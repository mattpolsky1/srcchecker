const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let totalCheckIns = 60;
let lastCheckInTime = 0;

const checkedInUsers = new Map();
const lastCheckInTimes = new Map();
const userData = []; // Use this array to store user check-in data

const publicPath = path.join(__dirname, 'Public');
setInterval(() => {
  checkForAutoCheckOut();
}, 1000);

function generateSessionId() {
  return uuidv4();
}

function checkForAutoCheckOut() {
  const currentTime = Date.now();

  for (const [socketId, lastCheckInTime] of lastCheckInTimes) {
    const timeSinceLastCheckIn = currentTime - lastCheckInTime;

    if (timeSinceLastCheckIn > 40000 && checkedInUsers.has(socketId)) {
      autoCheckOut(socketId);
    }
  }
}

function autoCheckOut(socketId) {
  checkedInUsers.delete(socketId);
  totalCheckIns--;
  io.emit('updateCount', totalCheckIns);

  // Emit an event to the client to toggle button visibility
  io.to(socketId).emit('autoCheckOut');

  // Additional logic for updating status and performing other tasks
}

app.use(express.static(publicPath));

app.get('/', (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  res.sendFile(indexPath);
});

app.post('/beacon', (req, res) => {
  console.log('Beacon received!');
  const { checkedIn } = req.body;
  if (checkedIn) {
    // Perform auto-checkout logic here
    console.log('Received beacon. Performing auto-checkout.');
    autoCheckOut();
  }
  res.sendStatus(200);
});

function updatePeopleCount() {
  const currentTime = Date.now();
  const currentTimeInET = new Date(currentTime - 5 * 60 * 60 * 1000);
  const resetTimeInET = new Date(currentTimeInET);
  resetTimeInET.setHours(20, 0, 0, 0);

  if (currentTimeInET >= resetTimeInET) {
    totalCheckIns = 0;
  }

  lastCheckInTime = currentTime;
}

io.on('connection', async (socket) => {
  try {
    const sessionId = generateSessionId();

    // Emit the session ID to the connected client
    socket.emit('initSession', sessionId);

    socket.emit('initCount', totalCheckIns);

    if (checkedInUsers.has(socket.id)) {
      socket.emit('alreadyCheckedIn');
    }

    socket.on('checkIn', async (userLocation) => {
      try {
        updatePeopleCount();

        if (checkedInUsers.has(socket.id)) {
          socket.emit('alreadyCheckedIn');
        } else {
          if (lastCheckInTimes.has(socket.id)) {
            const currentTime = Date.now();
            const lastCheckInTime = lastCheckInTimes.get(socket.id);
            const timeSinceLastCheckIn = currentTime - lastCheckInTime;

            if (timeSinceLastCheckIn < 30000) {
              socket.emit('checkInCooldown', 30000 - timeSinceLastCheckIn);
              return;
            }
          }

          if (userLocation && userLocation.latitude && userLocation.longitude) {
            const targetLocation = { latitude: 35.90927, longitude: -79.04746 };
            const distance = getDistance(userLocation, targetLocation);

            if (distance <= 10000) {
              checkedInUsers.set(socket.id, true);
              totalCheckIns++;
              io.emit('updateCount', totalCheckIns);

              lastCheckInTimes.set(socket.id, Date.now());

              // Store user check-in data in the array
              const checkInData = {
                socketId: socket.id,
                checkInTime: new Date(),
                userLocation: userLocation,
              };
              userData.push(checkInData);

              console.log('Check-in data stored in memory');
            } else {
              socket.emit('checkInNotAllowed');
            }
          } else {
            socket.emit('checkInNotAllowed');
          }
        }
      } catch (error) {
        console.error('Error handling check-in:', error);
      }
    });

    socket.on('checkOut', () => {
      const socketId = socket.id;

      // If the user has checked in before, remove them and decrement the count
      if (checkedInUsers.has(socketId)) {
        checkedInUsers.delete(socketId);
        totalCheckIns--;
        io.emit('updateCount', totalCheckIns);
      } else {
        // If the user has not checked in before (maybe due to page refresh), decrement the count anyway
        checkedInUsers.delete(socketId);
        totalCheckIns--;
        io.emit('updateCount', totalCheckIns);
      }

      // Remove the 'checkedOutAutomatically' flag from local storage
      socket.emit('removeCheckedOutAutomaticallyFlag');
    });

    socket.on('requestInitialCount', () => {
      socket.emit('initCount', totalCheckIns);
    });

    // Function to log daily check-ins (in-memory version)
    function logDailyCheckIns() {
      const currentDate = getCurrentDate();
      const dailyCheckIns = userData.filter(
        (entry) =>
          entry.checkInTime >= currentDate && entry.checkInTime < new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      );

      console.log('Number of check-ins today:', dailyCheckIns.length);
      io.emit('dailyCheckIns', { date: currentDate, count: dailyCheckIns.length });
    }

    // Function to log hourly check-ins (in-memory version)
    function logHourlyCheckIns() {
      const currentHour = getCurrentHour();
      if (currentHour >= 8 && currentHour <= 20) {
        const hourlyCheckIns = userData.filter(
          (entry) =>
            entry.checkInTime >= new Date().setHours(8, 0, 0) &&
            entry.checkInTime < new Date().setHours(21, 0, 0)
        );

        console.log('Number of check-ins this hour:', hourlyCheckIns.length);
        io.emit('hourlyCheckIns', { hour: currentHour, count: hourlyCheckIns.length });
      }
    }

    logDailyCheckIns();
    logHourlyCheckIns();
  } catch (error) {
    console.error('Error in socket connection:', error);
  }
});

function getCurrentDate() {
  const now = new Date();
  const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return currentDate;
}

function getCurrentHour() {
  return new Date().getHours();
}

function getDistance(location1, location2) {
  const R = 6371;
  const lat1 = location1.latitude;
  const lon1 = location1.longitude;
  const lat2 = location2.latitude;
  const lon2 = location2.longitude;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance * 1000;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const forceHttps = require('express-force-https');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let totalCheckIns = 60;
let checkedInUsersCount = 0;

const checkedInUsers = new Map();
const lastCheckInTimes = new Map();

const publicPath = path.join(__dirname, 'Public');
app.use(express.static(publicPath));
app.use(forceHttps);

app.get('/', (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    res.sendFile(indexPath);
});

function updatePeopleCount() {
    const currentTime = Date.now();
    const currentTimeInET = new Date(currentTime - 5 * 60 * 60 * 1000);
    const resetTimeInET = new Date(currentTimeInET);
    resetTimeInET.setHours(20, 0, 0, 0);

    if (currentTimeInET >= resetTimeInET) {
        totalCheckIns = 0;
        checkedInUsers.clear();
    }
}

io.on('connection', (socket) => {
    // Emit the current totalCheckIns count to the newly connected user
    socket.emit('updateCount', totalCheckIns);

    // Check if the user is already checked in based on their socket ID
    if (checkedInUsers.has(socket.id)) {
        socket.emit('alreadyCheckedIn');
    }

    // Request the user's check-in status from the server on connection
    socket.emit('requestCheckInStatus');

    // Event listener for when the server responds with the user's check-in status
    socket.on('responseCheckInStatus', (checkInStatus) => {
        if (checkInStatus === "checkedIn") {
            checkedInUsersCount++;
            checkedIn = true;
            toggleCheckInButton.classList.add("hidden"); // Hide the button
            updateStatus("Checked In");
            resumeTimer(); // Resume the timer if applicable
        }
    });

    socket.on('checkIn', (userLocation) => {
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
                    checkedInUsersCount++;
                    totalCheckIns = checkedInUsersCount;
                    io.emit('updateCount', totalCheckIns);

                    lastCheckInTimes.set(socket.id, Date.now());

                    setTimeout(() => {
                        if (checkedInUsers.get(socket.id)) {
                            checkedInUsers.delete(socket.id);
                            checkedInUsersCount--;
                            totalCheckIns = checkedInUsersCount;
                            io.emit('updateCount', totalCheckIns);
                            socket.emit('checkedOutAutomatically');
                            socket.emit('checkOut');
                        }
                    }, 30000);
                } else {
                    socket.emit('checkInNotAllowed');
                }
            } else {
                socket.emit('checkInNotAllowed');
            }
        }
    });

    socket.on('checkOut', () => {
        if (checkedInUsers.has(socket.id)) {
            checkedInUsers.delete(socket.id);
            checkedInUsersCount--;
            totalCheckIns = checkedInUsersCount;
            io.emit('updateCount', totalCheckIns);
        }
    });
});

function getDistance(location1, location2) {
    const R = 6371;
    const lat1 = location1.latitude;
    const lon1 = location1.longitude;
    const lat2 = location2.latitude;
    const lon2 = location2.longitude;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

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













































































































































const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let totalCheckIns = 60;
let lastCheckInTime = 0;

const checkedInUsers = new Map();
const lastCheckInTimes = new Map();

const publicPath = path.join(__dirname, 'Public');
app.use(express.static(publicPath));

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
    }

    lastCheckInTime = currentTime;
}

io.on('connection', async (socket) => {
    try {
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

                            // Additional logic for updating status and performing other tasks
                            updateStatusAndOtherTasks(socket.id);
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

        // Schedule auto-checkout function every second
        setInterval(() => {
            checkForAutoCheckOut(socket);
        }, 1000);

        function autoCheckOut(socket) {
            const socketId = socket.id;

            if (checkedInUsers.has(socketId)) {
                checkedInUsers.delete(socketId);
                totalCheckIns--;
                io.emit('updateCount', totalCheckIns);

                // Emit an event to the client to toggle button visibility
                socket.emit('autoCheckOut');

                // Additional logic for updating status and performing other tasks
                updateStatusAndOtherTasks(socketId);
            }
        }

        // Additional function for updating status and performing other tasks
        function updateStatusAndOtherTasks(socketId) {
            // Perform any additional tasks when auto-checkout occurs
            console.log(`User with socket ID ${socketId} auto-checked out.`);
            // Update status or perform other necessary actions
        }

        // Function to check for auto-checkout
function checkForAutoCheckOut() {
    const currentTime = Date.now();

    for (const [socketId, lastCheckInTime] of lastCheckInTimes) {
        const timeSinceLastCheckIn = currentTime - lastCheckInTime;

        if (timeSinceLastCheckIn > 30000 && checkedInUsers.has(socketId)) {
            autoCheckOut(socketId);
        }
    }
}

// Function for auto-checkout
function autoCheckOut(socketId) {
    checkedInUsers.delete(socketId);
    totalCheckIns--;
    io.emit('updateCount', totalCheckIns);

    // Emit an event to the client to toggle button visibility
    io.to(socketId).emit('autoCheckOut');

    // Additional logic for updating status and performing other tasks
    updateStatusAndOtherTasks(socketId);
}

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

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

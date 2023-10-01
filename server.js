const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let totalCheckIns = 0;
let lastCheckInTime = 0;

// Create a map to store checked-in users
const checkedInUsers = new Map();

// Create a map to store the last check-in time for each user
const lastCheckInTimes = new Map();

// Define the path to your static files directory
const publicPath = path.join(__dirname, 'Public');

// Serve static files from the "Public" directory
app.use(express.static(publicPath));

// Route handler for the root URL ("/")
app.get('/', (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    res.sendFile(indexPath);
});

// Function to update the people count and reset check-ins at 8 PM
function updatePeopleCount() {
    const currentTime = Date.now();

    // Get the current time in Eastern Time (UTC-5)
    const currentTimeInET = new Date(currentTime - 5 * 60 * 60 * 1000);

    // Define the reset time (8:00 PM in ET)
    const resetTimeInET = new Date(currentTimeInET);
    resetTimeInET.setHours(20, 0, 0, 0);

    // Define the check-in start time (8:00 AM in ET)
    const checkInStartTimeInET = new Date(currentTimeInET);
    checkInStartTimeInET.setHours(8, 0, 0, 0);

    if (currentTimeInET >= resetTimeInET) {
        // Reset the count at 8:00 PM ET
        totalCheckIns = 0;
        checkedInUsers.clear(); // Clear the checked-in users
        lastCheckInTimes.clear(); // Clear the last check-in times
        io.emit('checkedOutAutomatically'); // Notify all clients of automatic checkout
    }

    // Emit the check-in availability status to clients
    const isCheckInAllowed = currentTimeInET >= checkInStartTimeInET && currentTimeInET < resetTimeInET;
    io.emit('checkInAvailability', isCheckInAllowed);

    lastCheckInTime = currentTime;
}

io.on('connection', (socket) => {
    // Emit the current totalCheckIns count to the newly connected user
    socket.emit('updateCount', totalCheckIns);

    // Check if the user is already checked in based on their socket ID
    if (checkedInUsers.has(socket.id)) {
        socket.emit('alreadyCheckedIn');
    }

    socket.on('checkIn', (userLocation) => {
        updatePeopleCount();

        // Check if the user is already checked in
        if (checkedInUsers.has(socket.id)) {
            socket.emit('alreadyCheckedIn');
        } else {
            // Check if the user has a last check-in time recorded
            if (lastCheckInTimes.has(socket.id)) {
                const currentTime = Date.now();
                const lastCheckInTime = lastCheckInTimes.get(socket.id);
                const timeSinceLastCheckIn = currentTime - lastCheckInTime;

                // Check if the user is attempting to check in before the cooldown period (30 seconds) has passed
                if (timeSinceLastCheckIn < 30000) {
                    socket.emit('checkInCooldown', 30000 - timeSinceLastCheckIn);
                    return; // Exit the function, preventing the check-in
                }
            }

            // Check if geolocation data is available
            if (userLocation && userLocation.latitude && userLocation.longitude) {
                // Calculate the distance between user's location and the target location
                const targetLocation = { latitude: 35.90927, longitude: -79.04746 };
                const distance = getDistance(userLocation, targetLocation);

                // Check if the user is within 10 miles of the target location (3218.69 meters)
                if (distance <= 16093.45) {
                    // Mark the user as checked in, store their socket ID, and record the check-in time
                    checkedInUsers.set(socket.id, true);
                    totalCheckIns++;
                    io.emit('updateCount', totalCheckIns);

                    lastCheckInTimes.set(socket.id, Date.now()); // Record the check-in time

                    // Automatically check out the user after 30 seconds
                    setTimeout(() => {
                        if (checkedInUsers.get(socket.id)) {
                            checkedInUsers.delete(socket.id);
                            totalCheckIns--;
                            io.emit('updateCount', totalCheckIns);
                            socket.emit('checkedOutAutomatically');
                        }
                    }, 30000); // 30 seconds
                } else {
                    // Notify the client that check-in is not allowed
                    socket.emit('checkInNotAllowed');
                }
            } else {
                // Handle the case where geolocation data is not available
                socket.emit('checkInNotAllowed');
            }
        }
    });

    socket.on('checkOut', () => {
        // Check if the user is checked in and has a valid socket ID
        if (checkedInUsers.has(socket.id)) {
            checkedInUsers.delete(socket.id);
            totalCheckIns--;
            io.emit('updateCount', totalCheckIns);
        }
    });
});

// Haversine formula to calculate distance between two points on the Earth's surface
function getDistance(location1, location2) {
    const R = 6371; // Radius of the Earth in kilometers
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
    const distance = R * c; // Distance in kilometers

    return distance * 1000; // Convert to meters
}

// Function to convert degrees to radians
function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});





















const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const CHECKIN_COOLDOWN = 30000; // 30 seconds cooldown in milliseconds
const RESET_TIME_HOUR = 20; // 8:00 PM (24-hour format)

// Create a map to store checked-in users and their last check-in time
const checkedInUsers = new Map();

// Define the path to your static files directory
const publicPath = path.join(__dirname, 'Public');

// Serve static files from the "Public" directory
app.use(express.static(publicPath));

// Route handler for the root URL ("/")
app.get('/', (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    res.sendFile(indexPath);
});

// Function to reset check-ins at the specified hour
function resetCheckIns() {
    const now = new Date();
    if (now.getHours() === RESET_TIME_HOUR) {
        checkedInUsers.clear(); // Clear the checked-in users
        io.emit('checkedOutAutomatically'); // Notify all clients of automatic checkout
    }
}

setInterval(resetCheckIns, 60000); // Check every minute if it's time to reset

io.on('connection', (socket) => {
    socket.on('checkIn', (userLocation) => {
        // Check if geolocation data is available
        if (userLocation && userLocation.latitude && userLocation.longitude) {
            // Calculate the distance between user's location and the target location
            const targetLocation = { latitude: 35.90927, longitude: -79.04746 };
            const distance = getDistance(userLocation, targetLocation);

            // Check if the user is within 10 miles of the target location (3218.69 meters)
            if (distance <= 16093.45) {
                // Check if the user is already checked in
                if (!checkedInUsers.has(socket.id)) {
                    // Mark the user as checked in and store their last check-in time
                    checkedInUsers.set(socket.id, Date.now());

                    // Emit the check-in success to the client
                    socket.emit('checkInSuccess');

                    // Automatically check out the user after CHECKIN_COOLDOWN milliseconds
                    setTimeout(() => {
                        if (checkedInUsers.has(socket.id)) {
                            checkedInUsers.delete(socket.id);
                            socket.emit('checkedOutAutomatically');
                        }
                    }, CHECKIN_COOLDOWN);
                } else {
                    // User is already checked in
                    socket.emit('alreadyCheckedIn');
                }
            } else {
                // User is not within 10 miles of the specified location
                socket.emit('checkInNotAllowed');
            }
        } else {
            // Handle the case where geolocation data is not available
            socket.emit('checkInNotAllowed');
        }
    });

    socket.on('checkOut', () => {
        // Check if the user is checked in
        if (checkedInUsers.has(socket.id)) {
            checkedInUsers.delete(socket.id);
            socket.emit('checkedOut');
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





















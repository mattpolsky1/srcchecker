const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let totalCheckIns = 0;
let lastCheckInTime = 0;

// Define the path to your static files directory
const publicPath = path.join(__dirname, 'Public');

// Serve static files from the "Public" directory
app.use(express.static(publicPath));

// Route handler for the root URL ("/")
app.get('/', (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    res.sendFile(indexPath);
});

function updatePeopleCount() {
    const currentTime = Date.now();
    if (currentTime - lastCheckInTime >= 8 * 60 * 60 * 1000) {
        lastCheckInTime = currentTime;
        totalCheckIns = 0;
    }
}

io.on('connection', (socket) => {
    socket.emit('updateCount', totalCheckIns);

    socket.on('checkIn', (userLocation) => {
        updatePeopleCount();

        // Check if geolocation data is available
        if (userLocation && userLocation.latitude && userLocation.longitude) {
            // Calculate the distance between user's location and the target location
            const targetLocation = { latitude: 35.90927, longitude: -79.04746 };
            const distance = getDistance(userLocation, targetLocation);

            // Check if the user is within 2 miles of the target location (3218.69 meters)
            if (distance <= 3218.69) {
                totalCheckIns++;
                io.emit('updateCount', totalCheckIns);
            } else {
                // Notify the client that check-in is not allowed
                socket.emit('checkInNotAllowed');
            }
        } else {
            // Handle the case where geolocation data is not available
            socket.emit('checkInNotAllowed');
        }
    });

    socket.on('checkOut', () => {
        if (totalCheckIns > 0) {
            totalCheckIns--;
            io.emit('updateCount', totalCheckIns);
        }
    });
});

function getDistance(location1, location2) {
    // Haversine formula to calculate distance between two points on the Earth's surface
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

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});



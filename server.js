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

// Include your Google Maps API key here
const apiKey = 'AIzaSyBrWbBamD1cA1NL9Q3Mt1Izml4WwZlzncs'; // Replace with your actual API key

// Middleware to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers

    // Convert distance to miles
    return distance * 0.621371;
}

function updatePeopleCount() {
    const currentTime = Date.now();
    if (currentTime - lastCheckInTime >= 8 * 60 * 60 * 1000) {
        lastCheckInTime = currentTime;
        totalCheckIns = 0;
    }
}

// Target location coordinates (35.90927, -79.04746)
const targetLatitude = 35.90927;
const targetLongitude = -79.04746;

io.on('connection', (socket) => {
    socket.emit('updateCount', totalCheckIns);

    socket.on('checkIn', (data) => {
        const userLatitude = parseFloat(data.latitude);
        const userLongitude = parseFloat(data.longitude);

        // Calculate the distance between the user's location and the target location
        const distance = calculateDistance(
            userLatitude,
            userLongitude,
            targetLatitude,
            targetLongitude
        );

        // Check if the user is within 0.1 miles of the target location
        if (distance <= 0.1) {
            // Increment the count only if the check-in is successful
            updatePeopleCount();
            totalCheckIns++;
            io.emit('updateCount', totalCheckIns);
        } else {
            // Inform the user that they are not within 0.1 miles of the target location.
            socket.emit('checkInFailed', 'You are not within 0.1 miles of the specified location. Check-in not allowed.');
        }
    });

    socket.on('checkOut', () => {
        if (totalCheckIns > 0) {
            totalCheckIns--;
            io.emit('updateCount', totalCheckIns);
        }
    });
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

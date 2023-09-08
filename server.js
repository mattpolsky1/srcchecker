const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path'); // Import the 'path' module

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let totalCheckIns = 0;
let lastCheckInTime = 0;

// Define the path to your static files directory
const publicPath = path.join(__dirname, 'Public'); // Use 'Public' with a capital 'P'

// Serve static files from the "Public" directory
app.use(express.static(publicPath));

// Route handler for the root URL ("/")
app.get('/', (req, res) => {
    // Use path.join to ensure the correct path to 'index.html'
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

    socket.on('checkIn', () => {
        updatePeopleCount();
        totalCheckIns++; // Increase the total check-ins count
        io.emit('updateCount', totalCheckIns); // Broadcast the updated count to all clients
    });

    socket.on('disconnect', () => {
        // Handle disconnections if needed
    });
});

// Use the process.env.PORT variable provided by Heroku
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

updatePeopleCount(); // Initialize the lastCheckInTime and totalCheckIns

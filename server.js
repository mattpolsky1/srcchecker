const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let totalCheckIns = 0;
const checkInTimeout = 10 * 1000; // 10 seconds timeout for check-ins

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
    // Check if users are still checked in and automatically check them out
    const currentTime = Date.now();
    io.sockets.clients().forEach((socket) => {
        const checkInTime = socket.checkInTime || 0;
        if (currentTime - checkInTime >= checkInTimeout) {
            socket.checkInTime = 0; // Reset check-in time
            totalCheckIns--;
            io.emit('updateCount', totalCheckIns);
        }
    });
}

io.on('connection', (socket) => {
    socket.emit('updateCount', totalCheckIns);

    socket.on('checkIn', () => {
        totalCheckIns++;
        socket.checkInTime = Date.now(); // Store check-in time
        io.emit('updateCount', totalCheckIns);
    });

    socket.on('checkOut', () => {
        if (socket.checkInTime) {
            totalCheckIns--;
            io.emit('updateCount', totalCheckIns);
            socket.checkInTime = 0; // Reset check-in time
        }
    });

    socket.on('disconnect', () => {
        if (socket.checkInTime) {
            totalCheckIns--;
            io.emit('updateCount', totalCheckIns);
        }
    });
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

setInterval(updatePeopleCount, 1000); // Check for expired check

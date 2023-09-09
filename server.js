const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let totalCheckIns = 0;
let lastCheckInTime = 0;
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
    const currentTime = Date.now();
    io.sockets.clients().forEach((socket) => {
        const checkInTime = socket.checkInTime || 0;
        if (currentTime - checkInTime >= checkInTimeout && checkInTime !== 0) {
            socket.checkInTime = 0; // Reset check-in time
            totalCheckIns--;
        }
    });
    io.emit('updateCount', totalCheckIns); // Update the count for all clients
}

io.on('connection', (socket) => {
    socket.emit('updateCount', totalCheckIns);

    socket.on('checkIn', () => {
        updatePeopleCount();
        totalCheckIns++;
        socket.checkInTime = Date.now(); // Store check-in time
        io.emit('updateCount', totalCheckIns); // Update the count for all clients
    });

    socket.on('disconnect', () => {
        if (socket.checkInTime) {
            totalCheckIns--;
            socket.checkInTime = 0; // Reset check-in time
            io.emit('updateCount', totalCheckIns); // Update the count for all clients
        }
    });
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

setInterval(updatePeopleCount, 1000); // Check for expired check-ins every second

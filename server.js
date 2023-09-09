const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let totalCheckIns = 0;
let lastCheckInTime = 0;
let checkedIn = false; // Initially, the user is not checked in
const localStorageKey = "checkInStatus";

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
    if (currentTime - lastCheckInTime >= 10 * 1000) {
        if (checkedIn) {
            checkedIn = false;
            localStorage.removeItem(localStorageKey);
            totalCheckIns--;
            io.emit('updateCount', totalCheckIns);
        }
    }
}

io.on('connection', (socket) => {
    socket.emit('updateCount', totalCheckIns);

    socket.on('checkIn', () => {
        updatePeopleCount();
        if (!checkedIn) {
            checkedIn = true;
            localStorage.setItem(localStorageKey, "checkedIn");
            lastCheckInTime = Date.now(); // Store check-in time
            totalCheckIns++;
            io.emit('updateCount', totalCheckIns);
        }
    });

    socket.on('checkOut', () => {
        if (checkedIn) {
            checkedIn = false;
            localStorage.removeItem(localStorageKey);
            totalCheckIns--;
            io.emit('updateCount', totalCheckIns);
        }
    });

    socket.on('disconnect', () => {
        updatePeopleCount();
    });
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

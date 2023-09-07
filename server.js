const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path'); // Import the 'path' module

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let peopleAtGymCount = 0;
let lastCheckInTime = 0;

// Define the path to your static files directory
const publicPath = path.join(__dirname, 'public');

// Serve static files from the "public" directory
app.use(express.static(publicPath));

// Route handler for the root URL ("/")
app.get('/', (req, res) => {
    // Use path.join to ensure correct path to 'index.html'
    res.sendFile(path.join(publicPath, 'index.html'));
});

function updatePeopleCount() {
    const currentTime = Date.now();
    if (currentTime - lastCheckInTime >= 8 * 60 * 60 * 1000) {
        lastCheckInTime = currentTime;
        peopleAtGymCount = 0;
    }
}

io.on('connection', (socket) => {
    socket.emit('updateCount', peopleAtGymCount);

    socket.on('checkIn', () => {
        updatePeopleCount();
        if (peopleAtGymCount === 0) {
            peopleAtGymCount++;
            io.emit('updateCount', peopleAtGymCount);
        }
    });

    socket.on('checkOut', () => {
        if (peopleAtGymCount > 0) {
            peopleAtGymCount--;
            io.emit('updateCount', peopleAtGymCount);
        }
    });
});

// Use the process.env.PORT variable provided by Heroku
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


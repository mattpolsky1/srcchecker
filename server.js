const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let peopleAtGymCount = 0;
let lastCheckInTime = 0;

app.use(express.static(__dirname + '/public'));

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

server.listen(8080, () => {
    console.log('Server is running on port 8080');
});

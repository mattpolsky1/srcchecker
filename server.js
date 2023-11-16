const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://mattpolsky:Manning01!@cluster0.ev0u1hj.mongodb.net/CampusHoops?retryWrites=true&w=majority";

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server (optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        await client.close();
    }
}
run().catch(console.dir);

// Require the express-force-https middleware
const forceHttps = require('express-force-https');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let totalCheckIns = 60;
let lastCheckInTime = 0;

// Create a map to store checked-in users
const checkedInUsers = new Map();

// Create a map to store the last check-in time for each user
const lastCheckInTimes = new Map();

// Define the path to your static files directory
const publicPath = path.join(__dirname, 'Public');

// Serve static files from the "Public" directory
app.use(express.static(publicPath));

// Add the forceHttps middleware before other route handlers
app.use(forceHttps);

// Route handler for the root URL ("/")
app.get('/', (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    res.sendFile(indexPath);
});

function updatePeopleCount() {
    const currentTime = Date.now();

    // Get the current time in Eastern Time (UTC-5)
    const currentTimeInET = new Date(currentTime - 5 * 60 * 60 * 1000);

    // Define the reset time (8:00 PM in ET)
    const resetTimeInET = new Date(currentTimeInET);
    resetTimeInET.setHours(20, 0, 0, 0);

    if (currentTimeInET >= resetTimeInET) {
        // Reset the count at 8:00 PM ET
        totalCheckIns = 0;
    }

    lastCheckInTime = currentTime;
}

io.on('connection', async (socket) => {
    try {
        // Emit the current totalCheckIns count to the newly connected user
        socket.emit('updateCount', totalCheckIns);

        // Check if the user is already checked in based on their socket ID
        if (checkedInUsers.has(socket.id)) {
            socket.emit('alreadyCheckedIn');
        }

        socket.on('checkIn', async (userLocation) => {
            try {
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
                        // Calculate the distance between the user's location and the target location
                        const targetLocation = { latitude: 35.90927, longitude: -79.04746 };
                        const distance = getDistance(userLocation, targetLocation);

                        // Check if the user is within 10 miles of the target location (3218.69 meters)
                        if (distance <= 10000) {
                            // Mark the user as checked in, store their socket ID, and record the check-in time
                            checkedInUsers.set(socket.id, true);
                            totalCheckIns++;
                            io.emit('updateCount', totalCheckIns);

                            lastCheckInTimes.set(socket.id, Date.now()); // Record the check-in time

                            // Insert check-in data into MongoDB
                            const db = client.db('CampusHoops');
                            const collection = db.collection('Data');

                            const checkInData = {
                                socketId: socket.id,
                                checkInTime: new Date(),
                                userLocation: userLocation
                            };

                            try {
                                await collection.insertOne(checkInData);
                                console.log('Check-in data inserted into MongoDB');
                            } catch (error) {
                                console.error('Error inserting check-in data into MongoDB:', error);
                            }
                        } else {
                            // Notify the client that check-in is not allowed
                            socket.emit('checkInNotAllowed');
                        }
                    } else {
                        // Handle the case where geolocation data is not available
                        socket.emit('checkInNotAllowed');
                    }
                }
            } catch (error) {
                console.error('Error handling check-in:', error);
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
    } catch (error) {
        console.error('Error in socket connection:', error);
    }
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

// Function to retrieve and log the number of check-ins for the current day
async function logDailyCheckIns() {
    try {
        const db = client.db('CampusHoops');
        const collection = db.collection('Data');

        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0); // Set to the beginning of the current day

        const nextDate = new Date(currentDate);
        nextDate.setDate(nextDate.getDate() + 1); // Set to the beginning of the next day

        const dailyCheckIns = await collection.find({
            checkInTime: {
                $gte: currentDate,
                $lt: nextDate
            }
        }).toArray();

        console.log('Number of check-ins today:', dailyCheckIns.length);
    } catch (error) {
        console.error('Error logging daily check-ins:', error);
    }
}

// Call the function to log daily check-ins
logDailyCheckIns();

// Start the server
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

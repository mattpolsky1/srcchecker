const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://mattpolsky:Manning01!@cluster0.ev0u1hj.mongodb.net/?retryWrites=true&w=majority";
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("CampusHoops").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
}
run().catch(console.dir);


const app = express();
const server = http.createServer(app);
const io = socketIO(server);

let totalCheckIns = 60;
let lastCheckInTime = 0;

const checkedInUsers = new Map();
const lastCheckInTimes = new Map();

const publicPath = path.join(__dirname, 'Public');
app.use(express.static(publicPath));

app.get('/', (req, res) => {
    const indexPath = path.join(publicPath, 'index.html');
    res.sendFile(indexPath);
});

function updatePeopleCount() {
    const currentTime = Date.now();
    const currentTimeInET = new Date(currentTime - 5 * 60 * 60 * 1000);
    const resetTimeInET = new Date(currentTimeInET);
    resetTimeInET.setHours(20, 0, 0, 0);

    if (currentTimeInET >= resetTimeInET) {
        totalCheckIns = 0;
    }

    lastCheckInTime = currentTime;
}

io.on('connection', async (socket) => {
    try {
        socket.emit('updateCount', totalCheckIns);

        if (checkedInUsers.has(socket.id)) {
            socket.emit('alreadyCheckedIn');
        }

        socket.on('checkIn', async (userLocation) => {
            try {
                updatePeopleCount();

                if (checkedInUsers.has(socket.id)) {
                    socket.emit('alreadyCheckedIn');
                } else {
                    if (lastCheckInTimes.has(socket.id)) {
                        const currentTime = Date.now();
                        const lastCheckInTime = lastCheckInTimes.get(socket.id);
                        const timeSinceLastCheckIn = currentTime - lastCheckInTime;

                        if (timeSinceLastCheckIn < 30000) {
                            socket.emit('checkInCooldown', 30000 - timeSinceLastCheckIn);
                            return;
                        }
                    }

                    if (userLocation && userLocation.latitude && userLocation.longitude) {
                        const targetLocation = { latitude: 35.90927, longitude: -79.04746 };
                        const distance = getDistance(userLocation, targetLocation);

                        if (distance <= 10000) {
                            checkedInUsers.set(socket.id, true);
                            totalCheckIns++;
                            io.emit('updateCount', totalCheckIns);

                            lastCheckInTimes.set(socket.id, Date.now());

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
                            socket.emit('checkInNotAllowed');
                        }
                    } else {
                        socket.emit('checkInNotAllowed');
                    }
                }
            } catch (error) {
                console.error('Error handling check-in:', error);
            }
        });

        socket.on('checkOut', () => {
            if (checkedInUsers.has(socket.id)) {
                checkedInUsers.delete(socket.id);
                totalCheckIns--;
                io.emit('updateCount', totalCheckIns);
            }
        });

        // Function to log daily check-ins
        async function logDailyCheckIns() {
            try {
                const db = client.db('CampusHoops');
                const collection = db.collection('Data');

                const currentDate = getCurrentDate();

                const dailyCheckIns = await collection.find({
                    checkInTime: {
                        $gte: currentDate,
                        $lt: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
                    }
                }).toArray();

                dailyCheckInsCount = dailyCheckIns.length; // Update daily check-in count

                console.log('Number of check-ins today:', dailyCheckInsCount);
                io.emit('dailyCheckIns', { date: currentDate, count: dailyCheckInsCount });
            } catch (error) {
                console.error('Error logging daily check-ins:', error);
            }
        }

        // Function to log hourly check-ins (from 8:00 AM to 8:00 PM)
        async function logHourlyCheckIns() {
            try {
                const db = client.db('CampusHoops');
                const collection = db.collection('Data');

                const currentHour = getCurrentHour();

                if (currentHour >= 8 && currentHour <= 20) {
                    const hourlyCheckIns = await collection.find({
                        checkInTime: {
                            $gte: new Date().setHours(8, 0, 0),
                            $lt: new Date().setHours(21, 0, 0)
                        }
                    }).toArray();

                    hourlyCheckInsCount = hourlyCheckIns.length; // Update hourly check-in count

                    console.log('Hourly check-ins data:', hourlyCheckIns); // Add this line

                    io.emit('hourlyCheckIns', { hour: currentHour, count: hourlyCheckInsCount });
                }
            } catch (error) {
                console.error('Error logging hourly check-ins:', error);
            }
        }

        // Call the function to log daily check-ins
        await logDailyCheckIns();

        // Call the function to log hourly check-ins
        await logHourlyCheckIns();
    } catch (error) {
        console.error('Error in socket connection:', error);
    }
});

function getCurrentDate() {
    const now = new Date();
    const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return currentDate;
}

function getCurrentHour() {
    return new Date().getHours();
}

function getDistance(location1, location2) {
    const R = 6371;
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
    const distance = R * c;

    return distance * 1000;
}

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

const PORT = process.env.PORT || 1505;

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
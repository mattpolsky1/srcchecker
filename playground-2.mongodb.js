// Assuming your collection is named 'CheckIns'
use('CampusHoops');

// Count check-ins per day
const currentDate = new Date();
const dailyCheckIns = db.getCollection('Data').aggregate([
  {
    $match: {
      checkInTime: {
        $gte: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()),
        $lt: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1)
      }
    }
  },
  {
    $group: {
      _id: {
        year: { $year: '$checkInTime' },
        month: { $month: '$checkInTime' },
        day: { $dayOfMonth: '$checkInTime' }
      },
      count: { $sum: 1 }
    }
  },
  {
    $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
  }
]).toArray();

// Print daily check-ins
print('Daily Check-ins:');
dailyCheckIns.forEach(doc => {
  print(`${doc._id.year}-${doc._id.month}-${doc._id.day}: ${doc.count} check-ins`);
});

// Count check-ins per hour
const hourlyCheckIns = db.getCollection('Data').aggregate([
  {
    $group: {
      _id: {
        year: { $year: '$checkInTime' },
        month: { $month: '$checkInTime' },
        day: { $dayOfMonth: '$checkInTime' },
        hour: { $hour: '$checkInTime' }
      },
      count: { $sum: 1 }
    }
  },
  {
    $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 }
  }
]);

// Print hourly check-ins
print('\nHourly Check-ins:');
while (hourlyCheckIns.hasNext()) {
  const doc = hourlyCheckIns.next();
  print(`${doc._id.year}-${doc._id.month}-${doc._id.day} ${doc._id.hour}:00-${doc._id.hour + 1}:00: ${doc.count} check-ins`);
}

// Assuming your collection is named 'CheckIns'
use('CampusHoops');

// Count check-ins per day
const dailyCheckIns = db.getCollection('Data').aggregate([
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
]);

// Print daily check-ins
print('Daily Check-ins:');
while (dailyCheckIns.hasNext()) {
  const doc = dailyCheckIns.next();
  print(`${doc._id.year}-${doc._id.month}-${doc._id.day}: ${doc.count} check-ins`);
}

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



// Count check-ins per day for the last week
const currentDate = new Date();
const lastWeekStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 6); // Last 7 days

const dailyCheckIns = db.getCollection('Data').aggregate([
  {
    $match: {
      checkInTime: {
        $gte: lastWeekStartDate,
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
print('Daily Check-ins for the Last Week:');
dailyCheckIns.forEach(doc => {
  print(`${doc._id.year}-${doc._id.month}-${doc._id.day}: ${doc.count} check-ins`);
});

// Count check-ins per hour for the last week
const hourlyCheckIns = db.getCollection('Data').aggregate([
  {
    $match: {
      checkInTime: {
        $gte: lastWeekStartDate,
        $lt: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1)
      }
    }
  },
  {
    $group: {
      _id: {
        hour: { $hour: '$checkInTime' }
      },
      count: { $sum: 1 }
    }
  },
  {
    $sort: { '_id.hour': 1 }
  }
]).toArray();

// Print hourly check-ins
print('\nHourly Check-ins for the Last Week:');
hourlyCheckIns.forEach(doc => {
  print(`${doc._id.hour}:00-${doc._id.hour + 1}:00: ${doc.count} check-ins`);
});



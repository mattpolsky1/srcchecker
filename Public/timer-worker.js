let timer;
let checkedIn = false;

self.addEventListener('message', (event) => {
  if (event.data.type === 'start') {
    checkedIn = event.data.checkedIn;
    timer = setInterval(() => {
      // Notify the main page to update the timer
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'tick' }));
      });
    }, 1000);
  } else if (event.data.type === 'stop') {
    clearInterval(timer);
  }
});

// Listen for the sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'autoCheckOut') {
    event.waitUntil(autoCheckOut());
  }
});

function autoCheckOut() {

    if (checkedIn) {
        checkedIn = false;
        updateStatus("Checked Out");
        toggleButtonVisibility(); // Show the button
        Cookies.remove(cookieKey);
        Cookies.remove('checkInTimestamp');
        socket.emit('checkOut');
        Cookies.set('checkedOutAutomatically', 'true');
    }
  return new Promise(resolve => {
    setTimeout(() => {
      // Notify the main page about the checkout
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'autoCheckOut' }));
      });

      resolve();
    }, 10000); // 10 seconds
  });
}

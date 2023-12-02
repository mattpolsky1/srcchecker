let checkedIn = false;

self.addEventListener('install', event => {
  // Set checkedIn to false when the service worker is installed
  checkedIn = false;

  event.waitUntil(
    caches.open('your-cache-name').then(cache => {
      return cache.addAll([
        '/',
        '/index.html',
        // Add other files you want to cache
      ]);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('sync', (event) => {
    if (event.tag === 'autoCheckOut') {
      event.waitUntil(autoCheckOut());
    }
  });

function autoCheckOut() {
    // Add your auto checkout logic here
    if (checkedIn) {
      checkedIn = false;
      updateStatus("Checked Out");
      toggleButtonVisibility(); // Show the button
      Cookies.remove(cookieKey);
      Cookies.remove('checkInTimestamp');
      socket.emit('checkOut');
      Cookies.set('checkedOutAutomatically', 'true');
      return new Promise(resolve => {
        setTimeout(() => {
          // Perform actions when sync event is triggered
          console.log('Auto checkout performed');
          resolve();
        }, 10000); // 10 seconds
      });
    } else {
      // User is already checked out, no need to auto-checkout
      return Promise.resolve();
    }
  } 
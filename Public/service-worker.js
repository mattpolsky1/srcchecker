self.addEventListener('install', event => {
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
            // If the requested resource is found in the cache, return it
            if (response) {
                return response;
            }

            // If the requested resource is not found in the cache, fetch it from the network
            return fetch(event.request).then(networkResponse => {
                // Check if the network request was successful
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                // If the network request was successful, add the resource to the cache
                const clonedResponse = networkResponse.clone();
                caches.open('your-cache-name').then(cache => {
                    cache.put(event.request, clonedResponse);
                });

                return networkResponse;
            });
        })
    );
});

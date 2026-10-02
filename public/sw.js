// Service Worker Self-Clearing & Cache Buster
// Unregisters legacy caches to ensure browser always loads fresh deployment bundles from Render.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(cacheNames.map((name) => caches.delete(name)));
    }).then(() => self.clients.claim()).then(() => {
      return self.registration.unregister();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Pass through all fetch requests directly to network without caching
  return;
});

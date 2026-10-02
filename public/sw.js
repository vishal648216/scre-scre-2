// PWA Service Worker - Network Only (No Asset Caching)
// Preserves PWA installability while fetching 100% live assets directly from network/Render CDN.

const CACHE_NAME = 'scre-pwa-v3-network-only';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          return caches.delete(name);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Always fetch directly from network without caching static JS/CSS/HTML assets
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).catch((err) => {
      if (event.request.url.includes('/api/')) {
        return new Response(
          JSON.stringify({ offline: true, message: 'You are currently offline.' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      }
      return Promise.reject(err);
    })
  );
});

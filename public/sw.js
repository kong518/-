self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // PWA require a fetch handler to be present
  event.respondWith(fetch(event.request).catch(() => {
    return caches.match(event.request);
  }));
});

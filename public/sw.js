importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

workbox.setConfig({ debug: false });

const { registerRoute } = workbox.routing;
const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { BackgroundSyncPlugin } = workbox.backgroundSync;

// 1. App shell — Cache First (instant load, offline-ready)
// Network First during development — always fetches fresh code
// Switch back to CacheFirst before final deployment
registerRoute(
  ({ request }) => request.destination === 'document' ||
                   request.destination === 'script' ||
                   request.destination === 'style',
  new NetworkFirst({
    cacheName: 'app-shell-v1',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 })
    ]
  })
);
// 2. Locale files — Stale While Revalidate (fast load, auto-update)
registerRoute(
  ({ url }) => url.pathname.startsWith('/locales/'),
  new StaleWhileRevalidate({
    cacheName: 'locales-v1',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 })
    ]
  })
);

// 3. API data — Network First (fresh data when online, cached when offline)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-data-v1',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 })
    ]
  })
);

// 4. Audio files — Cache First (large files, rarely change)
registerRoute(
  ({ url }) => url.pathname.startsWith('/audio/'),
  new CacheFirst({
    cacheName: 'audio-v1',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 90 * 24 * 60 * 60 })
    ]
  })
);

// 5. Background Sync for user actions (e.g., "applied" markers)
const bgSyncPlugin = new BackgroundSyncPlugin('sync-queue', {
  maxRetentionTime: 24 * 60 // Retry for 24 hours
});

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/user-action'),
  new NetworkFirst({ plugins: [bgSyncPlugin] }),
  'POST'
);

// Precache the app shell on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('app-shell-v1').then((cache) => {
      return cache.addAll(['/', '/index.html', '/css/style.css', '/js/app.js']);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
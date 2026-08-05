// Always fetch fresh network assets for instant live updates
const CACHE_NAME = 'seiltanzer-3d-v90000';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './js/game.js?v=90000',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
});

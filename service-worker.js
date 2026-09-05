// v2: network-first for app files. The old v1 cache-first strategy meant
// that once a phone had cached the app, pushing fixed files to GitHub would
// silently NOT reach that phone until the service-worker.js bytes themselves
// changed. Network-first fixes that: online, you always get the latest
// files; offline, it falls back to whatever was last cached.
const CACHE_NAME = 'boq-tracker-v5';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/db.js',
  './js/xlsx-io.js',
  './js/app.js',
  './js/cloud-sync.js',
  './js/firebase-config.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        const respClone = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, respClone));
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});

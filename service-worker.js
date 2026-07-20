const CACHE_NAME = 'uno-tracker-v6.1.0';
const RUNTIME_CACHE = 'uno-tracker-runtime-v6.1';
const ASSETS = [
  './', './index.html', './styles.css', './app.js', './manifest.json',
  './live-sync.js', './v5-features.js', './firebase-config.js', './CHANGELOG.md', './CURRENT-STATE-v5.1.md', './ROADMAP.md', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('uno-tracker-') && ![CACHE_NAME, RUNTIME_CACHE].includes(key)).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => { caches.open(CACHE_NAME).then(cache => cache.put('./index.html', response.clone())); return response; }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        } else if (response.ok || response.type === 'opaque') {
          caches.open(RUNTIME_CACHE).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      });
      return cached || network;
    })
  );
});

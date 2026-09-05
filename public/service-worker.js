const CACHE_NAME = 'dreamlove-v15';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/app.html',
  '/profile.html',
  '/css/styles.css',
  '/js/api.js',
  '/js/lastseen.js',
  '/js/countries.js',
  '/js/numberInputFix.js',
  '/js/interests.js',
  '/js/camera.js',
  '/js/auth.js',
  '/js/notifications.js',
  '/js/emojiList.js',
  '/js/app.js',
  '/js/matches.js',
  '/js/chat.js',
  '/js/profile.js',
  '/js/sw-register.js',
  '/img/default-avatar.svg',
  '/img/logo-white.png',
  '/img/logo-red.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
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
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

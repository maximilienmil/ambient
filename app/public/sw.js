// Service worker: cache the shell, never cache the ledger.
//
// Network first for everything it does cache, so a changed file is picked up on
// the next load and the offline copy is only a fallback. /api/ is never read
// from or written to the cache — the ledger is local data that must not go
// stale behind the user's back.

const CACHE = 'latent-shell-v1';
const SHELL = [
  '/',
  '/tokens.css',
  '/style.css',
  '/app.js',
  '/twin.js',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/fonts/fonetika-400.woff2',
  '/fonts/fonetika-500.woff2',
  '/fonts/fonetika-600.woff2',
  '/fonts/fonetika-700.woff2',
  '/fonts/fonetika-800.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('/'))),
  );
});

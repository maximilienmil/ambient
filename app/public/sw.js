// Retire legacy shell caches; no API or navigation response is cached.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('latent-shell-')) await caches.delete(key);
  await self.registration.unregister();
  await self.clients.claim();
})()));

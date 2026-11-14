/* Service worker: keeps the app and tests available offline.
   Bump VERSION whenever you change app files so phones pick up the new version. */
const VERSION = 'v1';
const CACHE = `selective-prep-${VERSION}`;
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './tests/index.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_SHELL);
    // Pre-cache every test listed in the index so all tests work offline.
    try {
      const res = await fetch('./tests/index.json', { cache: 'no-cache' });
      const idx = await res.json();
      await cache.addAll((idx.tests || []).map((t) => `./tests/${t.file}`));
    } catch (e) { /* offline during install: tests get cached on first use */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('selective-prep-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isData = new URL(req.url).pathname.includes('/tests/');
  if (isData) {
    // Tests: try the network first so new tests show up, fall back to the cache offline.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(req, { cache: 'no-cache' });
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        throw e;
      }
    })());
    return;
  }
  // App files: cache first, then network.
  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  })());
});

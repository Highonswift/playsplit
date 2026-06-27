// PlaySplit service worker — offline app shell (PRD §24).
// Network-first for navigations (so data stays fresh), cache-first for static
// assets, with an offline fallback page when the network is unavailable.

const CACHE = 'playsplit-v1';
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Navigations: network-first, fall back to the offline page.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Static assets: cache-first, then network (and cache it).
  const url = new URL(request.url);
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
  }
});

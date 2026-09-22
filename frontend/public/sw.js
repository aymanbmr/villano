// Service worker: lets the caisse open and run even when the server is
// unreachable (the app's own data queue lives in src/offline.ts).
//
// Strategy per kind of request:
//   - navigation (the page itself): network first, fall back to the cached shell
//   - hashed build assets (/assets/*): cache first (their name changes on build)
//   - product photos (/uploads/*): cache first, refreshed in the background
//   - /api/*: never cached — the app handles offline itself
const VERSION = 'villano-v3';
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(['/', '/index.html', '/manifest.webmanifest'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Responses here are static files; `ignoreVary` keeps the lookup URL-based so
// a request sent with different headers still matches what we stored: module
// scripts are fetched in CORS mode (they send an Origin header) and the server
// answers with `Vary: Origin`, which would otherwise make the match miss.
const MATCH = { ignoreVary: true };

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request, MATCH);
  if (hit) {
    // Refresh in the background so a changed file is picked up next time
    fetch(request)
      .then((res) => res.ok && cache.put(request, res.clone()))
      .catch(() => {});
    return hit;
  }
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

// The page tells the worker which build assets it is using, so they are
// cached from the very first visit (before that, nothing has gone through
// the fetch handler yet).
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'PRECACHE' || !Array.isArray(event.data.urls)) return;
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      Promise.all(
        event.data.urls.map((url) =>
          cache.match(url).then((hit) => (hit ? null : cache.add(url).catch(() => null))),
        ),
      ),
    ),
  );
});

// respondWith must never reject, otherwise the browser reports a hard
// network error instead of using what we have.
async function serve(request, cacheName) {
  try {
    return await cacheFirst(request, cacheName);
  } catch {
    return (await caches.match(request, MATCH)) ?? Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // the app deals with this

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put('/index.html', copy));
          return res;
        })
        .catch(async () => (await caches.match('/index.html', MATCH)) ?? Response.error()),
    );
    return;
  }

  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/logo/')
  ) {
    event.respondWith(serve(request, SHELL));
    return;
  }

  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(serve(request, MEDIA));
  }
});

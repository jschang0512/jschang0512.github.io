// Service worker for the submission tracker: the app shell keeps opening on a poor connection.
// Pages are fetched from the network first; versioned files (?v=…), icons and the CDN libraries come from the cache.
// Requests to the database are never touched.
const CACHE = 'tracker-shell-1';
const SCOPE = new URL(self.registration.scope).pathname;
const CDN = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.indexOf('tracker-shell-') === 0 && k !== CACHE).map((k) => caches.delete(k)));
  await self.clients.claim();
})()));

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(SCOPE, res.clone());
    return res;
  } catch (e) {
    return (await cache.match(SCOPE)) || (await cache.match(req, { ignoreSearch: true })) || Response.error();
  }
}
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') {
    // an older version of the same file is dropped when a new one arrives
    const url = new URL(req.url);
    if (url.search) (await cache.keys()).forEach((k) => { const u = new URL(k.url); if (u.origin === url.origin && u.pathname === url.pathname && u.search !== url.search) cache.delete(k); });
    cache.put(req, res.clone());
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.indexOf(SCOPE) !== 0 || /\.(apk|json)$/.test(url.pathname) || url.pathname.endsWith('/sw.js')) return;
    if (req.mode === 'navigate' || url.pathname === SCOPE || url.pathname.endsWith('.html')) { e.respondWith(networkFirst(req)); return; }
    e.respondWith(cacheFirst(req));
  } else if (CDN.indexOf(url.hostname) >= 0) {
    e.respondWith(cacheFirst(req));
  }
});

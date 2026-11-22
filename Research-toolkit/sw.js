// Research Toolkit service worker: every tool keeps opening without a connection.
// Pages: network first, the cached copy when offline. Shared files, icons and CDN libraries: cache first
// (they carry a version in their URL). The submission tracker has its own worker and is left alone.
const CACHE = 'rt-2';
const BASE = new URL(self.registration.scope).pathname;          // /Research-toolkit/
const TOOLS = ['', 'prismaflow/', 'cohortflow/', 'timeline/', 'forestplot/', 'evalue/', 'effectsize/', 'dag/', 'sankey/', 'exposure/', 'panels/', 'rob2/', 'robinsi/', 'figureconvert/', 'drugs/', 'codelist/'];
// Taiwan drug data (drugs/, codelist/): meta.json is asked for fresh, the data files carry ?v=<content hash>
const DATA = 'raw.githubusercontent.com';
const CDN = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => e.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  // the pages themselves; their versioned scripts and styles are cached the first time they load
  await Promise.all(TOOLS.map((t) => cache.add(BASE + t).catch(() => {})));
  await self.skipWaiting();
})()));
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.indexOf('rt-') === 0 && k !== CACHE).map((k) => caches.delete(k)));
  await self.clients.claim();
})()));

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match(BASE)) || Response.error();
  }
}
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') {
    // a newer version of the same file replaces the older one
    const url = new URL(req.url);
    if (url.search && (url.origin === self.location.origin || url.hostname === DATA)) (await cache.keys()).forEach((k) => { const u = new URL(k.url); if (u.pathname === url.pathname && u.search !== url.search) cache.delete(k); });
    cache.put(req, res.clone());
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.indexOf(BASE) !== 0 || url.pathname.indexOf(BASE + 'submissions/') === 0 || url.pathname.endsWith('/sw.js')) return;
    if (url.pathname.indexOf(BASE + 'data/') === 0 && url.pathname.endsWith('/meta.json')) { e.respondWith(networkFirst(req)); return; }
    if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) { e.respondWith(networkFirst(req)); return; }
    e.respondWith(cacheFirst(req));
  } else if (url.hostname === DATA) {
    e.respondWith(url.pathname.endsWith('/meta.json') ? networkFirst(req) : cacheFirst(req));
  } else if (CDN.indexOf(url.hostname) >= 0) {
    e.respondWith(cacheFirst(req));
  }
});

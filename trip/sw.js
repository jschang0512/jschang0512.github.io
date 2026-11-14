/* ============================================================
   sw.js — keeps the trip pages usable without a connection (scope: /trip/).
   · pages, data and engine files: network first, the saved copy when offline
   · Leaflet, fonts: saved copy first (they are versioned and never change)
   · map tiles you have looked at: saved copy first, at most MAX_TILES kept
     (only tiles already viewed are stored — nothing is downloaded in advance)
   · weather, exchange rate, sunrise, quakes: network first, last answer offline
   Bump VERSION when the list below changes.
   ============================================================ */
const VERSION = "trip-v1";
const PAGES = `${VERSION}-pages`, STATIC = `${VERSION}-static`, TILES = "trip-tiles", API = "trip-api";
const MAX_TILES = 1500;
const CORE = [
  "./", "./index.html", "./sw.js",
  "./engine/trip.css", "./engine/modern.css", "./engine/trip-core.js", "./engine/icons.js", "./engine/trip.js",
  "./icons/favicon.svg", "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("trip-v") && !k.startsWith(VERSION)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const networkFirst = async (req, cacheName, timeout = 4000) => {
  const cache = await caches.open(cacheName);
  try {
    const res = await Promise.race([fetch(req), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeout))]);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
    if (hit) return hit;
    throw err;
  }
};
const cacheFirst = async (req, cacheName, trim) => {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  // CORS answers are stored when OK; opaque ones (no-CORS script and font links) only for the few static files
  if (res && (res.ok || (res.type === "opaque" && cacheName === STATIC))) {
    await cache.put(req, res.clone());
    if (trim) trimCache(cache, trim);
  }
  return res;
};
let trimming = false;
async function trimCache(cache, max) {
  if (trimming) return;
  trimming = true;
  try { const keys = await cache.keys(); for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]); }
  finally { trimming = false; }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (!url.pathname.startsWith(new URL("./", self.registration.scope).pathname)) return;
    e.respondWith(networkFirst(req, PAGES));
  } else if (/(^|\.)tile\.openstreetmap\.org$/.test(url.hostname)) {
    e.respondWith(cacheFirst(req, TILES, MAX_TILES));
  } else if (/^(unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) {
    e.respondWith(cacheFirst(req, STATIC));
  } else if (/open-meteo\.com|sunrise-sunset\.org|er-api\.com|currency-api\.pages\.dev|p2pquake\.net/.test(url.hostname)) {
    e.respondWith(networkFirst(req, API, 6000));
  }
});

// ============================================================
// Split Bill — service worker：快取 app 本身的檔案，讓手機可以
// 加到主畫面、離線時至少看得到上一次載入的畫面。
//
// 注意：Supabase 的 API 請求（跨網域）完全不經過這個快取，
// 帳務資料永遠直接打網路，不會被離線快取蓋掉變成舊資料。
// ============================================================

importScripts("version.js");
importScripts("notif-text.js");
// 兩個快取（2026-11 改）：
//   CACHE_NAME（每版一個）：頁面 HTML、圖示、manifest——換版就換新的一份。
//   ASSET_CACHE（跨版本一直留著）：帶 ?v=指紋 的 js / css。指紋是檔案內容算出來的
//     （scripts/stamp-assets.js），同一個網址的內容永遠不會變，所以換版時不用清掉；
//     沒改到的檔案網址不變，更新時就不必重抓。同一個檔案有了新指紋，舊的那份順手刪掉。
const CACHE_NAME = "splitbill-v" + APP_VERSION;
const ASSET_CACHE = "splitbill-assets";

const PAGES = [
  "index.html", "summary.html", "currency.html", "settings.html", "about.html", "privacy.html",
  "terms.html", "share-receipt.html", "recap.html", "recurring.html", "events.html"
];
const APP_SHELL = PAGES.concat(["manifest.json", "icon.svg", "icon-mono.svg", "icon-192.png", "icon-512.png"]);

// 指紋 = 內容 SHA-256 的前 10 碼（跟 scripts/stamp-assets.js 一樣）。
// 網址上是 10 碼十六進位才檢查；舊式的數字版本號（?v=972）沒得比，照收。
async function verifyHash(url, response){
  const v = new URL(url).searchParams.get("v") || "";
  if(!/^[0-9a-f]{10}$/.test(v)) return true;
  const buf = await response.clone().arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hex = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 10) === v;
}
// 抓一個帶指紋的檔案、確認內容對得上再放進快取，並刪掉同一個檔案的舊版本
async function fetchAndStoreAsset(request){
  const response = await fetch(request, { cache: "no-cache" });
  if(response && response.ok && await verifyHash(request.url || request, response)){
    const cache = await caches.open(ASSET_CACHE);
    const url = new URL(request.url || request);
    const keys = await cache.keys();
    await Promise.all(keys.filter(k => { const u = new URL(k.url); return u.pathname === url.pathname && u.search !== url.search; }).map(k => cache.delete(k)));
    await cache.put(request, response.clone());
  }
  return response;
}
// 安裝新版時：讀每一頁用到的 js / css，只下載手機上還沒有的（通常只有這版改到的幾個）
async function precacheAssets(){
  const shell = await caches.open(CACHE_NAME);
  const assets = await caches.open(ASSET_CACHE);
  const urls = new Set();
  for(const page of PAGES){
    const res = await shell.match(page);
    if(!res) continue;
    const html = await res.text();
    for(const m of html.matchAll(/(?:src|href)="([^":?#]+\.(?:js|css)\?v=[^"]+)"/g)) urls.add(new URL(m[1], self.registration.scope).href);
  }
  // 按需載入的檔案只先存小的、離線也用得到的；AI 拆單本來就要連網，節日場景平常用不到
  ["expense-form-shared.js", "release-notes.js"].forEach(name => {
    if(typeof SB_ASSET_V !== "undefined" && SB_ASSET_V[name]) urls.add(new URL(sbAsset(name), self.registration.scope).href);
  });
  await Promise.allSettled([...urls].map(async u => { if(!(await assets.match(u))) await fetchAndStoreAsset(new Request(u)); }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => precacheAssets().catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== ASSET_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 📤 分享目標（share_target，見 manifest.json）：手機相簿/相機把收據照片
// 分享進來時，作業系統會直接對這裡 POST 一個 multipart/form-data。靜態
// 網站沒有後端能接 POST，所以在 Service Worker 攔截這個請求、把檔案讀
// 出來存進 IndexedDB，再用 303 redirect 轉成一般 GET，讓瀏覽器正常導向
// share-receipt.html（那邊的頁面腳本會再轉去幣別頁）。跟 splitbillReadLangFromDB()
// 共用同一個 IndexedDB（splitbill-prefs / kv），多一個 key 而已，不用另開資料庫。
function splitbillStoreSharedFile(file){
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("splitbill-prefs", 1);
      req.onupgradeneeded = () => {
        if(!req.result.objectStoreNames.contains("kv")) req.result.createObjectStore("kv");
      };
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction("kv", "readwrite");
          tx.objectStore("kv").put(file, "sharedReceiptFile");
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch(e){ resolve(false); }
      };
      req.onerror = () => resolve(false);
    } catch(e){ resolve(false); }
  });
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if(req.method === "POST" && url.pathname.endsWith("/share-receipt.html")){
    event.respondWith((async () => {
      try {
        const formData = await req.formData();
        const file = formData.get("receipt");
        if(file) await splitbillStoreSharedFile(file);
      } catch(e){}
      return Response.redirect("./share-receipt.html?shared=1", 303);
    })());
    return;
  }

  // 只處理同網域的 GET 請求（app 自己的檔案），其他一律讓瀏覽器照正常方式處理
  if(req.method !== "GET" || url.origin !== self.location.origin){
    return;
  }

  // App 安裝檔（6 MB）交給瀏覽器直接下載，不經過快取
  if(url.pathname.toLowerCase().endsWith(".apk")) return;

  // 帶指紋的檔案（app.js?v=8322b8aff7）：網址對應的內容永遠不變，快取有就直接用，
  // 不用每次開頁都在背景再問伺服器一次；沒有才下載、核對指紋、存起來。
  const isVersioned = url.searchParams.has("v");
  const isHashed = isVersioned && /^[0-9a-f]{10}$/.test(url.searchParams.get("v"));
  if(isHashed){
    event.respondWith(caches.match(req, { cacheName: ASSET_CACHE }).then((hit) => hit || fetchAndStoreAsset(req).catch(() => caches.match(req))));
    return;
  }

  // 舊式數字版本號的檔案、圖示等靜態圖片：先回快取，背景再驗證一次
  const isStaticImage = /\.(png|svg|ico|webp|jpg|jpeg)$/i.test(url.pathname);
  if(isVersioned || isStaticImage){
    // 先回快取（快），同時在背景用 ETag 驗證一次並更新快取——萬一部署當下 CDN
    // 還給了舊內容，下一次開啟就會自動修正，不會卡在錯的版本。
    event.respondWith(caches.match(req).then((hit) => {
      const network = fetch(req, { cache: "no-cache" }).then((response) => {
        if(response && response.ok){
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      }).catch(() => hit);
      if(hit){ event.waitUntil(network); return hit; }
      return network;
    }));
    return;
  }

  // 頁面與其他沒帶版本號的檔案：先問網路（"no-cache" 會用 ETag 驗證，沒變就只回 304，
  // 很便宜），若網路超過 2.5 秒沒反應或離線，立即退回快取，避免畫面卡住乾等。
  const fetchWithTimeout = (request, timeoutMs = 2500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(request, { cache: "no-cache", signal: controller.signal })
      .finally(() => clearTimeout(timer));
  };

  event.respondWith(
    fetchWithTimeout(req, 2500)
      .then((response) => {
        if(response && response.ok){
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      })
      // 快取比對要忽略查詢字串：currency.html?c=TWD 這種網址快取裡沒有完全相同的項目，
      // 比不到會回空值，畫面就整片空白。真的沒有快取時再等一次網路，不要直接放棄。
      .catch(async () => (await caches.match(req, { ignoreSearch: true })) || fetch(req))
  );
});

// ============================================================
// Web Push：即使 app 沒開著，也能收到跟自己帳務有關的推播通知
//
// data.title 平常是後端（Supabase RPC/edge function）已經組好的通知
// 內容，這邊拿到什麼就顯示什麼，不會另外翻譯——Service Worker 沒有
// UI，沒辦法知道後端傳來的那句話是哪種語言寫的，硬翻反而可能翻錯。
// 這裡只處理「後端完全沒給 title」的極端情況下用的預設標題，這種
// 情況下才需要自己決定要用哪個語言顯示。
//
// Service Worker 是獨立的執行環境，碰不到分頁的 localStorage/i18n.js，
// 使用者目前選的語言是靠 i18n.js 的 syncLangToServiceWorker() 額外
// 寫進 IndexedDB 那份共用儲存空間，這裡讀出來用。
// ============================================================
const SW_FALLBACK_TITLES = {
  "zh-Hant": "帳務更動",
  "ja": "帳務の更新",
  "en": "Account Update"
};

function splitbillReadLangFromDB(){
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open("splitbill-prefs", 1);
      req.onupgradeneeded = () => {
        if(!req.result.objectStoreNames.contains("kv")) req.result.createObjectStore("kv");
      };
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction("kv", "readonly");
          const getReq = tx.objectStore("kv").get("lang");
          getReq.onsuccess = () => resolve(getReq.result || "zh-Hant");
          getReq.onerror = () => resolve("zh-Hant");
        } catch(e){ resolve("zh-Hant"); }
      };
      req.onerror = () => resolve("zh-Hant");
    } catch(e){ resolve("zh-Hant"); }
  });
}

// 後端（notify-push / send-reminder）2026-10 起會多帶 kind + params，文字交給 notif-text.js
// 依使用者語言組；沒帶的舊格式照 title/body 顯示。帶了 tag 的話，同一筆帳的新推播會取代舊的。
self.addEventListener("push", (event) => {
  let data = {};
  try{ data = event.data ? event.data.json() : {}; }catch(e){}

  event.waitUntil((async () => {
    const lang = await splitbillReadLangFromDB();
    const local = data.kind && data.params ? splitbillNotifText(data.kind, data.params, lang) : null;
    const title = (local && local.title) || data.title || SW_FALLBACK_TITLES[lang] || SW_FALLBACK_TITLES["zh-Hant"];
    const options = {
      body: (local && local.body) || data.body || "",
      icon: "icon.svg",
      badge: "icon.svg",
      data: { url: data.url || "./" }
    };
    if(data.tag){ options.tag = data.tag; options.renotify = true; }
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "./";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      for(const client of windowClients){
        if(client.url.includes(url) && "focus" in client) return client.focus();
      }
      if(clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ============================================================
// 動態回饋（2026-11）
// ============================================================
// 每個動畫都對應一個操作或狀態變化、只播一次，沒有循環。系統設定
// 「減少動態效果」時全部略過。純 CSS 做得到的（按壓、結清打勾、logo
// 組合、彈窗）在 shared.css；這裡只處理要知道「剛剛發生什麼」的：
//   1. 切換分頁：新分頁從點的那一側滑入
//   2. 剛存檔後新出現的那一列淡淡亮一下（只在自己剛寫入資料後）
//   3. 刪除時那一列先收合，再交給列表重畫（sbCollapseRows）
//   4. AI 拆單認領：剛點的頭像輕彈一下
//   5. 未讀數增加時，鈴鐺上的數字彈一下
// ============================================================
(function(){
  const reduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const calm = () => reduce.matches;
  const EASE = "cubic-bezier(.16, 1, .3, 1)";

  // 2 的前提：只有自己剛新增 / 修改支出或還款之後，新出現的列才算「新的」，
  // 切篩選、換分頁造成的列表變化不會亂亮。
  let lastWrite = 0;
  if(typeof window.fetch === "function"){
    const origFetch = window.fetch;
    window.fetch = function(input, init){
      try {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        const method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
        if(method !== "GET" && /\/rest\/v1\/(expenses|repayments)\b/.test(url)) lastWrite = Date.now();
      } catch(e){}
      return origFetch.apply(this, arguments);
    };
  }

  function watchPanels(){
    const panels = Array.from(document.querySelectorAll(".app-panel"));
    if(panels.length < 2) return;
    let current = panels.findIndex(p => p.classList.contains("active"));
    const mo = new MutationObserver(() => {
      const idx = panels.findIndex(p => p.classList.contains("active"));
      if(idx < 0 || idx === current) return;
      const dir = idx > current ? 1 : -1;
      current = idx;
      if(calm()) return;
      panels[idx].animate(
        [{ opacity: 0, transform: `translateX(${dir * 16}px)` }, { opacity: 1, transform: "none" }],
        { duration: 240, easing: EASE }
      );
    });
    panels.forEach(p => mo.observe(p, { attributes: true, attributeFilter: ["class"] }));
  }

  const ROW = ".exp-item[data-id], .ledger-row-wrap[data-id]";
  const seen = new Set();
  let lastBadge = null;
  function onDomChange(){
    const rows = document.querySelectorAll(ROW);
    const fresh = Date.now() - lastWrite < 8000;
    rows.forEach(r => {
      const key = (r.classList.contains("exp-item") ? "e:" : "l:") + r.dataset.id;
      if(seen.has(key)) return;
      seen.add(key);
      if(fresh && !calm()) r.classList.add("sb-row-new");
    });

    const badge = document.getElementById("notifBadge");
    if(badge){
      const n = badge.classList.contains("hidden") ? 0 : parseInt(badge.textContent, 10) || 0;
      if(lastBadge !== null && n > lastBadge && !calm()){
        badge.animate([{ transform: "scale(1)" }, { transform: "scale(1.35)" }, { transform: "scale(1)" }], { duration: 360, easing: EASE });
      }
      lastBadge = n;
    }
  }
  let pending = null;
  new MutationObserver(() => {
    if(pending) return;
    pending = setTimeout(() => { pending = null; onDomChange(); }, 40);
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });

  // 3：回傳 Promise，動畫播完才 resolve（刪除流程會一起等資料庫回應）
  window.sbCollapseRows = function(ids){
    if(calm()) return Promise.resolve();
    const els = new Set();
    (ids || []).forEach(id => {
      document.querySelectorAll(`[data-id="${CSS.escape(String(id))}"]`).forEach(el => {
        const row = el.closest(".exp-item, .ledger-row-wrap") || el;
        if(row.offsetHeight) els.add(row);
      });
    });
    const runs = Array.from(els).map(row => collapseEl(row, 220));
    return Promise.all(runs);
  };

  // 收合一個元素到高度 0。有些列的 padding 在手機版是 !important（動畫蓋不過），
  // 所以分兩步：先淡出，再把間距歸零、高度收到 0——淡出後才動間距，看不出跳動。
  async function collapseEl(el, duration){
    const h = el.offsetHeight;
    el.style.overflow = "hidden";
    try {
      await el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: Math.round(duration * 0.45), easing: "ease-out", fill: "forwards" }).finished;
      for(const p of ["padding-top", "padding-bottom", "margin-top", "margin-bottom", "border-top-width", "border-bottom-width", "min-height"]){
        el.style.setProperty(p, "0", "important");
      }
      await el.animate([{ height: h + "px", opacity: 0 }, { height: "0px", opacity: 0 }],
        { duration: Math.round(duration * 0.8), easing: "cubic-bezier(.65, 0, .35, 1)", fill: "forwards" }).finished;
    } catch(e){}
  }
  window.sbCollapseEl = (el) => (calm() ? Promise.resolve() : collapseEl(el, 200));

  // 4：認領頭像的點擊會整張重畫，所以先記下是哪一顆，重畫完再找回來彈一下
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest(".ai-avatar-bubble");
    if(!b || calm()) return;
    const item = b.dataset.itemId, member = b.dataset.memberId;
    setTimeout(() => {
      const nb = document.querySelector(`.ai-avatar-bubble[data-item-id="${CSS.escape(item)}"][data-member-id="${CSS.escape(member)}"]`);
      if(nb && nb.classList.contains("active")){
        nb.animate([{ transform: "scale(.82)" }, { transform: "scale(1.1)" }, { transform: "scale(1)" }], { duration: 280, easing: EASE });
      }
    }, 0);
  }, true);

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchPanels);
  else watchPanels();
})();

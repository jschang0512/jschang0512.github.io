// 節日主題：節日當天在 <html> 掛上 data-holiday，配色由 shared.css 底部的 token
// 覆寫，並載入頁首場景（holiday-scene.js）。節日前五天只在標題旁放倒數小標，
// 當天才完整呈現。放在 <head> 同步載入，第一次繪製就是節日配色，不會閃一下紫色。
//
// 開關存在 splitbill-holiday-off（設定頁「節日裝飾」）。網址加 ?holiday=christmas
// 可以預覽當天的樣子、?holiday=christmas-soon 預覽倒數（留在這個分頁的
// sessionStorage），?holiday=off 取消預覽。
(function holidayTheme(){
  const OFF_KEY = "splitbill-holiday-off";
  const PREVIEW_KEY = "splitbill-holiday-preview";
  const SOON_DAYS = 5;

  // 農曆節日用對照表：瀏覽器的 Intl 農曆在新月貼近午夜時會差一天
  // （例如 2027 春節），這幾個日期不能算錯。2035 之後要再補。
  const LUNAR_NEW_YEAR = ["2026-02-17","2027-02-06","2028-01-26","2029-02-13","2030-02-03","2031-01-23","2032-02-11","2033-01-31","2034-02-19","2035-02-08"];
  const DRAGON_BOAT = ["2026-06-19","2027-06-09","2028-05-28","2029-06-16","2030-06-05","2031-06-24","2032-06-12","2033-06-01","2034-06-20","2035-06-10"];
  const QIXI = ["2026-08-19","2027-08-08","2028-08-26","2029-08-16","2030-08-05","2031-08-24","2032-08-12","2033-08-01","2034-08-20","2035-08-10"];
  const MID_AUTUMN = ["2026-09-25","2027-09-15","2028-10-03","2029-09-22","2030-09-12","2031-10-01","2032-09-19","2033-09-08","2034-09-27","2035-09-16"];

  const pad = n => String(n).padStart(2, "0");
  const dayNumber = d => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const isoDayNumber = s => Math.round(Date.parse(s + "T00:00:00Z") / 86400000);
  // 從表上日期算起，第 start 天到第 end 天都算在節日內
  function nearTable(table, today, start, end){
    return table.some(s => {
      const diff = today - isoDayNumber(s);
      return diff >= start && diff <= end;
    });
  }

  function holidayOn(date){
    const today = dayNumber(date);
    const md = pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    if(nearTable(LUNAR_NEW_YEAR, today, -1, 5)) return "lunar";     // 除夕到初五
    if(nearTable(LUNAR_NEW_YEAR, today, 14, 14)) return "lantern";  // 正月十五
    if(nearTable(DRAGON_BOAT, today, 0, 0)) return "dragonboat";
    if(nearTable(QIXI, today, 0, 0)) return "qixi";
    if(nearTable(MID_AUTUMN, today, 0, 0)) return "midautumn";
    if(md === "12-31" || md === "01-01") return "newyear";
    if(md === "02-14") return "valentine";
    if(md === "10-31") return "halloween";
    if(md === "12-24" || md === "12-25") return "christmas";
    return null;
  }

  // 回傳 { id, days }：days 是 0 代表正在節日中，1～5 是還有幾天
  function holidayState(date){
    for(let days = 0; days <= SOON_DAYS; days++){
      const id = holidayOn(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
      if(id) return { id, days };
    }
    return null;
  }

  const KNOWN = ["newyear","lunar","lantern","valentine","dragonboat","qixi","midautumn","halloween","christmas"];
  function previewState(){
    try{
      const q = new URLSearchParams(location.search).get("holiday");
      if(q === "off") sessionStorage.removeItem(PREVIEW_KEY);
      else if(q && KNOWN.includes(q.replace(/-soon$/, ""))) sessionStorage.setItem(PREVIEW_KEY, q);
      const saved = sessionStorage.getItem(PREVIEW_KEY);
      if(!saved) return null;
      return saved.endsWith("-soon") ? { id: saved.replace(/-soon$/, ""), days: 3 } : { id: saved, days: 0 };
    }catch(e){ return null; }
  }
  function isOff(){
    try{ return localStorage.getItem(OFF_KEY) === "1"; }catch(e){ return false; }
  }

  let state = null;
  function apply(){
    state = previewState() || (isOff() ? null : holidayState(new Date()));
    if(state && state.days === 0) document.documentElement.setAttribute("data-holiday", state.id);
    else document.documentElement.removeAttribute("data-holiday");
  }

  window.splitbillHolidayState = holidayState;
  window.splitbillHolidayEnabled = () => !isOff();
  window.splitbillSetHolidayEnabled = (on) => {
    try{
      if(on) localStorage.removeItem(OFF_KEY);
      else localStorage.setItem(OFF_KEY, "1");
    }catch(e){}
    apply();
    syncDecor();
  };

  // 每個節日一個小圖，放在小標裡，手繪 SVG，不靠 emoji。
  const LANTERN_GLYPH = '<path d="M12 2v3" stroke="currentColor" stroke-width="1.6"/><rect x="8.5" y="4.5" width="7" height="2" rx=".6" fill="currentColor"/><ellipse cx="12" cy="12" rx="7.5" ry="5.8" fill="currentColor"/><rect x="8.5" y="17.2" width="7" height="2" rx=".6" fill="currentColor"/><path d="M12 19v3" stroke="currentColor" stroke-width="1.6"/>';
  const GLYPHS = {
    newyear: '<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" fill="currentColor"/>',
    lunar: LANTERN_GLYPH,
    lantern: '<path d="M3 12h18c0 5-4 9-9 9s-9-4-9-9z" fill="currentColor"/><circle cx="8.5" cy="8.5" r="3" fill="currentColor"/><circle cx="15.5" cy="8.5" r="3" fill="currentColor"/>',
    valentine: '<path d="M12 20.5S3.5 15.3 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6c0 6.1-8.5 11.3-8.5 11.3z" fill="currentColor"/>',
    dragonboat: '<path d="M12 3L21 19.5H3z" fill="currentColor"/>',
    qixi: '<path d="M7 3l1.4 4.6L13 9l-4.6 1.4L7 15l-1.4-4.6L1 9l4.6-1.4zM17 10l1.1 3.4 3.4 1.1-3.4 1.1L17 19l-1.1-3.4-3.4-1.1 3.4-1.1z" fill="currentColor"/>',
    midautumn: '<path d="M15.5 3.2a9 9 0 1 0 5.3 12.2A7.4 7.4 0 0 1 15.5 3.2z" fill="currentColor"/>',
    halloween: '<ellipse cx="12" cy="13.5" rx="9" ry="7.5" fill="currentColor"/><path d="M12 6c0-1.6.8-2.8 2.4-3.4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    christmas: '<path d="M12 2l5 7h-2.6l4 5.5h-3l4 5.5H4.6l4-5.5h-3l4-5.5H7z" fill="currentColor"/>'
  };
  const GLYPH_COLORS = { newyear:"#B8891F", lunar:"#C0272D", lantern:"#C2540A", valentine:"#D94C86", dragonboat:"#2F7D5B", qixi:"#6B4FBF", midautumn:"#C9962E", halloween:"#E06A12", christmas:"#1F7A4D" };
  const glyphSVG = (h, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${GLYPHS[h]}</svg>`;

  // 標題旁的小標：倒數期間每頁都有；節日當天只有沒有場景的頁面才放問候語
  function syncChip(){
    document.querySelectorAll(".sb-holiday-greet").forEach(el => el.remove());
    const row = document.querySelector(".title-row");
    if(!state || !row || typeof window.t !== "function") return;
    const hasScene = !!document.querySelector(".app-header > .header-utility-row");
    if(state.days === 0 && hasScene) return;
    const name = window.t("holiday.name." + state.id);
    const text = state.days === 0 ? window.t("holiday." + state.id)
      : state.days === 1 ? window.t("holiday.tomorrow", { name })
      : window.t("holiday.countdown", { name, n: state.days });
    const el = document.createElement("span");
    el.className = "sb-holiday-greet";
    el.innerHTML = glyphSVG(state.id, 14) + "<span></span>";
    el.firstElementChild.style.color = GLYPH_COLORS[state.id];
    el.lastElementChild.textContent = text;
    row.appendChild(el);
  }

  // 節日期間的常見花費：新增支出時點一下就帶入名稱和類別，倒數期間也有，
  // 因為多半是節日前就開始採買。
  const SPENDS = {
    newyear: [["countdownDinner","food"],["countdownEvent","ticket"]],
    lunar: [["redEnvelope","general"],["reunionDinner","food"],["newYearGoods","shopping"]],
    lantern: [["tangyuan","food"],["lanternShow","ticket"]],
    valentine: [["dateDinner","food"],["flowers","shopping"],["gift","shopping"]],
    dragonboat: [["zongzi","food"],["boatRace","ticket"]],
    qixi: [["dateDinner","food"],["gift","shopping"]],
    midautumn: [["barbecue","food"],["mooncake","food"],["pomelo","food"]],
    halloween: [["party","ticket"],["candy","food"],["costume","shopping"]],
    christmas: [["giftExchange","shopping"],["christmasDinner","food"],["cake","drink"]]
  };
  function syncSpends(){
    document.querySelectorAll(".sb-holiday-spends").forEach(el => el.remove());
    if(!state || typeof window.t !== "function") return;
    ["expDesc", "quickExpDesc"].forEach(id => {
      const input = document.getElementById(id);
      const select = document.getElementById(id === "expDesc" ? "expCategorySelect" : "quickExpCategorySelect");
      if(!input) return;
      const box = document.createElement("div");
      box.className = "sb-holiday-spends";
      SPENDS[state.id].forEach(([key, category]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = window.t("holiday.spend." + key);
        b.addEventListener("click", () => {
          input.value = b.textContent;
          input.dispatchEvent(new Event("input", { bubbles:true }));
          if(select){
            select.value = category;
            select.dispatchEvent(new Event("change", { bubbles:true }));
            if(typeof enhanceSelect === "function") enhanceSelect(select);
          }
        });
        box.appendChild(b);
      });
      input.insertAdjacentElement("afterend", box);
      // 已經打了字就收起來，不佔位置；表單清空後再點進去會回來
      const toggle = () => { box.hidden = !!input.value.trim(); };
      input.addEventListener("input", toggle);
      input.addEventListener("focus", toggle);
    });
  }

  // 場景插畫只有節日當天才需要，平常不下載
  function syncScene(){
    const h = state && state.days === 0 ? state.id : null;
    if(window.splitbillMountHolidayScene){ window.splitbillMountHolidayScene(h); return; }
    if(!h || document.body.classList.contains("rc-page")) return;
    const s = document.createElement("script");
    s.src = typeof sbAsset === "function" ? sbAsset("holiday-scene.js") : "holiday-scene.js";
    s.onload = () => window.splitbillMountHolidayScene(document.documentElement.getAttribute("data-holiday"));
    document.head.appendChild(s);
  }

  function syncDecor(){
    syncChip();
    syncSpends();
    syncScene();
    const meta = document.querySelector('meta[name="theme-color"]');
    if(meta && document.body && state && state.days === 0){
      const bg = getComputedStyle(document.body).backgroundColor;
      if(bg) meta.setAttribute("content", bg);
    }
  }

  apply();
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", syncDecor);
  else syncDecor();
  document.addEventListener("splitbill-lang-changed", syncDecor);
})();

// 節日主題：節日期間在 <html> 掛上 data-holiday，配色由 shared.css 底部的
// token 覆寫，這裡只負責判斷日期、問候小標跟開場的飄落動畫。放在 <head>
// 同步載入，第一次繪製就是節日配色，不會閃一下原本的紫色。
//
// 開關存在 splitbill-holiday-off（設定頁「節日裝飾」）。網址加
// ?holiday=christmas 可以預覽（留在這個分頁的 sessionStorage），?holiday=off 取消預覽。
(function holidayTheme(){
  const OFF_KEY = "splitbill-holiday-off";
  const PREVIEW_KEY = "splitbill-holiday-preview";

  // 農曆節日用對照表：瀏覽器的 Intl 農曆在新月貼近午夜時會差一天
  // （例如 2027 春節），這幾個日期不能算錯。2035 之後要再補。
  const LUNAR_NEW_YEAR = ["2026-02-17","2027-02-06","2028-01-26","2029-02-13","2030-02-03","2031-01-23","2032-02-11","2033-01-31","2034-02-19","2035-02-08"];
  const DRAGON_BOAT = ["2026-06-19","2027-06-09","2028-05-28","2029-06-16","2030-06-05","2031-06-24","2032-06-12","2033-06-01","2034-06-20","2035-06-10"];
  const MID_AUTUMN = ["2026-09-25","2027-09-15","2028-10-03","2029-09-22","2030-09-12","2031-10-01","2032-09-19","2033-09-08","2034-09-27","2035-09-16"];

  const pad = n => String(n).padStart(2, "0");
  const dayNumber = d => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const isoDayNumber = s => Math.round(Date.parse(s + "T00:00:00Z") / 86400000);
  function nearTable(table, today, before, after){
    return table.some(s => {
      const diff = today - isoDayNumber(s);
      return diff >= -before && diff <= after;
    });
  }

  function holidayFor(date){
    const today = dayNumber(date);
    const md = pad(date.getMonth() + 1) + "-" + pad(date.getDate());
    if(nearTable(LUNAR_NEW_YEAR, today, 1, 5)) return "lunar";   // 除夕到初五
    if(nearTable(DRAGON_BOAT, today, 2, 0)) return "dragonboat";
    if(nearTable(MID_AUTUMN, today, 2, 0)) return "midautumn";
    if(md === "12-31" || md <= "01-02") return "newyear";
    if(md === "02-13" || md === "02-14") return "valentine";
    if(md >= "10-29" && md <= "10-31") return "halloween";
    if(md >= "12-23" && md <= "12-26") return "christmas";
    return null;
  }

  const KNOWN = ["newyear","lunar","valentine","dragonboat","midautumn","halloween","christmas"];
  function previewHoliday(){
    try{
      const q = new URLSearchParams(location.search).get("holiday");
      if(q === "off") sessionStorage.removeItem(PREVIEW_KEY);
      else if(KNOWN.includes(q)) sessionStorage.setItem(PREVIEW_KEY, q);
      return sessionStorage.getItem(PREVIEW_KEY);
    }catch(e){ return null; }
  }
  function isOff(){
    try{ return localStorage.getItem(OFF_KEY) === "1"; }catch(e){ return false; }
  }

  function currentHoliday(){
    return previewHoliday() || (isOff() ? null : holidayFor(new Date()));
  }

  function apply(){
    const h = currentHoliday();
    if(h) document.documentElement.setAttribute("data-holiday", h);
    else document.documentElement.removeAttribute("data-holiday");
    return h;
  }

  window.splitbillHolidayFor = holidayFor;
  window.splitbillHolidayEnabled = () => !isOff();
  window.splitbillSetHolidayEnabled = (on) => {
    try{
      if(on) localStorage.removeItem(OFF_KEY);
      else localStorage.setItem(OFF_KEY, "1");
    }catch(e){}
    apply();
    syncDecor();
  };

  // 每個節日一個小圖：問候小標和飄落動畫共用，都是手繪 SVG，不靠 emoji。
  const GLYPHS = {
    newyear: '<path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" fill="currentColor"/>',
    lunar: '<path d="M12 2v3" stroke="currentColor" stroke-width="1.6"/><rect x="8.5" y="4.5" width="7" height="2" rx=".6" fill="currentColor"/><ellipse cx="12" cy="12" rx="7.5" ry="5.8" fill="currentColor"/><rect x="8.5" y="17.2" width="7" height="2" rx=".6" fill="currentColor"/><path d="M12 19v3" stroke="currentColor" stroke-width="1.6"/>',
    valentine: '<path d="M12 20.5S3.5 15.3 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6c0 6.1-8.5 11.3-8.5 11.3z" fill="currentColor"/>',
    dragonboat: '<path d="M12 3L21 19.5H3z" fill="currentColor"/><path d="M7.5 14l9 0M9.5 10.5l5 0" stroke="var(--card, #fff)" stroke-width="1.3"/>',
    midautumn: '<path d="M15.5 3.2a9 9 0 1 0 5.3 12.2A7.4 7.4 0 0 1 15.5 3.2z" fill="currentColor"/>',
    halloween: '<ellipse cx="12" cy="13.5" rx="9" ry="7.5" fill="currentColor"/><path d="M12 6c0-1.6.8-2.8 2.4-3.4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M8 11.5l1.8 1.8H6.2zM16 11.5l1.8 1.8h-3.6zM8 16.5q4 2 8 0" fill="var(--card, #fff)" stroke="var(--card, #fff)" stroke-width=".8"/>',
    christmas: '<path d="M12 2l5 7h-2.6l4 5.5h-3l4 5.5H4.6l4-5.5h-3l4-5.5H7z" fill="currentColor"/>'
  };
  const glyphSVG = (h, size) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${GLYPHS[h]}</svg>`;

  // 問候小標掛在頁面標題旁邊，主畫面才有；關掉裝飾時要能拿掉。
  function syncGreeting(h){
    document.querySelectorAll(".sb-holiday-greet").forEach(el => el.remove());
    const row = document.querySelector(".title-row");
    if(!h || !row || typeof window.t !== "function") return;
    const el = document.createElement("span");
    el.className = "sb-holiday-greet";
    el.innerHTML = glyphSVG(h, 14) + "<span></span>";
    el.lastElementChild.textContent = window.t("holiday." + h);
    row.appendChild(el);
  }

  // 頁面最上方一排淡淡的節日圖樣，跟著頁面捲走，不會擋到內容。
  function syncBand(h){
    document.querySelectorAll(".sb-holiday-band").forEach(el => el.remove());
    if(!h || !document.body || document.body.classList.contains("rc-page")) return;
    const tile = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="44"><svg x="6" y="4" width="18" height="18" viewBox="0 0 24 24">${GLYPHS[h]}</svg><svg x="38" y="22" width="14" height="14" viewBox="0 0 24 24">${GLYPHS[h]}</svg></svg>`;
    const url = `url("data:image/svg+xml,${encodeURIComponent(tile)}")`;
    const band = document.createElement("div");
    band.className = "sb-holiday-band";
    band.setAttribute("aria-hidden", "true");
    const masks = `${url}, linear-gradient(#000 45%, transparent)`;
    band.style.webkitMaskImage = masks;
    band.style.maskImage = masks;
    document.body.appendChild(band);
  }

  // 開場飄落：同一個節日每個分頁只播一次，動畫結束就把節點整個移除，
  // 不會一直佔著畫面。減少動態的使用者完全不播。
  function playFall(h){
    if(!h || !document.body) return;
    if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const seenKey = "splitbill-holiday-fall-" + h;
    try{
      if(sessionStorage.getItem(seenKey)) return;
      sessionStorage.setItem(seenKey, "1");
    }catch(e){}
    const layer = document.createElement("div");
    layer.className = "sb-holiday-fall";
    layer.setAttribute("aria-hidden", "true");
    let html = "";
    for(let i = 0; i < 16; i++){
      const size = 10 + (i * 7) % 11;
      const left = (i * 37 + 11) % 100;
      const delay = ((i * 13) % 22) / 10;
      const dur = 3.4 + ((i * 5) % 16) / 10;
      const drift = ((i % 2) ? 1 : -1) * (14 + (i * 3) % 26);
      html += `<i style="left:${left}%;animation-delay:${delay}s;animation-duration:${dur}s;--drift:${drift}px">${glyphSVG(h, size)}</i>`;
    }
    layer.innerHTML = html;
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 7000);
  }

  function syncDecor(){
    const h = document.documentElement.getAttribute("data-holiday");
    syncGreeting(h);
    syncBand(h);
    const meta = document.querySelector('meta[name="theme-color"]');
    if(meta && document.body){
      const bg = getComputedStyle(document.body).backgroundColor;
      if(h && bg) meta.setAttribute("content", bg);
    }
  }

  const active = apply();
  function onReady(){
    syncDecor();
    // 年度回顧是滿版的，不用再疊飄落動畫
    if(!document.body.classList.contains("rc-page")) playFall(active);
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady);
  else onReady();
  document.addEventListener("splitbill-lang-changed", syncDecor);
})();

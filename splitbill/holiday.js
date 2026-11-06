// 節日主題：節日期間在 <html> 掛上 data-holiday，配色由 shared.css 底部的
// token 覆寫，這裡負責判斷日期、問候小標，並載入頁首場景（holiday-scene.js）。放在 <head>
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

  // 每個節日一個小圖，放在問候小標裡，手繪 SVG，不靠 emoji。
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
    // 有場景的主畫面不放問候語，場景本身就夠了
    if(!h || !row || typeof window.t !== "function" || document.querySelector(".app-header > .header-utility-row")) return;
    const el = document.createElement("span");
    el.className = "sb-holiday-greet";
    el.innerHTML = glyphSVG(h, 14) + "<span></span>";
    el.lastElementChild.textContent = window.t("holiday." + h);
    row.appendChild(el);
  }

  // 場景插畫只有節日期間才需要，平常不下載
  function syncScene(h){
    if(window.splitbillMountHolidayScene){ window.splitbillMountHolidayScene(h); return; }
    if(!h || document.body.classList.contains("rc-page")) return;
    const s = document.createElement("script");
    s.src = "holiday-scene.js?v=" + (window.APP_VERSION || (typeof APP_VERSION !== "undefined" ? APP_VERSION : ""));
    s.onload = () => window.splitbillMountHolidayScene(document.documentElement.getAttribute("data-holiday"));
    document.head.appendChild(s);
  }

  function syncDecor(){
    const h = document.documentElement.getAttribute("data-holiday");
    syncGreeting(h);
    syncScene(h);
    const meta = document.querySelector('meta[name="theme-color"]');
    if(meta && document.body){
      const bg = getComputedStyle(document.body).backgroundColor;
      if(h && bg) meta.setAttribute("content", bg);
    }
  }

  apply();
  function onReady(){
    syncDecor();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady);
  else onReady();
  document.addEventListener("splitbill-lang-changed", syncDecor);
})();

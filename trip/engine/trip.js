/* ============================================================
   trip.js — the shared trip-page engine.
   Each trip folder has schedule.html (page shell), theme.css (colours)
   and data.js (TRIP settings + the itinerary). This file only reads
   those globals; nothing here is specific to one trip.
   Load order: leaflet → engine/trip-core.js → data.js → engine/trip.js
   ============================================================ */

// Header subtitle typewriter: types the destination list, pauses,
// deletes it, types the date range, pauses, deletes, and loops.
// Looks for an element with id="subtitleType" — if the page
// doesn't have one, this quietly does nothing.
// Pacing: most characters type at a steady clip with tiny random
// jitter (feels more like a real typist); separators ("・" and
// "～") get a longer pause before the next character, the way a
// person briefly pauses between items in a spoken list.
(function typewriterSubtitle(){
  const el = document.getElementById("subtitleType");
  if(!el) return;
  const dests = TRIP.dests.join(" ・ ");
  const dateRange = TRIP.dateRange;
  const phrases = [dests, dateRange];
  const PAUSE_CHARS = ["・", "～"];
  // static subtitle: show both lines at once instead of typing them
  el.textContent = dests + "　" + dateRange;
  return;
  let phraseIndex = 0, charIndex = 0, deleting = false;

  function jitter(base){ return base + Math.round((Math.random() - 0.5) * 20); }

  function tick(){
    const current = phrases[phraseIndex];
    let delay = jitter(65);
    if(!deleting){
      charIndex++;
      el.textContent = current.slice(0, charIndex);
      const justTyped = current[charIndex - 1];
      if(PAUSE_CHARS.includes(justTyped)) delay = 320; // brief pause after a separator
      if(charIndex === current.length){
        deleting = true;
        delay = 1500;
      }
    } else {
      charIndex--;
      el.textContent = current.slice(0, charIndex);
      delay = jitter(32);
      if(charIndex === 0){
        deleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        delay = 400;
      }
    }
    setTimeout(tick, delay);
  }
  tick();
})();

// Trip countdown: counts down to departure (TRIP.departISO).
// Looks for an element with id="countdown" — if the page doesn't have one,
// this quietly does nothing. Builds a flip-card layout once, then each
// second only the digits that actually changed play a 3D flip animation
// (the swap to the new number happens at the animation's midpoint, timed
// by JS via setTimeout — a classic flip-clock technique).
// date of day i of the trip (labels look like "8/18（二）"; the year comes from TRIP.departISO)
function tripDayDate(i){
  const dep = new Date(TRIP.departISO);
  const m = (days[i] && days[i].date || "").match(/(\d+)\/(\d+)/);
  if(!m) return null;
  let y = dep.getFullYear();
  if(Number(m[1]) < dep.getMonth() + 1) y += 1;   // a trip that crosses New Year
  return new Date(y, Number(m[1]) - 1, Number(m[2]));
}
function todayIndex(){
  const t = new Date(); t.setHours(0, 0, 0, 0);
  for(let i = 0; i < days.length; i++){ const d = tripDayDate(i); if(d && d.getTime() === t.getTime()) return i; }
  return -1;
}
(function tripCountdown(){
  const el = document.getElementById("countdown");
  if(!el) return;
  const DAY = 86400000;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(TRIP.departISO); start.setHours(0, 0, 0, 0);
  const end = tripDayDate(days.length - 1) || start;
  if(today > end) el.innerHTML = '<div class="cd-done">旅程已結束</div>';
  else if(today >= start) el.innerHTML = `<div class="cd-done">旅行中・第 ${Math.round((today - start) / DAY) + 1} 天</div>`;
  else {
    const n = Math.round((start - today) / DAY);
    el.innerHTML = n === 1 ? '<div class="cd-done">明天出發</div>' : `<div class="cd-done">還有 <b class="cd-big">${n}</b> 天出發</div>`;
  }
})();

// JPY→TWD exchange rate badge, always visible (no tap needed). Frankfurter
// (ECB data) doesn't carry TWD at all, so this tries ExchangeRate-API's
// open-access endpoint first (free, keyless, no signup), then two more
// free fallbacks if that's unreachable.
(function tripForex(){
  const el = document.getElementById("forexBadge");
  if(!el) return;
  el.innerHTML = '<span class="spinner"></span>讀取中…';

  // three independent free, keyless providers, tried in order — different
  // response shapes, so each has its own parser
  const sources = [
    { url:"https://open.er-api.com/v6/latest/JPY",
      parse:(data)=> data && data.rates && data.rates.TWD },
    { url:"https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/jpy.json",
      parse:(data)=> data && data.jpy && data.jpy.twd },
    { url:"https://latest.currency-api.pages.dev/v1/currencies/jpy.json",
      parse:(data)=> data && data.jpy && data.jpy.twd }
  ];

  function fetchWithTimeout(url, ms){
    const controller = new AbortController();
    const timer = setTimeout(()=> controller.abort(), ms);
    return fetch(url, { signal: controller.signal }).finally(()=> clearTimeout(timer));
  }

  function tryFetch(i){
    if(i >= sources.length){
      el.innerHTML = '匯率讀取失敗';
      return;
    }
    fetchWithTimeout(sources[i].url, 6000)
      .then(r=>{ if(!r.ok) throw new Error("bad response"); return r.json(); })
      .then(data=>{
        const rate = sources[i].parse(data);
        if(!rate) throw new Error("no rate");
        const twd1 = rate.toFixed(3);
        el.innerHTML = '<span class="cd-forex-jpy">¥1</span><span class="cd-forex-eq">=</span><span class="cd-forex-twd">NT$' + twd1 + '</span>';
      })
      .catch(()=> tryFetch(i+1));
  }
  tryFetch(0);
})();

// Header parallax: the hero header's background layer drifts slightly
// slower than the page as you scroll, giving it a subtle sense of depth.
// Looks for an element with id="heroBg" — if the page doesn't have one,
// this quietly does nothing. Throttled to one update per animation frame.
(function heroParallax(){
  const bg = document.getElementById("heroBg");
  const hero = document.getElementById("heroHeader");
  if(!bg || !hero) return;
  let ticking = false;
  function apply(){
    const rect = hero.getBoundingClientRect();
    if(rect.bottom > 0){
      const offset = Math.max(0, -rect.top) * 0.35;
      bg.style.transform = "translateY(" + offset + "px)";
    }
    ticking = false;
  }
  window.addEventListener("scroll", ()=>{
    if(!ticking){
      requestAnimationFrame(apply);
      ticking = true;
    }
  }, { passive:true });
  apply();
})();

// Light/dark theme toggle. Remembers the choice (localStorage) and falls
// back to the visitor's OS preference the first time. Adds a small
// floating button (top-right) to switch — no HTML markup needed on
// either page, this creates it itself.
(function themeToggle(){
  const KEY = TRIP.key + "-theme";

  // the theme is already applied synchronously by an inline <script> at the
  // top of <head> (before first paint, to avoid a flash of the wrong theme)
  // — this just reads that current value and wires up the toggle button
  function getPreferred(){
    const applied = document.documentElement.getAttribute("data-theme");
    if(applied === "dark" || applied === "light") return applied;
    try{
      const saved = localStorage.getItem(KEY);
      if(saved === "dark" || saved === "light") return saved;
    }catch(e){}
    return (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }

  let current = "light";   // the storybook look is light only
  document.documentElement.setAttribute("data-theme", current);

  function init(){
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-toggle";
    btn.setAttribute("aria-label", "切換深色／淺色模式");
    btn.textContent = current === "dark" ? "☀️" : "🌙";
    btn.addEventListener("click", ()=>{
      current = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", current);
      btn.textContent = current === "dark" ? "☀️" : "🌙";
      try{ localStorage.setItem(KEY, current); }catch(e){}
    });
    document.body.appendChild(btn);
  }
  if(document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();

function renderRow(item){
  if(item.type==="section"){
    return `<div class="section-label">${item.label}</div>`;
  }
  if(item.type==="note"){
    return `<div class="row"><div class="note">${item.text}</div></div>`;
  }
  if(item.type==="activity"){
    const ic = (TAG[item.tag]||{icon:"・"}).icon;
    const mapUrl = item.map ? (MAP_URL_OVERRIDE[item.map] || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.map)}`) : "";
    const mapLink = mapUrl ? `<a class="maplink" href="${mapUrl}" target="_blank" rel="noopener">${SB_ICON.pin}地圖</a>` : "";
    const info = item.map ? INFO[item.map] : null;
    const detail = info ? `<div class="activity-detail">
        <p>${info.intro}</p>
        <p class="tip">${info.tip}</p>
        ${info.souvenir ? `<p class="souvenir">${info.souvenir}</p>` : ""}
        ${info.coupon ? `<p class="souvenir">${info.coupon}　<a href="${TRIP.couponFile}" target="_blank" rel="noopener" download class="pack-link">下載優惠券PDF</a></p>` : ""}
        ${info.links ? `<p class="info-links">${info.links.map(l=>`<a href="${l.url}" target="_blank" rel="noopener" class="pack-link">🔗 ${l.label} →</a>`).join("")}</p>` : ""}
      </div>` : "";
    const clickable = info ? " clickable" : "";
    const chevron = info ? `<span class="chevron">▾</span>` : "";
    return `<div class="row">
      <span class="dot" style="background:var(--accent)"></span>
      <div class="activity${clickable}">
        <div class="activity-head">
          <span class="ic">${ic}</span>
          <div class="txt">${item.text}${item.time? `<span class="time">${item.time}</span>`:""}${mapLink}</div>
          ${chevron}
        </div>
        ${detail}
      </div>
    </div>`;
  }
  // transit
  const m = MODE[item.mode] || MODE.rail;
  const chips = [];
  if(item.price) chips.push(`<span class="chip price">${item.price}</span>`);
  if(item.transfer) chips.push(`<span class="chip transfer">${item.transfer}</span>`);
  const timeFrom = item.ft ? `<span class="time">${item.ft}</span>` : "";
  const timeTo = item.tt ? `<span class="time">${item.tt}</span>` : "";
  const gmapsUrl = (name)=> MAP_URL_OVERRIDE[name] || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
  const fromLink = `<a class="stop-link" href="${gmapsUrl(item.from)}" target="_blank" rel="noopener">${item.from}</a>`;
  const toLink = `<a class="stop-link" href="${gmapsUrl(item.to)}" target="_blank" rel="noopener">${item.to}</a>`;
  return `<div class="row row-transit">
    <span class="dot" style="border-color:${m.color}"></span>
    <div class="transit">
      <div class="leg">
        <span class="stop">${fromLink}${timeFrom? " "+timeFrom : ""}</span>
        <span class="mid"><span class="mode-tag" style="--mc:${m.color}">${m.label}</span></span>
        <span class="stop right">${toLink}${timeTo? " "+timeTo : ""}</span>
      </div>
      <div class="meta">
        <span class="chip line-tag" style="--mc:${m.color}">${item.line}</span>
        ${chips.join("")}
      </div>
    </div>
  </div>`;
}
function buildPage(day, idx){
  const rows = day.items.map(renderRow).join("");
  const hotelChip = day.hotel ? `<button type="button" class="hotel-info" data-goto="contacts">住宿：${day.hotel} ›</button>` : "";
  return `<section class="day-page" id="day-${idx}">
    <div class="day-head">
      <div class="dnum mono">${String(idx+1).padStart(2,"0")}</div>
      <div class="dmeta">
        <div class="ddate">${day.date}</div>
        <div class="dtitle">${day.theme}</div>
        ${hotelChip}
      </div>
      ${TRIP.sun ? `<div class="sun-info" id="sun-${idx}">${SB_ICON.sun} 讀取中…</div>` : ""}
    </div>
    <div class="daymap-wrap">
      <div class="daymap-label">今日移動路線</div>
      <div class="daymap" id="daymap-${idx}"></div>
    </div>
    <div class="timeline">${rows}</div>
  </section>`;
}

// ---- Packing checklist ----
function buildPackingPage(){
  const groups = PACKING.map((g, gi)=>`
    <div class="pack-group">
      <div class="pack-cat">${g.cat}</div>
      ${g.items.map((it,ii)=>{
        const id = "p-"+gi+"-"+ii;
        return `<label class="pack-item" for="${id}">
          <input type="checkbox" id="${id}" data-key="${id}">
          <span class="pack-text">${it}</span>
        </label>`;
      }).join("")}
    </div>`).join("");

  return `<section class="day-page" id="page-packing">
    <div class="day-head">
      <div class="dnum mono">🧳</div>
      <div class="dmeta">
        <div class="ddate">PACKING LIST</div>
        <div class="dtitle">待辦清單</div>
      </div>
    </div>
    <div class="pack-progress">
      <div class="pack-bar"><div class="pack-fill" id="packFill"></div></div>
      <div class="pack-count mono" id="packCount">0 / 0</div>
      <button class="pack-reset" id="packReset">全部清空</button>
    </div>
    ${groups}
  </section>`;
}

// ---- Weather ----
const WMO = {
  0:["☀️","晴朗"],1:["🌤","晴時多雲"],2:["⛅","多雲"],3:["☁️","陰天"],
  45:["🌫","有霧"],48:["🌫","有霧（霜）"],
  51:["🌦","毛毛雨"],53:["🌦","毛毛雨"],55:["🌧","毛毛雨（強）"],
  61:["🌧","小雨"],63:["🌧","中雨"],65:["🌧","大雨"],
  66:["🌧","凍雨"],67:["🌧","凍雨（強）"],
  71:["🌨","小雪"],73:["🌨","中雪"],75:["❄️","大雪"],
  80:["🌦","陣雨"],81:["🌧","陣雨"],82:["⛈","強陣雨"],
  95:["⛈","雷雨"],96:["⛈","雷雨（冰雹）"],99:["⛈","雷雨（強冰雹）"]
};
const WX_KEY = { "☀️":"sun", "🌤":"partly", "⛅":"partly", "☁️":"cloud", "🌫":"fog", "🌦":"drizzle", "🌧":"rain", "🌨":"snow", "❄️":"snow", "⛈":"storm" };
function wmoInfo(code){ const w = WMO[code]; return w ? [SB_ICON.wx[WX_KEY[w[0]]] || SB_ICON.wx.na, w[1]] : [SB_ICON.wx.na, "—"]; }
function wmoAnimClass(code){
  if(code === 0) return "wx-anim-sun";
  if(code === 1 || code === 2) return "wx-anim-cloud-sun";
  if(code === 3 || code === 45 || code === 48) return "wx-anim-cloud";
  if([95,96,99,82].includes(code)) return "wx-anim-storm";
  if([71,73,75].includes(code)) return "wx-anim-snow";
  if(code >= 51) return "wx-anim-rain";
  return "";
}
function buildWeatherPage(){
  const cityBlocks = WEATHER_CITIES.map(c=>`
    <div class="wx-city">
      <div class="wx-city-head">${c.name}</div>
      <div class="wx-body" id="wx-${c.key}">
        <div class="wx-loading"><span class="spinner"></span>讀取天氣資料中…</div>
      </div>
    </div>`).join("");

  return `<section class="day-page" id="page-weather">
    <div class="day-head">
      <div class="dnum mono">🌤</div>
      <div class="dmeta">
        <div class="ddate">WEATHER</div>
        <div class="dtitle">天氣預報</div>
      </div>
    </div>
    <p class="wx-note">${TRIP.weatherNote}</p>
    ${cityBlocks}
  </section>`;
}
const WX_PERIODS = [
  { key:"morning",   label:"上午", hours:[6,7,8,9,10,11] },
  { key:"afternoon", label:"下午", hours:[12,13,14,15,16,17] },
  { key:"evening",   label:"晚上", hours:[18,19,20,21,22,23] }
];
const wxState = {}; // { [cityKey]: { current, days: [...], idx } }
function wxAggregatePeriod(hourly, dayIdx, hours){
  const temps=[], pops=[], codes=[];
  hours.forEach(h=>{
    const idx = dayIdx*24 + h;
    if(hourly.temperature_2m[idx] !== undefined){
      temps.push(hourly.temperature_2m[idx]);
      pops.push(hourly.precipitation_probability[idx]);
      codes.push(hourly.weather_code[idx]);
    }
  });
  if(!temps.length) return null;
  const avgTemp = Math.round(temps.reduce((a,b)=>a+b,0)/temps.length);
  const maxPop = Math.max(...pops);
  const worstCode = Math.max(...codes); // heuristic: higher WMO code ≈ more severe weather
  return { avgTemp, maxPop, worstCode };
}
function wxDayColumnWidth(){ return 92; } // 84px column + 8px gap — matches .wx-daycol width in CSS
function renderWeatherDay(key){
  const state = wxState[key];
  if(!state) return;
  const el = document.getElementById("wx-"+key);
  if(!el) return;

  // how many day-columns fit at the current width — this is what makes
  // wider screens show more days at once without any fixed breakpoint
  const containerWidth = el.clientWidth || el.parentElement.clientWidth || 320;
  const PAGER_BTNS_WIDTH = 34*2 + 8*2; // two 34px round buttons + their gaps, reserved space around .wx-daycols
  const daycolsWidth = Math.max(0, containerWidth - PAGER_BTNS_WIDTH);
  const visible = Math.max(1, Math.min(state.days.length, Math.floor(daycolsWidth / wxDayColumnWidth())));
  if(state.idx > state.days.length - visible) state.idx = Math.max(0, state.days.length - visible);

  const slice = state.days.slice(state.idx, state.idx + visible);
  const dayCols = slice.map(day=>{
    const periods = WX_PERIODS.map(p=>{
      const agg = day.periods[p.key];
      if(!agg) return `<div class="wx-p-row"><span class="wx-p-name">${p.label}</span><span class="wx-p-na">－</span></div>`;
      const [icon] = wmoInfo(agg.worstCode);
      const animClass = wmoAnimClass(agg.worstCode);
      return `<div class="wx-p-row">
        <span class="wx-p-name">${p.label}</span>
        <span class="wx-p-icon ${animClass}">${icon}</span>
        <span class="wx-p-temp">${agg.avgTemp}°</span>
        <span class="wx-p-pop mono">${agg.maxPop}%</span>
      </div>`;
    }).join("");
    return `<div class="wx-daycol">
      <div class="wx-daycol-label mono">${day.label}</div>
      ${periods}
    </div>`;
  }).join("");

  el.innerHTML = `
    <div class="wx-current">
      <span class="wx-icon ${wmoAnimClass(state.current.weather_code)}">${wmoInfo(state.current.weather_code)[0]}</span>
      <span class="wx-temp">${Math.round(state.current.temperature_2m)}°C</span>
      <span class="wx-desc">${wmoInfo(state.current.weather_code)[1]}・濕度${state.current.relative_humidity_2m}%</span>
    </div>
    <div class="wx-pager">
      <button type="button" class="wx-pager-btn" data-dir="prev" ${state.idx<=0?"disabled":""}>◀</button>
      <div class="wx-daycols">${dayCols}</div>
      <button type="button" class="wx-pager-btn" data-dir="next" ${state.idx+visible>=state.days.length?"disabled":""}>▶</button>
    </div>
  `;

  el.querySelectorAll(".wx-pager-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const dir = btn.dataset.dir;
      if(dir === "next") state.idx = Math.min(state.days.length - visible, state.idx + visible);
      else state.idx = Math.max(0, state.idx - visible);
      renderWeatherDay(key);
    });
  });
}
window.addEventListener("resize", (()=>{
  let t = null;
  return ()=>{
    clearTimeout(t);
    t = setTimeout(()=>{
      Object.keys(wxState).forEach(key=>{
        if(document.getElementById("wx-"+key)) renderWeatherDay(key);
      });
    }, 200);
  };
})());
async function loadWeather(){
  for(const c of WEATHER_CITIES){
    const el = document.getElementById("wx-"+c.key);
    if(!el || el.dataset.loaded) continue;
    try{
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&current=temperature_2m,weather_code,relative_humidity_2m&hourly=temperature_2m,weather_code,precipitation_probability&timezone=Asia%2FTokyo&forecast_days=10`;
      const res = await fetch(url);
      if(!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      el.dataset.loaded = "1";

      const hourly = data.hourly;
      const dayCount = Math.floor(hourly.time.length / 24);
      const days = [];
      for(let d=0; d<dayCount; d++){
        const dateObj = new Date(hourly.time[d*24]);
        const label = (dateObj.getMonth()+1)+"/"+dateObj.getDate();
        const periods = {};
        WX_PERIODS.forEach(p=>{ periods[p.key] = wxAggregatePeriod(hourly, d, p.hours); });
        days.push({ label, periods });
      }

      wxState[c.key] = { current: data.current, days, idx: 0 };
      renderWeatherDay(c.key);
    }catch(err){
      el.innerHTML = `<div class="wx-error">天氣資料載入失敗，請確認網路連線後重新整理頁面。</div>`;
    }
  }
}
function buildNav(){
  const dayTabs = days.map((d,i)=>`
    <button class="daytab${i===0?" active":""}" data-page="${i}">
      <span class="num">DAY ${String(i+1).padStart(2,"0")}</span>
      <span class="lbl">${d.theme}</span>
    </button>`).join("");
  return `<div class="daytabs-scroll">${dayTabs}</div>`;
}
function buildUtilBar(){
  return `
    <button class="util-btn" data-page="days">每日行程</button>
    <button class="util-btn" data-page="flights">航班</button>
    <button class="util-btn" data-page="packing">待辦清單</button>
    <button class="util-btn" data-page="contacts">住宿與聯絡</button>
    <button class="util-btn" data-page="weather">天氣</button>
    ${TRIP.food ? `<button class="util-btn" data-page="food">美食地圖</button>` : ""}
    <button class="util-btn" data-page="driving">租車自駕</button>
    <button class="util-btn" data-page="quake">地震</button>
    <a class="util-btn" href="https://jschang0512.github.io/splitbill/" target="_blank" rel="noopener">旅費分帳 ${SB_ICON.arrowOut}</a>`;
}
function buildFoodPage(){
  const areaBlocks = FOOD_AREAS.map((a,ai)=>{
    const rows = a.items.map((it)=>{
      const gmapsUrl = it.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(it.name + " " + a.area + " " + TRIP.food.city)}`;
      return `<a class="food-item" href="${gmapsUrl}" target="_blank" rel="noopener">
        <span class="food-name">${it.name}</span>
        <span class="food-type">${it.type}</span>
        <span class="food-pin">${SB_ICON.pin}</span>
      </a>`;
    }).join("");
    return `<div class="food-area">
      <button type="button" class="food-area-head" data-area="${ai}">
        <span class="food-area-name">${a.area}</span>
        <span class="food-area-count mono">${a.items.length}</span>
        <span class="chevron">▾</span>
      </button>
      <div class="food-area-list" id="food-area-${ai}">
        <div class="food-area-items">${rows}</div>
      </div>
    </div>`;
  }).join("");

  // souvenir tab is built from the same INFO{} data already used for each
  // activity's expandable card, so it never drifts out of sync with the itinerary
  const souvenirEntries = Object.entries(INFO).filter(([,v])=>v.souvenir);
  const souvenirRows = souvenirEntries.map(([key,v],i)=>{
    const mapId = `souv-map-${i}`;
    const text = v.souvenir.replace(/^🛍\s*伴手禮：/, "");
    return `<div class="food-item-wrap">
      <button type="button" class="souvenir-item" data-coord-key="${key.replace(/"/g,'&quot;')}" data-map-id="${mapId}" data-name="${key.replace(/"/g,'&quot;')}">
        <span class="souvenir-place">${key}</span>
        <span class="souvenir-text">${text}</span>
        <span class="food-pin">${SB_ICON.pin}</span>
      </button>
      <div class="food-map-slot" id="${mapId}"></div>
    </div>`;
  }).join("");

  return `<section class="day-page" id="page-food">
    <div class="day-head">
      <div class="dnum mono">🍜</div>
      <div class="dmeta">
        <div class="ddate">FOOD &amp; SHOPPING</div>
        <div class="dtitle">美食・伴手禮</div>
      </div>
    </div>
    <div class="food-tabs">
      <button type="button" class="food-tab active" data-tab="eat">美食</button>
      <button type="button" class="food-tab" data-tab="buy">伴手禮</button>
    </div>
    <div class="food-tab-panel active" id="foodTabEat">
      <p class="wx-note">依地區整理的美食口袋名單，人在附近時可以點開對應區域看看，點餐廳名字會直接開 Google Maps 導航／查詳細資訊。</p>
      ${areaBlocks}
    </div>
    <div class="food-tab-panel" id="foodTabBuy">
      <p class="wx-note">這份清單是從行程裡每個景點卡片的「🛍 伴手禮」欄位自動彙整的，跟行程本身同步，不用另外維護。點地點名稱可以展開地圖看它在哪。</p>
      ${souvenirRows}
    </div>
  </section>`;
}
function buildContactsPage(){
  const contactRows = CONTACTS.map(c=>`
    <div class="contact-row">
      <div class="contact-name">${c.name}</div>
      <a class="contact-phone" href="tel:${c.phone.replace(/-/g,"")}">${c.phone}</a>
      <button type="button" class="addr-copy-mini" data-val="${c.phone}" aria-label="複製 ${c.name} 的電話">${SB_ICON.copy}</button>
      ${c.fb ? `<a class="fb-icon" href="${c.fb}" target="_blank" rel="noopener" title="${c.name} 的 Facebook">f</a>` : ""}
    </div>`).join("");

  const lodgingRows = LODGING.map(l=>`
    <div class="lodging-card">
      <div class="lodging-city">${l.city}</div>
      <div class="lodging-name">${l.name}</div>
      <div class="addr-line"><span class="addr-v">${l.addrJa || l.addr}</span><button type="button" class="addr-copy-mini" data-val="${l.addrJa || l.addr}" aria-label="複製 ${l.name} 的地址">${SB_ICON.copy}</button></div>
      ${l.checkin || l.checkout ? `<div class="lodging-times">${l.checkin ? `入住 ${l.checkin}` : ""}${l.checkin && l.checkout ? "・" : ""}${l.checkout ? `退房 ${l.checkout}` : ""}</div>` : ""}
      ${l.tel ? `<a class="lodging-tel" href="tel:${l.tel.replace(/[^\d+]/g, "")}">${l.tel}</a>` : ""}
      <button type="button" class="show-driver" data-name="${l.name}" data-addr="${l.addrJa || l.addr}">給司機看</button>
      <a class="maplink" href="${MAP_URL_OVERRIDE[l.addr] || ('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(l.addr))}" target="_blank" rel="noopener">${SB_ICON.pin}地圖</a>
    </div>`).join("");

  const people = `<div class="section-label">團員聯絡方式</div>
      ${contactRows ? `<div class="contact-block">${contactRows}</div>` : `<div class="empty-note">還沒有團員聯絡資訊。</div>`}`;
  const gate = TRIP.contactsGate;

  return `<section class="day-page" id="page-contacts">
    <div class="day-head">
      <div class="dnum mono">📇</div>
      <div class="dmeta">
        <div class="ddate">CONTACTS</div>
        <div class="dtitle">住宿與聯絡</div>
      </div>
    </div>
    ${gate ? `
    <div class="gate-wrap" id="contactsGate">
      <div class="gate-q">${SB_ICON.lock}${gate.question.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, "")}</div>
      <div class="gate-row">
        <input type="text" id="gateInput" class="gate-input" placeholder="輸入答案" aria-label="答案" autocomplete="off">
        <button type="button" id="gateSubmit" class="gate-btn">解鎖</button>
      </div>
      <div class="gate-msg" id="gateMsg"></div>
    </div>

    <div class="gate-content" id="contactsContent" style="display:none">
      ${people}
    </div>` : people}

    <div class="section-label">住宿</div>
    ${lodgingRows || `<div class="empty-note">住宿還沒訂好，訂好後會出現在這裡。</div>`}
  </section>`;
}
function buildFlightsPage(){
  const totalPax = FLIGHTS.reduce((sum,d)=> sum + d.entries.reduce((s,e)=>s+(e.pax||0),0), 0);
  const cards = FLIGHTS.map(d=>`
    <div class="flight-day">
      <div class="flight-day-head">
        <span class="flight-date">${d.date}</span>
        <span class="flight-note">${d.note}</span>
      </div>
      ${d.entries.length ? d.entries.map(e=>`
        <div class="flight-item">
          <div class="flight-item-top">
            <div class="flight-no">${e.flight}</div>
            <div class="flight-airline">${e.airline}・${e.aircraft}</div>
            ${e.pax ? `<div class="flight-pax">${SB_ICON.person}× ${e.pax}</div>` : ""}
          </div>
          <div class="flight-route">
            <div class="flight-leg">
              <span class="flight-time mono">${e.dep}<span class="flight-tz">${e.depTz}</span></span>
              <div class="flight-airport">${e.from}</div>
            </div>
            <div class="flight-arrow"><span class="plane">✈︎</span></div>
            <div class="flight-leg right">
              <span class="flight-time mono">${e.arr}<span class="flight-tz">${e.arrTz}</span></span>
              <div class="flight-airport">${e.to}</div>
            </div>
          </div>
          <a class="flight-link" href="${e.link}" target="_blank" rel="noopener">查詢航班動態／時刻表 →</a>
        </div>`).join("") : `<div class="flight-pending">${d.pending || "尚未訂票"}</div>`}
    </div>`).join("");

  return `<section class="day-page" id="page-flights">
    <div class="day-head">
      <div class="dnum mono">✈️</div>
      <div class="dmeta">
        <div class="ddate">FLIGHT INFO</div>
        <div class="dtitle">航班資訊</div>
      </div>
    </div>
    <p class="wx-note">${typeof TRIP.flightsNote === "function" ? TRIP.flightsNote(totalPax) : TRIP.flightsNote}</p>
    ${cards}
  </section>`;
}
function buildQuakePage(){
  return `<section class="day-page" id="page-quake">
    <div class="day-head">
      <div class="dnum mono">🌏</div>
      <div class="dmeta">
        <div class="ddate">EARTHQUAKE INFO</div>
        <div class="dtitle">${TRIP.quake.title}</div>
      </div>
    </div>
    <p class="wx-note">${TRIP.quake.note}</p>
    <div class="daymap-wrap">
      <div class="daymap-label">${TRIP.quake.mapLabel}</div>
      <div class="daymap" id="quake-map">
        <div class="wx-loading"><span class="spinner"></span>讀取地震資訊中…</div>
      </div>
    </div>
    <div class="section-label">詳細列表（依時間近到遠）</div>
    <div id="quake-list"></div>
  </section>`;
}
const SHINDO_MAP = {
  10:"震度1", 20:"震度2", 30:"震度3", 40:"震度4",
  45:"震度5弱", 50:"震度5強", 55:"震度6弱", 60:"震度6強", 70:"震度7"
};
function shindoColor(scale){
  if(scale >= 55) return "#7A1F1F"; // 震度6弱以上
  if(scale >= 45) return "#A13D2C"; // 震度5弱・5強
  if(scale >= 30) return TRIP.colors.shindo3; // 震度3・4
  return TRIP.colors.shindo1; // 震度1・2
}
function formatQuakeTime(t){
  // P2P quake API time format: "2026/08/05 12:34:56.789" — show "08/05<br>12:34"
  const m = String(t).match(/^\d{4}\/(\d{2}\/\d{2}) (\d{2}:\d{2})/);
  return m ? `${m[1]}<br>${m[2]}` : t;
}
async function loadQuakes(){
  const mapEl = document.getElementById("quake-map");
  if(!mapEl || mapEl.dataset.loaded) return;
  mapEl.dataset.loaded = "1";
  try{
    const res = await fetch("https://api.p2pquake.net/v2/history?codes=551&limit=100");
    if(!res.ok) throw new Error("fetch failed");
    const data = await res.json();

    // Kyushu bounding box (mainland Kyushu + nearby offshore epicenters)
    const inKyushu = (hp)=> hp && typeof hp.latitude==="number" && typeof hp.longitude==="number"
      && hp.latitude >= TRIP.quake.bbox.latMin && hp.latitude <= TRIP.quake.bbox.latMax
      && hp.longitude >= TRIP.quake.bbox.lngMin && hp.longitude <= TRIP.quake.bbox.lngMax;

    const valid = data.filter(q => inKyushu(q.earthquake.hypocenter));
    valid.sort((a,b)=> new Date(b.earthquake.time) - new Date(a.earthquake.time)); // most recent first

    const listEl = document.getElementById("quake-list");
    if(listEl){
      if(!valid.length){
        document.querySelector("#page-quake .wx-loading")?.remove();
        listEl.innerHTML = `<div class="quake-empty">近期${TRIP.quake.region}沒有偵測到地震資訊。</div>`;
      } else {
        document.querySelector("#page-quake .wx-loading")?.remove();
        listEl.innerHTML = valid.map((q,i)=>{
          const eq = q.earthquake;
          const hp = eq.hypocenter;
          const color = shindoColor(eq.maxScale);
          const shindo = SHINDO_MAP[eq.maxScale] || "—";
          const tsunami = eq.domesticTsunami && eq.domesticTsunami!=="None" && eq.domesticTsunami!=="Unknown"
            ? `<span class="quake-tsunami">⚠ 有海嘯資訊</span>` : "";
          return `<div class="quake-item" data-idx="${i}" style="--quake-c:${color}">
            <div class="quake-item-time mono">${formatQuakeTime(eq.time)}</div>
            <div class="quake-item-body">
              <div class="quake-item-place">${hp.name}</div>
              <div class="quake-item-meta">最大<span class="quake-item-shindo">${shindo}</span>・M${hp.magnitude}・深度${hp.depth}km ${tsunami}</div>
            </div>
          </div>`;
        }).join("");
      }
    }

    const map = L.map(mapEl, {
      scrollWheelZoom:true, doubleClickZoom:true, touchZoom:true,
      boxZoom:true, keyboard:true, zoomControl:true
    }).setView(TRIP.quake.center, 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      subdomains: 'abc', maxZoom: 19
    }).addTo(map);

    if(!valid.length){
      return; // no recent Kyushu quakes — just show the base map
    }

    const latlngs = [];
    const quakeMarkers = [];
    valid.forEach(q=>{
      const eq = q.earthquake;
      const hp = eq.hypocenter;
      const color = shindoColor(eq.maxScale);
      const radius = 6 + Math.max(0, (Number(hp.magnitude)||3) - 3) * 3;
      const shindo = SHINDO_MAP[eq.maxScale] || "—";
      const tsunami = eq.domesticTsunami && eq.domesticTsunami!=="None" && eq.domesticTsunami!=="Unknown"
        ? `<br><span class="quake-tsunami">⚠ 有海嘯資訊</span>` : "";
      const marker = L.circleMarker([hp.latitude, hp.longitude], {
        radius, color, fillColor:color, fillOpacity:0.55, weight:2
      }).addTo(map).bindPopup(
        `<span class="day-popup">${hp.name}<br>最大${shindo}・M${hp.magnitude}，深度${hp.depth}km<br>${eq.time}${tsunami}</span>`
      );
      quakeMarkers.push(marker);
      latlngs.push([hp.latitude, hp.longitude]);
    });
    if(latlngs.length > 1) map.fitBounds(latlngs, {padding:[24,24]});

    // clicking a list entry pans the map to that quake's marker and opens its popup
    if(listEl){
      listEl.addEventListener("click", (e)=>{
        const item = e.target.closest(".quake-item");
        if(!item) return;
        const idx = Number(item.dataset.idx);
        const marker = quakeMarkers[idx];
        if(!marker) return;
        map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 9), { duration:0.6 });
        setTimeout(()=> marker.openPopup(), 620);
        document.querySelectorAll(".quake-item.selected").forEach(el=>el.classList.remove("selected"));
        item.classList.add("selected");
      });
    }
  }catch(err){
    mapEl.innerHTML = `<div class="wx-error">地震資料載入失敗，請確認網路連線後重新整理頁面。</div>`;
  }
}
(function heroArt(){
  const art = window.TRIP_ART && window.TRIP_ART[TRIP.key];
  const h1 = document.querySelector("header.hero h1.title");
  if(!art || !h1) return;
  const box = document.createElement("div");
  box.className = "hero-art";
  box.setAttribute("aria-hidden", "true");
  box.innerHTML = art;
  h1.before(box);
})();
const main = document.getElementById("main");
main.innerHTML = days.map(buildPage).join("") + buildContactsPage() + buildFlightsPage() + buildDrivingPage() + buildWeatherPage() + buildQuakePage() + (TRIP.food ? buildFoodPage() : "") + buildPackingPage();
document.getElementById("dayNav").innerHTML = buildNav();
document.getElementById("utilBar").innerHTML = buildUtilBar();

// ---- Scroll reveal for cards ----
const REDUCED_EARLY = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
(function initScrollReveal(){
  const selector = ".row, .pack-item, .contact-row, .flight-item, .drv-block, .sign-card, .lodging-card, .fs-item, .quake-item";
  const els = document.querySelectorAll(selector);
  if(!("IntersectionObserver" in window) || REDUCED_EARLY){
    els.forEach(el=>el.classList.add("revealed"));
    return;
  }
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      }
    });
  }, {threshold:0.12, rootMargin:"0px 0px -30px 0px"});
  els.forEach(el=>{
    el.classList.add("reveal");
    observer.observe(el);
  });
})();

main.querySelectorAll(".activity.clickable").forEach(card=>{
  card.setAttribute("role", "button"); card.tabIndex = 0; card.setAttribute("aria-expanded", "false");
});
const toggleCard = (card)=>{ const open = card.classList.toggle("open"); card.setAttribute("aria-expanded", String(open)); };
main.addEventListener("click", (e)=>{
  const go = e.target.closest("[data-goto]");
  if(go){ activatePage(go.dataset.goto); return; }
  const drv = e.target.closest(".show-driver");
  if(drv){ showDriver(drv.dataset.name, drv.dataset.addr); return; }
  if(e.target.closest(".maplink")) return; // let the Google Maps link navigate normally
  const card = e.target.closest(".activity.clickable");
  if(!card) return;
  toggleCard(card);
});
main.addEventListener("keydown", (e)=>{
  if(e.key !== "Enter" && e.key !== " ") return;
  const card = e.target.closest(".activity.clickable");
  if(!card || e.target !== card) return;
  e.preventDefault(); toggleCard(card);
});
// big address card for a taxi driver
function showDriver(name, addr){
  const d = document.createElement("dialog");
  d.className = "driver-card";
  d.innerHTML = `<p class="driver-name">${name}</p><p class="driver-addr">${addr}</p><p class="driver-ask" lang="ja">この住所までお願いします</p><button type="button" class="driver-close">關閉</button>`;
  document.body.appendChild(d);
  d.querySelector(".driver-close").onclick = ()=>{ d.close(); d.remove(); };
  d.addEventListener("cancel", ()=> d.remove());
  d.showModal();
}
// strip emoji used as icons at the start of headings and notes written in data.js
document.querySelectorAll(".drv-title, .section-label, .souvenir, .activity-detail p, .flight-note").forEach(el=>{
  const first = el.firstChild;
  if(first && first.nodeType === 3) first.textContent = first.textContent.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u, "");
});

// ---- Per-day route maps ----
function dayStops(day){
  const stops = [];
  const push = (name)=>{
    const c = COORDS[name];
    if(!c) return;
    const last = stops[stops.length-1];
    if(last){
      const dLat = last.lat - c[0], dLng = last.lng - c[1];
      const closeEnough = Math.sqrt(dLat*dLat + dLng*dLng) < 0.003; // ~300m
      if(last.name===name || closeEnough) return;
    }
    stops.push({name, lat:c[0], lng:c[1]});
  };
  day.items.forEach(item=>{
    if(item.type==="transit"){ push(item.from); push(item.to); }
    else if(item.type==="activity" && item.map){ push(item.map); }
  });
  return stops;
}

// ---- Sunrise / sunset ----
const sunLoaded = {}; // idx -> true once fetched
function dayDateISO(dateLabel){
  // dateLabel looks like "8/18（二）" — pick the next upcoming occurrence of that month/day
  const m = dateLabel.match(/(\d+)\/(\d+)/);
  if(!m) return null;
  const month = Number(m[1]), day = Number(m[2]);
  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month-1, day);
  if(candidate < now) year += 1; // that date already passed this year — assume next year's trip
  const mm = String(month).padStart(2,"0");
  const dd = String(day).padStart(2,"0");
  return `${year}-${mm}-${dd}`;
}
async function loadSunTimes(idx){
  if(sunLoaded[idx]) return;
  const el = document.getElementById("sun-"+idx);
  if(!el) return;
  const stops = dayStops(days[idx]);
  const iso = dayDateISO(days[idx].date);
  if(!stops.length || !iso){ el.textContent = ""; return; }
  const { lat, lng } = stops[0];
  try{
    const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${iso}&formatted=0`;
    const res = await fetch(url);
    if(!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    sunLoaded[idx] = true;
    const fmt = (utcStr)=> new Date(utcStr).toLocaleTimeString("ja-JP", {hour:"2-digit", minute:"2-digit", timeZone:"Asia/Tokyo"});
    el.textContent = `↑${fmt(data.results.sunrise)} ↓${fmt(data.results.sunset)}`;
  }catch(err){
    el.textContent = "";
  }
}
const dayMaps = {}; // idx -> leaflet map instance
function buildDayMap(idx){
  if(dayMaps[idx]) { dayMaps[idx].invalidateSize(); return; }
  const el = document.getElementById("daymap-"+idx);
  if(!el) return;
  const stops = dayStops(days[idx]);
  if(stops.length < 2){ el.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--ink-soft);font-size:12px;">（無足夠地點資料）</div>`; return; }

  // when the same spot is revisited later that day, nudge it outward a little
  // so the pin doesn't sit exactly on top of the earlier visit and hide its number
  const seen = {};
  stops.forEach(s=>{
    const key = s.lat.toFixed(4)+","+s.lng.toFixed(4);
    const count = seen[key] || 0;
    seen[key] = count + 1;
    if(count > 0){
      const angle = count * 2.4; // golden-angle-ish spiral
      const radius = 0.0007 * count;
      s.lat += radius * Math.cos(angle);
      s.lng += radius * Math.sin(angle) / Math.cos(s.lat * Math.PI/180);
    }
  });

  const isBranch = !!TRIP.branch && idx >= TRIP.branch.fromDay;
  const color = isBranch ? TRIP.colors.branch : TRIP.colors.route;

  const map = L.map(el, {
    scrollWheelZoom:true,
    doubleClickZoom:true,
    touchZoom:true,
    boxZoom:true,
    keyboard:true,
    zoomControl:true
  }).setView([stops[0].lat, stops[0].lng], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    subdomains: 'abc', maxZoom: 19
  }).addTo(map);

  const latlngs = stops.map(s=>[s.lat,s.lng]);

  // arrival pins — all drawn immediately
  stops.forEach((s,i)=>{
    const isStart = i===0, isEnd = i===stops.length-1;
    const ring = isStart ? "0 0 0 3px #2F8F4E, 0 1px 4px rgba(0,0,0,.35)" : isEnd ? "0 0 0 3px #8C7FB0, 0 1px 4px rgba(0,0,0,.35)" : "0 1px 4px rgba(0,0,0,.35)";
    const size = (isStart||isEnd) ? 28 : 24;
    const icon = L.divIcon({
      className:"",
      html:`<div class="daypin" style="background:${color};width:${size}px;height:${size}px;box-shadow:${ring}">${isStart?"起":isEnd?"終":i+1}</div>`,
      iconSize:[size,size], iconAnchor:[size/2,size/2]
    });
    const label = isStart ? `起點：${s.name}` : isEnd ? `終點：${s.name}` : `${i+1}. ${s.name}`;
    L.marker([s.lat,s.lng], {icon}).addTo(map).bindPopup(`<span class="day-popup">${label}</span>`);
  });

  // direction arrows at each leg's midpoint — all drawn immediately
  for(let i=0;i<stops.length-1;i++){
    const a = stops[i], b = stops[i+1];
    const midLat = (a.lat+b.lat)/2, midLng = (a.lng+b.lng)/2;
    const angle = Math.atan2(b.lng-a.lng, b.lat-a.lat) * 180/Math.PI;
    const arrowIcon = L.divIcon({
      className:"",
      html:`<div class="dayarrow" style="color:${color};transform:rotate(${angle}deg)">▲</div>`,
      iconSize:[16,16], iconAnchor:[8,8]
    });
    L.marker([midLat,midLng], {icon:arrowIcon, interactive:false}).addTo(map);
  }

  // route line — all drawn immediately (one polyline per leg keeps the
  // per-leg direction arrows lined up, though there's no visual seam)
  for(let i=0;i<stops.length-1;i++){
    const a = stops[i], b = stops[i+1];
    L.polyline([[a.lat,a.lng],[b.lat,b.lng]], {color, weight:3, opacity:0.85}).addTo(map);
  }

  // fit every stop in view — everything is already drawn, no animation
  map.fitBounds(latlngs, {padding:[24,24]});

  dayMaps[idx] = map;
}
const EXTRA_PAGES = ["contacts","flights","driving","weather","quake","packing"].concat(TRIP.food ? ["food"] : []);
const EXTRA_PAGE_META = {
  contacts: {icon:"📇", label:"聯絡資訊"},
  flights:  {icon:"✈️", label:"航班資訊"},
  driving:  {icon:"🚗", label:"租車自駕"},
  weather:  {icon:"🌤", label:"天氣預報"},
  quake:    {icon:"🌏", label:"地震資訊"},
  packing:  {icon:"🧳", label:"行李清單"},
  food:     {icon:"🍜", label:"美食・伴手禮"}
};

// ---- Bottom mobile nav + "more" sheet ----
function buildMoreSheet(){
  const dayGrid = days.map((d,i)=>`
    <div class="more-sheet-day" data-page="${i}" ${TRIP.branch && i>=TRIP.branch.fromDay?'data-branch="b"':""}>
      <div class="n mono">${String(i+1).padStart(2,"0")}</div>
      <div class="t">${d.theme}</div>
    </div>`).join("");
  const itemGrid = EXTRA_PAGES.map(p=>`
    <div class="more-sheet-item" data-page="${p}">
      <span class="msi-icon">${EXTRA_PAGE_META[p].icon}</span>
      <span>${EXTRA_PAGE_META[p].label}</span>
    </div>`).join("") + `
    <a class="more-sheet-item" href="https://jschang0512.github.io/splitbill/" target="_blank" rel="noopener">
      <span class="msi-icon">💰</span>
      <span>旅費分帳</span>
    </a>`;
  document.getElementById("moreSheetDays").innerHTML = dayGrid;
  document.getElementById("moreSheetGrid").innerHTML = itemGrid;
}
function openMoreSheet(){ document.getElementById("moreSheet").classList.add("open"); }
function closeMoreSheet(){ document.getElementById("moreSheet").classList.remove("open"); }

// drag the handle down to dismiss the sheet, like a native bottom sheet
(function initSheetDrag(){
  const panel = document.querySelector(".more-sheet-panel");
  const handle = document.querySelector(".more-sheet-handle");
  if(!panel || !handle) return;
  let startY = 0, dragY = 0, dragging = false;

  function start(y){ dragging = true; startY = y; panel.style.transition = "none"; }
  function move(y){
    if(!dragging) return;
    dragY = Math.max(0, y - startY);
    panel.style.transform = `translateY(${dragY}px)`;
  }
  function end(){
    if(!dragging) return;
    dragging = false;
    panel.style.transition = "transform .25s ease";
    if(dragY > 90){
      panel.style.transform = "translateY(100%)";
      setTimeout(()=>{ closeMoreSheet(); panel.style.transform = ""; }, 200);
    } else {
      panel.style.transform = "";
    }
    dragY = 0;
  }

  handle.addEventListener("touchstart", e=>start(e.touches[0].clientY), {passive:true});
  handle.addEventListener("touchmove", e=>move(e.touches[0].clientY), {passive:true});
  handle.addEventListener("touchend", end);
  handle.addEventListener("mousedown", e=>{
    start(e.clientY);
    const onMove = ev=>move(ev.clientY);
    const onUp = ()=>{ end(); document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });
})();
document.getElementById("moreSheetClose").addEventListener("click", closeMoreSheet);

// food/buy sub-tabs
document.addEventListener("click", (e)=>{
  const tab = e.target.closest(".food-tab");
  if(!tab) return;
  document.querySelectorAll(".food-tab").forEach(t=>t.classList.remove("active"));
  document.querySelectorAll(".food-tab-panel").forEach(p=>p.classList.remove("active"));
  tab.classList.add("active");
  const panel = document.getElementById(tab.dataset.tab === "eat" ? "foodTabEat" : "foodTabBuy");
  if(panel) panel.classList.add("active");
});

// re-measures an open accordion's max-height after content inside it
// expands, so nothing gets clipped
function resyncFoodAreaHeight(fromEl){
  const list = fromEl.closest(".food-area-list");
  if(list && list.style.maxHeight && list.style.maxHeight !== "0px"){
    list.style.maxHeight = list.scrollHeight + "px";
  }
}
document.addEventListener("click", (e)=>{
  const head = e.target.closest(".food-area-head");
  if(head){
    const list = document.getElementById("food-area-" + head.dataset.area);
    if(!list) return;
    const open = head.classList.toggle("open");
    list.style.maxHeight = open ? (list.scrollHeight + "px") : "0px";
    return;
  }

  const souvBtn = e.target.closest(".souvenir-item");
  if(souvBtn){ toggleSouvenirMap(souvBtn); return; }
});
function toggleSouvenirMap(btn){
  const slot = document.getElementById(btn.dataset.mapId);
  if(!slot) return;
  const isOpen = slot.classList.toggle("open");
  if(!isOpen){ resyncFoodAreaHeight(slot); return; }

  if(!slot.dataset.built){
    slot.dataset.built = "1";
    const coord = COORDS[btn.dataset.coordKey];
    const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(btn.dataset.name)}`;
    if(coord){
      renderInlineMap(slot, coord[0], coord[1], btn.dataset.name, gmapsUrl);
    } else {
      slot.innerHTML = `<div class="food-map-loading">目前沒有這個地點的座標，<a href="${gmapsUrl}" target="_blank" rel="noopener">直接開 Google Maps 查詢 →</a></div>`;
    }
  }
  resyncFoodAreaHeight(slot);
}
function renderInlineMap(slot, lat, lng, label, gmapsUrl){
  slot.innerHTML = `<div class="food-map-canvas"></div><a class="maplink food-map-gmaps" href="${gmapsUrl}" target="_blank" rel="noopener">📍 在 Google Maps 開啟</a>`;
  const canvas = slot.querySelector(".food-map-canvas");
  const map = L.map(canvas, { zoomControl:false, attributionControl:false }).setView([lat,lng], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { subdomains:'abc', maxZoom:19 }).addTo(map);
  L.marker([lat,lng]).addTo(map).bindPopup(label);
}
function updateBottomNav(page, isExtra){
  const numEl = document.getElementById("bnCurrentNum");
  const themeEl = document.getElementById("bnCurrentTheme");
  const prevBtn = document.getElementById("bnPrev");
  const nextBtn = document.getElementById("bnNext");
  if(!numEl) return;
  if(isExtra){
    numEl.textContent = "EXTRA";
    themeEl.textContent = EXTRA_PAGE_META[page].icon + " " + EXTRA_PAGE_META[page].label;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
  } else {
    const idx = Number(page);
    numEl.textContent = "DAY " + String(idx+1).padStart(2,"0");
    themeEl.textContent = days[idx].theme;
    prevBtn.disabled = idx <= 0;
    nextBtn.disabled = idx >= days.length-1;
  }
  document.querySelectorAll(".more-sheet-day").forEach(d=>{
    d.classList.toggle("active", !isExtra && d.dataset.page === page);
  });
}
document.getElementById("bnPrev").addEventListener("click", ()=>{
  const btn = document.querySelector(".daytab.active");
  if(!btn) return;
  const idx = Number(btn.dataset.page);
  if(idx > 0) switchDayWithTransition(String(idx-1), "prev");
});
document.getElementById("bnNext").addEventListener("click", ()=>{
  const btn = document.querySelector(".daytab.active");
  if(!btn) return;
  const idx = Number(btn.dataset.page);
  if(idx < days.length-1) switchDayWithTransition(String(idx+1), "next");
});
document.getElementById("bnCurrent").addEventListener("click", ()=>{ buildMoreSheet(); openMoreSheet(); });
document.getElementById("bnMore").addEventListener("click", ()=>{ buildMoreSheet(); openMoreSheet(); });
document.getElementById("moreSheetBackdrop").addEventListener("click", closeMoreSheet);
document.getElementById("moreSheet").addEventListener("click", (e)=>{
  const dayCard = e.target.closest(".more-sheet-day");
  const itemCard = e.target.closest(".more-sheet-item");
  if(dayCard){ activatePage(dayCard.dataset.page); closeMoreSheet(); }
  else if(itemCard){ activatePage(itemCard.dataset.page); closeMoreSheet(); }
});
const REDUCED = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
let lastDayPage = "0";   // where "每日行程" in the top menu returns to
// on today's page: fade what is over, mark what comes next
function markNext(idx){
  const page = document.getElementById("day-" + idx);
  if(!page) return;
  page.querySelectorAll(".is-past, .is-next").forEach(r=>r.classList.remove("is-past", "is-next"));
  page.querySelectorAll(".next-pill").forEach(p=>p.remove());
  if(idx !== todayIndex()) return;
  const now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
  // most rows carry no time; only legs do. Rows before the latest leg already under way are over,
  // and the first leg still ahead is next.
  const rows = [...page.querySelectorAll(".timeline > .row")];
  const timeOf = (r)=>{ const t = (r.querySelector(".time")?.textContent || "").match(/(\d{1,2}):(\d{2})/); return t ? Number(t[1]) * 60 + Number(t[2]) : null; };
  let current = -1, next = -1;
  rows.forEach((r, i)=>{ const m = timeOf(r); if(m === null) return; if(m <= mins) current = i; else if(next < 0) next = i; });
  rows.forEach((r, i)=>{ if(i < current) r.classList.add("is-past"); });
  if(next >= 0){ rows[next].classList.add("is-next"); rows[next].insertAdjacentHTML("afterbegin", '<span class="next-pill">下一站</span>'); }
}
function activatePage(page, {jump=true, dir=null}={}){
  const isExtra = EXTRA_PAGES.includes(page);
  const btn = isExtra ? document.querySelector(`.util-btn[data-page="${page}"]`)
                       : document.querySelector(`.daytab[data-page="${page}"]`);
  const el = (page==="packing") ? document.getElementById("page-packing")
           : (page==="weather") ? document.getElementById("page-weather")
           : (page==="quake") ? document.getElementById("page-quake")
           : (page==="flights") ? document.getElementById("page-flights")
           : (page==="driving") ? document.getElementById("page-driving")
           : (page==="contacts") ? document.getElementById("page-contacts")
           : (page==="food") ? document.getElementById("page-food")
           : document.getElementById("day-"+page);
  if(!btn || !el) return;
  document.querySelectorAll(".daytab").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".util-btn").forEach(b=>b.classList.remove("active"));
  document.querySelectorAll(".day-page").forEach(p=>p.classList.remove("active","slide-next","slide-prev","exit-next","exit-prev"));
  btn.classList.add("active");
  el.classList.add("active");
  if(!isExtra){ lastDayPage = String(page); const d = document.querySelector('.util-btn[data-page="days"]'); if(d) d.classList.add("active"); }
  document.querySelectorAll(".daytab, .util-btn").forEach(b=>b.removeAttribute("aria-current"));
  btn.setAttribute("aria-current", "page");
  const menuBtn = isExtra ? btn : document.querySelector('.util-btn[data-page="days"]');
  if(menuBtn) menuBtn.setAttribute("aria-current", "page");
  const nav = document.getElementById("dayNav"); if(nav) nav.hidden = isExtra;
  try{ history.replaceState(null, "", "#" + (isExtra ? page : "day-" + page)); }catch(e){}
  if(menuBtn && menuBtn.scrollIntoView) menuBtn.scrollIntoView({behavior: REDUCED ? "auto" : "smooth", inline:"center", block:"nearest"});
  if(!isExtra) markNext(Number(page));
  el.querySelectorAll(".reveal:not(.revealed)").forEach(r=>r.classList.add("revealed"));
  if(dir === "next") el.classList.add("slide-next");
  else if(dir === "prev") el.classList.add("slide-prev");
  updateBottomNav(page, isExtra);

  if(page==="weather") loadWeather();
  else if(page==="quake") loadQuakes();
  else if(!isExtra){ buildDayMap(Number(page)); if(TRIP.sun) loadSunTimes(Number(page)); }

  if(!isExtra) btn.scrollIntoView({behavior:"smooth", inline:"center", block:"nearest"});
  if(jump){
    // land on the page's own heading, just under the fixed menu and the date bar
    const bars = (document.querySelector(".util-bar")?.offsetHeight || 0) + (nav && !nav.hidden ? nav.offsetHeight : 0);
    let y = -bars - 8;   // offsetTop ignores the page's entrance bounce transform
    for(let n = el; n; n = n.offsetParent) y += n.offsetTop;
    window.scrollTo({top: Math.max(0, y), behavior: REDUCED ? "auto" : "smooth"});
  }
}

// plays a brief exit animation on the current day page before switching,
// so day-to-day navigation reads as a clear directional slide rather than
// a plain cross-fade
function switchDayWithTransition(newPage, dir){
  const current = document.querySelector(".day-page.active");
  if(current && dir){
    current.classList.add(dir === "next" ? "exit-next" : "exit-prev");
    setTimeout(()=>{ activatePage(newPage, {dir}); }, 160);
  } else {
    activatePage(newPage, {dir});
  }
}
document.getElementById("dayNav").addEventListener("click",(e)=>{
  const btn = e.target.closest(".daytab");
  if(!btn) return;
  activatePage(btn.dataset.page);
});
document.getElementById("utilBar").addEventListener("click",(e)=>{
  const btn = e.target.closest(".util-btn");
  if(!btn || !btn.dataset.page) return;
  activatePage(btn.dataset.page === "days" ? lastDayPage : btn.dataset.page);
});

// ---- Packing list persistence ----
const PACK_KEY = TRIP.key + "-packing-v1";
function loadPackState(){
  try{ return JSON.parse(localStorage.getItem(PACK_KEY)) || {}; }catch(e){ return {}; }
}
function savePackState(state){
  try{ localStorage.setItem(PACK_KEY, JSON.stringify(state)); }catch(e){}
}
function refreshPackProgress(){
  const boxes = document.querySelectorAll("#page-packing input[type=checkbox]");
  const total = boxes.length;
  const checked = document.querySelectorAll("#page-packing input[type=checkbox]:checked").length;
  const fill = document.getElementById("packFill");
  const count = document.getElementById("packCount");
  if(fill) fill.style.width = (total? (checked/total*100) : 0) + "%";
  if(count) count.textContent = checked + " / " + total;
  if(total > 0 && checked === total){
    packCelebrate();
  } else {
    packUncelebrate();
  }
}

// small confetti burst celebrating a fully-packed list — only fires once per
// completion (guarded so re-checking an already-complete list doesn't replay it)
let packCelebrated = false;
// small toast that slides up from the bottom, e.g. after a successful copy
let toastTimer = null;
function undoToast(msg, undo){
  let el = document.getElementById("undoToast");
  if(!el){ el = document.createElement("div"); el.id = "undoToast"; el.className = "app-toast undo-toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.innerHTML = `<span>${msg}</span><button type="button">復原</button>`;
  el.classList.add("show");
  clearTimeout(el._t);
  el.querySelector("button").onclick = ()=>{ undo(); el.classList.remove("show"); };
  el._t = setTimeout(()=> el.classList.remove("show"), 7000);
}
function showToast(msg){
  let el = document.getElementById("appToast");
  if(!el){
    el = document.createElement("div");
    el.id = "appToast";
    el.className = "app-toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>{ el.classList.remove("show"); }, 1600);
}
function fireConfetti(originYPercent){
  const colors = TRIP.colors.confetti;
  const container = document.createElement("div");
  container.className = "pack-confetti";
  for(let i=0;i<28;i++){
    const bit = document.createElement("span");
    bit.style.left = (45 + Math.random()*10) + "%";
    bit.style.top = (originYPercent || 35) + "%";
    bit.style.background = colors[i % colors.length];
    bit.style.animationDelay = (Math.random()*0.15) + "s";
    bit.style.setProperty("--dx", (Math.random()*220-110) + "px");
    bit.style.setProperty("--rot", (Math.random()*520-260) + "deg");
    container.appendChild(bit);
  }
  document.body.appendChild(container);
  setTimeout(()=>{ container.remove(); }, 1600);
}
function packCelebrate(){
  if(packCelebrated) return;
  packCelebrated = true;
  fireConfetti(35);
}
function packUncelebrate(){ packCelebrated = false; }
(function initContactsGate(){
  const gate = document.getElementById("contactsGate");
  const content = document.getElementById("contactsContent");
  const input = document.getElementById("gateInput");
  const btn = document.getElementById("gateSubmit");
  const msg = document.getElementById("gateMsg");
  if(!TRIP.contactsGate || !gate || !content || !input || !btn) return;

  const ANSWER = TRIP.contactsGate.answer;

  function unlock(){
    gate.style.display = "none";
    content.style.display = "block";
    content.classList.add("fade-in");
  }

  function tryAnswer(){
    const val = input.value.trim();
    if(val === ANSWER){
      msg.textContent = "✓ 答對了！";
      msg.classList.add("ok");
      gate.classList.add("gate-success");
      fireConfetti(30);
      setTimeout(unlock, 650);
    } else {
      msg.textContent = "不對喔，再想想～";
      msg.classList.remove("ok");
    }
  }
  btn.addEventListener("click", tryAnswer);
  input.addEventListener("keydown", (e)=>{ if(e.key === "Enter") tryAnswer(); });
})();
(function initPacking(){
  const state = loadPackState();
  document.querySelectorAll("#page-packing input[type=checkbox]").forEach(box=>{
    const key = box.dataset.key;
    if(state[key]) box.checked = true;
    box.addEventListener("change", ()=>{
      const s = loadPackState();
      s[key] = box.checked;
      savePackState(s);
      const item = box.closest(".pack-item");
      item.classList.toggle("done", box.checked);
      if(box.checked){
        item.classList.remove("just-checked");
        void item.offsetWidth;
        item.classList.add("just-checked");
      }
      refreshPackProgress();
    });
    if(box.checked) box.closest(".pack-item").classList.add("done");
  });
  document.querySelectorAll("#page-packing .pack-link").forEach(a=>{
    a.addEventListener("click", e=>e.stopPropagation());
  });
  document.querySelectorAll(".addr-copy-mini").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      const text = btn.dataset.val || "";
      const done = ()=>{
        btn.innerHTML = SB_ICON.check;
        btn.classList.add("copied");
        showToast("已複製");
        setTimeout(()=>{ btn.innerHTML = SB_ICON.copy; btn.classList.remove("copied"); }, 1400);
      };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(done).catch(()=>{
          const ta = document.createElement("textarea");
          ta.value = text; document.body.appendChild(ta); ta.select();
          try{ document.execCommand("copy"); done(); }catch(err){}
          document.body.removeChild(ta);
        });
      } else {
        const ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        try{ document.execCommand("copy"); done(); }catch(err){}
        document.body.removeChild(ta);
      }
    });
  });
  refreshPackProgress();
  const resetBtn = document.getElementById("packReset");
  if(resetBtn) resetBtn.addEventListener("click", ()=>{
    const before = loadPackState();
    undoToast("已清空待辦清單", ()=>{
      savePackState(before);
      document.querySelectorAll("#page-packing input[type=checkbox]").forEach(box=>{
        box.checked = !!before[box.dataset.key];
        box.closest(".pack-item").classList.toggle("done", box.checked);
      });
      refreshPackProgress();
    });
    savePackState({});
    document.querySelectorAll("#page-packing input[type=checkbox]").forEach(box=>{
      box.checked = false;
      box.closest(".pack-item").classList.remove("done");
    });
    refreshPackProgress();
  });
})();
function pageFromHash(){
  const m = location.hash.match(/day-(\d+)/);
  if(location.hash === "#packing") return "packing";
  if(location.hash === "#weather") return "weather";
  if(location.hash === "#quake") return "quake";
  if(location.hash === "#flights") return "flights";
  if(location.hash === "#driving") return "driving";
  if(location.hash === "#contacts") return "contacts";
  if(TRIP.food && location.hash === "#food") return "food";
  return m ? m[1] : 0;
}
// during the trip, open on today unless a link asks for a page
(function(){
  const t = todayIndex();
  if(t >= 0){
    document.documentElement.classList.add("trip-live");
    const tab = document.querySelector(`.daytab[data-page="${t}"] .num`);
    if(tab) tab.insertAdjacentHTML("beforeend", '<span class="today-dot">今天</span>');
  }
  activatePage(location.hash ? pageFromHash() : (t >= 0 ? String(t) : 0), {jump:false});
  if(t >= 0) setInterval(()=>{ if(document.getElementById("day-" + t)?.classList.contains("active")) markNext(t); }, 60000);
})();
window.addEventListener("hashchange", ()=> activatePage(pageFromHash()));

// swipe left/right anywhere on the page to switch days (not just via the
// bottom nav) — ignored while touching a Leaflet map, so map panning still
// works normally, and ignored when the gesture is mostly vertical (scrolling)
(function initSwipeDays(){
  const target = document.getElementById("main");
  if(!target) return;
  let startX = 0, startY = 0, tracking = false;

  target.addEventListener("touchstart", (e)=>{
    if(e.target.closest(".leaflet-container")) { tracking = false; return; }
    if(e.touches.length !== 1) { tracking = false; return; }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive:true });

  target.addEventListener("touchend", (e)=>{
    if(!tracking) return;
    tracking = false;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if(Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return; // not a clear horizontal swipe

    const activeTab = document.querySelector(".daytab.active");
    if(!activeTab) return; // only switch days while on a day page, not an extra page
    const idx = Number(activeTab.dataset.page);
    if(dx < 0 && idx < days.length - 1) switchDayWithTransition(String(idx + 1), "next");      // swipe left → next day
    else if(dx > 0 && idx > 0) switchDayWithTransition(String(idx - 1), "prev");                // swipe right → previous day
    else if(dx < 0 || dx > 0) shakeBoundary();  // swiped further but already at the first/last day
  }, { passive:true });
})();

// shakes the current day page briefly to signal "you're at the first/last day"
function shakeBoundary(){
  const current = document.querySelector(".day-page.active");
  if(!current) return;
  current.classList.remove("shake-boundary");
  void current.offsetWidth;
  current.classList.add("shake-boundary");
}

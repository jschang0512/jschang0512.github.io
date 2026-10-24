/* ============================================================
   data.js — everything specific to this trip.
   TRIP holds the settings the engine reads; the rest is the itinerary.
   Helpers T() A() N() S() come from engine/trip-core.js:
     T(mode, from, fromTime, to, toTime, line, price, transfer)  a transit leg
     A(tag, text, time, place)                                   an activity
     N(text)                                                     a note box
     S(label)                                                    a section heading
   A place name ties three things together: INFO[place] (tap-to-open text),
   COORDS[place] (pin on the day map) and the Google Maps search link.
   ============================================================ */

const TRIP = {
  key: "mytrip",                 // localStorage prefix: theme + packing checklist (match schedule.html)
  dests: ["城市A", "城市B"],
  dateRange: "2027年01月10日～2027年01月11日",
  departISO: "2027-01-10T08:00:00+08:00",     // countdown target
  sun: true,                     // show sunrise/sunset on each day
  food: null,                    // null = no food map page; or { city: "城市A" } and fill FOOD_AREAS
  couponFile: null,              // PDF in this folder for INFO[...].coupon entries
  contactsGate: null,            // optional quiz before contacts show: { question: "…", answer: "…" }
  branch: null,                  // e.g. { fromDay: 3 } — from that day on the route map uses colors.branch
  colors: {
    route: "#33518A",
    branch: "#A65D2E",
    shindo3: "#33518A",          // earthquake markers, 震度3・4
    shindo1: "#8FA3CC",          // earthquake markers, 震度1・2
    confetti: ["#6E86B8", "#D9A73B", "#33518A", "#F0DDB0"]
  },
  weatherNote: "氣象預報僅能顯示最近約16天，建議出發前一週再回來查看最新預報。資料來源：Open-Meteo。",
  quake: {
    title: "沿線地震資訊",
    mapLabel: "沿線震央位置圖",
    region: "沿線地區",
    note: "僅顯示行程沿線附近的近期地震，供旅途中參考，<b>不是</b>緊急地震速報或警報系統。若人在日本遇到地震，請以手機的「緊急速報メール」、電視、NHK或當地廣播的官方警報為準。資料來源：P2P地震情報。",
    bbox: { latMin: 34.5, latMax: 36.5, lngMin: 138.5, lngMax: 140.5 },
    center: [35.6, 139.6]
  },
  // a string, or a function that receives the total passenger count
  flightsNote: "時間皆為當地時間，已標註時區（台灣 UTC+8／日本 UTC+9，時差1小時）。",
};

const MODE = {
  air:   {color:"var(--air)",   icon:"✈️", label:"飛機"},
  rail:  {color:"var(--rail)",  icon:"🚃", label:"鐵路"},
  bus:   {color:"var(--bus)",   icon:"🚌", label:"巴士"},
  boat:  {color:"var(--boat)",  icon:"⛴",  label:"船"},
  cable: {color:"var(--cable)", icon:"🚡", label:"纜車"},
  walk:  {color:"var(--walk)",  icon:"🚶", label:"步行"},
  car:   {color:"var(--car)",   icon:"🚕", label:"車"}
};

const TAG = {
  meal:{icon:"🍽"}, sight:{icon:"🏯"}, shop:{icon:"🛍"}, view:{icon:"🌄"}, onsen:{icon:"♨"}, hotel:{icon:"🏨"}
};

// exact Google Maps links for places whose plain-name search lands on the wrong spot
const MAP_URL_OVERRIDE = {};

// tap-to-open text for an activity; optional: souvenir, coupon (needs TRIP.couponFile), links:[{label,url}]
const INFO = {
  "淺草寺": {
    intro: "這裡寫景點介紹。",
    tip: "這裡寫小提醒，例如人潮、開放時間。",
    links: [{ label: "官方網站", url: "https://www.senso-ji.jp/" }]
  }
};

const days = [
{
  date:"1/10（日）", theme:"抵達", route:"桃園 → 成田 → 淺草", hotel:"淺草飯店",
  items:[
    S("移動：桃園 → 東京"),
    T("air","桃園國際機場","08:00","成田機場","12:20","班機號碼","","約3h20m"),
    T("rail","成田機場","13:30","淺草駅","14:40","京成 Access 特急","¥1,370",""),
    A("hotel","飯店 Check-in","15:00","淺草飯店"),
    S("下午"),
    A("sight","淺草寺","16:00","淺草寺"),
    N("可以在這裡放提醒，支援 <b>HTML</b>。")
  ]
},
{
  date:"1/11（一）", theme:"返程", route:"淺草 → 成田 → 桃園", hotel:"",
  items:[
    T("rail","淺草駅","09:00","成田機場","10:10","京成 Access 特急","¥1,370",""),
    T("air","成田機場","13:00","桃園國際機場","16:10","班機號碼","","")
  ]
}
];

const PACKING = [
  { cat:"證件與金錢", items:["護照","信用卡","日幣現金","Visit Japan Web"] },
  { cat:"交通與通訊", items:["上網 SIM 卡 / eSIM","行動電源","充電線"] },
  { cat:"衣物", items:["走路鞋","薄外套"] }
];

const WEATHER_CITIES = [
  { key:"tokyo", name:"東京", lat:35.6812, lng:139.7671 }
];

// CONTACTS {name, phone, fb?}; LODGING {city, name, addr}
const CONTACTS = [];
const LODGING = [];

// entries: [] with a pending note until the flight is booked; pax is optional
const FLIGHTS = [
  { date:"1/10（日）", note:"去程", entries:[
      { flight:"XX123", airline:"航空公司", aircraft:"機型",
        from:"桃園國際機場 TPE", to:"成田機場 NRT",
        dep:"08:00", depTz:"UTC+8", arr:"12:20", arrTz:"UTC+9",
        link:"https://www.flightradar24.com/" }
  ]},
  { date:"1/11（一）", note:"返程", entries:[], pending:"回程還沒訂，訂好後補進這裡。" }
];

// [lat, lng] for every place name used above — this draws the day maps
const COORDS = {
  "桃園國際機場":[25.0797,121.2342],
  "成田機場":[35.7720,140.3929],
  "淺草駅":[35.7106,139.7966],
  "淺草飯店":[35.7120,139.7950],
  "淺草寺":[35.7148,139.7967]
};

// free-form page; keep the section id and the day-head block
function buildDrivingPage(){
  return `<section class="day-page" id="page-driving">
    <div class="day-head">
      <div class="dnum mono">🚗</div>
      <div class="dmeta">
        <div class="ddate">SELF-DRIVE INFO</div>
        <div class="dtitle">租車自駕資訊</div>
      </div>
    </div>
    <p class="wx-note">這趟沒有自駕，或租車資訊之後補上。</p>
  </section>`;
}

// food map page (only used when TRIP.food is set) — copy the shape from ../fukuoka/data.js
const FOOD_AREAS = [];

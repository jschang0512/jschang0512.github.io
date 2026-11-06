// 節日場景：只有節日期間才由 holiday.js 載入。頁首鋪一幅平塗插畫：純色天空，
// 造型用兩三階同色系做出明暗，再加金線之類的細節；底部是每個節日自己的紋樣
// 地面，橫向重複到滿版，畫面才收得住。左右插畫分開貼齊兩側，避開中間的標題。
(function holidayScene(){
  const GOLD = "#F2C14E", CREAM = "#F7F2E6";

  function lantern(x, cord, s, delay, word){
    const y = cord + 34 * s, rx = 40 * s, ry = 28 * s;
    return `<g class="sb-sway" style="transform-origin:${x}px 0;animation-delay:${delay}s">
      <line x1="${x}" y1="0" x2="${x}" y2="${cord}" stroke="${GOLD}" stroke-width="1.6"/>
      <path d="M${x - 15 * s} ${cord + 7 * s}l${3 * s} ${-7 * s}h${24 * s}l${3 * s} ${7 * s}z" fill="${GOLD}"/>
      <ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#C8241C"/>
      <ellipse cx="${x}" cy="${y}" rx="${rx * .68}" ry="${ry}" fill="#E0392A"/>
      <ellipse cx="${x}" cy="${y}" rx="${rx * .32}" ry="${ry}" fill="#F0553A"/>
      <path d="M${x - rx * .78} ${y - ry * .5}q${rx * .78} ${-ry * .34} ${rx * 1.56} 0M${x - rx * .78} ${y + ry * .5}q${rx * .78} ${ry * .34} ${rx * 1.56} 0" fill="none" stroke="${GOLD}" stroke-opacity=".7" stroke-width="1"/>
      ${word ? `<text x="${x}" y="${y + 8 * s}" text-anchor="middle" font-size="${23 * s}" font-weight="700" fill="${GOLD}">福</text>` : ""}
      <path d="M${x - 15 * s} ${y + ry - 2 * s}h${30 * s}l${-3 * s} ${7 * s}h${-24 * s}z" fill="${GOLD}"/>
      <circle cx="${x}" cy="${y + ry + 9 * s}" r="${3 * s}" fill="${GOLD}"/>
      <path d="M${x - 5 * s} ${y + ry + 12 * s}h${10 * s}l${2 * s} ${20 * s}h${-14 * s}z" fill="#E0392A"/>
    </g>`;
  }
  function blossom(x, y, r, fill){
    let out = "";
    for(let i = 0; i < 5; i++){
      const a = (i * 72 - 90) * Math.PI / 180;
      out += `<circle cx="${(x + Math.cos(a) * r * .68).toFixed(1)}" cy="${(y + Math.sin(a) * r * .68).toFixed(1)}" r="${(r * .56).toFixed(1)}" fill="${fill}"/>`;
    }
    out += `<circle cx="${x}" cy="${y}" r="${(r * .42).toFixed(1)}" fill="#F7A8A0"/>`;
    for(let i = 0; i < 5; i++){
      const a = (i * 72 - 54) * Math.PI / 180;
      const px = x + Math.cos(a) * r * .5, py = y + Math.sin(a) * r * .5;
      out += `<line x1="${x}" y1="${y}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#B3261E" stroke-width=".8"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="1.2" fill="${GOLD}"/>`;
    }
    return out;
  }
  // 三層松樹：右半邊深一階當陰影，每層尖端壓一點雪
  function pine(x, base, h, light, dark, snow){
    let out = `<rect x="${x - h * .035}" y="${base - h * .12}" width="${h * .07}" height="${h * .12}" fill="#3A2A20"/>`;
    [[0, .46, .24], [.22, .72, .34], [.46, 1, .44]].forEach(([t, b, w]) => {
      const top = base - h * .96 + t * h * .96, bottom = base - h * .96 + b * h * .9, half = h * w;
      out += `<path d="M${x} ${top}L${x + half} ${bottom}H${x - half}Z" fill="${light}"/><path d="M${x} ${top}L${x + half} ${bottom}H${x}Z" fill="${dark}"/>`;
      if(snow) out += `<path d="M${x} ${top}l${half * .36} ${(bottom - top) * .36}q${-half * .18} ${h * .05} ${-half * .36} 0t${-half * .36} 0z" fill="${CREAM}"/>`;
    });
    return out;
  }
  const HEART = "M0 12C-8-4-34-2-34 20c0 20 22 32 34 44 12-12 34-24 34-44C34-2 8-4 0 12z";
  function heart(x, cord, s, delay, fill, shade){
    return `<g class="sb-sway" style="transform-origin:${x}px 0;animation-delay:${delay}s">
      <line x1="${x}" y1="0" x2="${x}" y2="${cord + 10 * s}" stroke="#FFE3EC" stroke-width="1.4"/>
      <g transform="translate(${x} ${cord}) scale(${s})">
        <path d="${HEART}" fill="${fill}"/>
        <path d="M0 12c12-16 34-14 34 8 0 20-22 32-34 44z" fill="${shade}"/>
        <path transform="scale(.76) translate(0 7)" d="${HEART}" fill="none" stroke="#C2366E" stroke-opacity=".5" stroke-width="1.6" stroke-dasharray="4 4"/>
      </g>
    </g>`;
  }
  function ring(x, y, r, n, len, color, dot){
    let out = "";
    for(let i = 0; i < n; i++){
      const a = i / n * Math.PI * 2 + r;
      const c = Math.cos(a), s = Math.sin(a);
      out += `<line x1="${(x + c * r * (1 - len)).toFixed(1)}" y1="${(y + s * r * (1 - len)).toFixed(1)}" x2="${(x + c * r).toFixed(1)}" y2="${(y + s * r).toFixed(1)}"/><circle cx="${(x + c * (r + 5)).toFixed(1)}" cy="${(y + s * (r + 5)).toFixed(1)}" r="${dot}" fill="${color}" stroke="none"/>`;
    }
    return out;
  }
  function burst(x, y, r, a, b, delay){
    return `<g class="sb-burst" stroke-linecap="round" style="transform-origin:${x}px ${y}px;animation-delay:${delay}s">
      <g stroke="${a}" stroke-width="1.8">${ring(x, y, r, 18, .42, a, 1.8)}</g>
      <g stroke="${b}" stroke-width="2.2">${ring(x, y, r * .54, 10, .5, b, 2.2)}</g>
      <circle cx="${x}" cy="${y}" r="${r * .1}" fill="${a}"/>
    </g>`;
  }
  const BAT = "M0 0c-3-3-3-7-1-9l3 4h4l3-4c2 2 2 6-1 9 8-6 20-6 28 2-6 0-9 3-10 8-3-3-7-4-11-1-2-3-4-4-6-4s-4 1-6 4c-4-3-8-2-11 1-1-5-4-8-10-8 8-8 20-8 28-2z";
  function pumpkin(x, y, s){
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M2-40c-2-10 2-18 12-20 2 6 0 10-5 12 0 3 0 6 2 8z" fill="#4F7A3A"/>
      <path d="M12-44c14-6 26 2 22 12-8 2-18-2-22-12z" fill="#6A9A4C"/>
      <path d="M12-44c8 2 16 6 22 12" fill="none" stroke="#3F6330" stroke-width="1.4"/>
      <ellipse cx="-42" cy="0" rx="26" ry="36" fill="#C85F14"/><ellipse cx="42" cy="0" rx="26" ry="36" fill="#C85F14"/>
      <ellipse cx="-24" cy="0" rx="28" ry="42" fill="#E0761C"/><ellipse cx="24" cy="0" rx="28" ry="42" fill="#E0761C"/>
      <ellipse cx="0" cy="0" rx="26" ry="44" fill="#F28F2E"/>
      <path d="M-34-8l15-13 7 18zM34-8l-15-13-7 18z" fill="#FFD66B"/><path d="M-5 4l5-8 5 8z" fill="#FFD66B"/>
      <path d="M-32 14q32 26 64 0l-9 2-5 7-8-6-6 8-6-8-6 8-6-8-8 6-5-7z" fill="#FFD66B"/>
    </g>`;
  }
  function zongzi(x, y, s){
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M0-54C8-54 60 30 60 42c0 8-8 13-16 13h-88c-8 0-16-5-16-13C-60 30-8-54 0-54z" fill="#3E9C78"/>
      <path d="M0-54C8-54 60 30 60 42c0 8-8 13-16 13H0z" fill="#2F8F72"/>
      <path d="M-7-42C-22-8-36 20-40 52M0-50V55M7-42C22-8 36 20 40 52M-24-8c6 18 8 38 8 60M24-8c-6 18-8 38-8 60" fill="none" stroke="#1F7558" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M-13-32L20 54M13-32L-20 54" fill="none" stroke="${CREAM}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M-45 8C-16 19 16 19 45 8" fill="none" stroke="${CREAM}" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M0 14c-8-12-24-10-24 0s16 10 24 0c8-12 24-10 24 0s-16 10-24 0z" fill="none" stroke="${CREAM}" stroke-width="3"/>
      <circle cx="0" cy="14" r="4.5" fill="${CREAM}"/>
    </g>`;
  }
  function magpie(x, y, s, flip){
    return `<g transform="translate(${x} ${y}) scale(${flip * s} ${s})">
      <path d="M-78 34l48-30 12 14-50 28z" fill="#2B2F6B"/>
      <path d="M-30 8c8-24 36-34 58-20 6 4 8 10 8 16 0 22-24 34-46 30-14-3-24-14-20-26z" fill="#2B2F6B"/>
      <path d="M-6 20c10 10 32 8 40-8 1 20-22 30-38 24-6-2-6-10-2-16z" fill="#FFFFFF"/>
      <path d="M-24 6c10-16 30-16 38-3-10 15-26 18-38 3z" fill="#4C6FD0"/>
      <circle cx="26" cy="-14" r="15" fill="#2B2F6B"/>
      <path d="M40-18l15 5-15 5z" fill="${GOLD}"/>
      <circle cx="31" cy="-17" r="2.6" fill="#FFFFFF"/>
    </g>`;
  }
  function tangyuan(x, y, r, fill, shade){
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/><path d="M${x} ${y - r}a${r} ${r} 0 0 1 0 ${r * 2}a${r * 1.3} ${r * 1.3} 0 0 0 0-${r * 2}z" fill="${shade}"/><circle cx="${x - r * .36}" cy="${y - r * .36}" r="${r * .18}" fill="#FFFFFF"/>`;
  }
  function bowl(x, y, s){
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-24-76c-8-8 8-14 0-24M6-80c-8-8 8-14 0-24M34-74c-8-8 8-14 0-24" fill="none" stroke="${CREAM}" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/>
      ${tangyuan(-34, -42, 20, "#FFF3EE", "#F2DDD6")}${tangyuan(34, -40, 19, CREAM, "#E6DFCF")}${tangyuan(0, -50, 22, "#FFC9D6", "#F7AFC0")}
      <path d="M-78-30h156c-6 30-30 46-54 46h-48c-24 0-48-16-54-46z" fill="#F7F2E6"/>
      <path d="M0-30h78c-6 30-30 46-54 46H0z" fill="#E6DFCF"/>
      <path d="M-80-32h160" stroke="#C8362B" stroke-width="5" stroke-linecap="round"/>
      <path d="M-54-12q10 10 20 0t20 0 20 0 20 0 20 0 20 0" fill="none" stroke="#3E6FB0" stroke-width="2.4"/>
      <rect x="-26" y="16" width="52" height="7" rx="3" fill="#D8CFBC"/>
    </g>`;
  }
  function cloud(x, y, s, fill, line){
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-70 16a14 14 0 0 1 8-26 24 24 0 0 1 44-10 30 30 0 0 1 52 2 20 20 0 0 1 32 34z" fill="${fill}"/>
      <path d="M-44 4c0-12 18-14 20-3 1 7-9 9-11 3M16 2c0-12 18-14 20-3 1 7-9 9-11 3" fill="none" stroke="${line}" stroke-width="2.2" stroke-linecap="round"/>
    </g>`;
  }
  const svg = (cls, hang, body) => `<svg class="${cls}" viewBox="0 0 420 180" preserveAspectRatio="${cls.includes("-r") ? "xMax" : "xMin"}${hang ? "YMin" : "YMax"} meet" aria-hidden="true">${body}</svg>`;
  // 手機上右側插畫會靠近標題，離標題最近的小配件先收起來
  const far = body => `<g class="sb-far">${body}</g>`;
  const tile = (w, h, body) => "url('data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`) + "')";

  const SCENES = {
    lunar: {
      status: "#9E1B1B",
      ground: { h: 26, w: 52, img: tile(52, 26, `<rect y="13" width="52" height="13" fill="#7A1216"/><g fill="#7A1216" stroke="${GOLD}" stroke-opacity=".75" stroke-width="1.2"><circle cx="0" cy="26" r="24"/><circle cx="52" cy="26" r="24"/><circle cx="26" cy="26" r="24"/></g><g fill="none" stroke="${GOLD}" stroke-opacity=".5" stroke-width="1"><circle cx="26" cy="26" r="16"/><circle cx="26" cy="26" r="8"/></g>`) },
      left: svg("sb-scene-l", true, `
        <path d="M0 16c60 6 96 26 150 24 40-2 66 12 104 8" fill="none" stroke="#5A0C10" stroke-width="7" stroke-linecap="round"/>
        <path d="M78 26c14 18 26 40 54 50M150 40c6 22 24 34 30 58M214 44c10 8 16 18 34 22" fill="none" stroke="#5A0C10" stroke-width="4" stroke-linecap="round"/>
        ${blossom(52, 24, 13, "#FFE3DC")}${blossom(132, 78, 14, "#FFF1EC")}${blossom(182, 100, 11, "#FFE3DC")}${blossom(250, 66, 12, "#FFF1EC")}${blossom(112, 42, 9, "#FFD3CB")}
        <circle cx="208" cy="62" r="4" fill="#FFD3CB"/><circle cx="96" cy="54" r="3.5" fill="#FFD3CB"/>`),
      right: svg("sb-scene-r", true, lantern(344, 18, .98, 0, true) + lantern(246, 6, .74, -1.4, false) + far(lantern(160, 28, .58, -2.6, false)))
    },
    midautumn: {
      status: "#1C2554", particle: "star", count: 8,
      ground: { h: 30, w: 320, img: tile(320, 30, `<path d="M0 30V20C50 2 110 2 160 16s110 14 160 4v10z" fill="#141B40"/>`) },
      left: svg("sb-scene-l", false, `
        <g transform="translate(112 158)"><path d="M-30 0c-14-2-20-16-10-26 8-10 28-10 38-2 4-14 20-16 28-8 8 10 2 22-10 24l2 12z" fill="${CREAM}"/>
          <path d="M6-30c-6-10-8-26-2-34 8 6 12 22 8 34zM20-34c0-12 6-24 14-28 4 10 0 24-8 32z" fill="${CREAM}"/>
          <path d="M8-36c-3-6-4-14-2-20 4 5 6 13 5 20zM22-38c1-7 4-14 8-17 1 6-1 13-4 19z" fill="#F3B6B0"/>
          <circle cx="-36" cy="-14" r="7" fill="#E8E2D2"/><circle cx="24" cy="-20" r="2.2" fill="#141B40"/><path d="M-2 0h12" stroke="#E8E2D2" stroke-width="2"/></g>
        <g transform="translate(214 150)"><circle r="20" fill="#C98A36"/><g fill="#C98A36">${[...Array(12)].map((_, i) => `<circle cx="${(Math.cos(i * Math.PI / 6) * 20).toFixed(1)}" cy="${(Math.sin(i * Math.PI / 6) * 20).toFixed(1)}" r="4.5"/>`).join("")}</g><circle r="15" fill="#E2A84C"/><circle r="11" fill="none" stroke="#C98A36" stroke-width="1.5"/><path d="M-6 0h12M0-6v12" stroke="#C98A36" stroke-width="2" stroke-linecap="round"/></g>`),
      right: svg("sb-scene-r", true, `
        <circle cx="306" cy="74" r="62" fill="#F7DA8C"/>
        <path d="M306 12a62 62 0 0 1 0 124 74 74 0 0 0 0-124z" fill="#EFC768"/>
        <g fill="#E3B654"><circle cx="280" cy="58" r="11"/><circle cx="322" cy="96" r="15"/><circle cx="326" cy="46" r="6"/></g>
        <g fill="#F0CB72"><circle cx="280" cy="58" r="6"/><circle cx="322" cy="96" r="9"/></g>
        <g class="sb-drift">${cloud(236, 112, .62, "#3A4A94", "#5868B4")}</g>
        <g class="sb-drift is-slow">${cloud(372, 134, .5, "#2F3D82", "#4C5CA6")}</g>`)
    },
    christmas: {
      status: "#14493A", particle: "snow", count: 10,
      strip: tile(240, 34, `<path d="M0 3Q60 26 120 3T240 3" fill="none" stroke="#0B2F25" stroke-width="2"/><g stroke="#0B2F25" stroke-width="2"><line x1="30" y1="12" x2="30" y2="16"/><line x1="90" y1="12" x2="90" y2="16"/><line x1="150" y1="12" x2="150" y2="16"/><line x1="210" y1="12" x2="210" y2="16"/></g><ellipse cx="30" cy="21" rx="4" ry="6" fill="${GOLD}"/><ellipse cx="90" cy="21" rx="4" ry="6" fill="#E5484D"/><ellipse cx="150" cy="21" rx="4" ry="6" fill="${CREAM}"/><ellipse cx="210" cy="21" rx="4" ry="6" fill="${GOLD}"/>`),
      ground: { h: 22, w: 200, img: tile(200, 22, `<path d="M0 22V12c30-10 60-10 100 0s70 10 100 0v10z" fill="${CREAM}"/><path d="M0 22v-4c40-6 70-2 100 2s70 2 100-2v4z" fill="#DCE5DF"/>`) },
      left: svg("sb-scene-l", false, `
        ${pine(44, 168, 138, "#1B5A47", "#0E3A2D", true)}${pine(118, 170, 92, "#2A7058", "#1B5A47", true)}
        <g transform="translate(218 168)">
          <rect x="30" y="-78" width="12" height="28" fill="#6B3F2A"/><rect x="28" y="-82" width="16" height="6" fill="${CREAM}"/>
          <rect x="-44" y="-46" width="88" height="48" fill="#7A4A30"/><path d="M-44-34h88M-44-22h88M-44-10h88" stroke="#5E3722" stroke-width="1.2"/>
          <path d="M-56-44L0-84 56-44z" fill="#4A2A1C"/><path d="M-58-42L0-86l58 44c-8 4-14-2-22 2s-14-2-22 1-14-3-22 1-12-2-20 0-14-3-22 0-14 0-8-2z" fill="${CREAM}"/>
          <rect x="-30" y="-34" width="24" height="24" rx="1" fill="#FFD27A"/><path d="M-18-34v24M-30-22h24" stroke="#7A4A30" stroke-width="2"/>
          <rect x="10" y="-30" width="20" height="32" rx="1" fill="#3A2A20"/><circle cx="25" cy="-13" r="1.6" fill="${GOLD}"/>
        </g>`),
      right: svg("sb-scene-r", false, `
        ${far(pine(160, 170, 84, "#2A7058", "#1B5A47", true))}${pine(396, 170, 104, "#2A7058", "#1B5A47", true)}
        ${pine(288, 170, 150, "#1F6650", "#0E3A2D", true)}
        <path d="M288 2l4 10 11 1-8 7 3 11-10-6-10 6 3-11-8-7 11-1z" fill="${GOLD}"/>
        <path d="M254 92q34 16 70-4M238 130q50 20 104-6" fill="none" stroke="${GOLD}" stroke-width="1.6"/>
        ${[[262,98,GOLD],[296,104,"#E5484D"],[316,92,CREAM],[246,136,"#E5484D"],[276,146,GOLD],[310,142,CREAM],[334,128,"#E5484D"]].map(([x, y, c], i) => `<circle class="sb-twinkle" style="animation-delay:${-i * .5}s" cx="${x}" cy="${y}" r="4" fill="${c}"/>`).join("")}`)
    },
    halloween: {
      status: "#3A1F5C", particle: "star", count: 6,
      ground: { h: 30, w: 66, img: tile(66, 30, `<rect y="22" width="66" height="8" fill="#22123A"/><rect y="10" width="66" height="4" fill="#22123A"/><g fill="#22123A"><path d="M6 30V6l6-6 6 6v24zM39 30V6l6-6 6 6v24z"/></g>`) },
      left: svg("sb-scene-l", false, pumpkin(96, 126, .92) + pumpkin(216, 142, .58)),
      right: svg("sb-scene-r", true, `
        <circle cx="298" cy="78" r="64" fill="#F6B14A"/>
        <path d="M298 14a64 64 0 0 1 0 128 78 78 0 0 0 0-128z" fill="#EA9A32"/>
        <g fill="#E58F2C"><circle cx="276" cy="62" r="10"/><circle cx="312" cy="100" r="13"/></g>
        <path d="M420 170c-34-20-50-34-62-62-6-16-4-28-16-44" fill="none" stroke="#22123A" stroke-width="10" stroke-linecap="round"/>
        <path d="M358 108c-20-4-34-14-52-14M342 64c-14-6-26-8-36-20M388 140c-24 2-40-2-62 8" fill="none" stroke="#22123A" stroke-width="5" stroke-linecap="round"/>
        <path d="M306 94c-10 0-18-6-26-4M306 44c-8-2-12-8-20-10" fill="none" stroke="#22123A" stroke-width="2.5" stroke-linecap="round"/>
        ${far(`<g fill="#22123A"><g transform="translate(176 58)"><path class="sb-flap" d="${BAT}"/></g><g transform="translate(120 96) scale(.7)"><path class="sb-flap" style="animation-delay:-.3s" d="${BAT}"/></g></g>`)}`)
    },
    dragonboat: {
      status: "#1B6B57",
      ground: { h: 30, w: 96, img: tile(96, 30, `<path d="M0 30V14q24-14 48 0t48 0v16z" fill="#145445"/><path d="M0 30v-6q24-12 48 0t48 0v6z" fill="#0F4537"/><path d="M12 22q12-6 24 0M60 22q12-6 24 0" fill="none" stroke="#7CCBA6" stroke-opacity=".6" stroke-width="1.5" stroke-linecap="round"/>`) },
      left: svg("sb-scene-l", false, `
        <g class="sb-bob">
          <path d="M40 66v-38" stroke="#7A4A30" stroke-width="2.5"/><path d="M41 28l26 7-26 7z" fill="${GOLD}"/>
          <g fill="#0F4A3C">${[92,134,176,218,260].map(x => `<circle cx="${x}" cy="102" r="7"/><path d="M${x - 8} 128v-12q8-8 16 0v12z"/><path d="M${x - 11} 100q11-9 22 0z" fill="${GOLD}"/>`).join("")}</g>
          <g stroke="#7A4A30" stroke-width="2.5" stroke-linecap="round">${[92,134,176,218,260].map(x => `<line x1="${x + 6}" y1="116" x2="${x - 16}" y2="164"/>`).join("")}</g>
          <ellipse cx="50" cy="118" rx="13" ry="10" fill="#A82C22"/><ellipse cx="50" cy="112" rx="13" ry="4" fill="${CREAM}"/>
          <path d="M14 128h300c-8 22-28 36-52 36H74c-30 0-50-14-60-36z" fill="#D8362B"/>
          <path d="M24 146h278c-12 12-26 18-42 18H74c-22 0-38-6-50-18z" fill="#B3261E"/>
          <rect x="14" y="125" width="300" height="5" fill="${GOLD}"/>
          <g fill="none" stroke="${GOLD}" stroke-opacity=".8" stroke-width="1.4">${[...Array(13)].map((_, i) => `<path d="M${44 + i * 20} 138q10 10 20 0"/>`).join("")}</g>
          <path d="M14 128c-12-6-16-20-8-34 4 8 12 12 14 22 2 6 0 10-6 12z" fill="${GOLD}"/>
          <path d="M306 132c20-6 28-22 24-46 10 0 26 4 40 0 8 0 14 4 18 10-6 4-12 6-22 6 2 4 4 6 8 8-8 4-16 2-24-2-2 12-10 26-30 30z" fill="#D8362B"/>
          <path d="M330 86c-6-6-8-14-6-22 8 2 14 10 16 20zM346 84c-2-8 0-16 6-22 4 6 4 14 2 22z" fill="${GOLD}"/>
          <path d="M324 104c-12 2-16 12-22 12M328 118c-10 4-14 10-22 12" fill="none" stroke="${GOLD}" stroke-width="3" stroke-linecap="round"/>
          <circle cx="362" cy="92" r="4" fill="${CREAM}"/><circle cx="363" cy="92" r="2" fill="#0F4A3C"/>
        </g>`),
      right: svg("sb-scene-r", false, `
        <g><rect x="296" y="-4" width="17" height="170" fill="#2F8F72"/><rect x="306" y="-4" width="7" height="170" fill="#237A61"/>
        <rect x="350" y="-4" width="21" height="170" fill="#3DA583"/><rect x="363" y="-4" width="8" height="170" fill="#2F8F72"/>
        <rect x="398" y="-4" width="15" height="170" fill="#2F8F72"/><rect x="407" y="-4" width="6" height="170" fill="#237A61"/></g>
        <g fill="#145445"><rect x="294" y="48" width="21" height="4" rx="2"/><rect x="294" y="110" width="21" height="4" rx="2"/><rect x="348" y="78" width="25" height="4" rx="2"/><rect x="348" y="136" width="25" height="4" rx="2"/><rect x="396" y="36" width="19" height="4" rx="2"/><rect x="396" y="98" width="19" height="4" rx="2"/></g>
        <g class="sb-sway is-soft" style="transform-origin:298px 48px"><path d="M298 48c-36-14-76-8-112 18 40 4 80 2 112-18z" fill="#7CCBA6"/><path d="M298 48c-40-2-76 6-112 18" fill="none" stroke="#4FA583" stroke-width="1.4"/><path d="M298 58c-30 2-62 18-84 46 34-8 66-20 84-46z" fill="#5DB592"/><path d="M298 58c-34 12-60 26-84 46" fill="none" stroke="#3F9477" stroke-width="1.4"/></g>
        ${far(`<line x1="150" y1="0" x2="150" y2="26" stroke="${CREAM}" stroke-width="1.4"/>${zongzi(150, 60, .62)}`)}`)
    },
    valentine: {
      status: "#C2366E",
      ground: { h: 22, w: 44, img: tile(44, 22, `<rect y="10" width="44" height="12" fill="#A62659"/><circle cx="22" cy="10" r="10" fill="#A62659"/><circle cx="22" cy="9" r="2.5" fill="#FFD9E5"/><circle cx="0" cy="14" r="1.5" fill="#FFD9E5"/><circle cx="44" cy="14" r="1.5" fill="#FFD9E5"/>`) },
      left: svg("sb-scene-l", false, `
        <g transform="translate(112 96) rotate(-8)">
          <rect x="-58" y="-38" width="116" height="76" rx="5" fill="#FFF3EE"/>
          <path d="M-58 38L-8 2M58 38L8 2" fill="none" stroke="#F0CFCB" stroke-width="2"/>
          <path d="M-58-38L0 8l58-46z" fill="#FFE0E0"/><path d="M-58-38L0 8l58-46" fill="none" stroke="#F0CFCB" stroke-width="2"/>
          <path transform="translate(0 -12) scale(.42)" d="${HEART}" fill="#D8245F"/>
        </g>
        <g fill="#E46C9B"><path transform="translate(226 44) scale(.3)" d="${HEART}"/><path transform="translate(268 104) scale(.2)" d="${HEART}"/><path transform="translate(30 30) scale(.22)" d="${HEART}"/></g>`),
      right: svg("sb-scene-r", true, heart(342, 30, 1.25, 0, "#FFFFFF", "#FFD9E5") + heart(244, 14, .84, -1.6, "#FFC2D6", "#FBA7C2") + far(heart(164, 44, .58, -2.8, "#FFFFFF", "#FFD9E5")))
    },
    lantern: {
      status: "#33205F", particle: "star", count: 8,
      ground: { h: 24, w: 60, img: tile(60, 24, `<path d="M0 24V12q15-12 30 0t30 0v12z" fill="#241547"/><path d="M0 12q15-12 30 0t30 0" fill="none" stroke="${GOLD}" stroke-opacity=".6" stroke-width="1.2"/>`) },
      left: svg("sb-scene-l", false, `
        ${tangyuan(84, 118, 30, "#FFF3EE", "#F2DDD6")}${tangyuan(160, 136, 24, "#FFC9D6", "#F7AFC0")}
        <g transform="translate(232 128)"><circle r="28" fill="${CREAM}"/><circle r="17" fill="#2E2238"/><circle cx="-5" cy="-5" r="3" fill="#4A3A58"/><path d="M-28-4c10-8 16 2 24-4s14 4 24-2" fill="none" stroke="#33205F" stroke-width="7" stroke-linecap="round"/></g>
        <path d="M60 60c-7-7 7-12 0-20M104 58c-7-7 7-12 0-20" fill="none" stroke="${CREAM}" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>`),
      right: svg("sb-scene-r", false, bowl(310, 142, .98) + far(tangyuan(176, 136, 22, "#FFC9D6", "#F7AFC0")))
    },
    qixi: {
      status: "#1E1A4F", particle: "star", count: 10,
      ground: { h: 20, w: 120, img: tile(120, 20, `<rect y="8" width="120" height="12" fill="#2C2670"/><g fill="#F7F2E6"><circle cx="14" cy="6" r="1.6"/><circle cx="44" cy="12" r="1.2"/><circle cx="76" cy="5" r="1.8"/><circle cx="104" cy="13" r="1.3"/></g>`) },
      left: svg("sb-scene-l", false, `
        <path d="M30 150Q170 30 310 150" fill="none" stroke="#3B3390" stroke-width="16" stroke-linecap="round"/>
        <path d="M30 150Q170 30 310 150" fill="none" stroke="${CREAM}" stroke-width="2" stroke-dasharray="3 12" stroke-linecap="round"/>
        ${magpie(126, 62, .46, 1)}${magpie(214, 62, .46, -1)}`),
      right: svg("sb-scene-r", true, `
        <path d="M340 18a54 54 0 1 0 40 92 44 44 0 0 1-40-92z" fill="#F7DA8C"/>
        <g fill="#FFC9D6"><path d="M250 44l4 12 12 4-12 4-4 12-4-12-12-4 12-4z"/></g>
        <g fill="#BFD8FF"><path d="M196 92l3 9 9 3-9 3-3 9-3-9-9-3 9-3z"/></g>
        <path d="M250 60L196 104" stroke="${CREAM}" stroke-opacity=".5" stroke-width="1.2" stroke-dasharray="3 5"/>`)
    },
    newyear: {
      status: "#1B2458", particle: "star", count: 8,
      ground: { h: 34, w: 220, img: tile(220, 34, `<path d="M0 34V18h22V8h26v14h18V2h24v18h20V12h30v10h22V6h26v16h32v12z" fill="#10173F"/><g fill="${GOLD}"><rect x="28" y="14" width="4" height="4"/><rect x="38" y="20" width="4" height="4"/><rect x="72" y="8" width="4" height="4"/><rect x="82" y="16" width="4" height="4"/><rect x="72" y="24" width="4" height="4"/><rect x="118" y="18" width="4" height="4"/><rect x="130" y="24" width="4" height="4"/><rect x="168" y="12" width="4" height="4"/><rect x="180" y="20" width="4" height="4"/></g>`) },
      left: svg("sb-scene-l", true, burst(108, 70, 54, GOLD, "#F2A7C3", 0) + burst(250, 50, 32, "#8FD0EC", CREAM, -2.2)),
      right: svg("sb-scene-r", true, burst(308, 72, 62, GOLD, "#8FD0EC", -1.1) + far(burst(160, 46, 34, "#F2A7C3", GOLD, -3.1)))
    }
  };

  function particles(type, count){
    let html = "";
    for(let i = 0; i < count; i++){
      const side = i % 2 === 0;
      const x = side ? (i * 37 + 7) % 24 : 76 + (i * 29 + 3) % 24, y = (i * 53 + 11) % 62;
      const dur = 7 + (i * 5) % 9, delay = -((i * 7) % 12);
      const size = 2 + (i * 3) % 4;
      html += `<i class="sb-p sb-p-${type}${side ? " is-left" : ""}" style="--x:${x}%;--y:${y}%;--s:${size}px;--drift:${((i % 2) ? 1 : -1) * (10 + (i * 7) % 26)}px;animation-duration:${dur}s;animation-delay:${delay}s"></i>`;
    }
    return html;
  }

  // 結清彩蛋：畫面中央出現節日主角，由暗轉亮，周圍散開幾顆平塗的小點。
  const EMBLEMS = {
    lunar: () => lantern(100, 36, 1.5, 0, true),
    lantern: () => bowl(100, 140, 1.1),
    christmas: () => pine(100, 186, 158, "#1F6650", "#0E3A2D", true) + `<path d="M100 8l6 14 15 1-11 10 4 15-14-8-14 8 4-15-11-10 15-1z" fill="${GOLD}"/>`,
    midautumn: () => `<circle cx="100" cy="100" r="76" fill="#F7DA8C"/><path d="M100 24a76 76 0 0 1 0 152 92 92 0 0 0 0-152z" fill="#EFC768"/><g fill="#E3B654"><circle cx="72" cy="80" r="14"/><circle cx="120" cy="126" r="18"/></g>`,
    halloween: () => pumpkin(100, 112, 1.25),
    dragonboat: () => zongzi(100, 106, 1.45),
    valentine: () => `<g transform="translate(100 62) scale(1.5)"><path d="${HEART}" fill="#E23D76"/><path d="M0 12c12-16 34-14 34 8 0 20-22 32-34 44z" fill="#C2285F"/></g>`,
    qixi: () => magpie(44, 118, .92, 1) + magpie(156, 118, .92, -1) + `<path transform="translate(100 52) scale(.34)" d="${HEART}" fill="#F2A7C3"/>`,
    newyear: () => `<g stroke-linecap="round"><g stroke="${GOLD}" stroke-width="3">${ring(100, 100, 78, 18, .42, GOLD, 3)}</g><g stroke="#F2A7C3" stroke-width="3.5">${ring(100, 100, 42, 10, .5, "#F2A7C3", 3.5)}</g><circle cx="100" cy="100" r="9" fill="${GOLD}"/></g>`
  };
  // 記帳動畫：節日當天，飛進帳本的收據蓋上節日貼紙
  window.splitbillHolidayDressReceipt = function(paper){
    const h = document.documentElement.getAttribute("data-holiday");
    if(!h || !EMBLEMS[h]) return;
    paper.classList.add("is-holiday");
    const sticker = document.createElement("div");
    sticker.className = "sb-receipt-sticker";
    sticker.setAttribute("aria-hidden", "true");
    sticker.innerHTML = `<svg viewBox="0 0 200 200">${EMBLEMS[h]()}</svg>`;
    paper.appendChild(sticker);
  };

  const SPARK_COLORS = [GOLD, "#F2A7C3", "#8FD0EC", CREAM];
  window.splitbillHolidayCelebrate = function(){
    const h = document.documentElement.getAttribute("data-holiday");
    if(!h || !EMBLEMS[h] || document.querySelector(".sb-moment")) return;
    const el = document.createElement("div");
    el.className = "sb-moment";
    el.setAttribute("role", "status");
    let sparks = "";
    for(let i = 0; i < 14; i++){
      const a = i / 14 * Math.PI * 2, r = 130 + (i % 3) * 26;
      sparks += `<i style="--dx:${(Math.cos(a) * r).toFixed(0)}px;--dy:${(Math.sin(a) * r).toFixed(0)}px;background:${SPARK_COLORS[i % 4]}"></i>`;
    }
    el.innerHTML = `<div class="sb-moment-stage">${sparks}<svg viewBox="0 0 200 200" aria-hidden="true">${EMBLEMS[h]()}</svg></div><p></p>`;
    el.lastElementChild.textContent = t("holiday.settled");
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  };

  let observer = null;
  function placeHeight(scene){
    const header = document.querySelector(".app-header");
    if(header) scene.style.setProperty("--scene-h", Math.round(header.getBoundingClientRect().bottom + window.scrollY + parseFloat(getComputedStyle(header).marginBottom) - 12) + "px");
  }
  function onResize(){
    const scene = document.querySelector(".sb-scene");
    if(scene) placeHeight(scene);
  }

  window.splitbillMountHolidayScene = function(h){
    document.querySelectorAll(".sb-scene").forEach(el => el.remove());
    if(observer){ observer.disconnect(); observer = null; }
    window.removeEventListener("resize", onResize);
    document.body.classList.remove("sb-has-scene");
    const def = h && SCENES[h];
    // 只有登入後的主畫面有場景；登入頁和條款頁的版面不同，維持配色就好
    const header = document.querySelector(".app-header");
    if(!def || !header || !header.querySelector(":scope > .header-utility-row")) return;

    const scene = document.createElement("div");
    scene.className = "sb-scene";
    scene.setAttribute("aria-hidden", "true");
    scene.innerHTML = (def.strip ? `<div class="sb-scene-strip" style="background-image:${def.strip}"></div>` : "")
      + def.left + def.right + (def.particle ? particles(def.particle, def.count) : "")
      + `<div class="sb-scene-ground" style="height:${def.ground.h}px;background-image:${def.ground.img}"></div>`;
    document.body.classList.add("sb-has-scene");
    document.body.insertBefore(scene, document.body.firstChild);
    placeHeight(scene);
    window.addEventListener("resize", onResize);
    // 捲到看不見時先停下來，省電
    if("IntersectionObserver" in window){
      observer = new IntersectionObserver(entries => scene.classList.toggle("is-paused", !entries[0].isIntersecting));
      observer.observe(scene);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if(meta) meta.setAttribute("content", def.status);
  };
})();

// 節日場景：只有節日期間才由 holiday.js 載入。頁首鋪一幅手繪場景（天色、左右
// 兩側的插畫、少量環境動態），底部漸層融進頁面底色，內容區維持乾淨好讀。
// 左右插畫分開貼齊兩側，手機變窄時只是靠近，不會裁掉主體。
(function holidayScene(){
  const lanternDefs = `<defs>
    <radialGradient id="sbLan" cx=".5" cy=".42" r=".62"><stop offset="0" stop-color="#FFC75A"/><stop offset=".45" stop-color="#EE4A2B"/><stop offset="1" stop-color="#A5121C"/></radialGradient>
    <radialGradient id="sbLanGlow"><stop offset="0" stop-color="#FFB24A" stop-opacity=".55"/><stop offset="1" stop-color="#FFB24A" stop-opacity="0"/></radialGradient>
  </defs>`;
  function lantern(x, cord, s, delay){
    const y = cord + 30 * s;
    return `<g class="sb-sway" style="transform-origin:${x}px 0;animation-delay:${delay}s">
      <line x1="${x}" y1="0" x2="${x}" y2="${cord}" stroke="#E9B949" stroke-width="1.4"/>
      <circle cx="${x}" cy="${y}" r="${72 * s}" fill="url(#sbLanGlow)"/>
      <rect x="${x - 15 * s}" y="${cord}" width="${30 * s}" height="${6 * s}" rx="${2 * s}" fill="#E9B949"/>
      <ellipse cx="${x}" cy="${y}" rx="${38 * s}" ry="${25 * s}" fill="url(#sbLan)"/>
      <g fill="none" stroke="#FFD98A" stroke-opacity=".38" stroke-width="1"><ellipse cx="${x}" cy="${y}" rx="${25 * s}" ry="${25 * s}"/><ellipse cx="${x}" cy="${y}" rx="${11 * s}" ry="${25 * s}"/></g>
      <rect x="${x - 15 * s}" y="${y + 24 * s}" width="${30 * s}" height="${6 * s}" rx="${2 * s}" fill="#E9B949"/>
      <g stroke="#E9B949" stroke-width="1.2"><line x1="${x - 6 * s}" y1="${y + 30 * s}" x2="${x - 6 * s}" y2="${y + 56 * s}"/><line x1="${x}" y1="${y + 30 * s}" x2="${x}" y2="${y + 62 * s}"/><line x1="${x + 6 * s}" y1="${y + 30 * s}" x2="${x + 6 * s}" y2="${y + 56 * s}"/></g>
    </g>`;
  }
  function blossom(x, y, r, fill){
    let petals = "";
    for(let i = 0; i < 5; i++){
      const a = (i * 72 - 90) * Math.PI / 180;
      petals += `<circle cx="${(x + Math.cos(a) * r * .72).toFixed(1)}" cy="${(y + Math.sin(a) * r * .72).toFixed(1)}" r="${(r * .58).toFixed(1)}" fill="${fill}"/>`;
    }
    return petals + `<circle cx="${x}" cy="${y}" r="${(r * .26).toFixed(1)}" fill="#E9B949"/>`;
  }
  function pine(x, base, h, fill, snow){
    const w = h * .42;
    let out = "";
    for(let i = 0; i < 3; i++){
      const top = base - h + i * h * .24, bottom = top + h * .46, half = w * (.55 + i * .22);
      out += `<path d="M${x} ${top}L${x + half} ${bottom}H${x - half}Z" fill="${fill}"/>`;
    }
    return out + (snow ? `<path d="M${x} ${base - h}l${w * .2} ${h * .13}q-${w * .2} ${h * .05}-${w * .4} 0z" fill="#EAF4F0"/>` : "");
  }
  function heart(x, cord, s, delay, fill){
    const y = cord + 2;
    return `<g class="sb-sway" style="transform-origin:${x}px 0;animation-delay:${delay}s">
      <line x1="${x}" y1="0" x2="${x}" y2="${cord}" stroke="#F4C9A8" stroke-opacity=".7" stroke-width="1"/>
      <circle cx="${x}" cy="${y + 22 * s}" r="${60 * s}" fill="url(#sbHeartGlow)"/>
      <path transform="translate(${x} ${y}) scale(${s})" d="M0 12C-8-4-34-2-34 20c0 20 22 32 34 44 12-12 34-24 34-44C34-2 8-4 0 12z" fill="${fill}"/>
    </g>`;
  }
  function burst(x, y, r, color, delay){
    let rays = "";
    for(let i = 0; i < 26; i++){
      const a = i / 26 * Math.PI * 2, long = i % 2 ? 1 : .82;
      const x1 = x + Math.cos(a) * r * .3, y1 = y + Math.sin(a) * r * .3;
      const x2 = x + Math.cos(a) * r * long, y2 = y + Math.sin(a) * r * long;
      rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/><circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="1.8" fill="${color}" stroke="none"/>`;
    }
    return `<g class="sb-burst" stroke="${color}" stroke-width="1.1" stroke-linecap="round" style="transform-origin:${x}px ${y}px;animation-delay:${delay}s">${rays}</g>`;
  }
  const svg = (w, h, cls, body) => `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="${cls.includes("-r") ? "xMaxYMin" : "xMinYMin"} meet" aria-hidden="true">${body}</svg>`;

  const SCENES = {
    lunar: {
      status: "#7A0F16", particle: "ember", count: 14,
      left: svg(420, 300, "sb-scene-l", `
        <path d="M0 26C70 34 120 62 168 58c44-4 74 16 118 8M84 42c18 24 30 52 62 64M168 58c6 26 30 40 34 72" fill="none" stroke="#3E070D" stroke-width="5" stroke-linecap="round"/>
        ${blossom(60, 28, 12, "#FFD6D0")}${blossom(146, 106, 13, "#FFE6DE")}${blossom(204, 130, 10, "#FFD6D0")}${blossom(286, 66, 12, "#FFE6DE")}${blossom(228, 50, 9, "#FFD6D0")}`),
      right: svg(420, 300, "sb-scene-r", lanternDefs + lantern(330, 26, 1.12, 0) + lantern(214, 8, .82, -1.4) + lantern(112, 40, .64, -2.6))
    },
    midautumn: {
      status: "#0E1430", particle: "star", count: 20,
      left: svg(420, 300, "sb-scene-l", `
        <path d="M0 18C60 26 118 20 190 54M92 26c8 18 22 28 46 34M150 36c10-8 22-12 40-10" fill="none" stroke="#0A0F26" stroke-width="4" stroke-linecap="round"/>
        <g fill="#F2C866">${[[52,30],[78,36],[118,40],[140,62],[190,58],[202,28],[168,46],[98,24]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2"/><circle cx="${x + 5}" cy="${y + 4}" r="2.2"/>`).join("")}</g>`),
      right: svg(420, 300, "sb-scene-r", `
        <defs><radialGradient id="sbMoon" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#FFF6D4"/><stop offset=".7" stop-color="#F6D682"/><stop offset="1" stop-color="#E5B553"/></radialGradient>
        <radialGradient id="sbMoonGlow"><stop offset=".45" stop-color="#F6D682" stop-opacity=".42"/><stop offset="1" stop-color="#F6D682" stop-opacity="0"/></radialGradient></defs>
        <circle cx="262" cy="108" r="186" fill="url(#sbMoonGlow)"/>
        <circle cx="262" cy="108" r="92" fill="url(#sbMoon)"/>
        <g fill="#C8963F" opacity=".16"><circle cx="228" cy="82" r="20"/><circle cx="292" cy="130" r="27"/><circle cx="296" cy="72" r="11"/><circle cx="238" cy="142" r="12"/></g>
        <g class="sb-drift" fill="#2A3770" opacity=".92"><rect x="70" y="150" width="210" height="16" rx="8"/><rect x="118" y="134" width="130" height="16" rx="8"/></g>
        <g class="sb-drift is-slow" fill="#1F2B5E" opacity=".92"><rect x="220" y="178" width="200" height="16" rx="8"/><rect x="270" y="162" width="120" height="16" rx="8"/></g>`)
    },
    christmas: {
      status: "#0B2A22", particle: "snow", count: 26, strip: true,
      left: svg(420, 300, "sb-scene-l", `
        ${pine(36, 190, 120, "#0A2E22", true)}${pine(104, 196, 92, "#0D3A2B", true)}
        <path d="M158 196v-50l42-30 42 30v50z" fill="#0A2A20"/><path d="M148 150l52-38 52 38" fill="none" stroke="#EAF4F0" stroke-width="5" stroke-linecap="round"/>
        <rect x="186" y="156" width="28" height="26" rx="2" fill="#FFC96B"/><circle cx="200" cy="168" r="44" fill="#FFC96B" opacity=".14"/>
        ${pine(292, 198, 74, "#0D3A2B", true)}`),
      right: svg(420, 300, "sb-scene-r", `
        <defs><radialGradient id="sbStar"><stop offset="0" stop-color="#FFE29A" stop-opacity=".8"/><stop offset="1" stop-color="#FFE29A" stop-opacity="0"/></radialGradient></defs>
        ${pine(150, 198, 78, "#0D3A2B", true)}${pine(392, 200, 96, "#0A2E22", true)}
        ${pine(280, 204, 170, "#0E4230", false)}
        <circle cx="280" cy="34" r="30" fill="url(#sbStar)"/><path d="M280 20l4 10 11 1-8 7 3 11-10-6-10 6 3-11-8-7 11-1z" fill="#FFD777"/>
        <g class="sb-twinkle-group">${[[262,92,"#FFD777"],[296,104,"#F2636B"],[248,128,"#FFD777"],[280,140,"#7FD3E8"],[318,136,"#FFD777"],[232,166,"#F2636B"],[270,174,"#FFD777"],[312,170,"#7FD3E8"],[338,178,"#F2636B"]].map(([x, y, c], i) => `<circle class="sb-twinkle" style="animation-delay:${-i * .5}s" cx="${x}" cy="${y}" r="3.4" fill="${c}"/>`).join("")}</g>`)
    },
    halloween: {
      status: "#1C1030", particle: "ember", count: 10,
      left: svg(420, 300, "sb-scene-l", `
        <defs><radialGradient id="sbPump" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#F7963A"/><stop offset="1" stop-color="#B9490F"/></radialGradient>
        <radialGradient id="sbPumpGlow"><stop offset="0" stop-color="#FFB24A" stop-opacity=".4"/><stop offset="1" stop-color="#FFB24A" stop-opacity="0"/></radialGradient></defs>
        <circle cx="96" cy="150" r="98" fill="url(#sbPumpGlow)"/>
        <path d="M92 112c-2-12 2-20 12-24" fill="none" stroke="#3D5A2B" stroke-width="6" stroke-linecap="round"/>
        <ellipse cx="96" cy="150" rx="62" ry="44" fill="url(#sbPump)"/>
        <g fill="none" stroke="#8E340B" stroke-opacity=".5" stroke-width="2"><ellipse cx="96" cy="150" rx="40" ry="44"/><ellipse cx="96" cy="150" rx="17" ry="44"/></g>
        <g fill="#FFE08A"><path d="M66 140l14-12 8 16zM126 140l-14-12-8 16z"/><path d="M62 164q34 22 68 0l-12 4-6-6-8 7-8-7-8 7-8-7-6 6z"/></g>
        <ellipse cx="198" cy="172" rx="34" ry="24" fill="url(#sbPump)"/><path d="M196 150c0-7 2-11 8-13" fill="none" stroke="#3D5A2B" stroke-width="4" stroke-linecap="round"/>
        <g fill="#FFE08A"><path d="M182 166l7-6 4 8zM214 166l-7-6-4 8z"/><path d="M180 180q18 10 36 0z"/></g>`),
      right: svg(420, 300, "sb-scene-r", `
        <defs><radialGradient id="sbHMoon"><stop offset=".5" stop-color="#FFC56B" stop-opacity=".5"/><stop offset="1" stop-color="#FFC56B" stop-opacity="0"/></radialGradient></defs>
        <circle cx="262" cy="96" r="160" fill="url(#sbHMoon)"/><circle cx="262" cy="96" r="80" fill="#F7BE64"/>
        <path d="M420 206c-40-30-66-34-84-70-8-16-6-30-22-48M336 136c-24-4-40-16-60-14M314 88c-16-8-30-8-42-22M372 170c-26 2-46-6-74 6M420 120c-22 6-40-4-60 8" fill="none" stroke="#120A1C" stroke-width="7" stroke-linecap="round"/>
        <g fill="#120A1C"><path class="sb-flap" style="transform-origin:150px 70px" d="M150 70c-8-12-20-14-30-10 8 2 10 8 8 14 6-4 10-2 14 4 2-4 4-6 8-6 4 0 6 2 8 6 4-6 8-8 14-4-2-6 0-12 8-14-10-4-22-2-30 10z"/>
        <path class="sb-flap" style="transform-origin:70px 120px;animation-delay:-.3s" transform="translate(-40 62) scale(.7)" d="M150 70c-8-12-20-14-30-10 8 2 10 8 8 14 6-4 10-2 14 4 2-4 4-6 8-6 4 0 6 2 8 6 4-6 8-8 14-4-2-6 0-12 8-14-10-4-22-2-30 10z"/></g>`)
    },
    dragonboat: {
      status: "#0E3B33", particle: "leaf", count: 9,
      left: svg(420, 300, "sb-scene-l", `
        <g class="sb-bob">
          <path d="M26 118c50 24 240 24 318 2-10 22-30 34-54 34H92c-30 0-54-14-66-36z" fill="#B9281F"/>
          <path d="M34 124c60 18 230 18 304 0" fill="none" stroke="#E9B949" stroke-width="3"/>
          <path d="M340 122c20-6 26-24 18-44 12 2 24 8 34 4-4 10-14 16-24 16 2 12-2 22-12 30z" fill="#B9281F"/><circle cx="366" cy="88" r="2.6" fill="#FFE08A"/>
          <path d="M28 120c-10-6-18-18-14-34 8 8 14 18 24 22z" fill="#E9B949"/>
          <g fill="#0C2E28">${[86,136,186,236,286].map(x => `<circle cx="${x}" cy="102" r="7"/><rect x="${x - 6}" y="108" width="12" height="16" rx="4"/>`).join("")}</g>
          <g stroke="#0C2E28" stroke-width="3" stroke-linecap="round">${[86,136,186,236,286].map(x => `<line x1="${x + 2}" y1="112" x2="${x - 18}" y2="152"/>`).join("")}</g>
        </g>
        <g fill="none" stroke="#8FD8C2" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"><path class="sb-drift" d="M0 160q24-10 48 0t48 0 48 0 48 0 48 0 48 0 48 0"/><path class="sb-drift is-slow" d="M30 178q24-10 48 0t48 0 48 0 48 0 48 0 48 0"/></g>`),
      right: svg(420, 300, "sb-scene-r", `
        <g fill="#1E6B52">${[[300,14],[352,18],[396,12]].map(([x, w]) => `<rect x="${x}" y="-4" width="${w}" height="220" rx="4"/>`).join("")}</g>
        <g fill="#0E4A39">${[52,112,172].map(y => `<rect x="298" y="${y}" width="18" height="4"/><rect x="350" y="${y + 24}" width="22" height="4"/><rect x="394" y="${y + 8}" width="16" height="4"/>`).join("")}</g>
        <g class="sb-sway is-soft" fill="#59B58F" style="transform-origin:300px 40px"><path d="M302 40c-40-14-84-6-122 22 42 2 86 0 122-22z"/><path d="M300 74c-34 0-70 16-96 46 38-8 74-20 96-46z"/><path d="M304 26c-30-20-66-22-104-10 34 10 72 16 104 10z"/></g>
        <g class="sb-sway is-soft" fill="#3E9C78" style="transform-origin:354px 90px;animation-delay:-2s"><path d="M352 92c-30 2-58 18-76 44 32-8 60-20 76-44z"/><path d="M352 118c-22 8-40 26-48 50 24-12 42-28 48-50z"/></g>`)
    },
    valentine: {
      status: "#5A1030", particle: "petal", count: 14,
      left: svg(420, 300, "sb-scene-l", `
        <defs><radialGradient id="sbBok"><stop offset="0" stop-color="#FFC2D6" stop-opacity=".42"/><stop offset="1" stop-color="#FFC2D6" stop-opacity="0"/></radialGradient></defs>
        <circle cx="72" cy="62" r="74" fill="url(#sbBok)"/><circle cx="214" cy="116" r="52" fill="url(#sbBok)"/><circle cx="318" cy="40" r="40" fill="url(#sbBok)"/><circle cx="124" cy="164" r="60" fill="url(#sbBok)"/>`),
      right: svg(420, 300, "sb-scene-r", `
        <defs><radialGradient id="sbHeartGlow"><stop offset="0" stop-color="#FFD0DE" stop-opacity=".5"/><stop offset="1" stop-color="#FFD0DE" stop-opacity="0"/></radialGradient>
        <linearGradient id="sbHeartA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFB7CC"/><stop offset="1" stop-color="#E23D76"/></linearGradient>
        <linearGradient id="sbHeartB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE3D2"/><stop offset="1" stop-color="#F08AA4"/></linearGradient></defs>
        ${heart(326, 48, 1.3, 0, "url(#sbHeartA)")}${heart(220, 22, .9, -1.6, "url(#sbHeartB)")}${heart(128, 60, .62, -2.8, "url(#sbHeartA)")}`)
    },
    newyear: {
      status: "#0A1030", particle: "star", count: 22,
      left: svg(420, 300, "sb-scene-l", burst(120, 84, 74, "#F4CF7A", 0) + burst(280, 56, 44, "#E7A8C8", -2.2)),
      right: svg(420, 300, "sb-scene-r", burst(292, 92, 90, "#F4CF7A", -1.1) + burst(118, 60, 52, "#9FD3EE", -3.1))
    }
  };

  // 聖誕燈串：一段燈線當底圖橫向重複，任何寬度都接得起來
  const LIGHTS = "url('data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="46"><path d="M0 6Q60 34 120 6T240 6" fill="none" stroke="#06201A" stroke-width="2"/><g><circle cx="30" cy="19" r="4.5" fill="#FFD777"/><circle cx="90" cy="19" r="4.5" fill="#F2636B"/><circle cx="150" cy="19" r="4.5" fill="#7FD3E8"/><circle cx="210" cy="19" r="4.5" fill="#FFD777"/></g><g opacity=".22"><circle cx="30" cy="19" r="11" fill="#FFD777"/><circle cx="90" cy="19" r="11" fill="#F2636B"/><circle cx="150" cy="19" r="11" fill="#7FD3E8"/><circle cx="210" cy="19" r="11" fill="#FFD777"/></g></svg>`) + "')";

  function particles(type, count){
    let html = "";
    for(let i = 0; i < count; i++){
      const x = (i * 37 + 7) % 100, y = (i * 53 + 11) % 62;
      const dur = 7 + (i * 5) % 9, delay = -((i * 7) % 12);
      const size = 2 + (i * 3) % 4;
      html += `<i class="sb-p sb-p-${type}" style="--x:${x}%;--y:${y}%;--s:${size}px;--drift:${((i % 2) ? 1 : -1) * (10 + (i * 7) % 26)}px;animation-duration:${dur}s;animation-delay:${delay}s"></i>`;
    }
    return html;
  }

  let observer = null;
  function placeHeight(scene){
    const hero = document.querySelector(".sb-hero");
    if(hero) scene.style.setProperty("--scene-h", Math.round(hero.getBoundingClientRect().bottom + window.scrollY + 26) + "px");
  }
  function onResize(){
    const scene = document.querySelector(".sb-scene");
    if(scene) placeHeight(scene);
  }

  window.splitbillMountHolidayScene = function(h){
    document.querySelectorAll(".sb-scene, .sb-hero").forEach(el => el.remove());
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
    scene.innerHTML = (def.strip ? `<div class="sb-scene-strip" style="background-image:${LIGHTS}"></div>` : "")
      + def.left + def.right + particles(def.particle, def.count);
    const hero = document.createElement("div");
    hero.className = "sb-hero";
    hero.innerHTML = "<strong></strong><span></span>";
    hero.firstElementChild.textContent = t("holiday." + h);
    hero.lastElementChild.textContent = t("holiday." + h + "Line");
    header.insertAdjacentElement("afterend", hero);
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

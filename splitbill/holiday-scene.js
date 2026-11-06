// 節日場景：只有節日期間才由 holiday.js 載入。頁首鋪一幅簡潔的平塗插畫：純色
// 天空、幾個幾何造型，不用漸層和光暈，每個節日只用三四個顏色。左右插畫分開
// 貼齊兩側，手機變窄時只是靠近，不會裁掉主體。
(function holidayScene(){
  function lantern(x, cord, s, delay){
    const y = cord + 30 * s;
    return `<g class="sb-sway" style="transform-origin:${x}px 0;animation-delay:${delay}s">
      <line x1="${x}" y1="0" x2="${x}" y2="${y + 56 * s}" stroke="#F2C14E" stroke-width="2"/>
      <rect x="${x - 16 * s}" y="${cord}" width="${32 * s}" height="${8 * s}" rx="${2 * s}" fill="#F2C14E"/>
      <ellipse cx="${x}" cy="${y}" rx="${38 * s}" ry="${26 * s}" fill="#EE4B2B"/>
      <ellipse cx="${x}" cy="${y}" rx="${16 * s}" ry="${26 * s}" fill="#F56A3F"/>
      <rect x="${x - 16 * s}" y="${y + 22 * s}" width="${32 * s}" height="${8 * s}" rx="${2 * s}" fill="#F2C14E"/>
    </g>`;
  }
  function blossom(x, y, r, fill){
    let petals = "";
    for(let i = 0; i < 5; i++){
      const a = (i * 72 - 90) * Math.PI / 180;
      petals += `<circle cx="${(x + Math.cos(a) * r * .7).toFixed(1)}" cy="${(y + Math.sin(a) * r * .7).toFixed(1)}" r="${(r * .55).toFixed(1)}" fill="${fill}"/>`;
    }
    return petals + `<circle cx="${x}" cy="${y}" r="${(r * .3).toFixed(1)}" fill="#F2C14E"/>`;
  }
  function pine(x, base, h, fill){
    const w = h * .36;
    return `<path d="M${x} ${base - h}L${x + w * .7} ${base - h * .56}H${x + w * .4}L${x + w} ${base - h * .2}H${x + w * .55}L${x + w * 1.2} ${base}H${x - w * 1.2}L${x - w * .55} ${base - h * .2}H${x - w}L${x - w * .4} ${base - h * .56}H${x - w * .7}Z" fill="${fill}"/>`;
  }
  function heart(x, cord, s, delay, fill){
    return `<g class="sb-sway" style="transform-origin:${x}px 0;animation-delay:${delay}s">
      <line x1="${x}" y1="0" x2="${x}" y2="${cord + 8}" stroke="#FFE3EC" stroke-width="2"/>
      <path transform="translate(${x} ${cord}) scale(${s})" d="M0 12C-8-4-34-2-34 20c0 20 22 32 34 44 12-12 34-24 34-44C34-2 8-4 0 12z" fill="${fill}"/>
    </g>`;
  }
  function burst(x, y, r, color, delay){
    let rays = "";
    for(let i = 0; i < 12; i++){
      const a = i / 12 * Math.PI * 2;
      const x1 = x + Math.cos(a) * r * .42, y1 = y + Math.sin(a) * r * .42;
      const x2 = x + Math.cos(a) * r * .86, y2 = y + Math.sin(a) * r * .86;
      rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/><circle cx="${(x + Math.cos(a) * r).toFixed(1)}" cy="${(y + Math.sin(a) * r).toFixed(1)}" r="3.5" fill="${color}" stroke="none"/>`;
    }
    return `<g class="sb-burst" stroke="${color}" stroke-width="4" stroke-linecap="round" style="transform-origin:${x}px ${y}px;animation-delay:${delay}s">${rays}</g>`;
  }
  const BAT = "M150 70c-8-12-20-14-30-10 8 2 10 8 8 14 6-4 10-2 14 4 2-4 4-6 8-6 4 0 6 2 8 6 4-6 8-8 14-4-2-6 0-12 8-14-10-4-22-2-30 10z";
  function pumpkin(x, y, s){
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-5" y="-54" width="10" height="16" rx="3" fill="#4F7A3A"/>
      <ellipse cx="-30" cy="0" rx="30" ry="42" fill="#E8791F"/><ellipse cx="30" cy="0" rx="30" ry="42" fill="#E8791F"/><ellipse cx="0" cy="0" rx="32" ry="44" fill="#F28F2E"/>
      <path d="M-30-8l14-14 8 18zM30-8l-14-14-8 18z" fill="#2E1848"/><path d="M-26 14q26 18 52 0-26 8-52 0z" fill="#2E1848"/>
    </g>`;
  }
  // 手機上右側插畫會靠近標題，離標題最近的小配件先收起來
  const far = body => `<g class="sb-far">${body}</g>`;
  const svg = (w, h, cls, body) => `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="${cls.includes("-r") ? "xMaxYMin" : "xMinYMin"} meet" aria-hidden="true">${body}</svg>`;

  const SCENES = {
    lunar: {
      status: "#9E1B1B",
      left: svg(420, 300, "sb-scene-l", `
        <path d="M0 24c70 8 120 34 170 30 44-4 74 14 116 8M86 40c16 22 30 48 60 60M170 54c6 24 28 38 32 66" fill="none" stroke="#6B0F12" stroke-width="6" stroke-linecap="round"/>
        ${blossom(62, 28, 14, "#FFD9D2")}${blossom(146, 100, 15, "#FFEDE6")}${blossom(204, 122, 12, "#FFD9D2")}${blossom(286, 62, 14, "#FFEDE6")}`),
      right: svg(420, 300, "sb-scene-r", lantern(330, 24, 1.15, 0) + lantern(214, 6, .85, -1.4) + far(lantern(112, 36, .66, -2.6)))
    },
    midautumn: {
      status: "#1C2554", particle: "star", count: 9,
      left: svg(420, 300, "sb-scene-l", `
        <path d="M0 214c70-46 170-54 290-10v40H0z" fill="#141B40"/>
        <g fill="#F4F1E6"><ellipse cx="128" cy="166" rx="27" ry="20"/><circle cx="154" cy="150" r="15"/><ellipse cx="150" cy="124" rx="6" ry="19" transform="rotate(-8 150 124)"/><ellipse cx="164" cy="125" rx="6" ry="19" transform="rotate(10 164 125)"/><circle cx="102" cy="164" r="7"/></g>
        <circle cx="160" cy="148" r="2.4" fill="#141B40"/>`),
      right: svg(420, 300, "sb-scene-r", `
        <circle cx="262" cy="108" r="92" fill="#F4D27A"/>
        <g fill="#E8BE5E"><circle cx="226" cy="84" r="17"/><circle cx="296" cy="128" r="24"/><circle cx="298" cy="70" r="10"/></g>
        <g class="sb-drift" fill="#34438A"><rect x="70" y="150" width="210" height="20" rx="10"/><rect x="118" y="130" width="130" height="20" rx="10"/></g>
        <g class="sb-drift is-slow" fill="#2A3775"><rect x="230" y="184" width="190" height="20" rx="10"/><rect x="280" y="164" width="110" height="20" rx="10"/></g>`)
    },
    christmas: {
      status: "#14493A", particle: "snow", count: 12,
      left: svg(420, 300, "sb-scene-l", `
        ${pine(46, 196, 124, "#0E3A2D")}${pine(116, 196, 88, "#1B5A47")}
        <path d="M170 196v-48h76v48z" fill="#0E3A2D"/><path d="M158 150l50-40 50 40z" fill="#F4F1E6"/>
        <rect x="196" y="158" width="24" height="24" rx="2" fill="#F4C863"/>`),
      right: svg(420, 300, "sb-scene-r", `
        ${pine(156, 200, 82, "#1B5A47")}${pine(392, 200, 102, "#1B5A47")}
        ${pine(282, 206, 176, "#0E3A2D")}
        <path d="M282 16l5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1z" fill="#F4C863"/>
        ${[[266,96,"#F4C863"],[298,112,"#E5484D"],[250,136,"#E5484D"],[284,146,"#F4C863"],[318,150,"#F4F1E6"],[236,178,"#F4F1E6"],[276,182,"#E5484D"],[330,184,"#F4C863"]].map(([x, y, c], i) => `<circle class="sb-twinkle" style="animation-delay:${-i * .5}s" cx="${x}" cy="${y}" r="5" fill="${c}"/>`).join("")}`)
    },
    halloween: {
      status: "#3A1F5C",
      left: svg(420, 300, "sb-scene-l", pumpkin(96, 148, 1) + pumpkin(208, 168, .62)),
      right: svg(420, 300, "sb-scene-r", `
        <circle cx="262" cy="98" r="84" fill="#F2A93B"/>
        <path d="M420 200c-40-26-66-30-84-66-8-16-6-30-22-48M336 134c-24-4-40-16-60-14M372 168c-26 2-46-6-74 6" fill="none" stroke="#2E1848" stroke-width="9" stroke-linecap="round"/>
        <g class="sb-far" fill="#2E1848"><path class="sb-flap" style="transform-origin:150px 70px" d="${BAT}"/><path class="sb-flap" style="transform-origin:64px 110px;animation-delay:-.3s" transform="translate(-44 58) scale(.7)" d="${BAT}"/></g>`)
    },
    dragonboat: {
      status: "#1B6B57", water: true,
      left: svg(420, 300, "sb-scene-l", `
        <g class="sb-bob">
          <path d="M26 122h318c-8 24-28 36-54 36H92c-30 0-54-14-66-36z" fill="#D8362B"/>
          <rect x="34" y="122" width="302" height="7" fill="#F2C14E"/>
          <path d="M338 128c18-8 22-26 16-44 12 2 26 8 36 4-4 12-16 18-26 18 2 12-4 24-14 32z" fill="#D8362B"/><circle cx="366" cy="96" r="3" fill="#F2C14E"/>
          <g fill="#0F4A3C">${[92,144,196,248,300].map(x => `<circle cx="${x}" cy="98" r="8"/><rect x="${x - 7}" y="106" width="14" height="18" rx="4"/>`).join("")}</g>
        </g>`),
      right: svg(420, 300, "sb-scene-r", `
        <g fill="#2F8F72"><rect x="300" y="-4" width="16" height="220" rx="4"/><rect x="352" y="-4" width="20" height="220" rx="4"/><rect x="396" y="-4" width="14" height="220" rx="4"/></g>
        <g fill="#145445"><rect x="298" y="60" width="20" height="5"/><rect x="298" y="130" width="20" height="5"/><rect x="350" y="90" width="24" height="5"/><rect x="350" y="160" width="24" height="5"/><rect x="394" y="50" width="18" height="5"/><rect x="394" y="120" width="18" height="5"/></g>
        <g class="sb-sway is-soft" fill="#7CCBA6" style="transform-origin:300px 50px"><path d="M302 42c-40-14-84-6-122 22 42 2 86 0 122-22z"/><path d="M300 78c-34 0-70 16-96 46 38-8 74-20 96-46z"/></g>`)
    },
    valentine: {
      status: "#C2366E",
      left: svg(420, 300, "sb-scene-l", `<g fill="#D65A8B"><path transform="translate(70 34) scale(.5)" d="M0 12C-8-4-34-2-34 20c0 20 22 32 34 44 12-12 34-24 34-44C34-2 8-4 0 12z"/><path transform="translate(236 100) scale(.36)" d="M0 12C-8-4-34-2-34 20c0 20 22 32 34 44 12-12 34-24 34-44C34-2 8-4 0 12z"/><path transform="translate(310 28) scale(.28)" d="M0 12C-8-4-34-2-34 20c0 20 22 32 34 44 12-12 34-24 34-44C34-2 8-4 0 12z"/></g>`),
      right: svg(420, 300, "sb-scene-r", heart(326, 44, 1.3, 0, "#FFFFFF") + heart(220, 20, .9, -1.6, "#FFC9DA") + far(heart(128, 56, .62, -2.8, "#FFFFFF")))
    },
    newyear: {
      status: "#1B2458", particle: "star", count: 9,
      left: svg(420, 300, "sb-scene-l", burst(120, 84, 62, "#F4C863", 0) + burst(286, 54, 36, "#F2A7C3", -2.2)),
      right: svg(420, 300, "sb-scene-r", burst(292, 92, 76, "#F4C863", -1.1) + far(burst(118, 60, 42, "#8FD0EC", -3.1)))
    }
  };

  // 聖誕燈串：一段燈線當底圖橫向重複，任何寬度都接得起來
  const LIGHTS = "url('data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="46"><path d="M0 6Q60 34 120 6T240 6" fill="none" stroke="#0E3A2D" stroke-width="3"/><circle cx="30" cy="20" r="5" fill="#F4C863"/><circle cx="90" cy="20" r="5" fill="#E5484D"/><circle cx="150" cy="20" r="5" fill="#F4F1E6"/><circle cx="210" cy="20" r="5" fill="#F4C863"/></svg>`) + "')";

  // 端午的河面：波浪當底圖橫向重複，整個畫面寬都接得起來
  const WAVES = "url('data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="16"><path d="M0 16V8q24-16 48 0t48 0v8z" fill="#145445"/></svg>`) + "')";

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
      + (def.water ? `<div class="sb-scene-water" style="background-image:${WAVES},linear-gradient(#145445,#145445)"></div>` : "")
      + def.left + def.right + (def.particle ? particles(def.particle, def.count) : "");
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

/* ============================================================
   illustrations.js — hand-drawn header art for each trip (storybook style).
   Flat fills, 3px ink outlines, palette: coral #F2A497, yamabuki #F6D27A,
   mizu #A8D3E6, wakatake #B9DAA5, paper #FFFCF6, ink #3E3A39.
   Keyed by TRIP.key; the engine drops the matching SVG into the header.
   Moving parts carry sb-* classes (see storybook.css); all decorative.
   ============================================================ */
window.TRIP_ART = (() => {
  const INK = '#3E3A39', P = '#FFFCF6', CO = '#F2A497', YE = '#F6D27A', MI = '#A8D3E6', GR = '#B9DAA5';
  const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const cloud = (x, y, s = 1) => `<g class="sb-drift" transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 18 C0 8 10 4 17 8 C20 0 34 -2 39 7 C48 4 56 11 53 18 Z" fill="#FFFFFF" ${S}/></g>`;

  const kyushu = `<svg viewBox="0 0 360 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="福岡塔、唐津城、熱氣球與渡輪">
  <!-- sun -->
  <g class="sb-twinkle" style="transform-origin:318px 36px">
    <g ${S}><path d="M318 12 V4 M318 68 V60 M294 36 H286 M350 36 H342 M301 19 L296 14 M335 53 L340 58 M335 19 L340 14 M301 53 L296 58"/></g>
    <circle cx="318" cy="36" r="15" fill="${YE}" ${S}/>
  </g>
  ${cloud(24, 26, 0.9)}
  ${cloud(196, 14, 0.7)}
  <!-- Saga balloon -->
  <g class="sb-float">
    <path d="M170 22 C150 22 143 48 158 64 L165 74 L175 74 L182 64 C197 48 190 22 170 22 Z" fill="${YE}" ${S}/>
    <path d="M170 22 C162 30 161 54 166 74 M170 22 C178 30 179 54 174 74" fill="none" ${S}/>
    <path d="M165 74 L166 82 M175 74 L174 82" ${S}/>
    <rect x="163" y="82" width="14" height="9" rx="2" fill="${CO}" ${S}/>
  </g>
  <!-- Fukuoka Tower -->
  <path d="M244 160 L252 50 L260 50 L268 160 Z" fill="${MI}" ${S}/>
  <path d="M247 120 H265 M249 95 H263 M250 75 H262" ${S}/>
  <rect x="246" y="58" width="20" height="11" rx="3" fill="${P}" ${S}/>
  <path d="M256 50 V30" ${S}/><circle cx="256" cy="28" r="3" fill="${CO}" ${S}/>
  <!-- Karatsu castle on its hill -->
  <path d="M-6 162 Q62 92 140 162 Z" fill="${GR}" ${S}/>
  <rect x="47" y="102" width="30" height="18" fill="${P}" ${S}/>
  <path d="M40 105 L62 92 L84 105 Z" fill="${CO}" ${S}/>
  <rect x="53" y="82" width="18" height="12" fill="${P}" ${S}/>
  <path d="M47 85 L62 73 L77 85 Z" fill="${CO}" ${S}/>
  <path d="M62 73 V67" ${S}/>
  <rect x="58" y="108" width="8" height="12" rx="2" fill="${MI}" ${S}/>
  <!-- sea -->
  <path d="M-4 158 Q14 150 32 158 T68 158 T104 158 T140 158 T176 158 T212 158 T248 158 T284 158 T320 158 T364 158 V194 H-4 Z" fill="${MI}" ${S}/>
  <!-- ferry to Ainoshima -->
  <g class="sb-bob">
    <path d="M140 156 L214 156 L204 172 L150 172 Z" fill="${CO}" ${S}/>
    <rect x="156" y="140" width="40" height="16" rx="4" fill="${P}" ${S}/>
    <circle cx="167" cy="148" r="3" fill="${MI}" ${S}/><circle cx="185" cy="148" r="3" fill="${MI}" ${S}/>
    <rect x="186" y="128" width="9" height="12" fill="${YE}" ${S}/>
  </g>
  <path d="M110 180 Q122 174 134 180 M232 178 Q244 172 256 178" fill="none" ${S}/>
</svg>`;

  const burst = (x, y, r, col, delay) => {
    const rays = Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4, x1 = x + Math.cos(a) * r * 0.35, y1 = y + Math.sin(a) * r * 0.35, x2 = x + Math.cos(a) * r, y2 = y + Math.sin(a) * r;
      return `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`;
    }).join(' ');
    return `<g class="sb-twinkle" style="transform-origin:${x}px ${y}px;animation-delay:${delay}s">
      <path d="${rays}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      <path d="${rays}" stroke="${col}" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="${x}" cy="${y}" r="${(r * 0.2).toFixed(1)}" fill="${col}" ${S}/></g>`;
  };
  const joetsu = `<svg viewBox="0 0 360 190" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="長岡花火、越後湯澤的雪山與上越新幹線">
  ${burst(62, 46, 26, CO, 0)}
  ${burst(124, 28, 18, YE, 0.8)}
  ${burst(30, 96, 15, MI, 1.6)}
  ${cloud(150, 50, 0.75)}
  <!-- Echigo-Yuzawa mountains -->
  <path d="M150 150 L236 40 L322 150 Z" fill="${GR}" ${S}/>
  <path d="M214 68 L236 40 L258 68 L247 62 L236 72 L225 62 Z" fill="${P}" ${S}/>
  <path d="M262 150 L310 82 L366 150 Z" fill="${GR}" ${S}/>
  <path d="M297 100 L310 82 L323 100 L316 96 L310 103 L304 96 Z" fill="${P}" ${S}/>
  <!-- rice fields and the Shinano river -->
  <path d="M-4 146 H364 V194 H-4 Z" fill="${GR}" ${S}/>
  <path d="M-4 176 Q40 166 90 176 T190 176 T290 176 T364 174 V194 H-4 Z" fill="${MI}" ${S}/>
  <path d="M8 156 H70 M96 156 H150" ${S}/>
  <!-- Joetsu Shinkansen -->
  <g class="sb-glide">
    <path d="M60 134 H250 Q284 134 296 150 H60 Z" fill="#FFFFFF" ${S}/>
    <path d="M60 144 H292" stroke="${MI}" stroke-width="5"/>
    <path d="M60 144 H292" ${S} stroke-width="1.5"/>
    <rect x="76" y="138" width="14" height="5" rx="2" fill="${MI}" ${S} stroke-width="2"/>
    <rect x="104" y="138" width="14" height="5" rx="2" fill="${MI}" ${S} stroke-width="2"/>
    <rect x="132" y="138" width="14" height="5" rx="2" fill="${MI}" ${S} stroke-width="2"/>
    <rect x="160" y="138" width="14" height="5" rx="2" fill="${MI}" ${S} stroke-width="2"/>
    <rect x="188" y="138" width="14" height="5" rx="2" fill="${MI}" ${S} stroke-width="2"/>
    <path d="M254 138 Q270 138 280 145" fill="none" ${S} stroke-width="2"/>
    <path d="M60 150 V134" ${S}/>
  </g>
  <path d="M40 152 H320" ${S}/>
</svg>`;

  return { kyushu, joetsu };
})();

/* Small ink-line icons (replace emoji used as icons). Inline SVG, sized by CSS (.sb-ic). */
window.SB_ICON = (() => {
  const INK = '#3E3A39', CO = '#F2A497', YE = '#F6D27A', MI = '#A8D3E6';
  const svg = (body, label) => `<svg class="sb-ic" viewBox="0 0 24 24" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'} xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const cloud = (fill = '#FFFFFF') => `<path d="M6.5 17.5h10a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1.2A4 4 0 0 0 6.5 17.5Z" fill="${fill}"/>`;
  return {
    pin: svg(`<path d="M12 21s6.5-6.1 6.5-11A6.5 6.5 0 0 0 5.5 10c0 4.9 6.5 11 6.5 11Z" fill="${CO}"/><circle cx="12" cy="10" r="2.3" fill="#FFFFFF"/>`),
    copy: svg(`<rect x="8" y="8" width="12" height="12" rx="3" fill="#FFFFFF"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>`),
    check: svg(`<path d="M5 12.5l4.5 4.5L19 7.5"/>`),
    lock: svg(`<rect x="5" y="10.5" width="14" height="10" rx="3" fill="${YE}"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>`),
    person: svg(`<circle cx="12" cy="8" r="3.5" fill="${MI}"/><path d="M5 20a7 7 0 0 1 14 0Z" fill="${MI}"/>`),
    sun: svg(`<circle cx="12" cy="12" r="4.5" fill="${YE}"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>`),
    arrowOut: svg(`<path d="M9 5h10v10M19 5 6 18"/>`),
    wx: {
      sun: svg(`<circle cx="12" cy="12" r="4.5" fill="${YE}"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>`, '晴'),
      partly: svg(`<circle cx="9" cy="8.5" r="3.5" fill="${YE}"/><path d="M9 2.5v1.2M3 8.5h1.2M4.8 4.3l.9.9"/>${cloud()}`, '晴時多雲'),
      cloud: svg(cloud(), '多雲'),
      fog: svg(`${cloud()}<path d="M5 20.5h14M8 22.5h8" />`, '霧'),
      drizzle: svg(`${cloud(MI)}<path d="M9 20.5v1M13 20.5v1M17 20.5v1"/>`, '毛毛雨'),
      rain: svg(`${cloud(MI)}<path d="M8.5 19.5l-1 2.5M12.5 19.5l-1 2.5M16.5 19.5l-1 2.5"/>`, '雨'),
      snow: svg(`${cloud()}<path d="M9 21h.01M13 20h.01M17 21h.01" stroke-width="3.2"/>`, '雪'),
      storm: svg(`${cloud(MI)}<path d="M13 17l-2.5 3.5h3L11 23.5" fill="none" stroke="${INK}"/>`, '雷雨'),
      na: svg(`<circle cx="12" cy="12" r="8" fill="#FFFFFF"/><path d="M9.8 9.6a2.3 2.3 0 0 1 4.4.9c0 1.6-2.2 1.9-2.2 3.3M12 16.8h.01"/>`, '未知'),
    },
  };
})();

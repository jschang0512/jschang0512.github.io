/* ============================================================
   icons.js — small line icons used by the trip engine (instead of emoji).
   Inline SVG, sized by CSS (.sb-ic). Lines use currentColor, so they follow
   the text colour in light and dark mode; only the weather icons keep a fill.
   Load before data.js and trip.js.
   ============================================================ */
window.SB_ICON = (() => {
  const SUN = '#F5B83D', RAIN = '#7FB3E0';
  const svg = (body, label) => `<svg class="sb-ic" viewBox="0 0 24 24" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'} xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const cloud = (fill = 'none') => `<path d="M6.5 17.5h10a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1.2A4 4 0 0 0 6.5 17.5Z" fill="${fill}"/>`;
  return {
    pin: svg(`<path d="M12 21s6.5-6.1 6.5-11A6.5 6.5 0 0 0 5.5 10c0 4.9 6.5 11 6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>`),
    copy: svg(`<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>`),
    check: svg(`<path d="M5 12.5l4.5 4.5L19 7.5"/>`),
    lock: svg(`<rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>`),
    person: svg(`<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>`),
    sun: svg(`<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>`),
    arrowOut: svg(`<path d="M9 5h10v10M19 5 6 18"/>`),
    moon: svg(`<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>`),
    print: svg(`<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>`),
    calendar: svg(`<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>`),
    grid: svg(`<rect x="3.5" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="16" rx="1.5"/><rect x="15.5" y="4" width="5" height="16" rx="1.5"/>`),
    single: svg(`<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>`),
    wx: {
      sun: svg(`<circle cx="12" cy="12" r="4.5" fill="${SUN}"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>`, '晴'),
      partly: svg(`<circle cx="9" cy="8.5" r="3.5" fill="${SUN}"/><path d="M9 2.5v1.2M3 8.5h1.2M4.8 4.3l.9.9"/>${cloud('var(--card, #fff)')}`, '晴時多雲'),
      cloud: svg(cloud(), '多雲'),
      fog: svg(`${cloud()}<path d="M5 20.5h14M8 22.5h8" />`, '霧'),
      drizzle: svg(`${cloud(RAIN)}<path d="M9 20.5v1M13 20.5v1M17 20.5v1"/>`, '毛毛雨'),
      rain: svg(`${cloud(RAIN)}<path d="M8.5 19.5l-1 2.5M12.5 19.5l-1 2.5M16.5 19.5l-1 2.5"/>`, '雨'),
      snow: svg(`${cloud()}<path d="M9 21h.01M13 20h.01M17 21h.01" stroke-width="3"/>`, '雪'),
      storm: svg(`${cloud(RAIN)}<path d="M13 17l-2.5 3.5h3L11 23.5"/>`, '雷雨'),
      na: svg(`<circle cx="12" cy="12" r="8"/><path d="M9.8 9.6a2.3 2.3 0 0 1 4.4.9c0 1.6-2.2 1.9-2.2 3.3M12 16.8h.01"/>`, '未知'),
    },
  };
})();

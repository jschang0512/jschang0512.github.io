// Draws the launcher icons and splash screens from the app's own icon artwork.
// node make-icons.js
const fs = require('fs'), path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const { PNG } = require('pngjs');
const RES = path.join(__dirname, 'android/app/src/main/res');
const BLUE = '#2347b8', PAPER = '#f4f6fb', BG = '#f6f7fb';

// the glyph (page + clock) on a 512 grid, without the rounded tile
const glyph = `<rect x="132" y="96" width="220" height="292" rx="28" fill="${PAPER}"/>
  <path d="M176 168h132M176 214h132M176 260h84" stroke="${BLUE}" stroke-width="22" stroke-linecap="round"/>
  <circle cx="352" cy="352" r="86" fill="${PAPER}"/>
  <circle cx="352" cy="352" r="62" fill="none" stroke="${BLUE}" stroke-width="20"/>
  <path d="M352 318v38l26 20" fill="none" stroke="${BLUE}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>`;
const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${BLUE}"/>${glyph}</svg>`;
const round = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><circle cx="256" cy="256" r="256" fill="${BLUE}"/>${glyph}</svg>`;
// adaptive foreground: 108dp canvas, artwork inside the 66dp safe zone (glyph spans ~96–438 of 512)
const fg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g transform="translate(256 256) scale(0.62) translate(-265 -267)">${glyph}</g></svg>`;
const render = (svg, w, h) => new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng();

const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  const dir = path.join(RES, 'mipmap-' + d);
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), render(full, Math.round(48 * k)));
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), render(round, Math.round(48 * k)));
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), render(fg, Math.round(108 * k)));
}
fs.writeFileSync(path.join(RES, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BLUE}</color>\n</resources>\n`);

// splash screens: every existing splash.png is redrawn at its own size, icon centred on the app background
for (const dir of fs.readdirSync(RES).filter((x) => x.startsWith('drawable'))) {
  const file = path.join(RES, dir, 'splash.png');
  if (!fs.existsSync(file)) continue;
  const { width: w, height: h } = PNG.sync.read(fs.readFileSync(file));
  const s = Math.round(Math.min(w, h) * 0.28);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${BG}"/><g transform="translate(${(w - s) / 2} ${(h - s) / 2}) scale(${s / 512})"><rect width="512" height="512" rx="112" fill="${BLUE}"/>${glyph}</g></svg>`;
  fs.writeFileSync(file, new Resvg(svg).render().asPng());
}
console.log('icons and splash screens written');

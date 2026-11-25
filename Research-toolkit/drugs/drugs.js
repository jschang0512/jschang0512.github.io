/* Taiwan drug lookup, page script (moved out of index.html so browsers and the service worker cache it).
 * After editing, change the ?v= on its <script> tag in index.html, or returning visitors keep the old copy. */
const TW = RT.twDrugs, N = TW.N, F = TW.F, T = RT.t, esc = RT.esc;
const KEY = 'drugs';
const ADV = { pmin: '', pmax: '', from: '', to: '', atc: '', cls: '', form: '', single: '', cat: '', ctrl: '', country: '', lic: '', pkg: '', who: '', rules: false, photo: false, short: false, recall: false };
const DEF = { scope: 'paid', pack: 'foil', sort: 'rel', byGroup: false, advOpen: false, adv: ADV, view: 'search', rview: 'list' };
let S = RT.merge(DEF, RT.load(KEY, {}));
// scopes before the four-way split: 'all' (with delisted) and 'lic' (everything) both become 'every'
if (S.scope === 'all' || (S.scope === 'lic' && !S.scope4)) S.scope = 'every';
S.scope4 = true;
// earlier versions kept a few filters at the top level
['cls', 'form'].forEach((k) => { if (S[k]) { S.adv[k] = S[k]; } delete S[k]; });
if (S.ctrl === true) S.adv.ctrl = 'any'; if (S.single === true) S.adv.single = '單方'; delete S.ctrl; delete S.single;
let Q = '', Qfix = '', chips = [];            // chips: [{k: 'group'|'atc', v}]
let nhiD = null, fdaD = null, extraD = null, rulesD = null, shown = 50, open = new Set(), openLic = new Set();
const tabOf = new Map();           // the tab each open drug shows
const $ = (id) => document.getElementById(id);
const phone = () => matchMedia('(max-width: 760px)').matches;
const fmtP = (p) => (p ? p.toLocaleString('en-US', { minimumFractionDigits: p < 100 ? 2 : 0, maximumFractionDigits: 2 }) : '0');
const CLS = ['研發廠', 'BA/BE學名藥', '一般學名藥', '生物製劑'];
const CLS_EN = { '研發廠': 'Originator', 'BA/BE學名藥': 'BA/BE generic', '一般學名藥': 'Generic', '生物製劑': 'Biologic' };
const CLS_KEY = { '研發廠': 'orig', 'BA/BE學名藥': 'babe', '一般學名藥': 'gen', '生物製劑': 'bio' };
const clsName = (c) => (RT.lang === 'en' ? CLS_EN[c] || c : c);
const COUNTRY = { TW: '台灣', IN: '印度', JP: '日本', DE: '德國', US: '美國', IT: '義大利', CN: '中國', CH: '瑞士', FR: '法國', GB: '英國', ES: '西班牙', BE: '比利時', KR: '韓國', AT: '奧地利', IE: '愛爾蘭', NL: '荷蘭', SE: '瑞典', DK: '丹麥', AU: '澳洲', CA: '加拿大', PR: '波多黎各', SI: '斯洛維尼亞', PT: '葡萄牙', GR: '希臘', HU: '匈牙利', PL: '波蘭', IL: '以色列', SG: '新加坡', TH: '泰國', MY: '馬來西亞', ID: '印尼', VN: '越南', FI: '芬蘭', NO: '挪威', CZ: '捷克', HR: '克羅埃西亞', BR: '巴西', AR: '阿根廷', MX: '墨西哥', TR: '土耳其', PK: '巴基斯坦', KE: '肯亞', ZA: '南非' };
const countryName = (c) => (RT.lang === 'en' ? c : (COUNTRY[c] ? `${COUNTRY[c]} ${c}` : c));

/* ---------- data ---------- */
function licOf(r) { return fdaD && r[N.licId] ? fdaD.byLicId.get(r[N.licId]) || null : null; }
// the same product in another pack: same first eight characters of the NHI code (…00 and …G0)
const siblings = (r) => { const p = r[N.code].slice(0, 8); return ['00', 'G0'].map((s) => p + s).filter((c) => c !== r[N.code] && nhiD.byCode.has(c)).map((c) => nhiD.byCode.get(c)); };
const hasFoilTwin = (r) => !TW.isFoil(r[N.code]) && nhiD.byCode.has(r[N.code].slice(0, 8) + 'G0');
const hasCanTwin = (r) => TW.isFoil(r[N.code]) && nhiD.byCode.has(r[N.code].slice(0, 8) + '00');
const mcp = (p) => (/^https?:/.test(p) ? p : (extraD ? extraD.base : 'https://mcp.fda.gov.tw/') + p);
function looksOf(f) { return f && extraD ? extraD.looks[f[F.licence]] || [] : []; }
function photoOf(r) {
  const looks = looksOf(licOf(r)); if (!looks.length) return '';
  const i = extraD.lookCols.indexOf('photo'); const l = looks.find((x) => x[i]); return l ? mcp(l[i]) : '';
}
let hay = null, zF = null, eF = null, iF = null, rank = null, indHits = new Set();
function haystack() {
  if (hay) return hay;
  const rows = nhiD.rows, n = rows.length;
  hay = new Array(n); zF = new Array(n); eF = new Array(n); iF = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = rows[i], f = licOf(r);
    hay[i] = TW.fold([r[N.code], r[N.en], r[N.zh], r[N.ingredient], r[N.atc], r[N.vendor], r[N.maker], r[N.group], f ? f[F.licence] : '', f ? f[F.ingredients] : ''].join(' \u0001 '));
    zF[i] = TW.fold(r[N.zh]); eF[i] = TW.fold(r[N.en]); iF[i] = TW.fold(r[N.ingredient]);
  }
  // each row's place in Chinese name order, worked out once: sorting results is then a comparison of numbers
  if (!rank || rank.length !== n) {
    const col = new Intl.Collator('zh-Hant'), order = rows.map((_, i) => i).sort((a, b) => col.compare(rows[a][N.zh], rows[b][N.zh]));
    rank = new Int32Array(n); order.forEach((ix, k) => (rank[ix] = k));
  }
  return hay;
}
// indication text (TFDA), folded, per NHI row and per licence-only row; null until the text has arrived
let indH = null, licInd = null;
const indText = (f) => { const t = f ? TW.licText(f) : null; return t ? t.indication || '' : ''; };
function indHay() {
  if (!moreReady()) return null;
  if (!indH || indH.length !== nhiD.rows.length) indH = nhiD.rows.map((r) => TW.fold(indText(licOf(r))));
  return indH;
}
const moreReady = () => !!(moreP.paid && moreP.paid.done) || !!(moreP.all && moreP.all.done);
// a short piece of the indication around the first word that matched only there
function indSnippet(text, toks) {
  const s = String(text || ''), f = TW.fold(s);
  const t = toks.find((x) => f.includes(x)); if (!t) return '';
  const p = f.indexOf(t), a = Math.max(0, p - 14), b = Math.min(s.length, p + t.length + 26);
  return (a > 0 ? '…' : '') + hl(s.slice(a, b).replace(/\s+/g, ' ')) + (b < s.length ? '…' : '');
}
let licOnly = null, licHay = null;
function licOnlyRows() {
  if (licOnly || !fdaD || !fdaD.complete) return licOnly || [];
  const used = new Set(nhiD.rows.map((r) => r[N.licId]).filter(Boolean));
  licOnly = fdaD.rows.filter((f) => !f[F.status] && !(f[F.licId] && used.has(f[F.licId])));
  licHay = licOnly.map((f) => TW.fold([f[F.licence], f[F.zh], f[F.en], f[F.ingredients], f[F.applicant], f[F.maker], licAtc(f)].join(' \u0001 ')));
  return licOnly;
}
const ATC_RE = /^[a-z]\d{2}([a-z]([a-z](\d{1,2})?)?)?$/;
function tokens() { return TW.fold(Qfix || Q).split(/\s+/).filter(Boolean); }
/* ---------- typo-tolerant search: a misspelt English word is matched to the nearest word in the lists ---------- */
let vocab = null;
function vocabulary() {
  if (vocab && vocab.n === nhiD.rows.length && vocab.f === (fdaD ? fdaD.rows.length : 0)) return vocab;
  const m = new Map();
  const add = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).forEach((w) => { if (w.length >= 4 && /[a-z]/.test(w)) m.set(w, (m.get(w) || 0) + 1); });
  nhiD.rows.forEach((r) => { add(r[N.en]); add(r[N.ingredient]); });
  if (fdaD) fdaD.rows.forEach((f) => { add(f[F.en]); add(f[F.ingredients]); });
  vocab = { n: nhiD.rows.length, f: fdaD ? fdaD.rows.length : 0, words: [...m.entries()] };
  return vocab;
}
// edit distance, giving up once it is sure to exceed max
function lev(a, b, max) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let lo = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < lo) lo = cur[j]; }
    if (lo > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
function nearest(t) {
  const max = t.length <= 5 ? 1 : t.length <= 9 ? 2 : 3, out = [];
  for (const [w, n] of vocabulary().words) { if (Math.abs(w.length - t.length) > max) continue; const d = lev(t, w, max); if (d <= max) out.push({ w, d, n }); }
  return out.sort((a, b) => a.d - b.d || b.n - a.n).slice(0, 4);
}
// the query with each English word that appears nowhere replaced by its nearest neighbour; null when nothing changes
function fuzzyFix(q) {
  const H = haystack(), toks = TW.fold(q).split(/\s+/).filter(Boolean);
  let changed = false, pairs = [], alts = [];
  const fixed = toks.map((t) => {
    if (!/^[a-z][a-z0-9-]{3,}$/.test(t) || H.some((h) => h.includes(t)) || (licHay && licHay.some((h) => h.includes(t)))) return t;
    const c = nearest(t); if (!c.length) return t;
    changed = true; pairs.push([t, c[0].w]);
    if (!alts.length) alts = c.slice(1).map((x) => toks.map((y) => (y === t ? x.w : y)).join(' '));
    return c[0].w;
  });
  return changed ? { q: fixed.join(' '), pairs, alts } : null;
}


/* ---------- dosage-form pictograms (when there is no photo) ---------- */
const ICON = {
  tab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="7.5"/><path d="M5.5 12h13"/></svg>',
  cap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3.5" y="8" width="17" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="m9.2 7.9 4.6 6.5"/></svg>',
  inj: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m17 3 4 4M19 5l-9.5 9.5M14 6l4 4M7 13l4 4M5.5 18.5 3 21M8.5 11.5 5 15l4 4 3.5-3.5"/></svg>',
  liq: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M9 3h6M10 3v4l-3 3v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V10l-3-3V3"/><path d="M7 14h10"/></svg>',
  tube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 21h12l-2-14H8z"/><path d="M10 7V4h4v3"/></svg>',
  inh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M8 3h6v10h4v5a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2z"/></svg>',
  drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>',
};
function formIcon(form) {
  const f = String(form || '');
  if (/膠囊/.test(f)) return ICON.cap;
  if (/注射|輸注|針/.test(f)) return ICON.inj;
  if (/吸入|噴/.test(f)) return ICON.inh;
  if (/點眼|點耳|點鼻|滴/.test(f)) return ICON.drop;
  if (/膏|凝膠|乳|貼/.test(f)) return ICON.tube;
  if (/液|糖漿|懸|酏|溶|乳劑/.test(f)) return ICON.liq;
  return ICON.tab;
}

/* ---------- advanced filters ---------- */
const A = () => S.adv;
const advCount = () => Object.entries(A()).filter(([, v]) => v !== '' && v !== false).length;
const needsLic = () => !!(A().cat || A().ctrl || A().country || A().lic);
const num = (v) => { const n = parseFloat(String(v).replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
function licPasses(f) {
  const a = A();
  if (!needsLic()) return true;
  if (!f) return false;
  if (a.cat && f[F.category] !== a.cat) return false;
  if (a.ctrl) { const lv = TW.ctrlLevel(f[F.controlled]); if (a.ctrl === 'any' ? !lv : a.ctrl === 'none' ? lv : lv !== +a.ctrl) return false; }
  if (a.country && f[F.country] !== a.country) return false;
  if (a.lic === 'valid' && f[F.status]) return false;
  if (a.lic === 'gone' && !f[F.status]) return false;
  return true;
}
function passes(r) {
  const a = A();
  if (a.cls && r[N.class] !== a.cls) return false;
  if (a.form && r[N.form] !== a.form) return false;
  if (a.single && r[N.single] !== a.single) return false;
  const lo = num(a.pmin), hi = num(a.pmax);
  if (lo != null && !(r[N.price] >= lo)) return false;
  if (hi != null && !(r[N.price] > 0 && r[N.price] <= hi)) return false;
  if (a.from && (r[N.firstListed] || '') < a.from) return false;
  if (a.to && (r[N.firstListed] || '9999') > a.to + '-31') return false;
  if (a.atc && !r[N.atc].startsWith(a.atc.trim().toUpperCase())) return false;
  if (a.pkg === 'g0' && !TW.isFoil(r[N.code])) return false;
  if (a.pkg === 'not' && TW.isFoil(r[N.code])) return false;
  if (a.who) { const w = TW.fold(a.who); if (!TW.fold(r[N.vendor] + ' ' + r[N.maker]).includes(w)) return false; }
  if (a.rules && !r[N.ruleChapters]) return false;
  if (needsLic() && !licPasses(licOf(r))) return false;
  if (a.photo && !photoOf(r)) return false;
  if (a.short && !isShort(licOf(r))) return false;
  if (a.recall && !lastRecall(licOf(r))) return false;
  return true;
}

function search() {
  const toks = tokens();
  const H = haystack();
  if (toks.length) loadMore();          // indication text, so the query also looks there
  const I = toks.length ? indHay() : null;
  const out = [];
  indHits = new Set();
  // a product sold in both a foil pack (…G0) and a standard pack (…00) is listed once, in the pack chosen above the results
  const pack = A().pkg ? 'both' : S.pack || 'foil';
  let packHidden = 0;
  for (let i = 0; i < nhiD.rows.length; i++) {
    const r = nhiD.rows[i];
    if (S.scope === 'lic') break;
    if (S.scope === 'paid' && !(r[N.price] > 0)) continue;
    if (S.scope === 'delisted' && r[N.price] > 0) continue;
    if (!passes(r)) continue;
    let ok = true;
    for (const c of chips) {
      if (c.k === 'group' && r[N.group] !== c.v) { ok = false; break; }
      if (c.k === 'atc' && !r[N.atc].startsWith(c.v)) { ok = false; break; }
    }
    if (!ok) continue;
    const h = H[i];
    let score = 0, viaInd = false;
    for (const t of toks) {
      if (!h.includes(t)) {
        // only in the indication: it counts, but below any match in the name, ingredient or codes
        if (I && I[i].includes(t)) { viaInd = true; continue; }
        ok = false; break;
      }
      const code = r[N.code].toLowerCase(), atc = r[N.atc].toLowerCase();
      if (code === t) score += 100;
      else if (code.startsWith(t)) score += 60;
      if (ATC_RE.test(t) && atc.startsWith(t)) score += 50;
      if (zF[i].startsWith(t) || eF[i].startsWith(t)) score += 30;
      if (iF[i].startsWith(t)) score += 20;
      score += 1;
    }
    if (!ok) continue;
    if (pack !== 'both' && (pack === 'foil' ? hasFoilTwin(r) : hasCanTwin(r)) && !toks.includes(r[N.code].toLowerCase())) { packHidden++; continue; }
    if (viaInd) indHits.add(r[N.code]);
    out.push({ r, i, score: score + (r[N.price] > 0 ? 5 : 0) });
  }
  const by = {
    rel: (a, b) => b.score - a.score || (b.r[N.price] > 0) - (a.r[N.price] > 0) || rank[a.i] - rank[b.i],
    pa: (a, b) => (a.r[N.price] || Infinity) - (b.r[N.price] || Infinity),
    pd: (a, b) => b.r[N.price] - a.r[N.price],
    code: (a, b) => (a.r[N.code] < b.r[N.code] ? -1 : 1),
    new: (a, b) => (a.r[N.firstListed] < b.r[N.firstListed] ? 1 : a.r[N.firstListed] > b.r[N.firstListed] ? -1 : 0),
  };
  // a price group is for comparing prices: cheapest first unless another order was chosen
  out.sort(S.sort === 'rel' && chips.some((c) => c.k === 'group') ? by.pa : by[S.sort] || by.rel);
  let lic = [];
  // licences have an ATC code now (from the TFDA), so an ATC filter or chip applies to them too
  const nhiOnly = A().cls || A().form || A().pmin || A().pmax || A().from || A().to || A().pkg || A().rules || A().single;
  const atcWant = [A().atc ? A().atc.trim().toUpperCase() : '', ...chips.filter((c) => c.k === 'atc').map((c) => c.v)].filter(Boolean);
  if ((S.scope === 'lic' || S.scope === 'every') && fdaD && (toks.length || needsLic() || A().photo || atcWant.length) && !chips.some((c) => c.k !== 'atc') && !nhiOnly) {
    const L = licOnlyRows();
    for (let i = 0; i < L.length; i++) {
      if (!licPasses(L[i])) continue;
      if (atcWant.length && !atcWant.every((a) => licAtc(L[i]).startsWith(a))) continue;
      if (!toks.length && !(A().photo && !looksOf(L[i]).length)) { lic.push(L[i]); continue; }
      if (A().photo && !looksOf(L[i]).length) continue;
      if (toks.every((t) => licHay[i].includes(t))) { lic.push(L[i]); continue; }
      if (moreReady() && toks.length) {
        if (!licInd || licInd.length !== L.length) licInd = L.map((f) => TW.fold(indText(f)));
        if (toks.every((t) => licHay[i].includes(t) || licInd[i].includes(t))) { lic.push(L[i]); indHits.add('L:' + L[i][F.licence]); }
      }
    }
  }
  return { rows: out.map((x) => x.r), lic, packHidden, pack };
}

/* ---------- price scale shared by the overview and the cards ---------- */
// paid prices of every NHI price group, lowest first, foil packs (G0) apart from the rest since they have a higher price floor
let grpIdx = null;
const grpKey = (x) => x[N.group] + (TW.isFoil(x[N.code]) ? '|G0' : '');
function grpPrices(r) {
  if (!r[N.group]) return null;
  if (!grpIdx) { grpIdx = new Map(); for (const x of nhiD.rows) if (x[N.price] > 0 && x[N.group]) { const k = grpKey(x), a = grpIdx.get(k); if (a) a.push(x[N.price]); else grpIdx.set(k, [x[N.price]]); } grpIdx.forEach((a) => a.sort((p, q) => p - q)); }
  return grpIdx.get(grpKey(r)) || null;
}
// where the price sits in its own price group (same ingredient, strength and form)
function grpPos(r) {
  const ps = grpPrices(r), foil = TW.isFoil(r[N.code]);
  if (!ps || ps.length < 2) return '';
  const lo = ps[0], hi = ps[ps.length - 1], p = r[N.price];
  const tip = T(`同分組（相同成分、含量、劑型）${foil ? '的鋁箔包裝' : ''}給付中 ${ps.length} 項，$${fmtP(lo)}${hi > lo ? ' – $' + fmtP(hi) : ''}`, `${ps.length} reimbursed ${foil ? 'foil-pack ' : ''}items in the same price group (ingredient, strength, form), $${fmtP(lo)}${hi > lo ? ' – $' + fmtP(hi) : ''}`);
  if (p <= lo) return `<span class="gp${hi > lo ? ' lo' : ''}" title="${tip}">${hi > lo ? T('同組最低', 'Group low') : T('同組同價', 'Same as group')}</span>`;
  const pc = Math.round(((p - lo) / lo) * 100);
  return `<span class="gp" title="${tip}">${T(`比同組最低貴 ${pc < 1 ? '<1' : pc}%`, `+${pc < 1 ? '<1' : pc}% vs group low`)}</span>`;
}
let scale = null;
function makeScale(rows) {
  const ps = rows.map((r) => r[N.price]).filter((p) => p > 0).sort((a, b) => a - b);
  if (!ps.length) return null;
  const lo = ps[0], hi = ps[ps.length - 1], log = hi / lo > 20;
  const f = (p) => (log ? Math.log(p) : p);
  const pos = (p) => (hi === lo ? 0.5 : (f(p) - f(lo)) / (f(hi) - f(lo)));
  return { ps, lo, hi, log, pos, med: ps[Math.floor(ps.length / 2)] };
}

/* ---------- render ---------- */
function hl(text) {
  const s = String(text || ''); const toks = tokens().filter((t) => t.length > 0);
  if (!toks.length) return esc(s);
  const f = TW.fold(s); const marks = new Array(s.length).fill(false);
  toks.forEach((t) => { let p = f.indexOf(t); while (p >= 0) { for (let k = p; k < p + t.length && k < s.length; k++) marks[k] = true; p = f.indexOf(t, p + t.length); } });
  let o = '', inM = false;
  for (let i = 0; i < s.length; i++) { if (marks[i] !== inM) { o += marks[i] ? '<mark>' : '</mark>'; inM = marks[i]; } o += esc(s[i]); }
  return o + (inM ? '</mark>' : '');
}
const clsTag = (c) => (c ? `<span class="tag"><span class="dot k-${CLS_KEY[c] || 'none'}"></span>${esc(clsName(c))}</span>` : '');
const pkgTag = (r) => (TW.isFoil(r[N.code]) ? `<span class="tag pkg" title="${T('健保代號末兩碼 G0', 'NHI code ends in G0')}">${T('鋁箔包裝', 'Foil pack')}</span>`
  : hasFoilTwin(r) ? `<span class="tag pkg" title="${T('同品項另有 G0 鋁箔包裝代號', 'A G0 foil-pack code exists for this product')}">${T('一般包裝', 'Standard pack')}</span>` : '');
function ctrlTag(f) {
  if (!f || !f[F.controlled]) return '';
  return TW.ctrlLevel(f[F.controlled]) ? `<span class="tag ctrl">${esc(f[F.controlled])}</span>` : `<span class="tag">${esc(f[F.controlled])}</span>`;
}
function thumbHTML(r) {
  const src = photoOf(r);
  return `<span class="thumb${src ? '' : ' noimg'}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : formIcon(r[N.form])}</span>`;
}
// the class as a coloured dot and a short name, in place of a tag on every row
const clsDot = (c) => (c ? `<span class="cls"><span class="dot k-${CLS_KEY[c] || 'none'}"></span>${esc(clsName(c))}</span>` : '');
// where this price sits among the reimbursed prices of its price group (foil packs apart): a strip of dots, this one larger
function grpInfo(r) {
  const ps = grpPrices(r);
  if (!ps || ps.length < 2 || !(r[N.price] > 0)) return null;
  const lo = ps[0], hi = ps[ps.length - 1], p = r[N.price], pc = lo ? Math.round(((p - lo) / lo) * 100) : 0;
  const label = hi === lo ? T('同組同價', 'Same as group') : p <= lo ? T('同組最低', 'Group low') : `+${pc < 1 ? '<1' : pc}%`;
  return { ps, lo, hi, p, n: ps.length, foil: TW.isFoil(r[N.code]), label, low: p <= lo && hi > lo };
}
function stripHTML(g) {
  if (!g) return '';
  const pos = (v) => (g.hi > g.lo ? ((v - g.lo) / (g.hi - g.lo)) * 100 : 50).toFixed(1) + '%';
  const tip = T(`同分組${g.foil ? '的鋁箔包裝' : ''}給付中 ${g.n} 項，$${fmtP(g.lo)}${g.hi > g.lo ? ' – $' + fmtP(g.hi) : ''}`, `${g.n} reimbursed ${g.foil ? 'foil-pack ' : ''}items in the price group, $${fmtP(g.lo)}${g.hi > g.lo ? ' – $' + fmtP(g.hi) : ''}`);
  return `<span class="gs" title="${tip}"><span class="gs-t" role="img" aria-label="${tip}">${[...new Set(g.ps)].map((v) => `<i style="left:${pos(v)}"></i>`).join('')}<i class="me${g.low ? ' lo' : ''}" style="left:${pos(g.p)}"></i></span><span class="gs-e">${g.hi > g.lo ? `<span>$${fmtP(g.lo)}</span><span>${T(`同組 ${g.n} 項`, `${g.n} in group`)}</span><span>$${fmtP(g.hi)}</span>` : `<span>${T(`同組 ${g.n} 項同價`, `all ${g.n} in group at this price`)}</span>`}</span></span>`;
}
const rareTags = (r, f) => [pkgTag(r), ctrlTag(f), alertTags(f), f && f[F.status] ? `<span class="tag off">${T('許可證', 'Licence ')}${esc(f[F.status])}</span>` : ''].join('');
const isOpenRow = (id) => open.has(id);
function rowHTML(r) {
  if (S.rview === 'table') return rowTblHTML(r);
  if (S.rview === 'cards') return rowCardHTML(r);
  const f = licOf(r), id = r[N.code], g = grpInfo(r), tags = rareTags(r, f);
  const price = r[N.price] > 0
    ? `<b>$${fmtP(r[N.price])}</b>${g ? `<span class="gp${g.low ? ' lo' : ''}">${g.label}</span>` : ''}<small>${esc(r[N.priceSince] || '')}</small>`
    : `<span class="tag off">${T('已取消給付', 'Delisted')}</span>${r[N.lastPaidPrice] ? `<small>${T('最後', 'last')} $${fmtP(r[N.lastPaidPrice])}</small>` : ''}`;
  return `<li data-code="${esc(id)}"${isOpenRow(id) ? ' class="open"' : ''}><button type="button" class="row" aria-expanded="${isOpenRow(id)}" aria-controls="d-${esc(id)}">
    ${thumbHTML(r)}
    <span class="main"><span class="nm">${hl(r[N.zh] || r[N.en])}${tags ? ` <span class="tags">${tags}</span>` : ''}</span>${r[N.zh] ? `<span class="en">${hl(r[N.en])}</span>` : ''}
      <span class="meta">${clsDot(r[N.class])}<span class="cd">${hl(id)}</span>${r[N.atc] ? `<span>ATC ${hl(r[N.atc])}</span>` : ''}<span>${hl(r[N.ingredient])}</span>${r[N.form] ? `<span>${esc(r[N.form])}</span>` : ''}</span>
      ${indHits.has(id) ? `<span class="ind-hit"><b>${T('適應症', 'Indication')}</b> ${indSnippet(indText(f), tokens())}</span>` : ''}</span>
    ${stripHTML(g)}
    <span class="pr">${price}</span>
  </button>${isOpenRow(id) ? detailHTML(r) : ''}</li>`;
}
// table: one line per item, a bar for the price on the results' own scale
function rowTblHTML(r) {
  const id = r[N.code], f = licOf(r), sc = scale, w = r[N.price] > 0 && sc ? Math.max(2, sc.pos(r[N.price]) * 100) : 0;
  return `<li data-code="${esc(id)}"${isOpenRow(id) ? ' class="open"' : ''}><button type="button" class="row t" aria-expanded="${isOpenRow(id)}" aria-controls="d-${esc(id)}">
    <span class="c-nm"><span class="nm">${hl(r[N.zh] || r[N.en])}</span>${r[N.zh] ? `<span class="en">${hl(r[N.en])}</span>` : ''}</span>
    <span class="c-cd cd">${hl(id)}</span>
    <span class="c-cls">${clsDot(r[N.class])}</span>
    <span class="c-ing">${hl(r[N.ingredient])}</span>
    <span class="c-form">${esc(r[N.form] || '')}${rareTags(r, f) ? ` <span class="tags">${rareTags(r, f)}</span>` : ''}</span>
    <span class="c-pr">${r[N.price] > 0 ? '$' + fmtP(r[N.price]) : `<span class="tag off">${T('已取消', 'Delisted')}</span>`}</span>
    <span class="c-bar" aria-hidden="true">${w ? `<i class="k-${CLS_KEY[r[N.class]] || 'none'}" style="width:${w.toFixed(1)}%"></i>` : ''}</span>
  </button>${isOpenRow(id) ? detailHTML(r) : ''}</li>`;
}
function tblHeadHTML() {
  const pr = S.sort === 'pa' ? ' ↑' : S.sort === 'pd' ? ' ↓' : '';
  return `<li class="th"><span>${T('名稱', 'Name')}</span><span><button type="button" class="th-b" data-sorth="code">${T('健保代號', 'NHI code')}${S.sort === 'code' ? ' ↑' : ''}</button></span><span>${T('分類', 'Class')}</span><span>${T('成分', 'Ingredient')}</span><span>${T('劑型', 'Form')}</span><span class="c-pr"><button type="button" class="th-b" data-sorth="price">${T('支付價', 'Price')}${pr}</button></span><span>${scale && scale.log ? T('（對數刻度）', '(log scale)') : ''}</span></li>`;
}
// cards: the photo large, with what the pill looks like
function looksLine(f) {
  const l = looksOf(f)[0]; if (!l || !extraD) return '';
  const C = {}; extraD.lookCols.forEach((c, i) => (C[c] = i));
  return [l[C.colour], l[C.shape], l[C.size] ? l[C.size] + ' mm' : '', l[C.score] ? T('有刻痕', 'scored') : '', [l[C.mark1], l[C.mark2]].filter(Boolean).join(' / ')].filter(Boolean).join(' · ');
}
function rowCardHTML(r) {
  const id = r[N.code], f = licOf(r), src = photoOf(r), lk = looksLine(f);
  return `<li data-code="${esc(id)}"${isOpenRow(id) ? ' class="open"' : ''}><button type="button" class="row c" aria-expanded="${isOpenRow(id)}" aria-controls="d-${esc(id)}">
    <span class="card-ph${src ? '' : ' noimg'}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : `${formIcon(r[N.form])}<small>${T('沒有照片', 'No photo')}</small>`}</span>
    <span class="card-nm">${hl(r[N.zh] || r[N.en])}</span>
    <span class="card-lk">${lk ? esc(lk) : `${hl(r[N.ingredient])}${r[N.form] ? ' · ' + esc(r[N.form]) : ''}`}</span>
    <span class="card-pr"><b>${r[N.price] > 0 ? '$' + fmtP(r[N.price]) : T('已取消給付', 'Delisted')}</b>${clsDot(r[N.class])}</span>
  </button>${isOpenRow(id) ? detailHTML(r) : ''}</li>`;
}

/* ---------- overview of the results ---------- */
function overviewHTML(rows) {
  if (!rows.length) return '';
  const sc = scale;
  const paid = rows.filter((r) => r[N.price] > 0).length;
  const byCls = {}; rows.forEach((r) => { const k = CLS_KEY[r[N.class]] ? r[N.class] : ''; byCls[k] = (byCls[k] || 0) + 1; });
  const ctrl = {}; if (fdaD) rows.forEach((r) => { const lv = TW.ctrlLevel((licOf(r) || [])[F.controlled]); if (lv) ctrl[lv] = (ctrl[lv] || 0) + 1; });
  const pct = (n) => ((n / rows.length) * 100).toFixed(2) + '%';
  // price dots: every reimbursed item, on a log scale when prices span more than 20×
  let strip = '';
  if (sc) {
    // dots as positioned elements so they stay round at any width; a little vertical jitter shows where they pile up
    const dots = sc.ps.length > 1500 ? sc.ps.filter((_, i) => i % Math.ceil(sc.ps.length / 1500) === 0) : sc.ps;
    const left = (p) => (sc.pos(p) * 100).toFixed(2) + '%';
    strip = `<div class="strip"><div class="track" role="img" aria-label="${T(`支付價分布：最低 $${fmtP(sc.lo)}、中位數 $${fmtP(sc.med)}、最高 $${fmtP(sc.hi)}`, `Prices: lowest $${fmtP(sc.lo)}, median $${fmtP(sc.med)}, highest $${fmtP(sc.hi)}`)}">${dots.map((p, i) => `<i style="left:${left(p)};top:${10 + ((i * 7919) % 13)}px"></i>`).join('')}<b class="med" style="left:${left(sc.med)}"></b></div>
      <div class="ends"><span>$${fmtP(sc.lo)}</span><span>${T('中位數', 'median')} <b>$${fmtP(sc.med)}</b>${sc.log ? T('（對數刻度）', ' (log scale)') : ''}</span><span>$${fmtP(sc.hi)}</span></div></div>`;
  }
  const clsBar = ['研發廠', 'BA/BE學名藥', '一般學名藥', '生物製劑', ''].filter((c) => byCls[c]).map((c) => ({ c, n: byCls[c], key: CLS_KEY[c] || 'none', name: c ? clsName(c) : T('未分類', 'Unclassified') }));
  const on = A().cls;
  const open = false;
  return `<details class="ov" id="ov"${open ? ' open' : ''}><summary><span>${T('結果分布：支付價、分類、給付狀態、ATC 趨勢', 'Breakdown: prices, classes, status and ATC trend')}</span><span class="car" aria-hidden="true">▾</span></summary>
    <div class="ov-body">
      ${sc ? `<span class="k">${T('支付價', 'Price')}</span>${strip}` : ''}
      <span class="k">${T('藥品分類', 'Class')}</span><div><div class="bar">${clsBar.map((b) => `<button type="button" class="k-${b.key}" style="width:${pct(b.n)}" data-ovcls="${esc(b.c)}" title="${esc(b.name)} ${b.n}" aria-label="${esc(b.name)} ${b.n}"></button>`).join('')}</div>
        <div class="legend">${clsBar.map((b) => `<button type="button" data-ovcls="${esc(b.c)}" aria-pressed="${on === b.c && !!b.c}"><span class="dot k-${b.key}"></span>${esc(b.name)} <b>${b.n}</b></button>`).join('')}</div></div>
      ${S.scope === 'every' || S.scope === 'delisted' ? `<span class="k">${T('給付狀態', 'Status')}</span><div><div class="bar"><button type="button" class="k-paid" style="width:${pct(paid)}" data-ovscope="paid" aria-label="${T('給付中', 'Reimbursed')} ${paid}"></button><button type="button" class="k-off" style="width:${pct(rows.length - paid)}" data-ovscope="delisted" aria-label="${T('已取消給付', 'Delisted')} ${rows.length - paid}"></button></div>
        <div class="legend"><button type="button" data-ovscope="paid"><span class="dot k-paid"></span>${T('給付中', 'Reimbursed')} <b>${paid}</b></button><button type="button" data-ovscope="delisted"><span class="dot k-off"></span>${T('已取消給付', 'Delisted')} <b>${rows.length - paid}</b></button></div></div>` : ''}
      ${(() => { const cp = classPrefix(rows); return cp ? `<span class="k top">ATC ${esc(cp)}</span><div><details class="ctr" data-ctr="${esc(cp)}"${S.ctrOpen ? ' open' : ''}><summary>${T('類別歷年趨勢：品項數、價格中位數、醫令量', 'Class over the years: items, median price, claims')}</summary><div class="ctr-box" data-ctrbox></div></details></div>` : ''; })()}
      ${Object.keys(ctrl).length ? `<span class="k">${T('管制藥品', 'Controlled')}</span><div class="legend" style="margin:0">${Object.entries(ctrl).sort().map(([lv, n]) => `<button type="button" data-ovctrl="${lv}" aria-pressed="${A().ctrl === lv}"><span class="tag ctrl">${T(`第${'一二三四'[lv - 1]}級`, `Schedule ${lv}`)}</span> <b>${n}</b></button>`).join('')}</div>` : ''}
    </div></details>`;
}

/* ---------- detail ---------- */
const fact = (k, v, wide) => (v ? `<div class="fact${wide ? ' wide' : ''}"><span class="k">${k}</span><span class="v">${v}</span></div>` : '');
const kv = (rows) => `<dl class="kv">${rows.filter((x) => x && x[1]).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
function ruleFile(r, c) { const files = r[N.ruleFiles] ? r[N.ruleFiles].split(',') : []; return files.find((x) => x.startsWith(c + '_')) || ''; }
function zoomBtn(src, cap, inner) { return `<button type="button" class="zoom" data-photo="${esc(src)}" data-cap="${esc(cap)}" aria-label="${T('放大照片', 'Enlarge photo')}" title="${T('點一下放大', 'Click to enlarge')}">${inner}</button>`; }
const TABS = [['sum', '概要', 'Overview'], ['price', '價格與費用', 'Price and cost'], ['use', '用量', 'Usage'], ['rules', '給付規定', 'NHI rules'], ['lic', '許可證與外觀', 'Licence and looks']];
const ICO = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6h10M4 12h10M4 18h7M18 15v6M15 18h6"/></svg>',
  cmp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="7" height="14" rx="1.5"/><rect x="14" y="5" width="7" height="14" rx="1.5"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};
const iconBtn = (act, ico, zh, en, cls = '') => `<button type="button" class="ib${cls}" data-act="${act}" aria-label="${T(zh, en)}" title="${T(zh, en)}">${ICO[ico]}</button>`;
// the four numbers worth seeing first; a cell with nothing to say is left out
function kpiHTML(r) {
  const k = (label, val, sub, extra = '', cls = '') => `<div class="kpi${cls}"><span class="kk">${label}</span><span class="kv">${val}</span>${sub ? `<span class="ks">${sub}</span>` : ''}${extra}</div>`;
  const g = grpInfo(r), cells = [];
  cells.push(r[N.price] > 0 ? k(T('支付價', 'Price'), `$${fmtP(r[N.price])}`, T(`自 ${esc(r[N.priceSince] || '—')}`, `since ${esc(r[N.priceSince] || '—')}`))
    : k(T('支付價', 'Price'), `<span style="color:var(--warn-text)">${T('已取消給付', 'Delisted')}</span>`, r[N.lastPaidPrice] ? T(`最後 $${fmtP(r[N.lastPaidPrice])}`, `last $${fmtP(r[N.lastPaidPrice])}`) : esc(r[N.priceSince] || '')));
  if (g) cells.push(k(T(`同組 ${g.n} 項中`, `Of ${g.n} in its group`), `<span${g.low ? ' style="color:var(--ok-text)"' : ''}>${g.label}</span>`, '', stripHTML(g), ' grp'));
  cells.push(`<div class="kpi" data-kpi-use hidden></div>`);
  if (r[N.ruleChapters]) {
    const cs = r[N.ruleChapters].split(',').filter(Boolean), fl = ruleFile(r, cs[0]);
    cells.push(k(T('給付規定', 'NHI rules'), esc(cs.join('、')), fl ? T(`修訂 ${esc(TW.ruleDate(fl))}`, `revised ${esc(TW.ruleDate(fl))}`) : ''));
  } else if (r[N.firstListed]) {
    const y = Math.floor((Date.now() - new Date(r[N.firstListed])) / 3.156e10);
    cells.push(k(T('首次收載', 'First listed'), esc(r[N.firstListed].slice(0, 7)), y >= 1 ? T(`${y} 年`, `${y} year${y > 1 ? 's' : ''}`) : ''));
  }
  return `<div class="kpis">${cells.join('')}</div>`;
}
// last full year of claims and its change on the year before
async function fillUseKpi(el, r) {
  if (!el) return;
  try { await loadUsage(); } catch (e) { return; }
  const ys = usageD.years, mine = usageD.q[r[N.code]];
  if (!el.isConnected || !ys.length || !mine) return;
  let i = ys.length - 1; while (i > 0 && ys[i].partial) i--;
  const v = (mine[i] || [0])[0], pv = i > 0 ? (mine[i - 1] || [0])[0] : 0;
  if (!v && !pv) return;
  const ch = pv ? Math.round(((v - pv) / pv) * 100) : null;
  el.innerHTML = `<span class="kk">${T(`${ys[i].year} 醫令量`, `${ys[i].year} claims`)}</span><span class="kv">${fmtN(v)}</span>${ch != null ? `<span class="ks">${ch > 0 ? '↑' : ch < 0 ? '↓' : '→'} ${Math.abs(ch)}% ${T('較前一年', 'on the year before')}</span>` : ''}`;
  el.hidden = false;
}
function detailHTML(r) {
  const f = licOf(r), id = r[N.code], tab = tabOf.get(id) === 'looks' ? 'lic' : tabOf.get(id) || 'sum';
  const photo = photoOf(r);
  const statusTags = [
    r[N.price] > 0 ? `<span class="tag ok">${T('給付中', 'Reimbursed')}</span>` : `<span class="tag off">${T('已取消給付', 'Delisted')}</span>`,
    clsTag(r[N.class]), ctrlTag(f), pkgTag(r), alertTags(f), rmpTag(f),
    f ? (f[F.status] ? `<span class="tag off">${T('許可證', 'Licence ')}${esc(f[F.status])}</span>` : `<span class="tag ok">${T('許可證有效', 'Licence valid')}</span>`) : '',
  ].join('');
  const tabs = TABS.filter(([k]) => k !== 'rules' || r[N.ruleChapters]);
  return `<div class="detail" id="d-${esc(id)}" data-code="${esc(id)}">
    <div class="d-back"><button type="button" data-act="close">← ${T('返回', 'Back')}</button><span>${esc(r[N.zh] || r[N.en])}</span></div>
    <div class="d-head">
      <div class="d-pic${photo ? '' : ' noimg'}">${photo ? zoomBtn(photo, (r[N.zh] || r[N.en]), `<img src="${esc(photo)}" alt="${esc(T('藥品外觀照片', 'Photo of the drug'))}" decoding="async">`) : formIcon(r[N.form])}</div>
      <div class="d-title"><h2>${esc(r[N.zh] || r[N.en])}</h2><div class="en">${r[N.zh] ? esc(r[N.en]) + ' · ' : ''}<span class="cd">${esc(id)}</span></div><div class="tags">${statusTags}</div></div>
      <div class="d-tools">${iconBtn('copy', 'copy', '複製摘要', 'Copy summary')}${iconBtn('link', 'link', '複製連結', 'Copy link')}${iconBtn('codelist', 'list', '加入代碼清單', 'Add to code list')}<button type="button" class="ib" data-act="cmp" aria-pressed="${(S.cmp || []).includes(id)}" aria-label="${T('加入比較', 'Add to compare')}" title="${T('加入比較（最多 4 個）', 'Add to compare (up to 4)')}">${ICO.cmp}</button>${iconBtn('close', 'close', '收合', 'Close', ' x')}</div>
    </div>
    ${kpiHTML(r)}
    ${alertBanners(f)}${safetyBanner(r[N.ingredient], r[N.atc])}
    <div class="tabs" role="tablist">${tabs.map(([k, zh, en]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}">${T(zh, en)}</button>`).join('')}<span class="tab-ink" aria-hidden="true"></span></div>
    <div class="tabp" role="tabpanel" data-panel="${tab}">${tabHTML(r, tab)}</div>
  </div>`;
}
function tabHTML(r, tab) {
  const f = licOf(r);
  if (tab === 'sum') {
    const sibs = siblings(r);
    const pkg = TW.isFoil(r[N.code]) ? T('鋁箔包裝（代號末兩碼 G0）', 'Foil pack (code ends in G0)') : hasFoilTwin(r) ? T('一般包裝（同品項另有 G0 鋁箔包裝）', 'Standard pack (a G0 foil pack also exists)') : '';
    const nGroup = r[N.group] ? nhiD.rows.filter((x) => x[N.group] === r[N.group]).length : 0;
    const nAtc = r[N.atc] ? nhiD.rows.filter((x) => x[N.atc] === r[N.atc]).length : 0;
    const nAtc5 = r[N.atc] && r[N.atc].length > 5 ? nhiD.rows.filter((x) => x[N.atc].startsWith(r[N.atc].slice(0, 5))).length : 0;
    const rules = r[N.ruleChapters] ? r[N.ruleChapters].split(',').filter(Boolean).map((c) => { const fl = ruleFile(r, c); return `<b>${esc(c)}</b>${fl ? ` <span class="hint" style="margin:0">${T('修訂', 'revised')} ${esc(TW.ruleDate(fl))}</span>` : ''}`; }).join('　') + ` <button type="button" class="small" data-tab="rules">${T('看全文', 'Full text')}</button>` : T('沒有特別給付規定', 'No specific rule');
    const yrs = r[N.firstListed] ? Math.floor((Date.now() - new Date(r[N.firstListed])) / 3.156e10) : 0;
    return `<div class="tl" data-tl></div>
    <div class="fgrps">
      <section><h4>${T('這是什麼藥', 'What it is')}</h4>${kv([
        [T('成分', 'Ingredient'), esc(r[N.ingredient])],
        [T('劑型', 'Form'), esc(r[N.form]) + (r[N.strength] ? ' · ' + esc(r[N.strength]) : '') + (r[N.single] ? ' · ' + esc(r[N.single]) : '')],
        ['ATC', r[N.atc] ? `<span class="cd">${esc(r[N.atc])}</span>` : ''],
        [T('外部資料', 'Elsewhere'), extLinks(r[N.ingredient], r[N.atc])],
        f ? [T('適應症', 'Indication'), TW.licText(f) ? `<span class="ind">${esc(TW.licText(f).indication)}</span>` : `<span class="hint">${T('載入中…', 'Loading…')}</span>`] : null,
      ])}</section>
      <section><h4>${T('健保', 'NHI')}</h4>${kv([
        [T('首次收載', 'First listed'), esc(r[N.firstListed]) + (yrs >= 1 ? ` <span class="hint" style="margin:0">（${T(`${yrs} 年`, `${yrs} yr`)}）</span>` : '')],
        [T('藥品分類', 'Class'), clsDot(r[N.class])],
        [T('分類分組', 'Price group'), esc(r[N.group])],
        [T('給付規定', 'NHI rules'), rules],
        [T('包裝', 'Pack'), pkg ? esc(pkg) : ''],
        [T('其他包裝', 'Other pack'), sibs.length ? `<span class="sib">${sibs.map((s) => `<button type="button" data-go="${esc(s[N.code])}">${esc(s[N.code])} ${s[N.price] > 0 ? '$' + fmtP(s[N.price]) : T('已取消給付', 'delisted')}</button>`).join('')}</span>` : ''],
      ])}</section>
      <section><h4>${T('廠商與許可證', 'Makers and licence')}</h4>${kv([
        [T('藥商', 'Vendor'), esc(r[N.vendor])],
        [T('製造廠', 'Manufacturer'), esc(r[N.maker])],
        f ? [T('許可證', 'Licence'), `${esc(f[F.licence])}${f[F.status] ? ` <span class="tag off">${esc(f[F.status])}</span>` : (f[F.validUntil] ? ` <span class="hint" style="margin:0">${T(`有效至 ${esc(f[F.validUntil])}`, `valid to ${esc(f[F.validUntil])}`)}</span>` : '')} <button type="button" class="small" data-tab="lic">${T('詳細', 'Details')}</button>`] : null,
      ])}</section>
    </div>
    ${pkg ? `<p class="note">${T('G0 與 00 的對應是依健保資料推得（G0 品項為鋁箔包裝，支付價適用較高的最低價），以健保署公告為準。', 'The G0 / 00 pairing is worked out from the NHI data (G0 items are foil packs with a higher price floor); the NHIA’s own notices take precedence.')}</p>` : ''}
    <div class="acts">
      ${r[N.group] ? `<button type="button" data-act="group">${T('同分組比價', 'Same price group')} <span class="n">${nGroup}</span></button>` : ''}
      ${r[N.atc] ? `<button type="button" data-act="atc">${T('同 ATC 藥品', 'Same ATC')} ${esc(r[N.atc])} <span class="n">${nAtc}</span></button>` : ''}
      <button type="button" data-act="ing">${T('成分全貌', 'Ingredient overview')}</button>
      ${nAtc5 ? `<button type="button" data-act="atc5">${T('同藥理分類', 'Same class')} ${esc(r[N.atc].slice(0, 5))} <span class="n">${nAtc5}</span></button>` : ''}
    </div>`;
  }
  if (tab === 'price') {
    return `${costHTML(r)}${dddHTML(r)}<h3 class="sec">${T('價格歷程', 'Price history')}</h3><div class="chart" data-chart><p class="hint">${T('載入中…', 'Loading…')}</p></div>
      ${r[N.group] ? `<h3 class="sec">${T('同分組比價', 'Same price group')} <small>${esc(r[N.group])}</small></h3>${groupBars(r)}` : ''}`;
  }
  if (tab === 'rules') {
    const chapters = r[N.ruleChapters].split(',').filter(Boolean);
    return `<div data-rulebox><p class="hint">${T('載入給付規定…', 'Loading the rules…')}</p></div>
      <div class="links">${chapters.map((c) => { const fl = ruleFile(r, c); return fl ? `<a href="${TW.ruleUrl(fl)}" target="_blank" rel="noopener">${T('給付規定', 'Rules')} ${esc(c)} PDF ↗</a>` : ''; }).join('')}</div>`;
  }
  if (tab === 'use') return `<h3 class="sec">${T('健保醫令量', 'NHI claims')}</h3><div data-usage><p class="hint">${T('載入中…', 'Loading…')}</p></div>`;
  if (tab === 'lic' || tab === 'looks') return licLooksHTML(r, f);
  return '';
}
// every reimbursed item in the same NHI price group, gathered by price: one row per price, this item's price marked
function groupBars(r) {
  const items = nhiD.rows.filter((x) => x[N.group] === r[N.group] && (x[N.price] > 0 || x === r)).sort((a, b) => a[N.price] - b[N.price] || (a[N.zh] || a[N.en]).localeCompare(b[N.zh] || b[N.en]));
  if (items.length < 2) return `<p class="hint">${T('這個分組只有這一項。', 'This is the only item in its group.')}</p>`;
  const tiers = [];
  items.forEach((x) => { const t = tiers[tiers.length - 1]; if (t && t.p === x[N.price]) t.xs.push(x); else tiers.push({ p: x[N.price], xs: [x] }); });
  const paid = items.filter((x) => x[N.price] > 0), mine = tiers.find((t) => t.xs.includes(r));
  // foil packs (G0) have a higher price floor, so this item is ranked only among its own kind of pack
  const foil = TW.isFoil(r[N.code]), kin = paid.filter((x) => TW.isFoil(x[N.code]) === foil), anyFoil = paid.some((x) => TW.isFoil(x[N.code]));
  const below = kin.filter((x) => r[N.price] > 0 && x[N.price] < r[N.price]).length, tied = kin.filter((x) => x !== r && x[N.price] === r[N.price]).length;
  const among = anyFoil ? T(foil ? '（只和鋁箔包裝比）' : '（只和一般包裝比）', foil ? ' (among foil packs)' : ' (among standard packs)') : '';
  const sum = r[N.price] > 0
    ? (below ? T(`給付中 <b>${paid.length}</b> 項；有 <b>${below}</b> 項比這個便宜${among}。`, `<b>${paid.length}</b> reimbursed; <b>${below}</b> cost less than this one${among}.`) : T(`給付中 <b>${paid.length}</b> 項；這個是最低價${tied ? `，和另外 ${tied} 項同價` : ''}${among}。`, `<b>${paid.length}</b> reimbursed; this one is the lowest${tied ? `, tied with ${tied} more` : ''}${among}.`))
    : T(`這個品項已取消給付；同組給付中 <b>${paid.length}</b> 項。`, `This item is delisted; <b>${paid.length}</b> others are reimbursed.`);
  const dot = (x) => `<i class="k-${CLS_KEY[x[N.class]] || 'none'}${TW.isFoil(x[N.code]) ? ' g0' : ''}${x === r ? ' me' : ''}"></i>`;
  const MAXDOTS = 40;
  return `<p class="tier-sum">${sum}</p><div class="tiers">${tiers.map((t) => { const me = t === mine; return `<details class="tier${me ? ' me' : ''}"${me && t.xs.length <= 12 ? ' open' : ''}><summary><span class="p">${t.p > 0 ? '$' + fmtP(t.p) : T('已取消', 'Delisted')}</span><span class="dots" aria-hidden="true">${t.xs.slice(0, MAXDOTS).map(dot).join('')}${t.xs.length > MAXDOTS ? '…' : ''}</span><span class="n">${T(`${t.xs.length} 項`, `${t.xs.length} item${t.xs.length > 1 ? 's' : ''}`)}</span></summary>
      <ul>${t.xs.map((x) => `<li${x === r ? ' class="me"' : ''}><span class="dot k-${CLS_KEY[x[N.class]] || 'none'}"></span><button type="button" data-go="${esc(x[N.code])}" title="${esc(x[N.code])}">${esc(x[N.zh] || x[N.en])}</button></li>`).join('')}</ul></details>`; }).join('')}</div>
    <div class="legend" style="margin-top:8px">${CLS.map((c) => `<span><span class="dot k-${CLS_KEY[c]}"></span> ${esc(clsName(c))}</span>`).join('')}${anyFoil ? `<span><i class="sq"></i> ${T('方點＝鋁箔包裝', 'square = foil pack')}</span>` : ''}<span>${T('點價格列看品項', 'Click a price to list the items')}</span></div>`;
}
function looksTab(r, f) {
  if (!f) return `<p class="hint">${fdaD ? T('找不到對應的許可證資料。', 'No matching licence record.') : T('許可證資料載入中…', 'Loading licence data…')}</p>`;
  if (!extraD) return `<p class="hint">${T('外觀資料載入中…', 'Loading appearance data…')}</p>`;
  const looks = extraD.looks[f[F.licence]] || [], lf = extraD.leaflets[f[F.licence]];
  const C = {}; extraD.lookCols.forEach((c, i) => (C[c] = i));
  const part = looks.length ? looks.map((l) => {
    const cap = [f[F.zh] || f[F.en], [l[C.shape], l[C.colour], l[C.size] ? l[C.size] + ' mm' : '', [l[C.mark1], l[C.mark2]].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')].join('\n');
    return `<div class="looks"><figure>${l[C.photo] ? zoomBtn(mcp(l[C.photo]), cap, `<img src="${esc(mcp(l[C.photo]))}" alt="${esc(T('藥品外觀照片', 'Photo of the drug'))}" loading="lazy" decoding="async">`) : `<span>${T('沒有照片', 'No photo')}</span>`}</figure>${kv([
      [T('形狀', 'Shape'), esc(l[C.shape])], [T('特殊劑型', 'Special form'), esc(l[C.special])], [T('顏色', 'Colour'), esc(l[C.colour])],
      [T('氣味', 'Smell'), esc(l[C.smell])], [T('刻痕', 'Score line'), esc(l[C.score])], [T('尺寸', 'Size'), l[C.size] ? esc(l[C.size]) + ' mm' : ''],
      [T('標註', 'Markings'), [l[C.mark1], l[C.mark2]].filter(Boolean).map(esc).join(' / ')],
    ])}</div>`;
  }).join('') : `<p class="hint" style="margin:0">${T('食藥署外觀資料集沒有這張許可證的外觀資料。', 'The TFDA appearance dataset has no entry for this licence.')}</p>`;
  const link = (p, label) => `<a href="${esc(mcp(p))}" target="_blank" rel="noopener">${label} ↗</a>`;
  const links = lf ? [...lf[0].map((p, i) => link(p, /^exportpdf\//.test(p) ? T('許可證資料', 'Licence record') : T('仿單', 'Leaflet') + (lf[0].length > 1 ? ' ' + (i + 1) : ''))), ...lf[1].map((p, i) => link(p, T('外盒', 'Carton') + (lf[1].length > 1 ? ' ' + (i + 1) : '')))].join('') : '';
  return part + (links ? `<div class="links">${links}</div>` : '');
}
function licTab(f) {
  if (!f) return `<p class="hint">${fdaD ? T('找不到對應的許可證資料。', 'No matching licence record.') : T('許可證資料載入中…', 'Loading licence data…')}</p>`;
  const st = f[F.status] ? `<span class="tag off">${esc(f[F.status])}</span> ${esc(f[F.cancelDate])} ${esc(f[F.cancelReason])}` : `<span class="tag ok">${T('有效', 'Valid')}</span> ${T('至 ', 'until ')}${esc(f[F.validUntil] || '—')}`;
  return kv([
    [T('字號', 'Number'), esc(f[F.licence])],
    [T('狀態', 'Status'), st],
    [T('類別', 'Category'), esc(f[F.category])],
    [T('管制藥品', 'Controlled'), esc(f[F.controlled])],
    [T('適應症', 'Indication'), TW.licText(f) ? `<span class="ind">${esc(TW.licText(f).indication)}</span>` : T('載入中…', 'Loading…')],
    [T('主成分', 'Ingredients'), esc(f[F.ingredients])],
    [T('包裝', 'Package'), TW.licText(f) ? esc(TW.licText(f).package.replace(/;;/g, '；')) : ''],
    [T('申請商', 'Applicant'), esc(f[F.applicant])],
    [T('製造廠', 'Manufacturer'), esc(f[F.maker]) + (f[F.country] ? ` (${esc(countryName(f[F.country]))})` : '')],
    [T('發證日期', 'Issued'), esc(f[F.issued])],
    f[F.licId] ? [T('食藥署查詢', 'TFDA record'), `<a href="${TW.licUrl(f[F.licId])}" target="_blank" rel="noopener">${T('藥品許可證查詢 ↗', 'Licence lookup ↗')}</a>`] : null,
  ]);
}
const licPhoto = (f) => { const looks = looksOf(f), i = extraD ? extraD.lookCols.indexOf('photo') : -1, l = i >= 0 ? looks.find((x) => x[i]) : null; return l ? mcp(l[i]) : ''; };
const licDomId = (f) => 'dl-' + String(f[F.licId] || f[F.licence]).replace(/[^\w-]/g, '_');
// licences without an NHI code, the first 50; with "by group" on, gathered by the same ingredients and form,
// each group saying what the NHI pays for those ingredients
function licListHTML(L) {
  const top = L.slice(0, 50);
  if (!S.byGroup) return top.map(licRowHTML).join('');
  const gs = new Map();
  top.forEach((f) => { const k = ingKey(f[F.ingredients], ';') + '|' + (f[F.form] || ''); const g = gs.get(k); if (g) g.push(f); else gs.set(k, [f]); });
  let h = '';
  for (const fs of gs.values()) {
    const f = fs[0], same = sameIngredient(f), paid = same.filter((r) => r[N.price] > 0).map((r) => r[N.price]);
    const lo = paid.length ? Math.min(...paid) : 0, hi = paid.length ? Math.max(...paid) : 0, first = licFirstIng(f);
    h += `<li class="grp-h"><span class="gn">${esc(String(f[F.ingredients] || '').replace(/;/g, '；'))}${f[F.form] ? ' · ' + esc(f[F.form]) : ''}</span><span class="gm">${T(`${fs.length} 張許可證`, `${fs.length} licence${fs.length > 1 ? 's' : ''}`)} · ${paid.length ? T(`健保同成分給付中 <b>${paid.length}</b> 項，<b>$${fmtP(lo)}</b>${hi > lo ? ' – $' + fmtP(hi) : ''}`, `NHI pays for <b>${paid.length}</b> with these ingredients, <b>$${fmtP(lo)}</b>${hi > lo ? ' – $' + fmtP(hi) : ''}`) : T('健保沒有同成分的給付品項', 'no NHI item with these ingredients')}</span>${paid.length && first ? `<button type="button" class="small" data-fixq="${esc(first)}">${T('看健保品項', 'See NHI items')}</button>` : ''}</li>` + fs.map(licRowHTML).join('');
  }
  return h;
}
// the licence's prescription category in a word or two
function catShort(v) {
  const s = String(v || '');
  if (/成藥/.test(s)) return T('成藥', 'OTC (general sale)');
  if (/指示藥品/.test(s)) return T('指示藥', 'Pharmacy OTC');
  if (/原料|膠囊|調劑/.test(s)) return T('原料／調劑用', 'Raw material');
  if (/醫師|處方|檢驗師/.test(s)) return T('處方藥', 'Prescription');
  return s;
}
function licRowHTML(f) {
  const no = f[F.licence], isOpen = openLic.has(no), src = licPhoto(f), tags = ctrlTag(f) + alertTags(f), cat = catShort(f[F.category]);
  const li = (cls, inner) => `<li data-lic="${esc(no)}"${isOpen ? ' class="open"' : ''}><button type="button" class="${cls}" aria-expanded="${isOpen}" aria-controls="${licDomId(f)}" title="${esc(f[F.category] || '')}">${inner}</button>${isOpen ? licDetailHTML(f) : ''}</li>`;
  const noPrice = `<span class="nop">${T('無健保價', 'No NHI price')}</span>`;
  if (S.rview === 'table') return li('row t', `
    <span class="c-nm"><span class="nm">${hl(f[F.zh] || f[F.en])}</span>${f[F.zh] ? `<span class="en">${hl(f[F.en])}</span>` : ''}</span>
    <span class="c-cd cd">${hl(no)}</span><span class="c-cls">${esc(cat)}</span><span class="c-ing">${hl(f[F.ingredients])}</span>
    <span class="c-form">${esc(f[F.form] || '')}${tags ? ` <span class="tags">${tags}</span>` : ''}</span><span class="c-pr">${noPrice}</span><span class="c-bar" aria-hidden="true"></span>`);
  if (S.rview === 'cards') {
    const lk = looksLine(f);
    return li('row c', `<span class="card-ph${src ? '' : ' noimg'}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : `${formIcon(f[F.form])}<small>${T('沒有照片', 'No photo')}</small>`}</span>
    <span class="card-nm">${hl(f[F.zh] || f[F.en])}</span><span class="card-lk">${lk ? esc(lk) : hl(f[F.ingredients])}</span>
    <span class="card-pr">${noPrice}<span>${esc(cat)}</span></span>`);
  }
  return li('row', `
    <span class="thumb${src ? '' : ' noimg'}">${src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">` : formIcon(f[F.form])}</span>
    <span class="main"><span class="nm">${hl(f[F.zh] || f[F.en])}${tags ? ` <span class="tags">${tags}</span>` : ''}</span>${f[F.zh] ? `<span class="en">${hl(f[F.en])}</span>` : ''}
      <span class="meta"><span class="cat">${esc(cat)}</span><span class="cd">${hl(no)}</span>${licAtc(f) ? `<span>ATC ${hl(licAtc(f))}</span>` : ''}<span>${hl(f[F.ingredients])}</span>${f[F.form] ? `<span>${esc(f[F.form])}</span>` : ''}</span>
      ${indHits.has('L:' + no) ? `<span class="ind-hit"><b>${T('適應症', 'Indication')}</b> ${indSnippet(indText(f), tokens())}</span>` : ''}</span>
    <span class="pr">${noPrice}</span>`);
}

/* ---------- a licence without an NHI code: what TFDA has, and the NHI items with the same ingredients ---------- */
// ingredient names written the same way in both lists: no brackets, strengths or water of crystallisation, the usual salt short forms
const ING_SYN = [[/HYDROCHLORIDE/g, 'HCL'], [/HYDROBROMIDE/g, 'HBR'], [/\b(ANHYDROUS|MONOHYDRATE|DIHYDRATE|TRIHYDRATE|HEMIHYDRATE|SESQUIHYDRATE)\b/g, ''], [/PARACETAMOL/g, 'ACETAMINOPHEN']];
function ingName(s) {
  let t = String(s || '').toUpperCase(), p;
  do { p = t; t = t.replace(/\([^()]*\)/g, ' '); } while (t !== p);
  t = ING_SYN.reduce((x, [a, b]) => x.replace(a, b), t);
  return t.replace(/\s+[\d.]+\s*(MG|G|MCG|ΜG|UG|ML|IU|U|%|MEQ|MMOL|UNITS?|KIU|MIU)\b.*$/, '').replace(/[^A-Z0-9 ,.\-']/g, ' ').replace(/\s+/g, ' ').trim();
}
const ingKey = (list, sep) => [...new Set(String(list || '').split(sep).map(ingName).filter(Boolean))].sort().join('+');
let ingIndex = null;
function sameIngredient(f) {
  if (!ingIndex || ingIndex.n !== nhiD.rows.length) {
    const m = new Map();
    nhiD.rows.forEach((r) => { const k = ingKey(r[N.ingredient], '+'); if (!k) return; const a = m.get(k) || []; a.push(r); m.set(k, a); });
    ingIndex = { n: nhiD.rows.length, m };
  }
  const form = String(f[F.form] || '').slice(0, 2), sameForm = (r) => (form && String(r[N.form] || '').startsWith(form) ? 1 : 0);
  // reimbursed first, the same form next, then by price
  return (ingIndex.m.get(ingKey(f[F.ingredients], ';')) || []).slice()
    .sort((a, b) => (b[N.price] > 0) - (a[N.price] > 0) || sameForm(b) - sameForm(a) || a[N.price] - b[N.price]);
}
const licFirstIng = (f) => ingName(String(f[F.ingredients] || '').split(';')[0]);
const LIC_TABS = [['sum', '概要', 'Overview'], ['lic', '許可證與外觀', 'Licence and looks']];
const licLooksHTML = (r, f) => `<h3 class="sec">${T('外觀與仿單', 'Looks and leaflet')}</h3>${looksTab(r, f)}<h3 class="sec">${T('許可證', 'Licence')}</h3>${licTab(f)}`;
function licDetailHTML(f) {
  const no = f[F.licence], tab = tabOf.get('L:' + no) === 'looks' ? 'lic' : tabOf.get('L:' + no) || 'sum', photo = licPhoto(f), name = f[F.zh] || f[F.en];
  const tags = [`<span class="tag off">${T('無健保代號', 'No NHI code')}</span>`, f[F.category] ? `<span class="tag">${esc(f[F.category])}</span>` : '', ctrlTag(f), rmpTag(f),
    f[F.status] ? `<span class="tag off">${T('許可證', 'Licence ')}${esc(f[F.status])}</span>` : `<span class="tag ok">${T('許可證有效', 'Licence valid')}</span>`].join('');
  return `<div class="detail" id="${licDomId(f)}" data-lic="${esc(no)}">
    <div class="d-back"><button type="button" data-act="close">← ${T('返回', 'Back')}</button><span>${esc(name)}</span></div>
    <div class="d-head">
      <div class="d-pic${photo ? '' : ' noimg'}">${photo ? zoomBtn(photo, name, `<img src="${esc(photo)}" alt="${esc(T('藥品外觀照片', 'Photo of the drug'))}" decoding="async">`) : formIcon(f[F.form])}</div>
      <div class="d-title"><h2>${esc(name)}</h2>${f[F.zh] ? `<div class="en">${esc(f[F.en])}</div>` : ''}<div class="tags">${tags}</div></div>
      <div class="d-tools">${iconBtn('copy', 'copy', '複製摘要', 'Copy summary')}${iconBtn('close', 'close', '收合', 'Close', ' x')}</div>
    </div>
    ${alertBanners(f)}${safetyBanner(f[F.ingredients], licAtc(f))}
    <div class="tabs" role="tablist">${LIC_TABS.map(([k, zh, en]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}">${T(zh, en)}</button>`).join('')}<span class="tab-ink" aria-hidden="true"></span></div>
    <div class="tabp" role="tabpanel" data-panel="${tab}">${licTabHTML(f, tab)}</div>
  </div>`;
}
function licTabHTML(f, tab) {
  if (tab === 'lic' || tab === 'looks') return licLooksHTML(null, f);
  const same = sameIngredient(f), paid = same.filter((r) => r[N.price] > 0).length, first = licFirstIng(f);
  const sameList = same.length ? `<ul class="same">${same.slice(0, 12).map((r) => `<li><button type="button" data-go="${esc(r[N.code])}">
      <span class="sn">${esc(r[N.zh] || r[N.en])}</span>
      <span class="sm">${esc(r[N.code])}${r[N.form] ? ' · ' + esc(r[N.form]) : ''}${r[N.strength] ? ' · ' + esc(r[N.strength]) : ''}${r[N.class] ? ' · ' + esc(clsName(r[N.class])) : ''}</span>
      <span class="sp">${r[N.price] > 0 ? '$' + fmtP(r[N.price]) : `<small>${T('已取消給付', 'delisted')}</small>`}</span></button></li>`).join('')}</ul>
      ${same.length > 12 ? `<p class="same-more">${T(`另有 ${same.length - 12} 筆，用下面的「搜尋」看全部`, `${same.length - 12} more; use Search below to see them all`)}</p>` : ''}`
    : `<p class="hint" style="margin:0">${T('健保用藥品項裡沒有成分組合完全相同的品項。', 'No NHI item has exactly the same ingredients.')}</p>`;
  return `<p class="lic-why">${T('這張許可證沒有對應的健保代號（常見於指示藥、成藥、自費藥或疫苗），健保署就沒有它的支付價、價格歷程、醫令量與給付規定。下面是食藥署許可證資料。', 'This licence has no NHI code (common for OTC, self-paid drugs and vaccines), so the NHIA has no price, price history, claims or rules for it. Below is what the TFDA licence record holds.')}</p>
    <div class="facts">
      ${fact(T('成分', 'Ingredients'), esc(String(f[F.ingredients] || '').replace(/;/g, '；')), true)}
      ${fact(T('許可證字號', 'Licence'), `<span class="cd">${esc(f[F.licence])}</span>`)}
      ${fact(T('劑型', 'Form'), esc(f[F.form]))}
      ${fact('ATC', licAtc(f) ? `<span class="cd">${esc(licAtc(f))}</span> <span class="hint" style="margin:0">${T('食藥署分類', 'TFDA')}</span>` : '')}
      ${fact(T('類別', 'Category'), esc(f[F.category]))}
      ${fact(T('管制藥品', 'Controlled'), esc(f[F.controlled]))}
      ${fact(T('有效期限', 'Valid until'), f[F.status] ? `${esc(f[F.status])} ${esc(f[F.cancelDate])}` : esc(f[F.validUntil]))}
      ${fact(T('發證日期', 'Issued'), esc(f[F.issued]))}
      ${fact(T('申請商', 'Applicant'), esc(f[F.applicant]))}
      ${fact(T('製造廠', 'Manufacturer'), esc(f[F.maker]) + (f[F.country] ? ` (${esc(countryName(f[F.country]))})` : ''))}
      ${fact(T('適應症', 'Indication'), TW.licText(f) ? `<span class="ind">${esc(TW.licText(f).indication)}</span>` : `<span class="hint">${T('載入中…', 'Loading…')}</span>`, true)}
    </div>
    <h3 class="sec">${T('同成分的健保品項', 'NHI items with the same ingredients')} <small>${same.length ? T(`${same.length} 筆，給付中 ${paid}`, `${same.length}, ${paid} reimbursed`) : ''}</small></h3>
    ${sameList}
    <p class="note">${T('依成分名稱比對（去掉括號、含量與結晶水，鹽類寫法統一），成分組合要完全相同；劑型與含量可能不同，請點進去確認。', 'Matched on ingredient names (brackets, strengths and water of crystallisation removed, salt names unified); the set must be identical. Form and strength may differ, so open an item to check.')}</p>
    <div class="acts">
      ${first ? `<button type="button" data-act="licq">${T(`搜尋含 ${esc(first)} 的藥品`, `Search drugs with ${esc(first)}`)}</button>` : ''}
      <button type="button" data-act="ing">${T('成分全貌', 'Ingredient overview')}</button>
      <button type="button" data-act="copy">${T('複製摘要', 'Copy summary')}</button>
      ${f[F.licId] ? `<a class="btn" href="${TW.licUrl(f[F.licId])}" target="_blank" rel="noopener">${T('食藥署查詢 ↗', 'TFDA record ↗')}</a>` : ''}
    </div>`;
}
function licSummary(f) {
  return [`${f[F.zh] || ''} ${f[F.en] || ''}`.trim(), `${f[F.licence]}${f[F.status] ? '（' + f[F.status] + '）' : ''} · ${T('無健保代號', 'no NHI code')}`,
    `${T('成分', 'Ingredients')} ${f[F.ingredients]}`, [f[F.form], f[F.category], f[F.controlled]].filter(Boolean).join(' · '), f[F.applicant] ? `${T('申請商', 'Applicant')} ${f[F.applicant]}` : ''].filter(Boolean).join('\n');
}

/* ---------- tabs that load something: price history, rules ---------- */
const motionOK = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
const played = new Set();
// add the entrance class the first time this chart is shown for this drug, never again
function enterOnce(el, key) { if (!el || played.has(key)) return; played.add(key); if (motionOK()) el.classList.add('enter'); }
// the sliding tab underline
function placeInk(tabs, animate) {
  if (!tabs) return;
  const ink = tabs.querySelector('.tab-ink'), b = tabs.querySelector('[aria-selected="true"]');
  if (!ink || !b) return;
  ink.classList.toggle('go', !!animate);
  ink.style.transform = `translate(${b.offsetLeft}px, ${b.offsetTop + b.offsetHeight - 2}px) scaleX(${b.offsetWidth / 100})`;
  tabs.classList.add('inked');
}
function switchTab(d, tab, html) {
  d.querySelectorAll('.tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  placeInk(d.querySelector('.tabs'), true);
  const p = d.querySelector('.tabp'); p.dataset.panel = tab; p.innerHTML = html;
  p.classList.remove('in'); void p.offsetWidth; if (motionOK()) p.classList.add('in');
}
addEventListener('resize', RT.debounce(() => document.querySelectorAll('#out .detail .tabs').forEach((t) => placeInk(t, false)), 150));
// phones: the row and the sheet are drawn as one shape that grows or shrinks (View Transitions); elsewhere a plain redraw
function morph(fromEl, update, target) {
  if (!phone() || !motionOK() || !document.startViewTransition || !fromEl) return Promise.resolve(update());
  let out = null;
  fromEl.style.viewTransitionName = 'drug-sheet';
  const vt = document.startViewTransition(() => { fromEl.style.viewTransitionName = ''; out = update(); const t = target(out); if (t) t.style.viewTransitionName = 'drug-sheet'; });
  vt.finished.finally(() => { const t = target(out); if (t) t.style.viewTransitionName = ''; });
  vt.ready.catch(() => {});
  return vt.updateCallbackDone.then(() => out, () => out);
}
function hydrate(root) {
  root.querySelectorAll('.detail .tabs').forEach((t) => placeInk(t, false));
  root.querySelectorAll('.detail[data-code]').forEach((d) => {
    const r = nhiD.byCode.get(d.dataset.code); if (!r) return;
    const tab = tabOf.get(r[N.code]) || 'sum';
    fillUseKpi(d.querySelector('[data-kpi-use]'), r);
    if (tab === 'sum') drawTimeline(d.querySelector('[data-tl]'), r);
    if (tab === 'price') drawHist(d.querySelector('[data-chart]'), r);
    if (tab === 'rules') fillRules(d.querySelector('[data-rulebox]'), r);
    if (tab === 'use') drawUsage(d.querySelector('[data-usage]'), r);
  });
}
async function drawHist(box, r) {
  if (!box) return;
  try {
    const h = (await TW.hist(r[N.code])).filter((x) => x.date);
    const pts = h.length ? h : (r[N.priceSince] ? [{ date: r[N.priceSince], price: r[N.price] }] : []);
    if (!pts.length) { box.innerHTML = `<p class="hint">${T('沒有價格紀錄。', 'No price record.')}</p>`; return; }
    const W = 640, H = 190, L = 52, R = 14, Tp = 12, B = 26;
    const t = (d) => new Date(d).getTime();
    const x0 = t(pts[0].date), x1 = Math.max(Date.now(), t(pts[pts.length - 1].date) + 864e5);
    const ps = pts.map((p) => p.price).filter((p) => p > 0);
    const max = Math.max(...ps, 0.01), min = Math.min(...ps, max);
    // y axis: 0 when prices are close to it, else a little below the lowest
    // (one price all along: from 0, so the line sits in the chart instead of on its top edge)
    const y0 = min < max * 0.35 || min === max ? 0 : Math.max(0, min - (max - min) * 0.25), y1 = max + (max - y0) * (min === max ? 0.25 : 0.08) || 1;
    const X = (d) => L + ((t(d) - x0) / (x1 - x0)) * (W - L - R), Y = (p) => Tp + (1 - (p - y0) / (y1 - y0)) * (H - Tp - B);
    const yt = [y0, (y0 + y1) / 2, y1].map((v) => ({ v, y: Y(v) }));
    const yrs = []; const ya = new Date(x0).getFullYear(), yb = new Date(x1).getFullYear(), step = Math.max(1, Math.ceil((yb - ya + 1) / 6));
    for (let y = ya + (ya === new Date(x0).getFullYear() && new Date(x0).getMonth() > 0 ? 1 : 0); y <= yb; y += step) yrs.push(y);
    let d = '', gone = '';
    pts.forEach((p, i) => {
      const xx = X(p.date).toFixed(1), yy = (p.price > 0 ? Y(p.price) : H - B).toFixed(1);
      if (p.price > 0) d += (i && pts[i - 1].price > 0 ? ` H${xx} V${yy}` : ` M${xx} ${yy}`);
      else if (i) gone += ` M${X(p.date).toFixed(1)} ${Y(pts[i - 1].price || max).toFixed(1)} V${yy} H${(W - R).toFixed(1)}`;
    });
    const last = pts[pts.length - 1];
    if (last.price > 0) d += ` H${(W - R).toFixed(1)}`;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${T('支付價歷程圖', 'Price history chart')}">
      ${yt.map((g) => `<line class="ax" x1="${L}" x2="${W - R}" y1="${g.y.toFixed(1)}" y2="${g.y.toFixed(1)}" stroke-dasharray="${g.v === y0 ? '' : '2 4'}"/><text class="lbl" x="${L - 8}" y="${(g.y + 4).toFixed(1)}" text-anchor="end">$${fmtP(+g.v.toFixed(2)) || '0'}</text>`).join('')}
      ${yrs.map((y) => { const xx = X(`${y}-01-01`); return xx >= L && xx <= W - R ? `<line class="ax" x1="${xx.toFixed(1)}" x2="${xx.toFixed(1)}" y1="${H - B}" y2="${H - B + 4}"/><text class="lbl" x="${xx.toFixed(1)}" y="${H - 8}" text-anchor="middle">${y}</text>` : ''; }).join('')}
      <path class="ln" pathLength="1" d="${d.trim()}"/>${gone ? `<path class="ln gone" d="${gone.trim()}"/>` : ''}
      ${pts.filter((p) => p.price > 0).map((p) => `<circle class="pt" cx="${X(p.date).toFixed(1)}" cy="${Y(p.price).toFixed(1)}" r="2.6"><title>${esc(p.date)} $${fmtP(p.price)}</title></circle>`).join('')}
    </svg>
    <details class="hist-tbl"><summary>${T(`${pts.length} 次價格變動`, `${pts.length} price changes`)}</summary><table>${pts.slice().reverse().map((p) => `<tr><td>${esc(p.date)}</td><td>${p.price ? '$' + fmtP(p.price) : T('取消給付', 'delisted')}</td></tr>`).join('')}</table></details>`;
    enterOnce(box, 'p:' + r[N.code]);
  } catch (e) { box.innerHTML = `<p class="hint">${esc(e.message || e)}</p>`; }
}
// highlight the drug's own ingredients in the chapter, so the relevant paragraph is easy to find
function ruleMarks(r) {
  const words = new Set();
  String(r[N.ingredient] || '').split(/[;,+/&]| AND /i).forEach((part) => {
    const w = part.trim().split(/[\s(]/)[0];
    if (w && w.length >= 4 && /^[A-Za-z-]+$/.test(w)) words.add(w);
  });
  return [...words];
}
function markText(text, words) {
  let h = esc(text);
  words.forEach((w) => { h = h.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'); });
  return h;
}
async function fillRules(box, r) {
  if (!box) return;
  const chapters = r[N.ruleChapters].split(',').filter(Boolean);
  try {
    if (!rulesD) rulesD = await TW.rules();
    const words = ruleMarks(r);
    box.innerHTML = chapters.map((c) => {
      const fl = ruleFile(r, c), text = fl && rulesD.files[fl];
      return `<div class="rules-txt"><h4>${T('給付規定', 'NHI rules')} ${esc(c)}${fl ? ` <small class="hint" style="margin:0">${T('修訂', 'revised')} ${esc(TW.ruleDate(fl))}</small>` : ''}${fl ? ` <a href="${TW.ruleUrl(fl)}" target="_blank" rel="noopener">PDF ↗</a>` : ''}</h4>` +
        (text ? `<div class="txt">${markText(text, words)}</div>` : `<p class="hint" style="padding:10px 12px;margin:0">${T('這一章的全文還沒有轉好，請開 PDF。', 'No text for this chapter yet; open the PDF.')}</p>`) + '</div>';
    }).join('') + `<p class="note">${T('全文由健保署 PDF 自動轉出，表格可能排版不完整；以 PDF 為準。', 'Text converted automatically from the NHIA PDFs; tables may lose their layout. The PDF is authoritative.')}</p>`;
  } catch (e) {
    box.innerHTML = `<p class="hint">${T('暫時無法取得給付規定全文，請開下方的 PDF。', 'The full text is not available right now; open the PDF below.')}</p>`;
  }
}

/* ---------- list ---------- */
let last = { rows: [], lic: [] };
/* ---------- the one-line summary, view switch and export menu; the filters in use ---------- */
const VMODES = [
  ['list', '清單', 'List', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h0M4 12h0M4 18h0" stroke-linecap="round" stroke-width="2.4"/></svg>'],
  ['table', '表格', 'Table', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M10 10v10"/></svg>'],
  ['cards', '圖卡', 'Cards', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>'],
];
const CLS_SHORT = { '研發廠': ['研發廠', 'originator'], 'BA/BE學名藥': ['BA/BE', 'BA/BE'], '一般學名藥': ['一般', 'generic'], '生物製劑': ['生物', 'biologic'] };
function statusHTML(total) {
  const rows = last.rows, paid = rows.filter((r) => r[N.price] > 0).length, sc = scale;
  const by = {}; rows.forEach((r) => { const k = CLS_KEY[r[N.class]] ? r[N.class] : ''; by[k] = (by[k] || 0) + 1; });
  const segs = ['研發廠', 'BA/BE學名藥', '一般學名藥', '生物製劑', ''].filter((k) => by[k]);
  const lg = segs.filter(Boolean).map((k) => `${T(...CLS_SHORT[k])} ${by[k]}`).join(' · ');
  const mini = total ? `<span class="mini-cls" title="${esc(lg)}"><span class="mb" role="img" aria-label="${esc(T('藥品分類：', 'Classes: ') + lg)}">${segs.map((k) => `<i class="k-${CLS_KEY[k] || 'none'}" style="width:${((by[k] / total) * 100).toFixed(2)}%"></i>`).join('')}</span><span class="lg">${esc(lg)}</span></span>` : '';
  const vm = `<span class="vmode" role="group" aria-label="${T('顯示方式', 'View')}">${VMODES.map(([k, zh, en, ic]) => `<button type="button" data-rview="${k}" aria-pressed="${S.rview === k}">${ic}${T(zh, en)}</button>`).join('')}</span>`;
  const qt = qType();
  return (qt ? `<span class="qtype">${T(...QTYPE[qt])}</span>` : '') + `<span class="n"><b>${total.toLocaleString()}</b> ${T('筆健保品項', 'NHI items')}${total && paid < total ? T(`（給付中 ${paid}）`, ` (${paid} reimbursed)`) : ''}${last.lic.length ? T(`、${last.lic.length} 張無健保代號的許可證`, `, ${last.lic.length} licences without an NHI code`) : ''}</span>`
    + (sc ? `<span class="md">${T('中位數', 'median')} <b>$${fmtP(sc.med)}</b>（$${fmtP(sc.lo)}–$${fmtP(sc.hi)}）</span>` : '') + mini
    + (last.packHidden ? `<span class="hint">${T(`另有 ${last.packHidden} 個${last.pack === 'foil' ? '一般包裝' : '鋁箔包裝'}代號已收起`, `${last.packHidden} ${last.pack === 'foil' ? 'standard-pack' : 'foil-pack'} codes folded away`)}</span>` : '')
    + (metaD ? `<span class="hint" title="${T('健保署與食藥署資料每週更新', 'NHIA and TFDA data, refreshed weekly')}">${T(`資料更新 ${esc(metaD.built)}`, `Data of ${esc(metaD.built)}`)}</span>` : '')
    + `<span class="spacer"></span>${total ? vm : ''}`
    + (total ? `<details class="menu"><summary>${T('匯出', 'Export')} ▾</summary><div class="menu-pop"><button type="button" id="btnCsv">${T('匯出 CSV', 'Export CSV')}</button><button type="button" id="btnAllCl">${T('全部加入代碼清單', 'Add all to code list')}</button></div></details>` : '');
}
function advChips() {
  const a = A(), out = [], add = (keys, zh, en) => out.push({ keys, label: T(zh, en) });
  if (a.pmin || a.pmax) add(['pmin', 'pmax'], `支付價 ${a.pmin ? '$' + a.pmin : ''}～${a.pmax ? '$' + a.pmax : ''}`, `Price ${a.pmin ? '$' + a.pmin : ''}–${a.pmax ? '$' + a.pmax : ''}`);
  if (a.from || a.to) add(['from', 'to'], `收載 ${a.from || ''}～${a.to || ''}`, `Listed ${a.from || ''}–${a.to || ''}`);
  if (a.pkg) add(['pkg'], a.pkg === 'g0' ? '只看鋁箔包裝' : '排除鋁箔包裝', a.pkg === 'g0' ? 'Foil packs only' : 'No foil packs');
  if (a.rules) add(['rules'], '有給付規定', 'Has NHI rules');
  if (a.atc) add(['atc'], `ATC ${a.atc}`, `ATC ${a.atc}`);
  if (a.cls) add(['cls'], `分類 ${clsName(a.cls)}`, `Class ${clsName(a.cls)}`);
  if (a.form) add(['form'], `劑型 ${a.form}`, `Form ${a.form}`);
  if (a.single) add(['single'], a.single, a.single === '單方' ? 'Single ingredient' : 'Combination');
  if (a.photo) add(['photo'], '有照片', 'Has a photo');
  if (a.cat) add(['cat'], `處方 ${a.cat}`, `Category ${a.cat}`);
  if (a.ctrl) add(['ctrl'], a.ctrl === 'any' ? '管制藥品' : a.ctrl === 'none' ? '非管制藥品' : `第${'一二三四'[a.ctrl - 1]}級管制`, a.ctrl === 'any' ? 'Controlled' : a.ctrl === 'none' ? 'Not controlled' : `Schedule ${a.ctrl}`);
  if (a.lic) add(['lic'], a.lic === 'valid' ? '許可證有效' : '許可證已註銷', a.lic === 'valid' ? 'Licence valid' : 'Licence cancelled');
  if (a.country) add(['country'], `製造國 ${countryName(a.country)}`, `Made in ${a.country}`);
  if (a.who) add(['who'], `廠商 ${a.who}`, `Maker ${a.who}`);
  if (a.short) add(['short'], '缺藥中', 'Short supply');
  if (a.recall) add(['recall'], '有回收紀錄', 'Recalled');
  if (S.pack && S.pack !== 'foil') add(['__pack'], S.pack === 'can' ? '列一般包裝' : '兩種包裝都列', S.pack === 'can' ? 'Standard packs' : 'Both packs');
  return out;
}
const GRP_KEYS = { pay: ['pmin', 'pmax', 'from', 'to', 'pkg', 'rules'], drug: ['atc', 'cls', 'form', 'single', 'photo'], lic: ['cat', 'ctrl', 'lic', 'country', 'who'], alert: ['short', 'recall'] };
function renderChips() {
  const ac = advChips();
  const base = chips.map((x, i) => `<span class="chip">${x.k === 'group' ? T('分組：', 'Group: ') : 'ATC '}${esc(x.v)}<button type="button" data-chip="${i}" aria-label="${T('移除', 'Remove')}">×</button></span>`).join('');
  const adv = ac.map((x) => `<span class="chip f">${esc(x.label)}<button type="button" data-advk="${x.keys.join(',')}" aria-label="${esc(T('移除 ', 'Remove ') + x.label)}">×</button></span>`).join('');
  $('chips').innerHTML = base || adv ? `${adv ? `<span class="lab">${T('已套用：', 'Applied:')}</span>` : ''}${base}${adv}${ac.length + chips.length > 1 ? `<button type="button" class="clear-all" data-clearall>${T('全部清除', 'Clear all')}</button>` : ''}` : '';
  document.querySelectorAll('#adv fieldset[data-grp]').forEach((fs) => { const n = GRP_KEYS[fs.dataset.grp].filter((k) => { const v = A()[k]; return v !== '' && v !== false; }).length; const m = n + (fs.dataset.grp === 'pay' && S.pack && S.pack !== 'foil' ? 1 : 0); fs.querySelector('legend .badge').textContent = m || ''; });
}
const HOME_IC = {
  pill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="2.5" y="8" width="19" height="8" rx="4" transform="rotate(-35 12 12)"/><path d="m9.3 7.6 5.4 8.8"/></svg>',
  batch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 6h10M4 11h10M4 16h6"/><circle cx="17" cy="16" r="3"/><path d="m19.2 18.2 2 2"/></svg>',
  alerts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17v.5"/></svg>',
  changes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
};
// before anything is typed: the four jobs people come for, and what they looked at last
function homeHTML() {
  const rec = (S.recent || []).map((x) => nhiD.byCode.get(x)).filter(Boolean).slice(0, 6), rq = (S.recentQ || []).slice(0, 6);
  const nShort = $('nAlerts').textContent;
  const task = (v, zh, en, szh, sen) => `<button type="button" class="task" data-home="${v}">${HOME_IC[v]}<b>${T(zh, en)}</b><span>${T(szh, sen)}</span></button>`;
  return `<div class="home">
    <p class="home-stat">${T(`收錄 <b>${totalCodes().toLocaleString()}</b> 個健保藥品代號（給付中 ${fmtCount()}）`, `<b>${totalCodes().toLocaleString()}</b> NHI drug codes (${fmtCount()} reimbursed)`)}${licTotal() ? T(`、<b>${licTotal().toLocaleString()}</b> 張許可證`, ` and <b>${licTotal().toLocaleString()}</b> licences`) : ''}${metaD ? T(`，資料更新於 ${esc(metaD.built)}`, `; data of ${esc(metaD.built)}`) : ''}。${T('在上面打字開始查，或從這裡開始：', ' Type above to search, or start here:')}</p>
    <div class="tasks">${task('pill', '認一顆藥丸', 'Identify a pill', '依顏色、形狀、藥上的字', 'by colour, shape and imprint')}${task('batch', '一次查一串代號', 'Look up a list', '貼上清單，匯出一張表', 'paste a list, export one table')}${task('alerts', '缺藥與回收', 'Shortages and recalls', nShort ? `${nShort} 項缺藥中` : '食藥署公告', nShort ? `${nShort} in short supply` : 'TFDA notices')}${task('changes', '本週異動', "This week's changes", '價格、收載、給付規定', 'prices, listings, rules')}</div>
    ${rec.length || rq.length ? `<div class="recent"><div class="rh"><b>${T('最近查過', 'Recently viewed')}</b><button type="button" class="small" data-homeclr>${T('清除', 'Clear')}</button></div>
      ${rec.map((r) => `<button type="button" class="rc" data-go="${esc(r[N.code])}"><span>${esc(r[N.zh] || r[N.en])}</span><span class="cd">${esc(r[N.code])}</span><b>${r[N.price] > 0 ? '$' + fmtP(r[N.price]) : T('已取消給付', 'Delisted')}</b></button>`).join('')}
      ${rq.length ? `<div class="rq">${T('搜尋過：', 'Searched:')}${rq.map((q) => `<button type="button" data-homeq="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}</div>` : ''}
  </div>`;
}
// what kind of thing was typed, when it is clearly one kind
function qType() {
  const t = Q.trim();
  if (/字第/.test(t)) return 'lic';
  if (/^[a-z]{1,2}\d[0-9a-z]{7,8}$/i.test(t) && nhiD && nhiD.byCode.has(t.toUpperCase())) return 'code';
  if (!/\s/.test(t) && ATC_RE.test(TW.fold(t))) return 'atc';
  return '';
}
const QTYPE = { code: ['以健保代號查詢', 'NHI code'], lic: ['以許可證字號查詢', 'Licence number'], atc: ['以 ATC 碼查詢', 'ATC code'] };
let autoQ = null;
function render() {
  if (!nhiD) return;
  const t0 = performance.now();
  Qfix = '';
  last = search();
  // nothing found: try the query with misspelt words corrected
  let fixNote = '';
  if (!last.rows.length && !last.lic.length && Q && !chips.length) {
    const fx = fuzzyFix(Q);
    if (fx) {
      Qfix = fx.q; const alt = search();
      if (alt.rows.length || alt.lic.length) {
        last = alt;
        fixNote = `<div class="fix-note">${T(`找不到「<b>${esc(Q)}</b>」，以下是「<b>${esc(fx.q)}</b>」的結果。`, `Nothing for “<b>${esc(Q)}</b>”; showing “<b>${esc(fx.q)}</b>”.`)}${fx.alts.length ? `<span>${T('或是：', 'Or:')}</span>${fx.alts.map((a) => `<button type="button" data-fixq="${esc(a)}">${esc(a)}</button>`).join('')}` : ''}</div>`;
      } else Qfix = '';
    }
  }
  scale = makeScale(last.rows);
  const total = last.rows.length;
  const idle = !tokens().length && !chips.length && !advCount();
  renderChips();
  $('advCount').textContent = (advCount() + (S.pack && S.pack !== 'foil' ? 1 : 0)) || '';
  $('advN').textContent = idle ? '' : `(${(total + last.lic.length).toLocaleString()})`;
  $('tips').hidden = !idle;
  if (idle) {
    $('ovWrap').innerHTML = ''; $('status').innerHTML = '';
    $('out').innerHTML = homeHTML();
    return;
  }
  const keepOpen = $('ov') ? $('ov').open : null;
  $('ovWrap').innerHTML = overviewHTML(last.rows);
  if (keepOpen != null && $('ov')) $('ov').open = keepOpen;
  { const ct = $('ovWrap').querySelector('details.ctr[open]'); if (ct) drawClassTrend(ct); }
  // the list: plain, or gathered under one heading per price group (in the order the sort puts them)
  let listHTML = '', used = Math.min(shown, total);
  if (total && S.byGroup) {
    const gs = new Map();
    last.rows.forEach((r) => { const k = r[N.group] || '\u0000' + r[N.ingredient] + '|' + r[N.form]; const g = gs.get(k); if (g) g.push(r); else gs.set(k, [r]); });
    used = 0;
    for (const [k, rs] of gs) {
      if (used >= shown) break;
      const paidP = rs.map((r) => r[N.price]).filter((p) => p > 0), lo = Math.min(...paidP), hi = Math.max(...paidP);
      const name = k[0] === '\u0000' ? [rs[0][N.ingredient], rs[0][N.form]].filter(Boolean).join(' · ') : k;
      listHTML += `<li class="grp-h"><span class="gn">${esc(name)}</span><span class="gm">${T(`${rs.length} 項`, `${rs.length} items`)}${paidP.length ? T(` · 給付中 <b>${paidP.length}</b> · <b>$${fmtP(lo)}</b>${hi > lo ? ' – $' + fmtP(hi) : ''}`, ` · <b>${paidP.length}</b> reimbursed · <b>$${fmtP(lo)}</b>${hi > lo ? ' – $' + fmtP(hi) : ''}`) : T(' · 都已取消給付', ' · all delisted')}</span>${k[0] !== '\u0000' && !chips.some((c) => c.k === 'group') ? `<button type="button" class="small" data-chipgroup="${esc(k)}">${T('只看這組', 'Only this group')}</button>` : ''}</li>` + rs.map(rowHTML).join('');
      used += rs.length;
    }
  } else if (total) listHTML = last.rows.slice(0, shown).map(rowHTML).join('');
  const ms = Math.round(performance.now() - t0);
  $('status').innerHTML = statusHTML(total);
  if (!total && !last.lic.length) {
    $('out').innerHTML = `<div class="empty-state">${T('找不到符合的藥品。', 'No matching drugs.')}${S.scope !== 'every' ? ` <button type="button" class="small" data-scope="every">${T('改搜全部', 'Search everything')}</button>` : ''}${advCount() ? ` <button type="button" class="small" data-clear="1">${T('清除進階篩選', 'Clear filters')}</button>` : ''}</div>`;
    return;
  }
  const ulCls = 'res' + (S.byGroup ? ' grouped' : '') + (S.rview === 'table' ? ' tbl' : S.rview === 'cards' ? ' cards' : '');
  const ul = total ? `<ul class="${ulCls}">${S.rview === 'table' ? tblHeadHTML() : ''}${listHTML}</ul>` : '';
  $('out').innerHTML = fixNote + (S.rview === 'table' && ul ? `<div class="tbl-wrap">${ul}</div>` : ul) +
    (total > used ? `<div class="more"><button type="button" id="btnMore">${T(`再顯示 ${Math.min(100, total - used)} 筆`, `Show ${Math.min(100, total - used)} more`)}</button></div>` : '') +
    (last.lic.length ? `<section class="lic-sec"${S.scope === 'lic' ? ' data-only' : ''}><div class="lic-h"${S.scope === 'lic' ? ' hidden' : ''}><h2>${T('沒有健保代號的許可證', 'Licences without an NHI code')} <span class="n">${last.lic.length}</span></h2><p>${T('健保沒有收載，所以沒有健保價。多半是自費處方藥、指示藥或成藥；點開看許可證資料與同成分的健保品項。', 'Not on the NHI list, so there is no NHI price. Mostly self-paid prescription drugs, pharmacy medicines or general-sale products; open one for its licence record and the NHI items with the same ingredients.')}</p></div>${(() => { const ul = `<ul class="res${S.rview === 'table' ? ' tbl' : S.rview === 'cards' ? ' cards' : ''}">${S.rview === 'table' ? tblHeadHTML() : ''}${licListHTML(last.lic)}</ul>`; return S.rview === 'table' ? `<div class="tbl-wrap">${ul}</div>` : ul; })()}${last.lic.length > 50 ? `<p class="hint">${T(`只列前 50 張，請加關鍵字縮小範圍`, `Showing the first 50; add words to narrow it down`)}</p>` : ''}</section>` : '');
  hydrate($('out'));
  if (total && !extraD) loadExtra();   // photos for the cards
  if (Q !== autoQ) {
    autoQ = Q;
    const t = qType();
    if (t === 'code' && !open.size) { const li = document.querySelector(`#out li[data-code="${CSS.escape(Q.trim().toUpperCase())}"]`); if (li) openDrug(li); }
    else if (t === 'lic' && total + last.lic.length === 1 && !open.size && !openLic.size) { const li = document.querySelector('#out li[data-code], #out li[data-lic]'); if (li) { if (li.dataset.code) openDrug(li); else openLicRow(li); } }
  }
}
let paidCount = null;
function fmtCount() { if (paidCount == null) paidCount = nhiD.rows.filter((r) => r[N.price] > 0).length; return paidCount.toLocaleString(); }
let metaD = null;
const licTotal = () => (metaD && metaD.counts && metaD.counts.licences) || (fdaD && fdaD.complete ? fdaD.rows.length : 0);
const totalCodes = () => (metaD && metaD.counts ? metaD.counts.nhiCodes : nhiD.rows.length);
// the codes no longer reimbursed are fetched only when a search needs them
let allP = null;
function loadAll() {
  if (nhiD && nhiD.complete) return Promise.resolve(nhiD);
  if (!allP) allP = TW.nhiAll().then((d) => { nhiD = d; hay = null; licOnly = null; indH = null; licInd = null; render(); return d; }).catch((e) => { allP = null; RT.toast(String(e.message || e), 5000); });
  return allP;
}
const moreP = {};
function loadMore() {
  const all = !!(fdaD && fdaD.complete), k = all ? 'all' : 'paid';
  if (!moreP[k]) {
    const p = TW.fdaMore(all).then(() => { p.done = true; indH = null; licInd = null; if (Q && S.view === 'search') render(); else refreshShown(); }).catch(() => { moreP[k] = null; });
    moreP[k] = p;
  }
  return moreP[k];
}
function redrawRow(li) {
  const r = nhiD.byCode.get(li.dataset.code); if (!r) return null;
  // the element that had focus, named by what it does, so the same one gets it back after the redraw
  const a = document.activeElement, had = a && li.contains(a) ? (a.dataset.act ? `[data-act="${a.dataset.act}"]` : a.dataset.tab ? `[data-tab="${a.dataset.tab}"]` : a.classList.contains('row') ? '.row' : null) : null;
  const tmp = document.createElement('ul'); tmp.innerHTML = rowHTML(r); const n = tmp.firstElementChild; li.replaceWith(n); hydrate(n);
  if (had) { const t = n.querySelector(had); if (t && t.offsetParent) t.focus({ preventScroll: true }); }
  return n;
}
// after the licence, appearance or rule files arrive: refresh what is on screen
function refreshShown() {
  document.querySelectorAll('#out li[data-lic]').forEach((li) => { if (openLic.has(li.dataset.lic)) redrawLic(li); });
  document.querySelectorAll('#out li[data-code]').forEach((li) => {
    const thumb = li.querySelector(':scope > .row .thumb'), r = nhiD.byCode.get(li.dataset.code);
    if (open.has(li.dataset.code)) { redrawRow(li); return; }
    if (thumb && r) { const src = photoOf(r); if (src && !thumb.querySelector('img')) thumb.innerHTML = `<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`; }
  });
}

/* ---------- opening and closing a drug (a full screen on phones) ---------- */
let sheetState = false;
function openDrug(li) {
  const id = li.dataset.code;
  S.recent = [id, ...(S.recent || []).filter((x) => x !== id)].slice(0, 8);
  if (Q && Q.trim().toUpperCase() !== id) S.recentQ = [Q.trim(), ...(S.recentQ || []).filter((x) => x !== Q.trim())].slice(0, 6);
  save();
  if (phone()) {
    [...open].forEach((c) => { open.delete(c); const o = document.querySelector(`#out li[data-code="${CSS.escape(c)}"]`); if (o) redrawRow(o); });
    open.add(id); document.body.classList.add('sheet-open');
    if (!sheetState) { history.pushState({ sheet: id }, ''); sheetState = true; }
  } else open.add(id);
  loadExtra(); loadMore(); loadAlerts(); loadSafety(); sync();
  const cur = document.querySelector(`#out li[data-code="${CSS.escape(id)}"]`) || li;
  morph(cur.querySelector('.row'), () => redrawRow(cur), (n) => n && n.querySelector('.detail')).then((n) => {
    if (phone() && n) { const d = n.querySelector('.detail'); if (d) { d.scrollTop = 0; const b = d.querySelector('[data-act="close"]'); if (b) b.focus({ preventScroll: true }); } }
    else if (n) { const x = n.querySelector('.d-tools .x'); if (x) x.focus({ preventScroll: true }); }
  });
}
function redrawLic(li) {
  const f = fdaD && licIdx().byNo.get(li.dataset.lic); if (!f) return null;
  const tmp = document.createElement('ul'); tmp.innerHTML = licRowHTML(f); const n = tmp.firstElementChild; li.replaceWith(n); n.querySelectorAll('.detail .tabs').forEach((t) => placeInk(t, false)); return n;
}
const licLi = (no) => document.querySelector(`#out li[data-lic="${CSS.escape(no)}"]`);
function openLicRow(li) {
  const no = li.dataset.lic;
  if (phone()) {
    [...open].forEach((c) => { open.delete(c); const o = document.querySelector(`#out li[data-code="${CSS.escape(c)}"]`); if (o) redrawRow(o); });
    [...openLic].forEach((c) => { openLic.delete(c); const o = licLi(c); if (o) redrawLic(o); });
    openLic.add(no); document.body.classList.add('sheet-open');
    if (!sheetState) { history.pushState({ sheet: no }, ''); sheetState = true; }
  } else openLic.add(no);
  loadExtra(); loadMore(); loadAlerts(); loadSafety();
  const cur = licLi(no) || li;
  morph(cur.querySelector('.row'), () => redrawLic(cur), (n) => n && n.querySelector('.detail')).then((n) => {
    if (phone() && n) { const d = n.querySelector('.detail'); if (d) { d.scrollTop = 0; const b = d.querySelector('[data-act="close"]'); if (b) b.focus({ preventScroll: true }); } }
    else if (n) { const x = n.querySelector('.d-tools .x'); if (x) x.focus({ preventScroll: true }); }
  });
}
function closeLic(no, fromHistory) {
  openLic.delete(no);
  const li = licLi(no);
  if (sheetState && !fromHistory) { sheetState = false; history.back(); } else sheetState = false;
  morph(li && li.querySelector('.detail'), () => { document.body.classList.remove('sheet-open'); return li ? redrawLic(li) : null; }, (n) => n && n.querySelector('.row')).then((n) => {
    if (n) { const row = n.querySelector('.row'); if (row) row.focus({ preventScroll: phone() }); }
  });
}
async function licClick(e, li) {
  const f = fdaD && licIdx().byNo.get(li.dataset.lic); if (!f) return;
  const no = f[F.licence];
  const tb = e.target.closest('[data-tab]');
  if (tb) {
    tabOf.set('L:' + no, tb.dataset.tab);
    switchTab(li.querySelector('.detail'), tb.dataset.tab, licTabHTML(f, tb.dataset.tab));
    return;
  }
  const act = e.target.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    if (a === 'close') closeLic(no);
    else if (a === 'licq') {
      leaveSheet(); chips = []; Q = licFirstIng(f); $('q').value = Q; shown = 50; open.clear(); openLic.clear();
      if (S.scope === 'lic') setScope('every', true);
      sync(); render(); window.scrollTo({ top: 0 });
    } else if (a === 'ing') openIng(f[F.ingredients]);
    else if (a === 'copy') { try { await navigator.clipboard.writeText(licSummary(f)); RT.toast(T('已複製', 'Copied')); } catch (x) { RT.toast(T('無法複製到剪貼簿', 'Could not copy'), 3000); } }
    return;
  }
  if (e.target.closest('.row') && !e.target.closest('a')) { if (openLic.has(no)) closeLic(no); else openLicRow(li); }
}
function closeDrug(id, fromHistory) {
  open.delete(id);
  const li = document.querySelector(`#out li[data-code="${CSS.escape(id)}"]`);
  if (sheetState && !fromHistory) { sheetState = false; history.back(); setTimeout(sync, 0); } else { sheetState = false; sync(); }
  morph(li && li.querySelector('.detail'), () => { document.body.classList.remove('sheet-open'); return li ? redrawRow(li) : null; }, (n) => n && n.querySelector('.row')).then((n) => {
    if (n) { const row = n.querySelector('.row'); if (row) row.focus({ preventScroll: phone() }); }
  });
}
window.addEventListener('popstate', () => { if (sheetState) { sheetState = false; [...open].forEach((c) => closeDrug(c, true)); [...openLic].forEach((c) => closeLic(c, true)); } });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && phone() && (open.size || openLic.size) && !$('photo').open) { [...open].forEach((c) => closeDrug(c)); [...openLic].forEach((c) => closeLic(c)); } });

/* ---------- photo viewer ---------- */
function openPhoto(btn) {
  const [name, ...rest] = (btn.dataset.cap || '').split('\n');
  $('phImg').src = btn.dataset.photo; $('phImg').alt = T('藥品外觀照片：', 'Photo: ') + name;
  $('phCap').innerHTML = `<b>${esc(name)}</b>${rest.length ? '\n' + esc(rest.join('\n')) : ''}`;
  $('phLink').href = btn.dataset.photo;
  $('photo').showModal();
}
$('phClose').onclick = () => $('photo').close();
$('phImg').onclick = () => $('photo').close();
$('photo').addEventListener('click', (e) => { if (e.target === $('photo')) $('photo').close(); });
$('photo').addEventListener('close', () => { $('phImg').removeAttribute('src'); });

/* ---------- actions ---------- */
function summary(r) {
  const f = licOf(r);
  return [`${r[N.zh]} ${r[N.en]}`.trim(), `${T('健保代號', 'NHI code')} ${r[N.code]}${r[N.atc] ? ' · ATC ' + r[N.atc] : ''}`,
    r[N.price] > 0 ? `${T('支付價', 'Price')} $${fmtP(r[N.price])}（${r[N.priceSince]}）` : T('已取消給付', 'Delisted'),
    `${T('成分', 'Ingredient')} ${r[N.ingredient]}`, r[N.ruleChapters] ? `${T('給付規定', 'NHI rules')} ${r[N.ruleChapters]}` : '',
    f ? `${f[F.licence]}${f[F.status] ? '（' + f[F.status] + '）' : ''}${f[F.controlled] ? ' · ' + f[F.controlled] : ''}` : ''].filter(Boolean).join('\n');
}
function toCodelist(items) {
  let q = []; try { q = JSON.parse(localStorage.getItem('rt:handoff-codes') || '[]'); } catch (e) { q = []; }
  q.push(...items); try { localStorage.setItem('rt:handoff-codes', JSON.stringify(q.slice(-5000))); } catch (e) { /* ignore */ }
  RT.toast(T(`已送出 ${items.length} 個代碼，到「代碼清單產生器」就會出現`, `${items.length} codes sent; they appear in the Code List Builder`), 4000);
}
const nhiItem = (r) => ({ sys: 'nhi', code: r[N.code], name: [r[N.zh], r[N.en]].filter(Boolean).join(' / '), atc: r[N.atc] });
function leaveSheet() { if ((open.size || openLic.size) && phone()) { open.clear(); openLic.clear(); document.body.classList.remove('sheet-open'); if (sheetState) { sheetState = false; history.back(); } } }
function setChip(k, v) { leaveSheet(); chips = chips.filter((c) => c.k !== k); chips.push({ k, v }); Q = ''; $('q').value = ''; shown = 50; open.clear(); sync(); render(); window.scrollTo({ top: 0 }); }
async function goCode(code) {
  if (!nhiD.byCode.has(code)) await loadAll();
  if (!nhiD.byCode.has(code)) return;
  leaveSheet();
  chips = []; Q = code; $('q').value = code; shown = 50; open.clear();
  const p = nhiD.byCode.get(code)[N.price] > 0;
  if (!p) loadFdaAll();
  if ((S.scope === 'paid' && !p) || (S.scope === 'delisted' && p) || S.scope === 'lic') setScope('every', true);
  sync(); render(); window.scrollTo({ top: 0 });
  const li = document.querySelector(`#out li[data-code="${CSS.escape(code)}"]`); if (li) openDrug(li);
}
$('out').addEventListener('click', async (e) => {
  const z = e.target.closest('[data-photo]'); if (z) { openPhoto(z); return; }
  const sc = e.target.closest('[data-scope]'); if (sc) { setScope(sc.dataset.scope); return; }
  if (e.target.closest('[data-clear]')) { clearAdv(); return; }
  if (e.target.id === 'btnMore') { shown += 100; render(); return; }
  const cg = e.target.closest('[data-chipgroup]'); if (cg) { setChip('group', cg.dataset.chipgroup); return; }
  const sh = e.target.closest('[data-sorth]'); if (sh) { S.sort = sh.dataset.sorth === 'code' ? 'code' : S.sort === 'pa' ? 'pd' : 'pa'; S.byGroup = false; $('fSort').value = S.sort; save(); render(); return; }
  const hm = e.target.closest('[data-home]'); if (hm) { setView(hm.dataset.home); window.scrollTo({ top: 0 }); return; }
  const hq = e.target.closest('[data-homeq]'); if (hq) { Q = hq.dataset.homeq; $('q').value = Q; shown = 50; sync(); render(); return; }
  if (e.target.closest('[data-homeclr]')) { S.recent = []; S.recentQ = []; save(); render(); return; }
  const fq = e.target.closest('[data-fixq]'); if (fq) { Q = fq.dataset.fixq; $('q').value = Q; shown = 50; open.clear(); openLic.clear(); sync(); render(); return; }
  const go = e.target.closest('[data-go]'); if (go) { goCode(go.dataset.go); return; }
  const ll = e.target.closest('li[data-lic]'); if (ll) { licClick(e, ll); return; }
  const li = e.target.closest('li[data-code]'); if (!li) return;
  const r = nhiD.byCode.get(li.dataset.code); if (!r) return;
  const tb = e.target.closest('[data-tab]');
  if (tb) {
    tabOf.set(r[N.code], tb.dataset.tab);
    // the button may also be a shortcut inside a panel ("Full text"): mark the tab with the same name
    switchTab(li.querySelector('.detail'), tb.dataset.tab, tabHTML(r, tb.dataset.tab)); hydrate(li);
    return;
  }
  const act = e.target.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    if (a === 'close') closeDrug(r[N.code]);
    else if (a === 'group') setChip('group', r[N.group]);
    else if (a === 'atc') setChip('atc', r[N.atc]);
    else if (a === 'atc5') setChip('atc', r[N.atc].slice(0, 5));
    else if (a === 'copy') { try { await navigator.clipboard.writeText(summary(r)); RT.toast(T('已複製', 'Copied')); } catch (x) { RT.toast(T('無法複製到剪貼簿', 'Could not copy'), 3000); } }
    else if (a === 'codelist') toCodelist([nhiItem(r)]);
    else if (a === 'cmp') toggleCmp(r[N.code]);
    else if (a === 'ing') openIng(r[N.ingredient]);
    else if (a === 'link') { const u = location.origin + location.pathname + '?code=' + encodeURIComponent(r[N.code]); try { await navigator.clipboard.writeText(u); RT.toast(T('已複製這個藥的連結', 'Link copied')); } catch (x) { RT.toast(u, 6000); } }
    return;
  }
  if (e.target.closest('.row') && !e.target.closest('a')) {
    if (open.has(r[N.code])) closeDrug(r[N.code]); else openDrug(li);
  }
});
$('ovWrap').addEventListener('toggle', (e) => {
  const d = e.target; if (!d.matches || !d.matches('details.ctr')) return;
  S.ctrOpen = d.open; save(); if (d.open) drawClassTrend(d);
}, true);
$('ovWrap').addEventListener('click', (e) => {
  const c = e.target.closest('[data-ovcls]'), s = e.target.closest('[data-ovscope]'), k = e.target.closest('[data-ovctrl]');
  if (c) { A().cls = A().cls === c.dataset.ovcls ? '' : c.dataset.ovcls; syncAdv(); shown = 50; save(); render(); }
  else if (s) setScope(s.dataset.ovscope);
  else if (k) { A().ctrl = A().ctrl === k.dataset.ovctrl ? '' : k.dataset.ovctrl; syncAdv(); shown = 50; save(); render(); }
});
const CSV_HEAD = ['健保代號', '中文名稱', '英文名稱', '成分', '規格', '劑型', '藥品分類', 'ATC', '支付價', '支付價起日', '首次收載', '包裝', '分類分組', '給付規定章節', '藥商', '製造廠', '許可證字號', '許可證狀態', '處方類別', '管制藥品', '製造國別'];
function csvRow(r) { if (!r) return CSV_HEAD.map(() => ''); const f = licOf(r); return [r[N.code], r[N.zh], r[N.en], r[N.ingredient], r[N.strength], r[N.form], r[N.class], r[N.atc], r[N.price], r[N.priceSince], r[N.firstListed], TW.isFoil(r[N.code]) ? '鋁箔包裝(G0)' : hasFoilTwin(r) ? '一般包裝' : '', r[N.group], r[N.ruleChapters], r[N.vendor], r[N.maker], f ? f[F.licence] : '', f ? f[F.status] || '有效' : '', f ? f[F.category] : '', f ? f[F.controlled] : '', f ? f[F.country] : '']; }
$('status').addEventListener('click', (e) => {
  const vm = e.target.closest('[data-rview]'); if (vm) { S.rview = vm.dataset.rview; save(); if (S.rview === 'cards') loadExtra(); render(); return; }
  if (e.target.id === 'btnCsv') {
    const rows = last.rows.map(csvRow);
    RT.downloadCSV([CSV_HEAD, ...rows], 'tw-drugs.csv');
  }
  if (e.target.id === 'btnAllCl') {
    if (last.rows.length > 3000) { RT.toast(T('結果超過 3000 筆，請先縮小範圍', 'More than 3000 results; narrow the search first'), 4000); return; }
    toCodelist(last.rows.map(nhiItem));
  }
});
$('chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-chip]'); if (b) { chips.splice(+b.dataset.chip, 1); shown = 50; sync(); render(); return; }
  const k = e.target.closest('[data-advk]'); if (k) { k.dataset.advk.split(',').forEach((x) => { if (x === '__pack') setPack('foil', true); else A()[x] = ADV[x]; }); syncAdv(); shown = 50; save(); render(); return; }
  if (e.target.closest('[data-clearall]')) { chips = []; S.adv = { ...ADV }; setPack('foil', true); syncAdv(); shown = 50; save(); sync(); render(); }
});
// an open menu closes on a click anywhere else
document.addEventListener('click', (e) => { document.querySelectorAll('details.menu[open]').forEach((m) => { if (!m.contains(e.target) || e.target.closest('.menu-pop button')) m.open = false; }); });


/* ---------- compare up to four drugs side by side ---------- */
const CMP_MAX = 4;
const cmpList = () => (S.cmp = (S.cmp || []).filter((c) => !nhiD || nhiD.byCode.has(c)));
function toggleCmp(code) {
  const l = cmpList();
  if (l.includes(code)) S.cmp = l.filter((c) => c !== code);
  else if (l.length >= CMP_MAX) { RT.toast(T(`最多比較 ${CMP_MAX} 個，請先移除一個`, `Up to ${CMP_MAX}; remove one first`), 3000); return; }
  else S.cmp = [...l, code];
  save(); drawTray();
  document.querySelectorAll(`#out [data-act="cmp"]`).forEach((b) => b.setAttribute('aria-pressed', String(S.cmp.includes(b.closest('.detail').dataset.code))));
}
function drawTray() {
  const l = cmpList(), tray = $('cmpTray');
  tray.hidden = !l.length;
  if (!l.length) return;
  tray.innerHTML = `<span class="ct-k">${T('比較', 'Compare')} <b>${l.length}</b>/${CMP_MAX}</span><span class="ct-l">${l.map((c) => { const r = nhiD.byCode.get(c); return `<span class="chip f">${esc(r[N.zh] || r[N.en])}<button type="button" data-cmprm="${esc(c)}" aria-label="${T('移除', 'Remove')}">×</button></span>`; }).join('')}</span><span class="spacer"></span><button type="button" class="primary small" id="cmpGo"${l.length < 2 ? ' disabled title="' + T('至少選 2 個', 'Pick at least 2') + '"' : ''}>${T('看比較', 'Compare')}</button><button type="button" class="small" id="cmpClr">${T('清除', 'Clear')}</button>`;
}
const CMP_ROWS = [
  [['名稱', 'Name'], (r) => `<button type="button" class="cmp-nm" data-cmpgo="${esc(r[N.code])}">${esc(r[N.zh] || r[N.en])}</button><small>${r[N.zh] ? esc(r[N.en]) : ''}</small>`, (r) => r[N.zh] || r[N.en]],
  [['外觀', 'Looks'], (r) => { const s = photoOf(r); return s ? `<img class="cmp-ph" src="${esc(s)}" alt="" loading="lazy">` : '—'; }, () => ''],
  [['健保代號', 'NHI code'], (r) => `<span class="cd">${esc(r[N.code])}</span>`, (r) => r[N.code]],
  [['成分', 'Ingredient'], (r) => esc(r[N.ingredient]), (r) => r[N.ingredient]],
  [['劑型', 'Form'], (r) => esc([r[N.form], r[N.strength]].filter(Boolean).join(' · ')), (r) => [r[N.form], r[N.strength]].filter(Boolean).join(' ')],
  ['ATC', (r) => `<span class="cd">${esc(r[N.atc])}</span>`, (r) => r[N.atc]],
  [['藥品分類', 'Class'], (r) => clsDot(r[N.class]) || '—', (r) => r[N.class]],
  [['支付價', 'Price'], (r) => (r[N.price] > 0 ? `<b class="cmp-p">$${fmtP(r[N.price])}</b><small>${T('自 ', 'since ')}${esc(r[N.priceSince] || '')}</small>` : `<span class="tag off">${T('已取消給付', 'Delisted')}</span>`), (r) => (r[N.price] > 0 ? r[N.price] : '已取消給付')],
  [['同組位置', 'In its group'], (r) => { const g = grpInfo(r); return g ? `<b>${g.label}</b>${stripHTML(g)}` : '—'; }, (r) => { const g = grpInfo(r); return g ? g.label.replace(/<[^>]+>/g, '') : ''; }],
  [['每 DDD', 'Per DDD'], (r) => { const p = perDDD(r); return p ? `$${fmtP(+p.cost.toFixed(2))}` : '—'; }, (r) => { const p = perDDD(r); return p ? +p.cost.toFixed(2) : ''; }],
  [['醫令量', 'Claims'], (r) => `<span data-cmpuse="${esc(r[N.code])}">…</span>`, (r) => { const u = cmpUse(r); return u ? u.v : ''; }],
  [['給付規定', 'NHI rules'], (r) => esc(r[N.ruleChapters] ? r[N.ruleChapters].split(',').filter(Boolean).join('、') : T('無', 'none')), (r) => r[N.ruleChapters] || ''],
  [['首次收載', 'First listed'], (r) => esc(r[N.firstListed] || ''), (r) => r[N.firstListed] || ''],
  [['藥商', 'Vendor'], (r) => esc(r[N.vendor] || ''), (r) => r[N.vendor] || ''],
  [['許可證', 'Licence'], (r) => { const f = licOf(r); return f ? `${esc(f[F.licence])}${f[F.status] ? ` <span class="tag off">${esc(f[F.status])}</span>` : ''}` : '—'; }, (r) => { const f = licOf(r); return f ? f[F.licence] : ''; }],
];
function cmpUse(r) {
  if (!usageD) return null;
  const ys = usageD.years, mine = usageD.q[r[N.code]]; if (!ys.length || !mine) return null;
  let i = ys.length - 1; while (i > 0 && ys[i].partial) i--;
  const v = (mine[i] || [0])[0]; return { y: ys[i].year, v };
}
function openCmp() {
  const rs = cmpList().map((c) => nhiD.byCode.get(c));
  if (rs.length < 2) return;
  const lab = (x) => (Array.isArray(x) ? T(...x) : x);
  $('cmpBody').innerHTML = `<table class="cmp-t"><tbody>${CMP_ROWS.map(([k, h]) => `<tr><th scope="row">${lab(k)}</th>${rs.map((r) => `<td>${h(r)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  $('cmpDlg').showModal();
  loadExtra(); loadAlerts();
  loadUsage().then(() => { $('cmpBody').querySelectorAll('[data-cmpuse]').forEach((el) => { const u = cmpUse(nhiD.byCode.get(el.dataset.cmpuse)); el.innerHTML = u && u.v ? `<b>${fmtN(u.v)}</b><small>${u.y}</small>` : '—'; }); }).catch(() => {});
}
$('cmpTray').addEventListener('click', (e) => {
  const rm = e.target.closest('[data-cmprm]'); if (rm) { toggleCmp(rm.dataset.cmprm); return; }
  if (e.target.id === 'cmpGo') openCmp();
  if (e.target.id === 'cmpClr') { S.cmp = []; save(); drawTray(); document.querySelectorAll('#out [data-act="cmp"]').forEach((b) => b.setAttribute('aria-pressed', 'false')); }
});
$('cmpDlg').addEventListener('click', async (e) => {
  if (e.target === $('cmpDlg') || e.target.id === 'cmpClose') { $('cmpDlg').close(); return; }
  const g = e.target.closest('[data-cmpgo]'); if (g) { $('cmpDlg').close(); setView('search', true); goCode(g.dataset.cmpgo); return; }
  if (e.target.id === 'cmpCopy') {
    const rs = cmpList().map((c) => nhiD.byCode.get(c)), lab = (x) => (Array.isArray(x) ? T(...x) : x);
    const tsv = CMP_ROWS.filter(([k]) => !(Array.isArray(k) && k[0] === '外觀')).map(([k, , t]) => [lab(k), ...rs.map((r) => String(t(r) ?? '').replace(/\s+/g, ' '))].join('\t')).join('\n');
    try { await navigator.clipboard.writeText(tsv); RT.toast(T('已複製表格，可直接貼到 Excel 或 Word', 'Table copied; paste it into Excel or Word')); } catch (x) { RT.toast(T('無法複製到剪貼簿', 'Could not copy'), 3000); }
  }
});

/* ---------- what a month costs at the NHI price, and in the same price group ---------- */
function costHTML(r) {
  if (!(r[N.price] > 0)) return '';
  return `<div class="cost" data-cost="${esc(r[N.code])}"><h3 class="sec">${T('每月費用試算', 'Cost per month')}</h3>
    <div class="cost-in"><label>${T('一天用', 'Per day')} <input type="number" data-cq min="0.25" max="99" step="0.25" inputmode="decimal" value="${esc(S.costQty || 1)}"> ${T('單位', 'units')}</label><span>×</span><label><input type="number" data-cd min="1" max="365" step="1" inputmode="numeric" value="${esc(S.costDays || 30)}"> ${T('天', 'days')}</label></div>
    <div data-cost-out>${costOut(r)}</div></div>`;
}
function costOut(r) {
  const q = Math.max(0, parseFloat(S.costQty) || 1), d = Math.max(1, Math.round(parseFloat(S.costDays) || 30)), me = r[N.price] * q * d;
  const k = grpKey(r), peers = r[N.group] ? nhiD.rows.filter((x) => x !== r && x[N.price] > 0 && grpKey(x) === k).sort((a, b) => a[N.price] - b[N.price]).slice(0, 6) : [];
  const money = (v) => '$' + Math.round(v).toLocaleString();
  const row = (x, mine) => { const v = x[N.price] * q * d, dv = v - me; return `<li${mine ? ' class="me"' : ''}><span class="cn">${mine ? `<b>${T('這個藥', 'This drug')}</b>` : `<button type="button" data-go="${esc(x[N.code])}">${esc(x[N.zh] || x[N.en])}</button>`}</span><span class="cu">$${fmtP(x[N.price])}</span><span class="cm">${money(v)}</span><span class="cd2${Math.round(dv) === 0 ? ' eq' : dv < 0 ? ' less' : ''}">${mine ? '' : Math.round(dv) === 0 ? T('同價', 'same') : (dv < 0 ? '−' : '+') + money(Math.abs(dv))}</span></li>`; };
  const lo = peers[0];
  return `<p class="cost-sum">${T(`${d} 天約 <b>${money(me)}</b>`, `<b>${money(me)}</b> for ${d} days`)}${lo && lo[N.price] < r[N.price] ? T(`；換成同組最低價每 ${d} 天約省 <b>${money(me - lo[N.price] * q * d)}</b>`, `; the group's lowest price saves about <b>${money(me - lo[N.price] * q * d)}</b> per ${d} days`) : ''}</p>
    ${peers.length ? `<ul class="cost-l"><li class="h"><span>${T('同分組', 'Same group')}</span><span>${T('單價', 'Unit')}</span><span>${T(`${d} 天`, `${d} days`)}</span><span>${T('差額', 'Difference')}</span></li>${[...peers, r].sort((a, b) => a[N.price] - b[N.price]).map((x) => row(x, x === r)).join('')}</ul>` : ''}
    <p class="note">${T('以健保支付價的計價單位計算（錠、顆、支、瓶…依品項而定），不含藥事服務費、診察費與部分負擔，只供比較參考。', 'Worked out per pricing unit of the NHI price (tablet, capsule, vial… depending on the item), without dispensing fees, consultation fees or co-payment; for comparison only.')}</p>`;
}
$('out').addEventListener('input', (e) => {
  const box = e.target.closest('.cost'); if (!box) return;
  if (e.target.matches('[data-cq]')) S.costQty = e.target.value;
  if (e.target.matches('[data-cd]')) S.costDays = e.target.value;
  save();
  const r = nhiD.byCode.get(box.dataset.cost); if (r) box.querySelector('[data-cost-out]').innerHTML = costOut(r);
});

/* ---------- keyboard: ↑ ↓ (and ← → among cards) move between results; ↓ from the search box enters the list ---------- */
const rowsInOut = () => [...document.querySelectorAll('#out ul.res > li:not(.th):not(.grp-h) > .row')].filter((b) => b.offsetParent);
$('out').addEventListener('keydown', (e) => {
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key) || !e.target.matches('ul.res > li > .row')) return;
  const cards = !!e.target.closest('ul.cards');
  if (!cards && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
  const all = rowsInOut(), i = all.indexOf(e.target); if (i < 0) return;
  let j = i;
  if (cards && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    const x = e.target.getBoundingClientRect().left, y = e.target.getBoundingClientRect().top;
    const cand = all.filter((b) => (e.key === 'ArrowDown' ? b.getBoundingClientRect().top > y + 4 : b.getBoundingClientRect().top < y - 4));
    if (cand.length) { const ty = e.key === 'ArrowDown' ? Math.min(...cand.map((b) => b.getBoundingClientRect().top)) : Math.max(...cand.map((b) => b.getBoundingClientRect().top)); const rowB = cand.filter((b) => Math.abs(b.getBoundingClientRect().top - ty) < 4); j = all.indexOf(rowB.reduce((a, b) => (Math.abs(b.getBoundingClientRect().left - x) < Math.abs(a.getBoundingClientRect().left - x) ? b : a))); }
  } else j = i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1);
  if (j >= 0 && j < all.length && j !== i) { e.preventDefault(); all[j].focus(); all[j].scrollIntoView({ block: 'nearest' }); }
  else if (j < 0 && (e.key === 'ArrowUp')) { e.preventDefault(); $('q').focus(); }
});
$('q').addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { const f = rowsInOut()[0]; if (f) { e.preventDefault(); f.focus(); } } });


/* ---------- TFDA safety communications and risk management plans ---------- */
let safetyD = null, safetyP = null;
// class names in the notices, read as ATC prefixes
const SAFE_CLASS = [
  [/SSRI|選擇性血清素/i, ['N06AB']], [/SNRI|正腎上腺素回收/i, ['N06AX16', 'N06AX21', 'N06AX17']], [/vortioxetine/i, ['N06AX26']],
  [/fluoroquinolone/i, ['J01MA']], [/非類固醇消炎|NSAID/i, ['M01A']], [/JAK/i, ['L04AF', 'L04AA29', 'L04AA37', 'L04AA44', 'L01EJ']],
  [/DOAC|直接作用型口服抗凝血/i, ['B01AF', 'B01AE07']], [/aminoglycoside/i, ['J01G']], [/碘顯影|iodinated contrast/i, ['V08AB']],
  [/刺激型瀉劑/, ['A06AB']], [/血管內皮生長因子|VEGF/i, ['L01FG', 'L01EK', 'S01LA']], [/巨環類|macrolide/i, ['J01FA']], [/^insulin|胰島素/i, ['A10A']],
];
const SAFE_STOP = new Set(['selective', 'serotonin', 'reuptake', 'inhibitors', 'inhibitor', 'noradrenaline', 'contrast', 'media', 'iodinated', 'sodium', 'hydrochloride', 'vitamin', 'acetate', 'phosphate', 'sulfate', 'potassium', 'calcium', 'direct-acting', 'anticoagulants', 'acting', 'merck', 'varicella-zoster', 'virus', 'olumiant', 'tablets', 'injection', 'class']);
function loadSafety() {
  if (!safetyP) safetyP = TW.safety().then((d) => {
    safetyD = { comms: d.comms || [], rmp: new Set(d.rmp || []) };
    safetyD.idx = safetyD.comms.map((c) => ({ atc: SAFE_CLASS.filter(([re]) => re.test(c[1])).flatMap(([, a]) => a), tok: [...new Set((c[1].toLowerCase().match(/[a-z][a-z0-9-]{4,}/g) || []).filter((w) => !SAFE_STOP.has(w)))] }));
    if (open.size || openLic.size) refreshShown();
    return safetyD;
  }).catch(() => { safetyP = null; });
  return safetyP;
}
// the notices about this ingredient (by name) or its class (by ATC)
function safetyOf(ingredients, atc) {
  if (!safetyD) return [];
  const ing = ' ' + TW.fold(ingredients).replace(/[^a-z0-9-]+/g, ' ') + ' ', a = String(atc || '').toUpperCase();
  return safetyD.comms.filter((c, i) => { const x = safetyD.idx[i]; return (a && x.atc.some((p) => a.startsWith(p))) || x.tok.some((w) => ing.includes(' ' + w + ' ')); });
}
const rmpTag = (f) => (safetyD && f && safetyD.rmp.has(f[F.licence]) ? `<span class="tag ctrl" title="${T('食藥署要求這張許可證執行藥品風險管理計畫（RMP），使用前後有特別的衛教或監測要求', 'TFDA requires a risk management plan for this licence: specific education or monitoring around its use')}">${T('風險管理計畫', 'Risk plan')}</span>` : '');
function safetyBanner(ingredients, atc) {
  const cs = safetyOf(ingredients, atc);
  if (!cs.length) return '';
  return `<div class="banners"><div class="banner safe"><b>${T(`食藥署安全資訊 ${cs.length} 則`, `${cs.length} TFDA safety notice${cs.length > 1 ? 's' : ''}`)}</b><span>${T('最近 ', 'latest ')}${esc(cs[0][0])} · ${esc(firstLine(cs[0][1]))}</span>
    <details><summary>${T('看內容', 'Read them')}</summary>${cs.map((c) => `<div class="sf"><p><b>${esc(c[0])} · ${esc(c[1])}</b></p>${c[3] ? `<p><span class="sfk">${T('緣由', 'Why')}</span>${esc(c[3])}</p>` : ''}${c[5] ? `<p><span class="sfk">${T('食藥署說明', 'TFDA advice')}</span>${esc(c[5])}</p>` : ''}</div>`).join('')}
    <p class="note">${T('資料來源：食藥署「藥品安全資訊風險溝通資料」開放資料集，目前最新一則發布於 ', 'From the TFDA open dataset of drug safety communications; its newest notice is from ')}${esc(safetyD.comms[0] ? safetyD.comms[0][0] : '—')}${T('；比對依成分名稱與藥理分類，請以食藥署公告原文為準。', '; matched by ingredient name and drug class, so check the TFDA notice itself.')}</p></details></div></div>`;
}

/* ---------- DDD: the user's own WHO value per ATC code (the WHO list is not ours to publish) ---------- */
const UNIT = { mg: ['mg', 1], g: ['mg', 1000], mcg: ['mg', 0.001], ug: ['mg', 0.001], 'μg': ['mg', 0.001], u: ['u', 1], iu: ['u', 1], mu: ['u', 1e6] };
// the strength of one unit, when the item has one ingredient and a plain per-unit amount (not per mL)
function unitStrength(r) {
  const s = String(r[N.ingredient] || '');
  if (/\+/.test(s)) return null;
  const m = s.match(/([\d.]+)\s*(MG|G|MCG|UG|ΜG|IU|U|MU)\b(?!\s*\/)/i); if (!m) return null;
  const u = UNIT[m[2].toLowerCase().replace('μ', 'μ')] || UNIT[m[2].toLowerCase()]; if (!u) return null;
  return { v: parseFloat(m[1]) * u[1], base: u[0], text: m[0] };
}
const dddOf = (atc) => (S.ddd || {})[atc] || null;
function perDDD(r) {
  const d = dddOf(r[N.atc]), s = unitStrength(r); if (!d || !s || !(r[N.price] > 0)) return null;
  const u = UNIT[d.u]; if (!u || u[0] !== s.base) return null;
  const units = (d.v * u[1]) / s.v;           // units of this item in one DDD
  return { units, cost: r[N.price] * units };
}
function dddHTML(r) {
  if (!r[N.atc] || r[N.atc].length < 7) return '';
  const d = dddOf(r[N.atc]) || { v: '', u: 'g' }, s = unitStrength(r), p = perDDD(r);
  return `<div class="ddd" data-ddd="${esc(r[N.code])}"><div class="cost-in"><label>DDD <input type="number" data-dv min="0" step="any" inputmode="decimal" value="${esc(d.v)}" aria-label="${T('WHO 每日定義劑量', 'WHO defined daily dose')}"></label><select data-du aria-label="${T('單位', 'Unit')}">${['g', 'mg', 'mcg', 'U', 'MU'].map((u) => `<option value="${u.toLowerCase()}"${d.u === u.toLowerCase() ? ' selected' : ''}>${u}</option>`).join('')}</select>
    <a href="https://atcddd.fhi.no/atc_ddd_index/?code=${encodeURIComponent(r[N.atc])}" target="_blank" rel="noopener">${T(`查 ${esc(r[N.atc])} 的 DDD ↗`, `Look up ${esc(r[N.atc])} ↗`)}</a></div>
    <p class="cost-sum" data-dddout>${p ? T(`每 DDD 約 <b>$${fmtP(+p.cost.toFixed(2))}</b>（1 DDD = ${+p.units.toFixed(2)} 單位，每單位 ${esc(s.text)}）`, `About <b>$${fmtP(+p.cost.toFixed(2))}</b> per DDD (1 DDD = ${+p.units.toFixed(2)} units of ${esc(s.text)})`) : !s ? T('這個品項的含量不是單一成分的每單位劑量（例如每 mL），無法換算 DDD。', 'This item’s strength is not one ingredient per unit (it may be per mL), so it cannot be turned into DDDs.') : d.v ? T('DDD 的單位和含量的單位對不上（例如一個是 mg、一個是 U）。', 'The DDD unit does not match the strength unit (e.g. mg against U).') : T('輸入 WHO 公布的 DDD，就能算每 DDD 費用。', 'Enter the WHO DDD to get the cost per DDD.')}</p>
    <p class="note">${T('WHO 的 ATC/DDD 表有著作權，網站不提供；請到 WHOCC 查詢後輸入，數值只存在這台裝置，同一個 ATC 碼的品項共用。', 'The WHO ATC/DDD index is copyrighted and not bundled; look the value up at the WHOCC and enter it. It stays on this device and is shared by every item with this ATC code.')}</p></div>`;
}
$('out').addEventListener('input', (e) => {
  const box = e.target.closest('.ddd'); if (!box) return;
  const r = nhiD.byCode.get(box.dataset.ddd); if (!r) return;
  const v = parseFloat(box.querySelector('[data-dv]').value), u = box.querySelector('[data-du]').value;
  S.ddd = { ...(S.ddd || {}) };
  if (v > 0) S.ddd[r[N.atc]] = { v, u }; else delete S.ddd[r[N.atc]];
  save();
  const t = document.createElement('div'); t.innerHTML = dddHTML(r);
  box.querySelector('[data-dddout]').innerHTML = t.querySelector('[data-dddout]').innerHTML;
});
$('out').addEventListener('change', (e) => { if (e.target.matches('.ddd [data-du]')) e.target.closest('.ddd').querySelector('[data-dv]').dispatchEvent(new Event('input', { bubbles: true })); });

/* ---------- outside references for an ingredient ---------- */
const SALT = /\b(HCL|HBR|HYDROCHLORIDE|HYDROBROMIDE|SODIUM|POTASSIUM|CALCIUM|MAGNESIUM|MALEATE|BESYLATE|BESILATE|MESYLATE|MESILATE|TARTRATE|BITARTRATE|SUCCINATE|FUMARATE|CITRATE|ACETATE|SULFATE|SULPHATE|PHOSPHATE|NITRATE|BROMIDE|CHLORIDE|DIHYDRATE|MONOHYDRATE|TRIHYDRATE|HEMIHYDRATE|ANHYDROUS|MEDOXOMIL|CILEXETIL|DIPROPIONATE|PROPIONATE|VALERATE|FUROATE)\b/g;
const baseName = (ing) => ingName(String(ing || '').split(/[+;]/)[0]).replace(SALT, '').replace(/\s+/g, ' ').trim().toLowerCase();
function extLinks(ing, atc) {
  const n = baseName(ing); if (!n) return '';
  const q = encodeURIComponent(n);
  const L = [
    [`https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${q}`, 'DailyMed', T('美國仿單', 'US labels')],
    [`https://www.ncbi.nlm.nih.gov/books/NBK501922/?term=${q}`, 'LactMed', T('哺乳用藥', 'breastfeeding')],
    [`https://pubchem.ncbi.nlm.nih.gov/#query=${q}`, 'PubChem', T('化學結構與別名', 'structure and synonyms')],
    [`https://pubmed.ncbi.nlm.nih.gov/?term=${q}`, 'PubMed', T('文獻', 'literature')],
  ];
  if (atc) L.push([`https://atcddd.fhi.no/atc_ddd_index/?code=${encodeURIComponent(atc)}`, 'WHOCC', 'ATC/DDD']);
  return `<span class="ext">${L.map(([u, k, d]) => `<a href="${u}" target="_blank" rel="noopener" title="${esc(d)}">${k} ↗</a>`).join('')}</span>`;
}

/* ---------- one ingredient (or combination), all of it in one view ---------- */
async function openIng(ingText) {
  const key = ingKey(ingText, /\+/.test(ingText) ? '+' : ';');
  if (!key) return;
  $('ingBody').innerHTML = `<div class="loading">${T('整理中…', 'Gathering…')}</div>`;
  $('ingDlg').showModal();
  try { await Promise.all([loadAll(), loadFdaAll(), loadUsage(), loadSafety(), loadAlertIdx()]); } catch (e) { /* draw what there is */ }
  $('ingBody').innerHTML = ingHTML(key);
  $('ingDlg').dataset.key = key;
}
const f2 = (r) => licOf(r);
function ingHTML(key) {
  const rows = nhiD.rows.filter((r) => ingKey(r[N.ingredient], '+') === key);
  if (!rows.length) return `<div class="empty-state">${T('找不到這個成分的健保品項。', 'No NHI items with these ingredients.')}</div>`;
  const paid = rows.filter((r) => r[N.price] > 0), name = key.split('+').join(' + ');
  const by = {}; paid.forEach((r) => { const k = CLS_KEY[r[N.class]] ? r[N.class] : ''; by[k] = (by[k] || 0) + 1; });
  const vendors = new Set(paid.map((r) => r[N.vendor]).filter(Boolean)).size;
  const lic = fdaD && fdaD.complete ? licOnlyRows().filter((f) => ingKey(f[F.ingredients], ';') === key).length : 0;
  const k = (l, v, s) => `<div class="kpi"><span class="kk">${l}</span><span class="kv">${v}</span>${s ? `<span class="ks">${s}</span>` : ''}</div>`;
  // strengths and forms: one line per price group
  const gs = new Map();
  rows.forEach((r) => { const g = r[N.group] || (r[N.ingredient] + ' · ' + r[N.form]); const a = gs.get(g) || []; a.push(r); gs.set(g, a); });
  const grows = [...gs.entries()].map(([g, rs]) => { const p = rs.filter((r) => r[N.price] > 0), ps = p.map((r) => r[N.price]); const orig = p.filter((r) => r[N.class] === '研發廠').map((r) => r[N.price]); const dd = p.map(perDDD).filter(Boolean).map((x) => x.cost); return { g, n: rs.length, np: p.length, lo: ps.length ? Math.min(...ps) : 0, hi: ps.length ? Math.max(...ps) : 0, orig: orig.length ? Math.min(...orig) : 0, ddd: dd.length ? Math.min(...dd) : 0, r: (p[0] || rs[0]) }; })
    .sort((a, b) => b.np - a.np || a.lo - b.lo);
  // claims per year, split by class
  let use = '';
  if (usageD && usageD.years.length) {
    const ys = usageD.years, keys = ['研發廠', 'BA/BE學名藥', '一般學名藥', '生物製劑', ''];
    const tot = ys.map((_, i) => { const o = {}; rows.forEach((r) => { const q = usageD.q[r[N.code]]; if (!q || !q[i]) return; const c = CLS_KEY[r[N.class]] ? r[N.class] : ''; o[c] = (o[c] || 0) + q[i][0]; }); return o; });
    const sums = tot.map((o) => Object.values(o).reduce((s, v) => s + v, 0)), mx = Math.max(1, ...sums);
    if (sums.some(Boolean)) use = `<h3 class="sec">${T('歷年醫令量', 'Claims by year')} <small>${T('依藥品分類堆疊', 'stacked by class')}</small></h3>
      <div class="ubars ing">${ys.map((y, i) => `<div class="ucol${y.partial ? ' part' : ''}" style="--i:${i}" title="${y.year}：${sums[i].toLocaleString()}"><span class="val">${sums[i] ? fmtN(sums[i]) : '0'}</span><span class="stack" style="height:${((sums[i] / mx) * 100).toFixed(1)}%">${keys.filter((c) => tot[i][c]).map((c) => `<i class="k-${CLS_KEY[c] || 'none'}" style="flex:${tot[i][c]}"></i>`).join('')}</span></div>`).join('')}</div>
      <div class="uyears">${ys.map((y) => `<span>${y.year}${y.partial ? '*' : ''}</span>`).join('')}</div>
      <div class="legend">${keys.filter((k2) => tot.some((o) => o[k2])).map((k2) => `<span><span class="dot k-${CLS_KEY[k2] || 'none'}"></span> ${k2 ? esc(clsName(k2)) : T('未分類', 'Unclassified')}</span>`).join('')}${ys.some((y) => y.partial) ? `<span>${T('* 部分月份', '* part of the year')}</span>` : ''}</div>`;
  }
  const byLic = new Map();
  rows.forEach((r) => { const f = licOf(r); if (!f || byLic.has(f[F.licence]) || !(isShort(f) || lastRecall(f))) return; byLic.set(f[F.licence], { r, f, sh: isShort(f), rc: lastRecall(f) }); });
  const alerts = [...byLic.values()].sort((a, b) => b.sh - a.sh || String(b.rc ? b.rc[0] : '').localeCompare(String(a.rc ? a.rc[0] : '')));
  const cs = safetyOf(key.replace(/\+/g, ' '), rows[0][N.atc]);
  return `<div class="ing-h"><h2>${esc(name)}</h2>${extLinks(rows[0][N.ingredient], rows[0][N.atc])}</div>
    <div class="kpis">${k(T('健保品項', 'NHI items'), rows.length, T(`給付中 ${paid.length}`, `${paid.length} reimbursed`))}${k(T('藥商', 'Vendors'), vendors, T('給付中品項', 'of reimbursed items'))}${k(T('原廠／學名藥', 'Originator / generic'), `${by['研發廠'] || 0} / ${(by['BA/BE學名藥'] || 0) + (by['一般學名藥'] || 0)}`, `BA/BE ${by['BA/BE學名藥'] || 0} · ${T('一般', 'generic')} ${by['一般學名藥'] || 0}${by['生物製劑'] ? ` · ${T('生物', 'bio')} ${by['生物製劑']}` : ''}`)}${k(T('無健保代號的許可證', 'Licences without NHI code'), lic, T('自費或指示藥', 'self-paid or OTC'))}</div>
    <h3 class="sec">${T('含量與劑型', 'Strengths and forms')} <small>${T(`${grows.length} 組`, `${grows.length} groups`)}</small></h3>
    <div class="ing-t"><table><thead><tr><th>${T('分類分組', 'Price group')}</th><th class="n">${T('給付中', 'Paid')}</th><th class="n">${T('支付價', 'Price')}</th><th class="n">${T('原廠', 'Originator')}</th><th class="n">${T('每 DDD', 'Per DDD')}</th></tr></thead><tbody>
      ${grows.map((x) => `<tr><td><button type="button" class="lnk" data-inggrp="${esc(x.r[N.group] || '')}" data-ingq="${esc(x.r[N.code])}">${esc(x.g)}</button></td><td class="n">${x.np}/${x.n}</td><td class="n">${x.np ? `$${fmtP(x.lo)}${x.hi > x.lo ? '–$' + fmtP(x.hi) : ''}` : '—'}</td><td class="n">${x.orig ? '$' + fmtP(x.orig) : '—'}</td><td class="n">${x.ddd ? '$' + fmtP(+x.ddd.toFixed(2)) : '—'}</td></tr>`).join('')}</tbody></table></div>
    ${grows.some((x) => x.ddd) ? '' : `<p class="note">${T('「每 DDD」需要先在任一品項的「價格與費用」分頁輸入這個 ATC 碼的 DDD。', '“Per DDD” needs the DDD for this ATC code, entered once under Price and cost on any item.')}</p>`}
    ${use}
    ${alerts.length ? `<h3 class="sec">${T('缺藥與回收', 'Shortages and recalls')} <small>${T(`${alerts.length} 張許可證`, `${alerts.length} licences`)}</small></h3><ul class="ing-l">${alerts.slice(0, 15).map(({ r, sh, rc }) => `<li><button type="button" class="lnk" data-ingq="${esc(r[N.code])}">${esc(r[N.zh] || r[N.en])}</button> ${sh ? (noAlt(f2(r)) ? `<span class="tag noalt">${T('缺藥・無替代', 'Short, no alternative')}</span>` : `<span class="tag short">${T('缺藥中', 'Short')}</span>`) : ''}${rc ? `<span class="tag recall">${T('最近回收', 'Last recall')} ${esc(rc[0])}</span>` : ''}</li>`).join('')}</ul>${alerts.length > 15 ? `<p class="note">${T(`另有 ${alerts.length - 15} 張許可證有回收紀錄`, `${alerts.length - 15} more licences with a recall`)}</p>` : ''}` : ''}
    ${cs.length ? `<h3 class="sec">${T('食藥署安全資訊', 'TFDA safety notices')} <small>${cs.length}</small></h3><ul class="ing-l">${cs.map((c) => `<li><span class="d">${esc(c[0])}</span> ${esc(c[1])}${c[5] ? `<details><summary>${T('食藥署說明', 'TFDA advice')}</summary><p>${esc(c[5])}</p></details>` : ''}</li>`).join('')}</ul>` : ''}
    <div class="acts"><button type="button" data-ingall>${T('列出全部品項', 'List every item')}</button><button type="button" data-ingcl>${T(`全部 ${rows.length} 個代碼加入代碼清單`, `Add all ${rows.length} codes to the code list`)}</button></div>`;
}
$('ingDlg').addEventListener('click', (e) => {
  if (e.target === $('ingDlg') || e.target.id === 'ingClose') { $('ingDlg').close(); return; }
  const key = $('ingDlg').dataset.key, rows = () => nhiD.rows.filter((r) => ingKey(r[N.ingredient], '+') === key);
  const g = e.target.closest('[data-ingq]');
  if (g) { $('ingDlg').close(); setView('search', true); if (g.dataset.inggrp) setChip('group', g.dataset.inggrp); else goCode(g.dataset.ingq); return; }
  if (e.target.closest('[data-ingall]')) { $('ingDlg').close(); setView('search', true); leaveSheet(); chips = []; Q = key.split('+')[0].toLowerCase(); $('q').value = Q; if (S.scope === 'lic') setScope('every', true); shown = 50; open.clear(); sync(); render(); window.scrollTo({ top: 0 }); return; }
  if (e.target.closest('[data-ingcl]')) toCodelist(rows().map(nhiItem));
});

/* ---------- controls ---------- */
function setScope(v, quiet) { if (v !== 'paid') loadAll(); S.scope = v; $('scope').value = v; if (v !== 'paid') loadFdaAll(); shown = 50; save(); if (!quiet) render(); }
$('scope').addEventListener('change', () => setScope($('scope').value));
function setPack(v, quiet) { S.pack = v; $('pack').value = v; shown = 50; save(); if (!quiet) render(); }
$('pack').addEventListener('change', () => setPack($('pack').value));
function save() { RT.save(KEY, S); }
function sync() {
  const p = new URLSearchParams();
  if (S.view && S.view !== 'search') p.set('view', S.view);
  if (Q) p.set('q', Q);
  if (open.size === 1 && S.view === 'search') p.set('code', [...open][0]);
  chips.forEach((c) => p.set(c.k, c.v));
  history.replaceState(history.state, '', location.pathname + (p.toString() ? '?' + p : ''));
}
const onQ = RT.debounce(() => { Q = $('q').value.trim(); shown = 50; leaveSheet(); open.clear(); sync(); render(); }, 140);
$('q').addEventListener('input', onQ);
$('q').addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('q').value = ''; onQ(); } });
document.addEventListener('keydown', (e) => { if (e.key === '/' && document.activeElement !== $('q') && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('q').focus(); } });
$('fSort').onchange = () => { const v = $('fSort').value; if (v === 'grp') setByGroup(true); else { S.sort = v; setByGroup(false); } };
function setByGroup(on, quiet) { S.byGroup = !!on; $('fSort').value = S.byGroup ? 'grp' : S.sort; shown = 50; save(); if (!quiet) render(); }
// the filter panel (a sheet on phones)
function showAdv(on) {
  $('adv').hidden = !on; $('btnAdv').setAttribute('aria-expanded', String(on));
  const sheet = on && matchMedia('(max-width: 640px)').matches;
  $('advScrim').hidden = !sheet; document.body.classList.toggle('adv-open', sheet);
  S.advOpen = on; save(); if (on) loadFda();
}
$('btnAdv').onclick = () => showAdv($('adv').hidden);
['advDone', 'advDone2'].forEach((id) => ($(id).onclick = () => showAdv(false)));
$('advScrim').onclick = () => showAdv(false);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('adv').hidden && document.body.classList.contains('adv-open')) showAdv(false); });
const AF = { aPmin: 'pmin', aPmax: 'pmax', aFrom: 'from', aTo: 'to', aAtc: 'atc', aCls: 'cls', aForm: 'form', aSingle: 'single', aCat: 'cat', aCtrl: 'ctrl', aCountry: 'country', aLic: 'lic', aPkg: 'pkg', aWho: 'who', aRules: 'rules', aPhoto: 'photo', aShort: 'short', aRecall: 'recall' };
const applyAdv = RT.debounce(() => { shown = 50; save(); render(); }, 160);
Object.entries(AF).forEach(([id, k]) => {
  const el = $(id);
  el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
    A()[k] = el.type === 'checkbox' ? el.checked : el.value;
    if (needsLic()) loadFda();
    if (k === 'photo' && el.checked) loadExtra();
    if ((k === 'short' || k === 'recall') && el.checked) { loadFda(); loadAlertIdx(); }
    applyAdv();
  });
});
function syncAdv() { Object.entries(AF).forEach(([id, k]) => { const el = $(id); if (el.type === 'checkbox') el.checked = !!A()[k]; else el.value = A()[k] || ''; }); }
function clearAdv() { S.adv = { ...ADV }; syncAdv(); shown = 50; save(); render(); }
$('advClear').onclick = clearAdv; $('advClear2').onclick = clearAdv;
$('tips').innerHTML = T('例如：', 'Try: ') + ['metformin', 'A10BA', 'AC368201G0', '衛署藥輸字第004858號', 'atorvastatin 10'].map((x) => `<button type="button" class="small" data-try="${esc(x)}">${esc(x)}</button>`).join(' ');
$('tips').addEventListener('click', (e) => { const b = e.target.closest('[data-try]'); if (b) { $('q').value = b.dataset.try; onQ(); } });

let fdaP = null, extraP = null;
function licOptions(d) {
    const cats = {}, countries = {};
    d.rows.forEach((f) => { if (f[F.category]) cats[f[F.category]] = (cats[f[F.category]] || 0) + 1; if (f[F.country]) countries[f[F.country]] = (countries[f[F.country]] || 0) + 1; });
    $('aCat').innerHTML = `<option value="">${T('不限', 'All')}</option>` + Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([c]) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    $('aCountry').innerHTML = `<option value="">${T('不限', 'All')}</option>` + Object.entries(countries).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([c]) => `<option value="${esc(c)}">${esc(countryName(c))}</option>`).join('');
    syncAdv();
}
function loadFda() {
  if (fdaP) return fdaP;
  fdaP = TW.fda().then((d) => { fdaD = d; hay = null; indH = null; licOptions(d); render(); })
    .catch((e) => { fdaP = null; RT.toast(String(e.message || e), 5000); });
  return fdaP;
}
// licences of codes no longer reimbursed, and those without an NHI code
let fdaAllP = null;
let fdaAtcD = null, fdaAtcP = null;
function loadFdaAtc() {
  if (!fdaAtcP) fdaAtcP = TW.fdaAtc().then((d) => { fdaAtcD = d.atc || {}; licOnly = null; if (fdaD && fdaD.complete && !open.size && !openLic.size) render(); }).catch(() => { fdaAtcP = null; });
  return fdaAtcP;
}
const licAtc = (f) => (fdaAtcD && f ? fdaAtcD[f[F.licence]] || '' : '');
function loadFdaAll() {
  loadFdaAtc();
  if (!fdaAllP) fdaAllP = TW.fdaAll().then((d) => {
    fdaD = d; hay = null; licOnly = null; indH = null; licInd = null; licIndex = null; licOptions(d);
    if (open.size) { loadMore(); refreshShown(); } else render();
  }).catch((e) => { fdaAllP = null; RT.toast(String(e.message || e), 5000); });
  return fdaAllP;
}
function loadExtra() {
  if (extraP) return extraP;
  extraP = TW.extra().then((d) => { extraD = d; if (A().photo) render(); else refreshShown(); })
    .catch((e) => { extraP = null; RT.toast(String(e.message || e), 5000); });
  return extraP;
}

/* ---------- shortages and recalls ---------- */
let alertsD = null, alertsP = null;
function loadAlerts() {
  if (!alertsP) alertsP = TW.alerts().then((d) => {
    alertsD = d; if (open.size || openLic.size) refreshShown();
    $('nAlerts').textContent = Object.keys(d.short).length || '';
    if (S.view === 'alerts') renderAlerts();
    return d;
  }).catch(() => { alertsP = null; });
  return alertsP;
}
// which licences are short and when each was last recalled: enough for the cards and the filters
let alertIdx = null, aidxP = null;
function loadAlertIdx() {
  if (!aidxP) aidxP = TW.alertIndex().then((d) => {
    alertIdx = d;
    if (!alertsD) $('nAlerts').textContent = d.short.size || '';
    if (open.size && !(A().short || A().recall)) refreshShown(); else render();
    return d;
  }).catch(() => { aidxP = null; });
  return aidxP;
}
const isShort = (f) => !!(alertIdx && f && alertIdx.short.has(f[F.licence]));
// the TFDA judged there is no alternative to this short drug
const noAlt = (f) => !!(alertIdx && f && alertIdx.noAlt && alertIdx.noAlt.has(f[F.licence]));
const altLabel = (s) => (s && s[3] === 0 ? `<span class="alt no">${T('食藥署評估：無替代藥品', 'TFDA: no alternative')}</span>` : s && s[3] === 1 ? `<span class="alt">${T('食藥署評估：有替代藥品', 'TFDA: an alternative exists')}</span>` : '');
const lastRecall = (f) => (alertIdx && f ? alertIdx.recall.get(f[F.licence]) || null : null);
const shortOf = (f) => (alertsD && f ? alertsD.short[f[F.licence]] || null : null);
const recallsOf = (f) => (alertsD && f ? alertsD.recalls[f[F.licence]] || [] : []);
const yearsAgo = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10); };
const firstLine = (s) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > 90 ? t.slice(0, 88) + '…' : t; };
const GRADE = (g) => (g ? T(`第${'一二三'[g - 1]}級`, `Class ${g}`) : T('未分級', 'No class given'));
function alertTags(f) {
  const rc = lastRecall(f);
  return (isShort(f) ? (noAlt(f) ? `<span class="tag noalt">${T('缺藥・無替代', 'Short, no alternative')}</span>` : `<span class="tag short">${T('缺藥中', 'Short supply')}</span>`) : '') + (rc && rc[0] >= yearsAgo(2) ? `<span class="tag recall">${T('近兩年回收', 'Recalled')} ${esc(rc[0].slice(0, 7))}</span>` : '');
}
function alertBanners(f) {
  if (!f || !alertsD) return '';
  const s = shortOf(f), rc = recallsOf(f), back = alertsD.recovered[f[F.licence]];
  let h = '';
  if (s) h += `<div class="banner short${s[3] === 0 ? ' noalt' : ''}"><b>${T('缺藥中', 'In short supply')}</b>${altLabel(s)}<span>${T('食藥署公告 ', 'TFDA notice ')}${esc(s[0])}</span><details><summary>${esc(firstLine(s[2]))}</summary><p>${esc(s[2])}</p></details></div>`;
  else if (back) h += `<div class="banner ok"><b>${T('已恢復供應', 'Back in supply')}</b><span>${esc(back[0])} · ${esc(firstLine(back[2]))}</span></div>`;
  if (rc.length) h += `<div class="banner recall"><b>${T(`回收紀錄 ${rc.length} 次`, `${rc.length} recall${rc.length > 1 ? 's' : ''}`)}</b><span>${T('最近 ', 'latest ')}${esc(rc[0][0])} · ${GRADE(rc[0][1])}</span><details><summary>${esc(firstLine(rc[0][3]))}</summary>${rc.map((x) => `<p><b>${esc(x[0])} · ${GRADE(x[1])}</b>\n${T('批號', 'Batches')}：${esc(x[2] || '—')}\n${T('原因', 'Reason')}：${esc(x[3])}\n<small>${esc(x[4])}</small></p>`).join('')}</details></div>`;
  return h ? `<div class="banners">${h}</div>` : '';
}
// licence number → its row, and → the NHI codes that point to it
let licIndex = null;
function licIdx() {
  if (licIndex && licIndex.n === nhiD.rows.length && licIndex.f === (fdaD ? fdaD.rows.length : 0)) return licIndex;
  const byNo = new Map(fdaD ? fdaD.rows.map((f) => [f[F.licence], f]) : []), codes = new Map();
  if (fdaD) nhiD.rows.forEach((r) => { const f = licOf(r); if (f) { const a = codes.get(f[F.licence]) || []; a.push(r); codes.set(f[F.licence], a); } });
  licIndex = { n: nhiD.rows.length, f: fdaD ? fdaD.rows.length : 0, byNo, codes };
  return licIndex;
}
const codeBtns = (licence) => { const rs = (licIdx().codes.get(licence) || []).slice(0, 8); return rs.length ? `<span class="codes">${rs.map((r) => `<button type="button" data-go="${esc(r[N.code])}" title="${esc(r[N.zh] || r[N.en])}">${esc(r[N.code])}${r[N.price] > 0 ? ' $' + fmtP(r[N.price]) : ''}</button>`).join('')}</span>` : ''; };

/* ---------- NHI usage ---------- */
let usageD = null, usageP = null;
function loadUsage() { if (!usageP) usageP = TW.usage().then((d) => (usageD = d)).catch((e) => { usageP = null; throw e; }); return usageP; }
const fmtN = (n) => (RT.lang === 'en'
  ? (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(0) + 'k' : n.toLocaleString())
  : (n >= 1e8 ? (n / 1e8).toFixed(2) + ' 億' : n >= 1e4 ? (n / 1e4).toFixed(1) + ' 萬' : n.toLocaleString()));
async function drawUsage(box, r) {
  if (!box) return;
  try { await Promise.all([loadUsage(), loadAll()]); } catch (e) { box.innerHTML = `<p class="hint">${T('無法取得用量資料。', 'Could not load the usage data.')}</p>`; return; }
  const ys = usageD.years, mine = usageD.q[r[N.code]];
  if (!ys.length) { box.innerHTML = `<p class="hint">${T('還沒有用量資料。', 'No usage data yet.')}</p>`; return; }
  const span = `${ys[0].year}–${ys[ys.length - 1].year}`;
  if (!mine || !mine.some((x) => x && x[0])) { box.innerHTML = `<p class="hint">${T(`這個健保代號在 ${span} 年沒有申報用量。`, `No claims for this NHI code in ${span}.`)}</p>`; return; }
  // the same ATC code: this item's share of all claims for that ingredient
  const peers = r[N.atc] ? nhiD.rows.filter((x) => x[N.atc] === r[N.atc]).map((x) => usageD.q[x[N.code]]).filter(Boolean) : [];
  const atcTot = ys.map((_, i) => peers.reduce((s, p) => s + ((p[i] || [0])[0] || 0), 0));
  const max = Math.max(...mine.map((x) => (x ? x[0] : 0)), 1);
  const cols = ys.map((y, i) => {
    const [t, m] = mine[i] || [0, 0], f = Math.max(0, t - m);
    return `<div class="ucol${y.partial ? ' part' : ''}" style="--i:${i}" title="${y.year}${y.partial ? T(`（到 ${y.to}）`, ` (to ${y.to})`) : ''}"><span class="val">${t ? fmtN(t) : '0'}</span><span class="stack" style="height:${((t / max) * 100).toFixed(1)}%"><i class="f" style="flex:${f}"></i><i class="m" style="flex:${m}"></i></span></div>`;
  }).join('');
  box.innerHTML = `<div class="ubars" role="img" aria-label="${T('各年醫令量', 'Claims per year')}">${cols}</div>
    <div class="uyears">${ys.map((y) => `<span>${y.year}${y.partial ? '*' : ''}</span>`).join('')}</div>
    <div class="legend" style="margin-top:8px"><span><span class="dot" style="background:var(--accent)"></span> ${T('男性', 'Men')}</span><span><span class="dot" style="background:var(--c-bio)"></span> ${T('女性', 'Women')}</span></div>
    <table class="utbl"><thead><tr><th>${T('年', 'Year')}</th><th>${T('醫令量', 'Claims')}</th><th>${T('男 / 女', 'Men / women')}</th>${r[N.atc] ? `<th>${T('佔同 ATC', 'Share of ATC')}</th>` : ''}</tr></thead><tbody>
    ${ys.map((y, i) => { const [t, m] = mine[i] || [0, 0]; return `<tr><td>${y.year}${y.partial ? T(`（1–${+y.to.slice(5)} 月）`, ` (Jan–${y.to.slice(5)})`) : ''}</td><td>${t.toLocaleString()}</td><td>${t ? Math.round((m / t) * 100) + '% / ' + (100 - Math.round((m / t) * 100)) + '%' : '—'}</td>${r[N.atc] ? `<td>${atcTot[i] ? (t && t / atcTot[i] < 0.001 ? '<0.1%' : ((t / atcTot[i]) * 100).toFixed(1) + '%') : '—'}</td>` : ''}</tr>`; }).join('')}
    </tbody></table>
    <p class="note">${T(`醫令量是健保申報的數量（含包裹支付），單位依品項而定，例如錠、支、瓶。* 為當年度部分月份。「佔同 ATC」是同一個 ATC 代碼（${esc(r[N.atc])}）所有健保代號中，這個代號的醫令量比例；不同劑型、含量的單位不同，比例僅供參考。資料來源：健保署「健保藥品使用量」。`, `Claims are NHI quantities including bundled payments, in each item’s own unit (tablet, vial, bottle…). * marks a partial year. “Share of ATC” is this code’s part of all NHI codes with ATC ${esc(r[N.atc])}; units differ between forms and strengths, so read it as a rough guide. Source: NHIA drug usage data.`)}</p>`;
  box.insertAdjacentHTML('beforeend', shareHTML(r));
  enterOnce(box.querySelector('.ubars'), 'u:' + r[N.code]);
}


/* ---------- A. the drug's life on one line ---------- */
const TL_KIND = {
  lic: ['許可證', 'Licence'], list: ['收載／恢復給付', 'Listed'], down: ['調降', 'Price cut'], up: ['調升', 'Price rise'],
  rule: ['給付規定修訂', 'Rule revised'], short: ['缺藥', 'Shortage'], back: ['恢復供應', 'Back in supply'], recall: ['回收', 'Recall'], safety: ['安全資訊', 'Safety notice'], off: ['取消給付／許可證註銷', 'Delisted / licence cancelled'],
};
const TL_COLOR = { lic: 'var(--accent)', list: 'var(--accent)', down: 'var(--c-babe)', up: 'var(--c-orig)', rule: 'var(--c-bio)', short: 'var(--c-off)', back: 'var(--c-babe)', recall: 'var(--c-orig)', safety: 'var(--warn-text)', off: 'var(--muted)' };
// price and events in one picture: the price as a step line with its changes marked on it,
// and a lane above for what does not move the price (licence, rules, shortages, recalls)
const TL_LANE = new Set(['lic', 'rule', 'short', 'back', 'recall', 'safety']);
async function drawTimeline(box, r) {
  if (!box) return;
  let h = [];
  try { [h] = await Promise.all([TW.hist(r[N.code]), loadAlerts(), loadSafety()]); } catch (e) { h = []; }
  if (!box.isConnected) return;
  const f = licOf(r), ev = [], today = new Date().toISOString().slice(0, 10);
  const add = (date, kind, label, end, p) => { const d = String(date || '').slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today) ev.push({ date: d, kind, label, end, p }); };
  if (f) add(f[F.issued], 'lic', T('許可證核發', 'Licence issued') + ' · ' + f[F.licence]);
  // no recorded change: the current price since it took effect
  let pts = h.filter((x) => x.date);
  if (!pts.length && r[N.price] > 0) pts = [{ date: r[N.priceSince] || r[N.firstListed], price: r[N.price] }].filter((x) => x.date);
  add(r[N.firstListed], 'list', T('健保收載', 'NHI listing') + (pts[0] && pts[0].price > 0 ? ` · $${fmtP(pts[0].price)}` : ''), null, pts[0] && pts[0].price > 0 ? pts[0].price : null);
  pts.forEach((x, i) => {
    if (!i) return;
    const o = pts[i - 1].price, p = x.price;
    if (!(p > 0)) add(x.date, 'off', T('取消給付', 'Delisted'), null, o > 0 ? o : null);
    else if (!(o > 0)) add(x.date, 'list', T(`恢復給付 · $${fmtP(p)}`, `Relisted · $${fmtP(p)}`), null, p);
    else if (p !== o) add(x.date, p < o ? 'down' : 'up', `$${fmtP(o)} → $${fmtP(p)}（${p > o ? '+' : ''}${(((p - o) / o) * 100).toFixed(1)}%）`, null, p);
  });
  if (r[N.ruleChapters]) r[N.ruleChapters].split(',').filter(Boolean).forEach((c) => { const fl = ruleFile(r, c); if (fl) add(TW.ruleDate(fl), 'rule', T(`給付規定 ${c} 修訂`, `Rule ${c} revised`)); });
  if (f && f[F.status]) add(f[F.cancelDate], 'off', T('許可證', 'Licence ') + f[F.status]);
  if (f && alertsD) {
    const sh = alertsD.short[f[F.licence]], bk = alertsD.recovered[f[F.licence]];
    if (sh) add(sh[0], 'short', T('食藥署公告缺藥，至今未恢復', 'TFDA shortage notice, still short'), today);
    if (bk) add(bk[0], 'back', T('恢復供應', 'Back in supply'));
    (alertsD.recalls[f[F.licence]] || []).forEach((x) => add(x[0], 'recall', T('回收', 'Recall') + ' · ' + GRADE(x[1])));
  }
  safetyOf(r[N.ingredient], r[N.atc]).forEach((c) => add(c[0], 'safety', T('食藥署安全資訊', 'TFDA safety notice') + ' · ' + firstLine(c[1])));
  if (!ev.length) { box.innerHTML = ''; return; }
  ev.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  // drawn at the box's own width, so marks and labels keep their size on a phone
  const W = Math.max(280, Math.round(box.clientWidth || 640)), Hh = 158, L = 52, R = 14, LANE = 14, P0 = 40, P1 = 118, AX = 128;
  const t = (d) => new Date(d).getTime();
  let x0 = Math.min(t(ev[0].date), pts.length ? t(pts[0].date) : Infinity), x1 = t(today);
  if (x1 - x0 < 3e10) x0 = x1 - 3e10;                 // at least about a year wide
  const X = (d) => L + ((t(d) - x0) / (x1 - x0)) * (W - L - R);
  const paid = pts.map((x) => x.price).filter((p) => p > 0);
  const pmax = paid.length ? Math.max(...paid) : 0, pmin = paid.length ? Math.min(...paid) : 0;
  const ylo = pmin === pmax ? pmin * 0.7 : Math.max(0, pmin - (pmax - pmin) * 0.18), yhi = pmin === pmax ? pmax * 1.3 || 1 : pmax + (pmax - pmin) * 0.12;
  const Y = (p) => (paid.length && p > 0 ? P1 - ((p - ylo) / (yhi - ylo)) * (P1 - P0) : (P0 + P1) / 2);
  const inLane = (e) => TL_LANE.has(e.kind) || e.p == null;
  ev.forEach((e, i) => { e.i = i; e.x = X(e.date); e.y = inLane(e) ? LANE : Y(e.p); });
  // the step line
  let line = '';
  pts.forEach((x, i) => {
    const xx = Math.max(L, X(x.date)).toFixed(1), yy = Y(x.price).toFixed(1);
    if (x.price > 0) line += i && pts[i - 1].price > 0 ? ` H${xx} V${yy}` : ` M${xx} ${yy}`;
  });
  if (pts.length && pts[pts.length - 1].price > 0) line += ` H${W - R}`;
  // marks that would sit on top of each other are drawn once, with how many there are
  const groups = [];
  [...ev.filter(inLane), ...ev.filter((e) => !inLane(e))].forEach((e) => {
    const g = e.kind === 'short' ? null : groups.find((q) => q.lane === inLane(e) && q.kind !== 'short' && Math.abs(q.x - e.x) < 9 && Math.abs(q.y - e.y) < 7);
    if (g) { g.n++; g.e = e; } else groups.push({ x: e.x, y: e.y, lane: inLane(e), kind: e.kind, e, n: 1 });
  });
  const shape = (e, x, y) => {
    const X1 = x.toFixed(1), Y1 = y.toFixed(1);
    if (e.kind === 'short') { const w = Math.max(3, X(e.end) - x).toFixed(1); return `<rect class="e-short" x="${X1}" y="${y - 4}" width="${w}" height="8" rx="2"/>`; }
    if (e.kind === 'rule') return `<path class="e-rule" d="M${X1} ${y - 6} l6 6 -6 6 -6 -6z"/>`;
    if (e.kind === 'recall') return `<rect class="e-recall" x="${(x - 4.5).toFixed(1)}" y="${y - 4.5}" width="9" height="9" rx="1.5"/>`;
    if (e.kind === 'down') return `<path class="e-down" d="M${(x - 5.5).toFixed(1)} ${y - 9} h11 l-5.5 8z"/>`;
    if (e.kind === 'up') return `<path class="e-up" d="M${(x - 5.5).toFixed(1)} ${y + 9} h11 l-5.5 -8z"/>`;
    if (e.kind === 'off') return `<path class="e-off" d="M${(x - 4).toFixed(1)} ${y - 4} l8 8 M${(x + 4).toFixed(1)} ${y - 4} l-8 8"/>`;
    return `<circle class="e-${e.kind}" cx="${X1}" cy="${Y1}" r="${e.kind === 'lic' || e.kind === 'list' ? 5 : 4}"/>`;
  };
  const mark = (g) => {
    const e = g.e, hit = e.kind === 'short' ? `<rect class="hit" x="${g.x.toFixed(1)}" y="${g.y - 10}" width="${Math.max(16, X(e.end) - g.x).toFixed(1)}" height="20"/>` : `<circle class="hit" cx="${g.x.toFixed(1)}" cy="${(e.kind === 'down' ? g.y - 5 : e.kind === 'up' ? g.y + 5 : g.y).toFixed(1)}" r="11"/>`;
    const cnt = g.n > 1 ? `<circle class="cnt" cx="${(g.x + 8).toFixed(1)}" cy="${(g.y - 8).toFixed(1)}" r="6.5"/><text class="cnt-t" x="${(g.x + 8).toFixed(1)}" y="${(g.y - 5).toFixed(1)}" text-anchor="middle">${g.n}</text>` : '';
    return `<g class="ev" data-i="${e.i}" tabindex="0" role="button" aria-label="${esc(e.date + ' ' + e.label)}${g.n > 1 ? T(`，附近另有 ${g.n - 1} 件`, `, and ${g.n - 1} more nearby`) : ''}">${hit}${shape(e, g.x, g.y)}${cnt}</g>`;
  };
  const ya = new Date(x0).getFullYear(), yb = new Date(x1).getFullYear(), step = Math.max(1, Math.ceil((yb - ya) / Math.max(3, Math.floor((W - L) / 90))));
  const yrs = []; for (let y = Math.ceil(ya / step) * step; y <= yb; y += step) if (t(`${y}-01-01`) > x0) yrs.push(y);
  const guides = groups.filter((g) => g.lane).map((g) => `<line class="guide" x1="${g.x.toFixed(1)}" x2="${g.x.toFixed(1)}" y1="${LANE + 7}" y2="${AX}"/>`).join('');
  const kinds = Object.keys(TL_KIND).filter((k) => ev.some((e) => e.kind === k));
  const latest = ev.slice().reverse();
  const yl = paid.length ? (pmin === pmax ? [pmax] : [pmax, pmin]) : [];
  box.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="${T(`價格與事件：${ev.length} 個事件，從 ${ev[0].date} 到今天${paid.length ? `，支付價 $${fmtP(pmin)}–$${fmtP(pmax)}` : ''}`, `Price and events: ${ev.length} events from ${ev[0].date} to today${paid.length ? `, price $${fmtP(pmin)}–$${fmtP(pmax)}` : ''}`)}">
      <text class="lane-l" x="${L - 8}" y="${LANE + 4}" text-anchor="end">${T('事件', 'Events')}</text>
      <line class="lane" x1="${L}" x2="${W - R}" y1="${LANE}" y2="${LANE}"/>
      ${yl.map((p) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(p).toFixed(1)}" y2="${Y(p).toFixed(1)}"/><text class="ylab" x="${L - 8}" y="${(Y(p) + 4).toFixed(1)}" text-anchor="end">$${fmtP(p)}</text>`).join('')}
      <line class="ax" x1="${L}" x2="${W - R}" y1="${AX}" y2="${AX}"/>
      ${yrs.map((y) => { const x = X(`${y}-01-01`).toFixed(1); return `<line class="ax" x1="${x}" x2="${x}" y1="${AX}" y2="${AX + 4}"/><text class="yr" x="${x}" y="${Hh - 6}" text-anchor="middle">${y}</text>`; }).join('')}
      ${guides}
      ${line ? `<path class="pl" pathLength="1" d="${line.trim()}"/>` : ''}
      ${groups.map(mark).join('')}
    </svg>
    <div class="legend">${kinds.map((k) => `<span><span class="dot" style="background:${TL_COLOR[k]}"></span> ${T(TL_KIND[k][0], TL_KIND[k][1])} <b>${ev.filter((e) => e.kind === k).length}</b></span>`).join('')}<span class="tl-hint">${T('點圖示看說明', 'Tap a mark for details')}</span></div>
    <details><summary>${T(`最近：${esc(latest[0].date)} ${esc(latest[0].label)}（全部 ${ev.length} 個事件）`, `Latest: ${esc(latest[0].date)} ${esc(latest[0].label)} (all ${ev.length} events)`)}</summary>
      <ol>${latest.slice(0, 80).map((e) => `<li><span class="d">${esc(e.date)}</span><span><span class="dot" style="background:${TL_COLOR[e.kind]}"></span> ${esc(e.label)}</span></li>`).join('')}</ol></details>`;
  enterOnce(box, 't:' + r[N.code]);
  box._tl = { ev, today };
  box.onclick = (x) => { const g = x.target.closest('.ev'); if (g) { x.stopPropagation(); tlPop(box, g); } else if (x.target.closest('[data-tlx]')) tlClose(true); };
  box.onkeydown = (x) => { const g = x.target.closest('.ev'); if (g && (x.key === 'Enter' || x.key === ' ')) { x.preventDefault(); tlPop(box, g); } };
}
// the small note for one mark, and any others drawn on top of it
let tlOpen = null;
function tlClose(refocus) {
  if (!tlOpen) return;
  const { pop, g } = tlOpen; tlOpen = null;
  pop.remove(); g.classList.remove('on'); g.setAttribute('aria-expanded', 'false');
  if (refocus && g.isConnected) g.focus();
}
function tlPop(box, g) {
  const same = tlOpen && tlOpen.g === g;
  tlClose(false);
  if (same) return;
  const { ev, today } = box._tl, e = ev[+g.dataset.i];
  const near = ev.filter((o) => Math.abs(o.x - e.x) < 9 && Math.abs(o.y - e.y) < 7).sort((a, b) => (a.date < b.date ? -1 : 1));
  const span = (a) => {
    const d = Math.round((new Date(today) - new Date(a)) / 864e5);
    if (d < 365) return T(`${d} 天`, `${d} day${d === 1 ? '' : 's'}`);
    const y = (d / 365.25).toFixed(1);
    return T(`約 ${y} 年`, `about ${y} years`);
  };
  const pop = document.createElement('div');
  pop.className = 'tl-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', T('事件說明', 'Event details'));
  pop.innerHTML = `<button type="button" class="icon" data-tlx aria-label="${T('關閉', 'Close')}">×</button>` + near.map((o) => `<div class="it">
      <div class="k"><span class="dot" style="background:${TL_COLOR[o.kind]}"></span><b>${T(...TL_KIND[o.kind])}</b><span class="d">${esc(o.date)}</span></div>
      <div>${esc(o.label)}</div>
      <div class="d">${o.kind === 'short' ? T(`至今 ${span(o.date)}`, `${span(o.date)} so far`) : T(`${span(o.date)}前`, `${span(o.date)} ago`)}</div>
    </div>`).join('');
  box.appendChild(pop);
  // under the mark, kept inside the box
  const br = box.getBoundingClientRect(), mr = g.getBoundingClientRect(), pw = pop.offsetWidth;
  pop.style.left = Math.max(0, Math.min(br.width - pw, mr.left + mr.width / 2 - br.left - pw / 2)) + 'px';
  pop.style.top = (mr.bottom - br.top + 6) + 'px';
  g.classList.add('on'); g.setAttribute('aria-expanded', 'true');
  tlOpen = { pop, g };
}
document.addEventListener('click', (x) => { if (tlOpen && !x.target.closest('.tl-pop')) tlClose(false); });
document.addEventListener('keydown', (x) => { if (x.key === 'Escape' && tlOpen) tlClose(true); });

/* ---------- B. share of the same price group (same ingredient, strength and form) ---------- */
function shareHTML(r) {
  if (!r[N.group] || !usageD || !usageD.years.length) return '';
  const ys = usageD.years, me = r[N.code].slice(0, 8), prods = new Map();
  nhiD.rows.forEach((x) => {
    if (x[N.group] !== r[N.group]) return;
    const q = usageD.q[x[N.code]]; if (!q) return;
    const k = x[N.code].slice(0, 8);                 // the 00 and G0 packs of one product count together
    const p = prods.get(k) || { k, code: x[N.code], name: x[N.zh] || x[N.en], cls: x[N.class], y: ys.map(() => 0) };
    if (x === r) p.code = r[N.code];
    q.forEach((v, i) => { p.y[i] += (v && v[0]) || 0; });
    prods.set(k, p);
  });
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const list = [...prods.values()].filter((p) => sum(p.y) > 0).sort((a, b) => sum(b.y) - sum(a.y));
  if (list.length < 2) return '';
  let top = list.slice(0, 6);
  if (!top.some((p) => p.k === me)) { const mine = list.find((p) => p.k === me); if (mine) top = list.slice(0, 5).concat([mine]); }
  const rest = list.filter((p) => !top.includes(p));
  const segs = rest.length ? top.concat([{ k: '', other: true, name: T(`其他 ${rest.length} 項`, `${rest.length} others`), y: ys.map((_, i) => sum(rest.map((p) => p.y[i]))) }]) : top;
  // products of the same class share a colour, a step lighter each time
  const seen = {}; segs.forEach((p) => { const c = p.other ? 'none' : CLS_KEY[p.cls] || 'none'; p.key = c; p.op = p.other ? 1 : [1, 0.72, 0.5, 0.36][Math.min(3, (seen[c] = (seen[c] || 0) + 1) - 1)]; });
  const tot = ys.map((_, i) => sum(segs.map((p) => p.y[i])));
  const li = ys.map((y, i) => (!y.partial && tot[i] ? i : -1)).filter((i) => i >= 0).pop() ?? ys.length - 1;
  const pct = (p, i) => (tot[i] ? (p.y[i] / tot[i]) * 100 : 0);
  return `<h3 class="sec">${T('同分組市占', 'Share within the price group')} <small>${esc(r[N.group])}</small></h3>
    <div class="share" role="img" aria-label="${T('同分組各品項每年醫令量占比', 'Share of claims per product and year')}">${ys.map((y, i) => `<div class="sh-row"><span>${y.year}${y.partial ? '*' : ''}</span><span class="sh-bar">${segs.map((p) => (p.y[i] ? `<i class="k-${p.key}${p.k === me ? ' me' : ''}" style="width:${pct(p, i).toFixed(2)}%;opacity:${p.op}" title="${esc(p.name)} ${pct(p, i).toFixed(1)}%"></i>` : '')).join('')}</span></div>`).join('')}</div>
    <ul class="sh-leg">${segs.map((p) => `<li class="${p.k === me ? 'me' : ''}"><span class="dot k-${p.key}" style="opacity:${p.op}"></span>${p.other ? `<span>${esc(p.name)}</span>` : `<button type="button" data-go="${esc(p.code)}" title="${esc(p.name)}">${esc(p.name)}${p.k === me ? T('（本品）', ' (this one)') : ''}</button>`}<b>${pct(p, li).toFixed(1)}%</b></li>`).join('')}</ul>
    <p class="note">${T(`健保「分類分組」是同成分、同含量、同劑型的一組藥，單位一致，所以占比可以直接比較。右側百分比是 ${ys[li].year} 年；同一品項的 00 與 G0 包裝合併計算，顏色依藥品分類。`, `An NHI price group is one ingredient at one strength and form, so the units match and the shares compare directly. Percentages on the right are for ${ys[li].year}; the 00 and G0 packs of a product are counted together; colours follow the drug class.`)}</p>`;
}

/* ---------- C. new shortages, recoveries or recalls per month ---------- */
function calHTML(dates, sel, tone) {
  const Y = new Date().getFullYear(), M = new Date().getMonth() + 1, cnt = {};
  dates.forEach((d) => { const m = String(d || '').slice(0, 7); if (m) cnt[m] = (cnt[m] || 0) + 1; });
  const years = [Y - 2, Y - 1, Y], key = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
  const max = Math.max(1, ...years.flatMap((y) => Array.from({ length: 12 }, (_, i) => cnt[key(y, i + 1)] || 0)));
  const cell = (y, m) => {
    const k = key(y, m), n = cnt[k] || 0;
    if (y === Y && m > M) return '<span class="c" aria-hidden="true"></span>';
    const lv = n ? 1 + Math.min(3, Math.floor((n / max) * 4)) : 0;
    return `<button type="button" class="c${lv ? ' l' + lv : ''}" data-amonth="${k}" aria-pressed="${sel === k}" title="${k}：${n}" aria-label="${k} ${n}"></button>`;
  };
  return `<div class="cal ${tone}" role="group" aria-label="${T('每月件數', 'Count per month')}"><span></span>${Array.from({ length: 12 }, (_, i) => `<span class="h">${i + 1}</span>`).join('')}
    ${years.map((y) => `<span>${y}</span>${Array.from({ length: 12 }, (_, i) => cell(y, i + 1)).join('')}`).join('')}</div>`;
}

/* ---------- D. an ATC class over the years ---------- */
function classPrefix(rows) {
  const norm = (p) => (p.length === 6 ? p.slice(0, 5) : p.length === 2 ? p.slice(0, 1) : p);
  const c = chips.find((x) => x.k === 'atc'); if (c && c.v.length >= 3) return norm(c.v);
  if (A().atc && A().atc.trim().length >= 3) return norm(A().atc.trim().toUpperCase());
  const a = rows.map((r) => r[N.atc]).filter(Boolean);
  if (a.length < 2 || a.length < rows.length * 0.9) return '';
  let p = a[0];
  for (const x of a) { while (p && !x.startsWith(p)) p = p.slice(0, -1); if (p.length < 4) return ''; }
  return norm(p);
}
const ctrCache = new Map();
async function drawClassTrend(det) {
  const p = det.dataset.ctr, box = det.querySelector('[data-ctrbox]');
  if (!box) return;
  if (ctrCache.has(p)) { box.innerHTML = ctrCache.get(p); return; }
  box.innerHTML = `<p class="hint" style="margin:0">${T('載入歷年資料…', 'Loading the history…')}</p>`;
  let H;
  try { [, H] = await Promise.all([loadAll(), TW.histAll(), loadUsage()]); } catch (e) { box.innerHTML = `<p class="hint" style="margin:0">${T('暫時無法取得歷年資料。', 'The history is not available right now.')}</p>`; return; }
  const rows = nhiD.rows.filter((r) => r[N.atc].startsWith(p));
  const Y = new Date().getFullYear(), today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const series = rows.map((r) => {
    const hs = H.hist[r[N.code]];
    if (hs) return hs.split(';').map((x) => { const [d, v] = x.split(':'); return [d, +v]; });
    const since = (r[N.firstListed] || r[N.priceSince] || '').replace(/-/g, '');
    return r[N.price] > 0 && since ? [[since, r[N.price]]] : [];
  });
  const at = (ser, d) => { let v = 0; for (const [t, pr] of ser) { if (t <= d) v = pr; else break; } return v; };
  let snap = [];
  for (let y = Y - 14; y <= Y; y++) {
    const d = y === Y ? today : `${y}0701`;
    const ps = series.map((ser) => at(ser, d)).filter((v) => v > 0).sort((a, b) => a - b);
    const m = ps.length ? (ps.length % 2 ? ps[(ps.length - 1) / 2] : (ps[ps.length / 2 - 1] + ps[ps.length / 2]) / 2) : 0;
    snap.push({ y, n: ps.length, med: m, q: null, part: false });
  }
  usageD.years.forEach((u, i) => { const sn = snap.find((x) => x.y === u.year); if (sn) { sn.q = rows.reduce((a, r) => { const v = (usageD.q[r[N.code]] || [])[i]; return a + ((v && v[0]) || 0); }, 0); sn.part = u.partial; } });
  while (snap.length > 2 && !snap[0].n) snap.shift();
  if (!snap.some((x) => x.n)) { box.innerHTML = `<p class="hint" style="margin:0">${T('這個類別沒有價格紀錄。', 'No price records for this class.')}</p>`; return; }
  const n = snap.length, VW = 300, VH = 40, bw = VW / n;
  const bars = (vals, cls) => { const mx = Math.max(1, ...vals.map((v) => v || 0)); return vals.map((v, i) => (v == null ? '' : `<rect class="${cls(i)}" x="${(i * bw + bw * 0.15).toFixed(2)}" y="${(VH - Math.max(1, (v / mx) * VH)).toFixed(2)}" width="${(bw * 0.7).toFixed(2)}" height="${Math.max(1, (v / mx) * VH).toFixed(2)}"><title>${snap[i].y}${snap[i].part ? '*' : ''}: ${v.toLocaleString()}</title></rect>`)).join(''); };
  const mx = Math.max(...snap.map((x) => x.med), 0.01), mn = Math.min(...snap.filter((x) => x.med).map((x) => x.med), mx);
  const lo = mn < mx * 0.4 ? 0 : mn * 0.9, Yp = (v) => (VH - 3 - ((v - lo) / (mx - lo || 1)) * (VH - 6)).toFixed(2);
  const line = snap.map((x, i) => (x.med ? `${i && snap[i - 1].med ? 'L' : 'M'}${(i * bw + bw / 2).toFixed(2)} ${Yp(x.med)}` : '')).join(' ');
  const lastQ = snap.filter((x) => x.q != null && !x.part).pop(), last = snap[n - 1];
  const svg = (inner, label) => `<svg viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="none" role="img" aria-label="${label}">${inner}</svg>`;
  const html = `<div class="ctr-row"><span class="k">${T('給付品項數', 'Items paid')}</span>${svg(bars(snap.map((x) => x.n), () => ''), T('各年給付品項數', 'Items paid per year'))}<span class="v">${last.n.toLocaleString()}</span></div>
    <div class="ctr-row"><span class="k">${T('支付價中位數', 'Median price')}</span>${svg(`<line class="base" x1="0" x2="${VW}" y1="${VH - 0.5}" y2="${VH - 0.5}"/><path class="ln" pathLength="1" d="${line}"/>${snap.map((x, i) => (x.med ? `<rect x="${(i * bw).toFixed(2)}" y="0" width="${bw.toFixed(2)}" height="${VH}" class="hit"><title>${x.y}: $${fmtP(x.med)}</title></rect>` : '')).join('')}`, T('各年支付價中位數', 'Median price per year'))}<span class="v">$${fmtP(last.med)}</span></div>
    ${snap.some((x) => x.q) ? `<div class="ctr-row"><span class="k">${T('醫令量', 'Claims')}</span>${svg(bars(snap.map((x) => x.q), (i) => (snap[i].part ? 'part' : '')), T('各年醫令量', 'Claims per year'))}<span class="v">${lastQ ? fmtN(lastQ.q) : '—'}</span></div>` : ''}
    <div class="ctr-ax"><span></span><span class="yrs">${snap.map((x, i) => { const step = Math.ceil(n / 6); return `<span${(n - 1 - i) % step ? ' class="off"' : ''}>${x.y}</span>`; }).join('')}</span><span></span></div>
    <p class="note">${T(`ATC ${esc(p)} 共 ${rows.length} 個健保代號（含已取消給付）。品項數與價格中位數取每年 7 月 1 日（今年為今天）的狀態；不同含量、劑型混在一起，只看大方向。醫令量 * 為部分月份。`, `ATC ${esc(p)}: ${rows.length} NHI codes, delisted ones included. Item counts and median prices are as of 1 July each year (today for this year); strengths and forms are mixed, so read the direction only. * marks a partial year of claims.`)}</p>`;
  ctrCache.set(p, html);
  if (det.isConnected) { box.innerHTML = html; enterOnce(box, 'c:' + p); }
}

/* ---------- views ---------- */
const VIEWS = ['search', 'changes', 'alerts', 'rules', 'pill', 'batch'];
const NEWS = ['changes', 'alerts', 'rules'];
function setView(v, quiet) {
  if (v === 'news') v = NEWS.includes(S.newsSub) ? S.newsSub : 'changes';
  if (!VIEWS.includes(v)) v = 'search';
  S.view = v; if (NEWS.includes(v)) S.newsSub = v; save();
  const top = NEWS.includes(v) ? 'news' : v;
  $('views').querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === top)));
  $('newsBar').hidden = !NEWS.includes(v);
  $('newsBar').querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === v)));
  $('vSearch').hidden = v !== 'search'; $('vChanges').hidden = v !== 'changes'; $('vAlerts').hidden = v !== 'alerts'; $('vRules').hidden = v !== 'rules'; $('vBatch').hidden = v !== 'batch'; $('vPill').hidden = v !== 'pill';
  if (v === 'changes') renderChanges(); else if (v === 'alerts') renderAlerts(); else if (v === 'rules') renderRulesView(); else if (v === 'batch') renderBatch(); else if (v === 'pill') renderPill();
  if (!quiet) sync();
}
$('views').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) { leaveSheet(); setView(b.dataset.view); window.scrollTo({ top: 0 }); } });
$('newsBar').addEventListener('click', (e) => { const b = e.target.closest('[data-view]'); if (b) setView(b.dataset.view); });
// help: the ? button or the ? key
$('btnHelp').onclick = () => $('helpDlg').showModal();
$('helpClose').onclick = () => $('helpDlg').close();
$('helpDlg').addEventListener('click', (e) => { if (e.target === $('helpDlg')) $('helpDlg').close(); });
document.addEventListener('keydown', (e) => { if (e.key === '?' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { e.preventDefault(); $('helpDlg').showModal(); } });
// a drug named in any view opens in the search view
['vChanges', 'vAlerts', 'vRules', 'vBatch'].forEach((id) => $(id).addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]'); if (!g) return;
  setView('search', true); goCode(g.dataset.go);
}));
const loadingBox = (id) => { $(id).innerHTML = `<div class="loading">${T('載入中…', 'Loading…')}</div>`; };
const nameOf = (code) => { const r = nhiD.byCode.get(code); return r ? (r[N.zh] || r[N.en]) : code; };
const drugBtn = (code) => `<button type="button" data-go="${esc(code)}">${esc(nameOf(code))}</button>`;


/* batch lookup: a pasted list of codes, licence numbers, ATC codes or names, one result table */
const BATCH_MAX = 2000;
function batchItems(text) {
  const seen = new Set(), out = [];
  String(text || '').split(/[\n\r\t,;，；、]+/).map((s) => s.trim()).filter(Boolean).forEach((s) => { const k = TW.fold(s); if (!seen.has(k)) { seen.add(k); out.push(s); } });
  return out.slice(0, BATCH_MAX);
}
// one input → { kind, rows (NHI), lic (licence-only) }
function batchMatch(s) {
  const k = TW.fold(s).trim(), up = s.trim().toUpperCase();
  if (nhiD.byCode.has(up)) return { kind: 'code', rows: [nhiD.byCode.get(up)], lic: [] };
  if (/字第/.test(s)) {
    const f = licIdx().byNo.get(s.trim());
    if (f) { const rs = licIdx().codes.get(f[F.licence]) || []; return { kind: 'licence', rows: rs, lic: rs.length ? [] : [f] }; }
    return { kind: 'licence', rows: [], lic: [] };
  }
  if (ATC_RE.test(k)) { const rs = nhiD.rows.filter((r) => r[N.atc].toLowerCase().startsWith(k)); if (rs.length) return { kind: 'atc', rows: rs, lic: [] }; }
  // a name: the exact Chinese or English name first, else every item that has all its words
  const H = haystack();
  let rs = nhiD.rows.filter((r, i) => zF[i] === k || eF[i] === k);
  if (!rs.length) { const ts = k.split(/\s+/).filter(Boolean); rs = nhiD.rows.filter((r, i) => ts.every((t) => H[i].includes(t))); }
  let lic = [];
  if (!rs.length) { const L = licOnlyRows(), ts = k.split(/\s+/).filter(Boolean); lic = L.filter((f, i) => ts.every((t) => licHay[i].includes(t))); }
  return { kind: 'name', rows: rs, lic };
}
let batchRes = null;
const batchPaidFirst = (a, b) => (b[N.price] > 0) - (a[N.price] > 0) || (a[N.zh] || '').localeCompare(b[N.zh] || '', 'zh-Hant');
async function renderBatch() {
  const box = $('vBatch');
  if (!box.querySelector('#bq')) {
    box.innerHTML = `<div class="batch">
      <label for="bq" class="batch-l">${T('每行一個（也可以用逗號分開）：健保代號、許可證字號、ATC 碼或藥名、成分', 'One per line (or comma-separated): NHI codes, licence numbers, ATC codes, names or ingredients')}</label>
      <textarea id="bq" rows="7" spellcheck="false" placeholder="A009186100&#10;BC23743100&#10;C10AA05&#10;metformin"></textarea>
      <div class="batch-acts"><button type="button" class="primary" id="bGo">${T('查詢', 'Look up')}</button><button type="button" id="bClear">${T('清除', 'Clear')}</button><span class="hint" id="bCount" style="margin:0"></span></div>
      <div id="bOut"></div></div>`;
    const ta = $('bq'); ta.value = S.bq || '';
    const cnt = () => { const n = batchItems(ta.value).length; $('bCount').textContent = n ? T(`${n} 項${n >= BATCH_MAX ? `（上限 ${BATCH_MAX}）` : ''}`, `${n} items${n >= BATCH_MAX ? ` (limit ${BATCH_MAX})` : ''}`) : ''; };
    ta.oninput = RT.debounce(() => { S.bq = ta.value.length < 60000 ? ta.value : ''; save(); cnt(); }, 300);
    ta.onkeydown = (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runBatch(); } };
    $('bGo').onclick = runBatch;
    $('bClear').onclick = () => { ta.value = ''; S.bq = ''; save(); batchRes = null; $('bOut').innerHTML = ''; cnt(); ta.focus(); };
    cnt();
  }
  if (batchRes) drawBatch();
}
async function runBatch() {
  const items = batchItems($('bq').value);
  if (!items.length) { $('bOut').innerHTML = ''; return; }
  $('bOut').innerHTML = `<div class="loading">${T('載入完整資料中…', 'Loading the full lists…')}</div>`;
  try { await Promise.all([loadAll(), loadFdaAll()]); } catch (e) { $('bOut').innerHTML = `<div class="empty-state">${esc(e.message || e)}</div>`; return; }
  batchRes = items.map((s) => ({ s, ...batchMatch(s) }));
  drawBatch();
}
let batchOnlyMiss = false;
function drawBatch() {
  const res = batchRes, PER = 30;
  const one = res.filter((x) => x.rows.length + x.lic.length === 1).length, none = res.filter((x) => !x.rows.length && !x.lic.length).length, many = res.length - one - none;
  const shown = batchOnlyMiss ? res.filter((x) => x.rows.length + x.lic.length !== 1) : res;
  const kindName = { code: T('代號', 'code'), licence: T('許可證', 'licence'), atc: 'ATC', name: T('名稱', 'name') };
  const rowTr = (x, r, first, n) => `<tr${first ? ' class="first"' : ''}>${first ? `<td rowspan="${n}" class="bi"><b>${esc(x.s)}</b><small>${kindName[x.kind]}</small></td>` : ''}
    <td class="cd"><button type="button" data-go="${esc(r[N.code])}">${esc(r[N.code])}</button></td><td>${esc(r[N.zh] || r[N.en])}<small>${r[N.zh] ? esc(r[N.en]) : ''}</small></td>
    <td>${esc(r[N.ingredient])}</td><td class="cd">${esc(r[N.atc])}</td><td class="num">${r[N.price] > 0 ? '$' + fmtP(r[N.price]) : `<span class="tag off">${T('已取消給付', 'Delisted')}</span>`}</td></tr>`;
  const licTr = (x, f, first, n) => `<tr${first ? ' class="first"' : ''}>${first ? `<td rowspan="${n}" class="bi"><b>${esc(x.s)}</b><small>${kindName[x.kind]}</small></td>` : ''}
    <td class="cd">—</td><td>${esc(f[F.zh] || f[F.en])}<small>${esc(f[F.licence])}</small></td><td>${esc(f[F.ingredients])}</td><td class="cd"></td><td class="num"><span class="tag off">${T('無健保代號', 'No NHI code')}</span></td></tr>`;
  const body = shown.map((x) => {
    const rs = x.rows.slice().sort(batchPaidFirst), tot = rs.length + x.lic.length;
    if (!tot) return `<tr class="first miss"><td class="bi"><b>${esc(x.s)}</b><small>${kindName[x.kind]}</small></td><td colspan="5">${T('找不到', 'Not found')}</td></tr>`;
    const list = [...rs.slice(0, PER).map((r) => ['r', r]), ...x.lic.slice(0, Math.max(0, PER - rs.length)).map((f) => ['l', f])];
    const more = tot - list.length, n = list.length + (more > 0 ? 1 : 0);
    return list.map(([t, v], i) => (t === 'r' ? rowTr(x, v, i === 0, n) : licTr(x, v, i === 0, n))).join('')
      + (more > 0 ? `<tr><td colspan="5" class="hint">${T(`另有 ${more} 筆（匯出 CSV 會全部列出）`, `${more} more (all of them go into the CSV)`)}</td></tr>` : '');
  }).join('');
  $('bOut').innerHTML = `<div class="batch-sum"><span>${T(`共 ${res.length} 項：<b>${one}</b> 項對到一筆、<b>${many}</b> 項對到多筆、<b>${none}</b> 項找不到`, `${res.length} items: <b>${one}</b> one match, <b>${many}</b> several, <b>${none}</b> not found`)}</span>
      <label class="batch-miss"><input type="checkbox" id="bMiss"${batchOnlyMiss ? ' checked' : ''}> ${T('只看多筆或找不到的', 'Only several or not found')}</label>
      <span class="spacer"></span><button type="button" class="small" id="bCsv">${T('匯出 CSV', 'Export CSV')}</button><button type="button" class="small" id="bCl">${T('健保代號加入代碼清單', 'Add NHI codes to code list')}</button></div>
    <div class="batch-tbl"><table><thead><tr><th>${T('輸入', 'Input')}</th><th>${T('健保代號', 'NHI code')}</th><th>${T('名稱', 'Name')}</th><th>${T('成分', 'Ingredient')}</th><th>ATC</th><th class="num">${T('支付價', 'Price')}</th></tr></thead><tbody>${body}</tbody></table></div>`;
  $('bMiss').onchange = (e) => { batchOnlyMiss = e.target.checked; drawBatch(); };
  $('bCsv').onclick = () => {
    const rows = [];
    res.forEach((x) => {
      if (!x.rows.length && !x.lic.length) rows.push([x.s, '找不到', ...csvRow(null)]);
      x.rows.slice().sort(batchPaidFirst).forEach((r) => rows.push([x.s, x.rows.length + x.lic.length > 1 ? '多筆' : '符合', ...csvRow(r)]));
      x.lic.forEach((f) => rows.push([x.s, '無健保代號', '', f[F.zh], f[F.en], f[F.ingredients], '', f[F.form], '', '', '', '', '', '', '', '', f[F.applicant], f[F.maker], f[F.licence], f[F.status] || '有效', f[F.category], f[F.controlled], f[F.country]]));
    });
    RT.downloadCSV([['輸入', '比對結果', ...CSV_HEAD], ...rows], 'tw-drugs-batch.csv');
  };
  $('bCl').onclick = () => {
    const seen = new Set(), items = [];
    res.forEach((x) => x.rows.forEach((r) => { if (!seen.has(r[N.code])) { seen.add(r[N.code]); items.push(nhiItem(r)); } }));
    if (!items.length) { RT.toast(T('沒有健保代號可以加入', 'No NHI codes to add'), 3000); return; }
    if (items.length > 3000) { RT.toast(T('超過 3000 個代號，請分批', 'More than 3000 codes; split the list'), 4000); return; }
    toCodelist(items);
  };
}


/* pill finder: colour, shape, score line, imprint and size, from the TFDA appearance data */
const PILL_COL = [['白', 'White', '#f5f4f0'], ['黃', 'Yellow', '#f0d24a'], ['粉', 'Pink', '#f1a9c0'], ['橘', 'Orange', '#f09a4c'], ['紅', 'Red', '#d6463c'], ['藍', 'Blue', '#4b7fd6'], ['綠', 'Green', '#53ad6b'], ['棕', 'Brown', '#8b5a3c'], ['紫', 'Purple', '#8f6bcf'], ['灰', 'Grey', '#9b9b9b'], ['黑', 'Black', '#2a2a2a'], ['透明', 'Clear', '']];
const PILL_SHAPE = [['圓形', 'Round'], ['橢圓形', 'Oval'], ['膠囊', 'Capsule'], ['四邊形', 'Four-sided'], ['三角形', 'Triangle'], ['多邊形', 'Polygon'], ['水滴形', 'Teardrop'], ['雙圓形', 'Double round'], ['其他', 'Other']];
const PILL_SCORE = [['無', 'None'], ['直線', 'Line'], ['十字', 'Cross']];
const PILL_DEF = { col: [], shape: '', score: '', mark: '', size: '' };
const pillS = () => (S.pill = { ...PILL_DEF, ...(S.pill || {}) });
const normMark = (s) => String(s || '').toUpperCase().replace(/[\s/|;,.\-]+/g, '');
let pillIdx = null;
function pillIndex() {
  if (pillIdx && pillIdx.f === fdaD.rows.length && pillIdx.n === nhiD.rows.length) return pillIdx;
  const C = {}; extraD.lookCols.forEach((c, i) => (C[c] = i));
  const items = [], parts = (v) => String(v || '').split(';;;').map((x) => x.trim()).filter(Boolean);
  Object.entries(extraD.looks).forEach(([no, ls]) => {
    const f = licIdx().byNo.get(no); if (!f) return;
    const rs = (licIdx().codes.get(no) || []).slice().sort((a, b) => (b[N.price] > 0) - (a[N.price] > 0) || a[N.price] - b[N.price]);
    ls.forEach((l) => items.push({ no, f, rs, l, col: parts(l[C.colour]), shape: parts(l[C.shape]), score: parts(l[C.score]), mark: normMark([l[C.mark1], l[C.mark2]].join(' ')), size: parseFloat(l[C.size]) || null, C }));
  });
  pillIdx = { f: fdaD.rows.length, n: nhiD.rows.length, items };
  return pillIdx;
}
const shapeHit = (want, have) => have.some((h) => (want === '多邊形' ? /[五六八]邊形/.test(h) : want === '其他' ? /其他/.test(h) : h === want));
function pillSearch() {
  const p = pillS(), q = normMark(p.mark), sz = parseFloat(p.size);
  if (!p.col.length && !p.shape && !p.score && !q && !(sz > 0)) return null;
  return pillIndex().items.filter((it) => (!p.col.length || p.col.every((c) => it.col.includes(c)))
      && (!p.shape || shapeHit(p.shape, it.shape))
      && (!p.score || it.score.includes(p.score))
      && (!q || it.mark.includes(q))
      && (!(sz > 0) || (it.size && Math.abs(it.size - sz) <= 1)))
    .sort((a, b) => (q ? (b.mark.startsWith(q) - a.mark.startsWith(q)) || a.mark.length - b.mark.length : 0)
      || (b.rs.some((r) => r[N.price] > 0) - a.rs.some((r) => r[N.price] > 0))
      || String(a.f[F.zh] || a.f[F.en]).localeCompare(String(b.f[F.zh] || b.f[F.en]), 'zh-Hant'));
}
let pillShown = 60;
async function renderPill() {
  const box = $('vPill');
  if (!box.querySelector('.pill-f')) {
    const p = pillS();
    box.innerHTML = `<div class="pill-f">
      <p class="pill-lead">${T('手上有一顆不知道是什麼的藥？依外觀找：顏色、形狀、刻痕和藥上的字，條件越多越準。資料來自食藥署藥品外觀資料集，只涵蓋有登錄外觀的許可證。', 'Holding a pill you cannot name? Find it by how it looks: colour, shape, score line and the imprint. The more you give, the fewer matches. From the TFDA appearance dataset, so only licences with a recorded appearance are covered.')}</p>
      <div class="pf-row"><span class="pf-k">${T('顏色', 'Colour')}<small>${T('膠囊可選兩色', 'two for a capsule')}</small></span><div class="pf-v">${PILL_COL.map(([zh, en, hex]) => `<button type="button" class="sw" data-pcol="${zh}" aria-pressed="${p.col.includes(zh)}"><i style="${hex ? `background:${hex}` : ''}"${hex ? '' : ' class="clear"'}></i>${T(zh, en)}</button>`).join('')}</div></div>
      <div class="pf-row"><span class="pf-k">${T('形狀', 'Shape')}</span><div class="pf-v">${PILL_SHAPE.map(([zh, en]) => `<button type="button" class="pc" data-pshape="${zh}" aria-pressed="${p.shape === zh}">${T(zh, en)}</button>`).join('')}</div></div>
      <div class="pf-row"><span class="pf-k">${T('刻痕', 'Score line')}</span><div class="pf-v">${PILL_SCORE.map(([zh, en]) => `<button type="button" class="pc" data-pscore="${zh}" aria-pressed="${p.score === zh}">${T(zh, en)}</button>`).join('')}</div></div>
      <div class="pf-row"><span class="pf-k">${T('藥上的字', 'Imprint')}</span><div class="pf-v"><input id="pMark" autocomplete="off" spellcheck="false" placeholder="${T('例如 MF 1、SC B06', 'e.g. MF 1, SC B06')}" value="${esc(p.mark)}"><label class="pf-size">${T('大小約', 'About')} <input id="pSize" type="number" min="1" max="40" step="0.5" inputmode="decimal" value="${esc(p.size)}"> mm</label><button type="button" class="small" id="pClear">${T('清除', 'Clear')}</button></div></div>
    </div><div id="pOut"></div>`;
    box.addEventListener('click', (e) => {
      const p = pillS(), c = e.target.closest('[data-pcol]'), s = e.target.closest('[data-pshape]'), k = e.target.closest('[data-pscore]');
      if (c) { const v = c.dataset.pcol; p.col = p.col.includes(v) ? p.col.filter((x) => x !== v) : [...p.col, v].slice(-2); }
      else if (s) p.shape = p.shape === s.dataset.pshape ? '' : s.dataset.pshape;
      else if (k) p.score = p.score === k.dataset.pscore ? '' : k.dataset.pscore;
      else if (e.target.id === 'pClear') { S.pill = { ...PILL_DEF }; $('pMark').value = ''; $('pSize').value = ''; }
      else if (e.target.id === 'pMore') { pillShown += 60; drawPill(); return; }
      else {
        const g = e.target.closest('[data-pgo]'), l = e.target.closest('[data-plic]');
        if (g) { setView('search', true); goCode(g.dataset.pgo); } else if (l) goLic(l.dataset.plic);
        return;
      }
      box.querySelectorAll('[data-pcol]').forEach((b) => b.setAttribute('aria-pressed', String(pillS().col.includes(b.dataset.pcol))));
      box.querySelectorAll('[data-pshape]').forEach((b) => b.setAttribute('aria-pressed', String(pillS().shape === b.dataset.pshape)));
      box.querySelectorAll('[data-pscore]').forEach((b) => b.setAttribute('aria-pressed', String(pillS().score === b.dataset.pscore)));
      pillShown = 60; save(); drawPill();
    });
    const typed = RT.debounce(() => { pillS().mark = $('pMark').value; pillS().size = $('pSize').value; pillShown = 60; save(); drawPill(); }, 200);
    $('pMark').addEventListener('input', typed); $('pSize').addEventListener('input', typed);
  }
  $('pOut').innerHTML = `<div class="loading">${T('載入外觀資料中…', 'Loading the appearance data…')}</div>`;
  try { await Promise.all([loadAll(), loadFdaAll(), loadExtra()]); } catch (e) { $('pOut').innerHTML = `<div class="empty-state">${esc(e.message || e)}</div>`; return; }
  drawPill();
}
function drawPill() {
  if (!extraD || !fdaD || !fdaD.complete) return;
  const res = pillSearch();
  if (!res) { $('pOut').innerHTML = `<div class="empty-state">${T(`選一個顏色、形狀，或輸入藥上的字開始找（共 ${pillIndex().items.length.toLocaleString()} 種外觀）。`, `Pick a colour or shape, or type the imprint (${pillIndex().items.length.toLocaleString()} appearances).`)}</div>`; return; }
  if (!res.length) { $('pOut').innerHTML = `<div class="empty-state">${T('沒有符合的外觀。試著少選一個條件，或只輸入藥上字的一部分。', 'Nothing matches. Drop a condition, or type only part of the imprint.')}</div>`; return; }
  const card = (it) => {
    const l = it.l, C = it.C, ph = l[C.photo], r = it.rs[0];
    const lk = [l[C.colour], l[C.shape], l[C.size] ? l[C.size] + ' mm' : '', l[C.score] && !/^無/.test(l[C.score]) ? T('刻痕 ', 'score ') + l[C.score] : '', [l[C.mark1], l[C.mark2]].filter(Boolean).join(' / ')].filter(Boolean).join(' · ').replace(/;;;/g, '/');
    const go = r ? `data-pgo="${esc(r[N.code])}"` : `data-plic="${esc(it.no)}"`;
    return `<li><button type="button" class="row c" ${go}>
      <span class="card-ph${ph ? '' : ' noimg'}">${ph ? `<img src="${esc(mcp(ph))}" alt="" loading="lazy" decoding="async">` : `${formIcon(it.f[F.form])}<small>${T('沒有照片', 'No photo')}</small>`}</span>
      <span class="card-nm">${esc(it.f[F.zh] || it.f[F.en])}</span>
      <span class="card-lk">${esc(lk)}</span>
      <span class="card-lk">${esc(it.f[F.ingredients])}</span>
      <span class="card-pr">${r ? `<b>${r[N.price] > 0 ? '$' + fmtP(r[N.price]) : T('已取消給付', 'Delisted')}</b><span class="cd">${esc(r[N.code])}</span>` : `<span class="nop">${T('無健保價', 'No NHI price')}</span><span>${esc(catShort(it.f[F.category]))}</span>`}</span>
    </button></li>`;
  };
  $('pOut').innerHTML = `<p class="pill-n">${T(`符合 <b>${res.length.toLocaleString()}</b> 種外觀`, `<b>${res.length.toLocaleString()}</b> matching appearances`)}${res.length > pillShown ? T(`，先列 ${pillShown} 種`, `; the first ${pillShown} shown`) : ''}</p>
    <ul class="res cards">${res.slice(0, pillShown).map(card).join('')}</ul>${res.length > pillShown ? `<div class="more"><button type="button" id="pMore">${T('再顯示 60 種', 'Show 60 more')}</button></div>` : ''}
    <p class="note">${T('外觀相同的藥很多，請一定再核對藥名、劑量與藥袋，必要時詢問藥師。', 'Many drugs look alike: always check the name, strength and label, and ask a pharmacist when unsure.')}</p>`;
}
// open a licence that has no NHI code, from another view
async function goLic(no) {
  await Promise.all([loadAll(), loadFdaAll()]);
  setView('search', true); leaveSheet();
  chips = []; Q = no; $('q').value = no; shown = 50; open.clear(); openLic.clear();
  if (S.scope !== 'every' && S.scope !== 'lic') setScope('every', true);
  sync(); render(); window.scrollTo({ top: 0 });
  const li = licLi(no); if (li) openLicRow(li);
}

/* this week */
let changesD = null;
async function renderChanges() {
  loadingBox('vChanges');
  try { [changesD] = await Promise.all([changesD || TW.changes(), loadAll(), loadFdaAll(), loadAlerts()]); }
  catch (e) { $('vChanges').innerHTML = `<div class="empty-state">${esc(e.message || e)}</div>`; return; }
  const weeks = changesD.weeks || [];
  if (!weeks.length) {
    $('vChanges').innerHTML = `<div class="vhead"><h2>${T('本週異動', 'This week')}</h2></div><div class="empty-state">${T('還沒有異動紀錄。每週一更新資料時會和上一週比對，第一次比對完成後，新收載、調價、取消給付、新增缺藥與回收、給付規定改版都會列在這裡。', 'No changes recorded yet. Each Monday’s update is compared with the week before; after the first comparison, new listings, price changes, delistings, new shortages and recalls and revised rules appear here.')}</div>`;
    return;
  }
  const wi = Math.min(S.week || 0, weeks.length - 1), w = weeks[wi];
  const pct = (o, n) => ((n - o) / o) * 100;
  const moves = [...w.down, ...w.up].map(([c, o, n]) => pct(o, n));
  // histogram of price moves in 2.5% steps, clipped to ±30%
  const bins = new Map(); moves.forEach((p) => { const b = Math.max(-30, Math.min(30, Math.round(p / 2.5) * 2.5)); bins.set(b, (bins.get(b) || 0) + 1); });
  const keys = [...bins.keys()].sort((a, b) => a - b), hmax = Math.max(1, ...bins.values());
  const sec = S.wsec || 'all';
  const CARDS = [['added', '新收載', 'New listings'], ['down', '調降', 'Price cuts'], ['up', '調升', 'Price rises'], ['delisted', '取消給付', 'Delisted'], ['relisted', '恢復給付', 'Relisted'], ['rules', '給付規定改版', 'Rules revised'], ['newShort', '新增缺藥', 'New shortages'], ['resolved', '缺藥解除', 'Shortages ended'], ['newRecalls', '新增回收', 'New recalls']];
  const lic = licIdx();
  const licName = (l) => { const f = lic.byNo.get(l); return f ? (f[F.zh] || f[F.en]) : l; };
  const list = (k) => {
    const a = w[k] || [];
    if (!a.length) return '';
    let items = '';
    if (k === 'added') items = a.map(([c, p]) => `<li><span class="t">${drugBtn(c)}<span class="sub">${esc(c)}</span></span><span class="r">${p > 0 ? '$' + fmtP(p) : '—'}</span></li>`).join('');
    else if (k === 'down' || k === 'up') items = a.slice().sort((x, y) => pct(x[1], x[2]) - pct(y[1], y[2])).map(([c, o, n]) => `<li><span class="t">${drugBtn(c)}<span class="sub">${esc(c)}</span></span><span class="r">$${fmtP(o)} → $${fmtP(n)} <b class="${n < o ? 'dn-t' : 'up-t'}">${pct(o, n) > 0 ? '+' : ''}${pct(o, n).toFixed(1)}%</b></span></li>`).join('');
    else if (k === 'delisted') items = a.map(([c, o]) => `<li><span class="t">${drugBtn(c)}<span class="sub">${esc(c)}</span></span><span class="r">${T('原', 'was')} $${fmtP(o)}</span></li>`).join('');
    else if (k === 'relisted') items = a.map(([c, p]) => `<li><span class="t">${drugBtn(c)}<span class="sub">${esc(c)}</span></span><span class="r">$${fmtP(p)}</span></li>`).join('');
    else if (k === 'rules') items = a.map((f) => `<li><span class="t"><b>${esc(f.split('_')[0])}</b><span class="sub">${T('修訂日期', 'revised')} ${esc(TW.ruleDate(f))}</span></span><span class="r"><a href="${TW.ruleUrl(f)}" target="_blank" rel="noopener">PDF ↗</a></span></li>`).join('');
    else if (k === 'newShort' || k === 'resolved') items = a.map((l) => { const s = alertsD.short[l] || alertsD.recovered[l]; return `<li><span class="t"><b>${esc(s ? s[1] : licName(l))}</b><span class="sub">${esc(l)}</span>${codeBtns(l)}</span><span class="r">${esc(s ? s[0] : '')}</span>${s ? `<details><summary>${esc(firstLine(s[2]))}</summary><p>${esc(s[2])}</p></details>` : ''}</li>`; }).join('');
    else if (k === 'newRecalls') items = a.map(([l, d, g]) => `<li><span class="t"><b>${esc(licName(l))}</b><span class="sub">${esc(l)}</span>${codeBtns(l)}</span><span class="r">${esc(d)} · ${GRADE(g)}</span></li>`).join('');
    const c = CARDS.find((x) => x[0] === k);
    return `<h3 class="sec">${T(c[1], c[2])} <small>${a.length}</small></h3><ul class="wl">${items}</ul>`;
  };
  $('vChanges').innerHTML = `<div class="vhead"><h2>${T('本週異動', 'This week')}</h2><p>${esc(w.from)} → ${esc(w.to)}</p></div>
    ${weeks.length > 1 ? `<div class="pills" role="group" aria-label="${T('週次', 'Week')}">${weeks.map((x, i) => `<button type="button" data-week="${i}" aria-pressed="${i === wi}">${esc(x.to.slice(5))}</button>`).join('')}</div>` : ''}
    <div class="cards">${CARDS.map(([k, zh, en]) => `<button type="button" data-wsec="${k}" aria-pressed="${sec === k}" class="${(w[k] || []).length ? '' : 'zero'}"><b>${(w[k] || []).length}</b><span>${T(zh, en)}</span></button>`).join('')}</div>
    ${moves.length ? `<h3 class="sec">${T('調價幅度分布', 'Size of price changes')} <small>${T(`${moves.length} 項`, `${moves.length} items`)}</small></h3><div class="histo" role="img" aria-label="${T('調價幅度分布', 'Price change distribution')}">${keys.map((k) => `<i class="${k < 0 ? 'dn' : 'upb'}" style="height:${((bins.get(k) / hmax) * 100).toFixed(1)}%" title="${k > 0 ? '+' : ''}${k}%: ${bins.get(k)}"></i>`).join('')}</div><div class="histo-ax"><span>${keys[0] > 0 ? '+' : ''}${keys[0]}%</span><span>0</span><span>${keys[keys.length - 1] > 0 ? '+' : ''}${keys[keys.length - 1]}%</span></div>` : ''}
    ${(sec === 'all' ? CARDS.map((c) => c[0]) : [sec]).map(list).join('') || `<p class="hint">${T('這一類本週沒有異動。', 'Nothing in this group this week.')}</p>`}`;
}
$('vChanges').addEventListener('click', (e) => {
  const wk = e.target.closest('[data-week]'), sc = e.target.closest('[data-wsec]');
  if (wk) { S.week = +wk.dataset.week; S.wsec = 'all'; save(); renderChanges(); }
  else if (sc) { S.wsec = S.wsec === sc.dataset.wsec ? 'all' : sc.dataset.wsec; save(); renderChanges(); }
});

/* shortages and recalls */
const calBlock = (dates, tone, title) => `<h3 class="sec">${title} <small>${T('近三年', 'last three years')}</small></h3>${calHTML(dates, S.amonth || '', tone)}<p class="cal-note">${S.amonth ? `<button type="button" class="small" data-amonth="${esc(S.amonth)}">${T(`只看 ${esc(S.amonth)}　×`, `Only ${esc(S.amonth)}  ×`)}</button>` : T('點一格只看那個月。', 'Pick a month to list only that month.')}</p>`;
async function renderAlerts() {
  loadingBox('vAlerts');
  try { await Promise.all([loadAlerts(), loadFdaAll(), loadAll()]); } catch (e) { $('vAlerts').innerHTML = `<div class="empty-state">${esc(e.message || e)}</div>`; return; }
  if (!alertsD) { $('vAlerts').innerHTML = `<div class="empty-state">${T('缺藥與回收資料暫時無法取得。', 'Shortage and recall data are not available right now.')}</div>`; return; }
  const tab = S.atab || 'short', q = TW.fold(S.aq || '');
  const shorts = Object.entries(alertsD.short).sort((a, b) => (a[1][0] < b[1][0] ? 1 : -1));
  const backs = Object.entries(alertsD.recovered).sort((a, b) => (a[1][0] < b[1][0] ? 1 : -1));
  const recalls = []; Object.entries(alertsD.recalls).forEach(([l, a]) => a.forEach((x) => recalls.push([l, x]))); recalls.sort((a, b) => (a[1][0] < b[1][0] ? 1 : -1));
  const lic = licIdx(), licName = (l) => { const f = lic.byNo.get(l); return f ? (f[F.zh] || f[F.en]) : ''; };
  const hit = (...s) => !q || TW.fold(s.join(' ')).includes(q);
  let body = '';
  if (tab === 'short' || tab === 'back') {
    const src = tab === 'short' ? shorts : backs, am = S.amonth || '';
    const rows = src.filter(([l, s]) => hit(l, s[1], s[2]) && (!am || s[0].startsWith(am)));
    body = calBlock(src.map(([, s]) => s[0]), tab === 'short' ? '' : 'ok', T(tab === 'short' ? '目前缺藥，依公告月份' : '恢復供應，依公告月份', tab === 'short' ? 'Current shortages by month of notice' : 'Recoveries by month of notice')) + `<ul class="wl">${rows.slice(0, 300).map(([l, s]) => `<li><span class="t"><b>${esc(s[1])}</b><span class="sub">${esc(l)}</span>${tab === 'short' ? altLabel(s) : ''}${codeBtns(l)}</span><span class="r">${esc(s[0])}</span><details${tab === 'short' ? '' : ''}><summary>${esc(firstLine(s[2]))}</summary><p>${esc(s[2])}</p></details></li>`).join('')}</ul>${rows.length > 300 ? `<p class="hint">${T('只顯示前 300 筆，請用上方搜尋縮小範圍。', 'Showing the first 300; narrow with the search above.')}</p>` : ''}${!rows.length ? `<p class="hint">${T('沒有符合的項目。', 'Nothing matches.')}</p>` : ''}`;
  } else {
    const g = S.agrade || '';
    const am = S.amonth || '';
    const rows = recalls.filter(([l, x]) => (!g || String(x[1]) === g) && hit(l, x[5], x[6], x[3], licName(l)) && (!am || x[0].startsWith(am)));
    // recalls per year, by class
    const years = {}; recalls.forEach(([, x]) => { const y = x[0].slice(0, 4); if (!y) return; years[y] = years[y] || [0, 0, 0, 0]; years[y][x[1]]++; });
    const yk = Object.keys(years).sort(), ymax = Math.max(1, ...yk.map((y) => years[y].reduce((a, b) => a + b, 0)));
    body = calBlock(recalls.filter(([, x]) => !g || String(x[1]) === g).map(([, x]) => x[0]), 'rc', T('回收，依公告月份', 'Recalls by month of notice')) + `<h3 class="sec">${T('每年回收件數', 'Recalls per year')}</h3><div class="yearbars" role="img" aria-label="${T('每年回收件數', 'Recalls per year')}">${yk.map((y) => `<div title="${y}: ${years[y].reduce((a, b) => a + b, 0)}">${[1, 2, 3, 0].map((k) => (years[y][k] ? `<i class="g${k}" style="height:${((years[y][k] / ymax) * 80).toFixed(1)}px"></i>` : '')).join('')}</div>`).join('')}</div>
      <div class="yearax">${yk.map((y) => `<span>${y.slice(2)}</span>`).join('')}</div>
      <div class="legend" style="margin:-8px 0 14px"><span><span class="dot" style="background:var(--c-orig)"></span> ${T('第一級', 'Class 1')}</span><span><span class="dot" style="background:var(--c-off)"></span> ${T('第二級', 'Class 2')}</span><span><span class="dot" style="background:var(--c-gen)"></span> ${T('第三級／未分級', 'Class 3 / none')}</span></div>
      <div class="pills" role="group" aria-label="${T('分級', 'Class')}">${[['', '全部', 'All'], ['1', '第一級', 'Class 1'], ['2', '第二級', 'Class 2'], ['3', '第三級', 'Class 3']].map(([v, zh, en]) => `<button type="button" data-agrade="${v}" aria-pressed="${g === v}">${T(zh, en)}</button>`).join('')}</div>
      <ul class="wl">${rows.slice(0, 300).map(([l, x]) => `<li><span class="t"><b>${esc(x[5] || licName(l) || l)}</b><span class="sub">${esc(l)}${x[6] ? ' · ' + esc(x[6]) : ''}</span>${codeBtns(l)}</span><span class="r">${esc(x[0])}<br><span class="tag ${x[1] === 1 ? 'recall' : ''}">${GRADE(x[1])}</span></span><details><summary>${esc(firstLine(x[3]))}</summary><p>${T('批號', 'Batches')}：${esc(x[2] || '—')}\n${T('原因', 'Reason')}：${esc(x[3])}\n${esc(x[4])}</p></details></li>`).join('')}</ul>${rows.length > 300 ? `<p class="hint">${T('只顯示前 300 筆，請用上方搜尋縮小範圍。', 'Showing the first 300; narrow with the search above.')}</p>` : ''}${!rows.length ? `<p class="hint">${T('沒有符合的項目。', 'Nothing matches.')}</p>` : ''}`;
  }
  $('vAlerts').innerHTML = `<div class="vhead"><h2>${T('缺藥與回收', 'Shortages & recalls')}</h2><p>${T('資料來源：食藥署藥品供應資訊、回收藥品資料集，每週更新。', 'Sources: TFDA drug supply notices and recall dataset, refreshed weekly.')}</p></div>
    <div class="cards">${[['short', shorts.length, '缺藥中', 'In short supply'], ['back', backs.length, '已恢復供應', 'Back in supply'], ['recall', recalls.length, '回收紀錄', 'Recalls']].map(([k, n, zh, en]) => `<button type="button" data-atab="${k}" aria-pressed="${tab === k}"><b>${n.toLocaleString()}</b><span>${T(zh, en)}</span></button>`).join('')}</div>
    <div class="vfilter"><input type="search" id="aq" value="${esc(S.aq || '')}" placeholder="${T('搜尋品名、成分、許可證字號、原因', 'Search name, licence, reason')}" aria-label="${T('搜尋', 'Search')}"></div>
    ${body}`;
  const inp = $('aq'); inp.oninput = RT.debounce(() => { S.aq = inp.value; save(); const pos = inp.selectionStart; renderAlerts().then(() => { const n = $('aq'); n.focus(); n.setSelectionRange(pos, pos); }); }, 250);
}
$('vAlerts').addEventListener('click', (e) => {
  const t = e.target.closest('[data-atab]'), g = e.target.closest('[data-agrade]'), am = e.target.closest('[data-amonth]');
  if (am) { S.amonth = S.amonth === am.dataset.amonth ? '' : am.dataset.amonth; save(); renderAlerts(); return; }
  if (t) { S.atab = t.dataset.atab; S.amonth = ''; save(); renderAlerts(); }
  else if (g) { S.agrade = g.dataset.agrade; save(); renderAlerts(); }
});

/* rule revisions */
async function renderRulesView() {
  loadingBox('vRules');
  try { await Promise.all([loadAll(), rulesD || TW.rules().then((d) => (rulesD = d))]); } catch (e) { $('vRules').innerHTML = `<div class="empty-state">${esc(e.message || e)}</div>`; return; }
  const ch = new Map();
  nhiD.rows.forEach((r) => {
    if (!r[N.ruleChapters]) return;
    r[N.ruleChapters].split(',').filter(Boolean).forEach((c) => {
      const fl = ruleFile(r, c); if (!fl) return;
      const e = ch.get(c) || { c, file: fl, date: TW.ruleDate(fl), n: 0 }; e.n += r[N.price] > 0 ? 1 : 0; ch.set(c, e);
    });
  });
  // first line of the chapter, without its number and the list of revision dates that follows the title
  const titleOf = (e) => { const t = (rulesD.files[e.file] || '').split('\n')[0].trim(); return t.replace(/^[\d.]+\s*/, '').replace(/\s*[（(]\s*\d{2,3}\/\d.*$/, '').replace(/[：:]\s*$/, '').slice(0, 80); };
  const months = S.rmonths || '6', q = TW.fold(S.rq || '');
  const since = months === 'all' ? '' : (() => { const d = new Date(); d.setMonth(d.getMonth() - +months); return d.toISOString().slice(0, 10); })();
  const all = [...ch.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.c.localeCompare(b.c, undefined, { numeric: true })));
  const rows = all.filter((e) => e.date >= since && (!q || TW.fold(e.c + ' ' + titleOf(e)).includes(q)));
  // revisions per month over the last two years
  const mon = {}; const cut = (() => { const d = new Date(); d.setMonth(d.getMonth() - 24); return d.toISOString().slice(0, 7); })();
  all.forEach((e) => { const m = e.date.slice(0, 7); if (m >= cut) mon[m] = (mon[m] || 0) + 1; });
  const mk = []; { const d = new Date(cut + '-01'); const end = new Date().toISOString().slice(0, 7); while (d.toISOString().slice(0, 7) <= end) { mk.push(d.toISOString().slice(0, 7)); d.setMonth(d.getMonth() + 1); } }
  const mmax = Math.max(1, ...Object.values(mon));
  $('vRules').innerHTML = `<div class="vhead"><h2>${T('給付規定修訂', 'Rule revisions')}</h2><p>${T(`共 ${all.length} 個章節；日期取自健保署公告的 PDF 檔名。`, `${all.length} chapters; dates come from the NHIA PDF file names.`)}</p></div>
    <h3 class="sec">${T('每月修訂章節數（近兩年）', 'Chapters revised per month (two years)')}</h3>
    <div class="yearbars" role="img" aria-label="${T('每月修訂章節數', 'Chapters revised per month')}">${mk.map((m) => `<div title="${m}: ${mon[m] || 0}">${mon[m] ? `<i class="g2" style="height:${((mon[m] / mmax) * 80).toFixed(1)}px"></i>` : ''}</div>`).join('')}</div>
    <div class="yearax">${mk.map((m, i) => `<span>${i % 3 === 0 ? m.slice(2).replace('-', '/') : ''}</span>`).join('')}</div>
    <div class="vfilter"><input type="search" id="rq" value="${esc(S.rq || '')}" placeholder="${T('搜尋章節或標題，例如 5.1、糖尿病', 'Search chapter or title, e.g. 5.1, diabetes')}" aria-label="${T('搜尋', 'Search')}">
      <select id="rmonths" aria-label="${T('期間', 'Period')}">${[['1', '近 1 個月', 'Last month'], ['3', '近 3 個月', 'Last 3 months'], ['6', '近 6 個月', 'Last 6 months'], ['12', '近 1 年', 'Last year'], ['all', '全部章節', 'All chapters']].map(([v, zh, en]) => `<option value="${v}"${v === months ? ' selected' : ''}>${T(zh, en)}</option>`).join('')}</select></div>
    ${rows.length ? rows.map((e) => `<details class="rv" data-file="${esc(e.file)}"><summary><span class="d">${esc(e.date)}</span><span><span class="c">${esc(e.c)}</span>${esc(titleOf(e))}</span><span class="r hint" style="margin:0">${T(`${e.n} 項給付中`, `${e.n} reimbursed`)}</span></summary></details>`).join('') : `<p class="hint">${T('這段期間沒有修訂。', 'No revisions in this period.')}</p>`}`;
  const inp = $('rq'); inp.oninput = RT.debounce(() => { S.rq = inp.value; save(); const pos = inp.selectionStart; renderRulesView().then(() => { const n = $('rq'); n.focus(); n.setSelectionRange(pos, pos); }); }, 250);
  $('rmonths').onchange = () => { S.rmonths = $('rmonths').value; save(); renderRulesView(); };
}
$('vRules').addEventListener('toggle', (e) => {
  const d = e.target; if (!d.matches || !d.matches('details.rv') || !d.open || d.dataset.filled) return;
  d.dataset.filled = '1';
  const fl = d.dataset.file, text = rulesD && rulesD.files[fl];
  d.insertAdjacentHTML('beforeend', `<div class="rules-txt"><h4>${esc(fl.split('_')[0])} · ${T('修訂', 'revised')} ${esc(TW.ruleDate(fl))} <a href="${TW.ruleUrl(fl)}" target="_blank" rel="noopener">PDF ↗</a></h4>${text ? `<div class="txt">${esc(text)}</div>` : `<p class="hint" style="padding:10px 12px;margin:0">${T('這一章的全文還沒有轉好，請開 PDF。', 'No text for this chapter yet; open the PDF.')}</p>`}</div>`);
}, true);

/* ---------- start ---------- */
let startCode = '';
$('srcNote').textContent = TW.sourceNote();
$('refs').innerHTML = RT.noticeHTML([T('資料來源：健保署「健保用藥品項」與藥品給付規定；食藥署「全部藥品許可證資料集」「藥品外觀資料集」「藥品仿單外盒資料集」（政府資料開放授權條款第 1 版）。外觀照片、仿單與外盒直接連到食藥署網站。', 'Sources: NHIA “NHI drug list” and reimbursement rules; TFDA “All drug licences”, “Drug appearance” and “Leaflets and cartons” datasets (Open Government Data License, Taiwan v1.0). Photos, leaflets and cartons link straight to the TFDA site.')]);
(() => {
  const p = new URLSearchParams(location.search);
  Q = p.get('q') || ''; $('q').value = Q;
  startCode = (p.get('code') || '').trim().toUpperCase();
  if (p.get('group')) chips.push({ k: 'group', v: p.get('group') });
  if (p.get('atc')) chips.push({ k: 'atc', v: p.get('atc').toUpperCase() });
})();
$('scope').value = S.scope;
setPack(['foil', 'can', 'both'].includes(S.pack) ? S.pack : 'foil', true);
$('fSort').value = S.sort;
setByGroup(S.byGroup, true);
// a shared link to a search or a drug opens the search, whatever view was used last
{ const u = new URLSearchParams(location.search); setView(u.get('view') || (['q', 'code', 'atc', 'group'].some((k) => u.get(k)) ? 'search' : S.view) || 'search', true); }
// the filter sheet never opens by itself on a phone
showAdv(!!S.advOpen && !matchMedia('(max-width: 640px)').matches);
$('aCls').innerHTML = `<option value="">${T('不限', 'All')}</option>` + CLS.map((c) => `<option value="${esc(c)}">${esc(clsName(c))}</option>`).join('');
$('aCat').innerHTML = $('aCountry').innerHTML = `<option value="">${T('不限', 'All')}</option>`;
syncAdv();
TW.nhi().then((d) => {
  nhiD = d;
  drawTray();
  const forms = {}; d.rows.forEach((r) => { if (r[N.price] > 0 && r[N.form]) forms[r[N.form]] = (forms[r[N.form]] || 0) + 1; });
  $('aForm').innerHTML = `<option value="">${T('不限', 'All')}</option>` + Object.entries(forms).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([f]) => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
  syncAdv();
  if (S.scope !== 'paid') { loadAll(); loadFdaAll(); }
  TW.meta().then((m) => { metaD = m; $('srcNote').textContent = TW.sourceNote() + T(` 本次資料整理於 ${m.built}。`, ` This copy was built on ${m.built}.`); });
  render();
  if (startCode) { if (S.view !== 'search') setView('search', true); goCode(startCode); }
  // licences come second: search works as soon as the NHI list is in
  loadFda();
  loadAlertIdx();
  if (A().photo) loadExtra();
}).catch((e) => { $('out').innerHTML = `<div class="empty-state">${esc(e.message || e)}</div>`; });

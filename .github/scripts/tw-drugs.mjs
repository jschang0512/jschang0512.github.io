// Builds the Taiwan drug data used by Research-toolkit/drugs/ and Research-toolkit/codelist/.
// Sources (Open Government Data License, Taiwan, v1.0; attribution is shown on both pages):
//   NHI  健保用藥品項       https://info.nhi.gov.tw/api/iode0000s01/Dataset?rId=A21030000I-E41001-001  (CSV, ~95 MB)
//   TFDA 全部藥品許可證資料集 https://data.fda.gov.tw/data/opendata/export/36/csv                         (zipped CSV)
// Usage: node .github/scripts/tw-drugs.mjs <nhi.csv> <fda.csv> [outDir] [appearance.csv] [leaflets.csv]
// Any input can instead be the previous week's JSON (nhi.json, fda.json, extra.json from the tw-drugs-data branch):
// a source that could not be downloaded then keeps last week's data while the others are refreshed.
// Output (outDir, default Research-toolkit/data/tw-drugs/):
//   nhi.json   every NHI drug code ever listed, one row each, with its current price (0 = no longer reimbursed)
//   fda.json   licences that are still valid, plus cancelled ones that an NHI code still points to
//   hist.json  price history per NHI code (loaded only when someone opens it)
//   extra.json appearance (shape, colour, markings, photo) and leaflet / carton links per licence, from
//              TFDA 藥品外觀資料集 (export/42) and 藥品仿單外盒資料集 (export/39); loaded when a drug is opened
//   meta.json  build date, row counts and column names
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [nhiFile, fdaFile, outArg, looksFile, leafletFile] = process.argv.slice(2);
if (!nhiFile || !fdaFile) { console.error('usage: tw-drugs.mjs <nhi.csv> <fda.csv> [outDir] [appearance.csv] [leaflets.csv]'); process.exit(1); }
const OUT = outArg || 'Research-toolkit/data/tw-drugs';

function parseCSV(s) {
  s = s.replace(/^﻿/, '');
  const rows = []; let r = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { r.push(f); f = ''; }
    else if (c === '\n') { r.push(f.replace(/\r$/, '')); rows.push(r); r = []; f = ''; }
    else f += c;
  }
  if (f || r.length) { r.push(f); rows.push(r); }
  const head = rows[0].map((h) => h.trim());
  return { head, rows: rows.slice(1).filter((x) => x.length >= head.length - 2) };
}
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
// ROC dates: '  960901' → 2007-09-01, '1040201' → 2015-02-01, 9991231 → '' (open-ended)
const roc = (v) => {
  const t = String(v || '').trim();
  if (!/^\d{6,7}$/.test(t) || t === '9991231') return '';
  const y = +t.slice(0, -4) + 1911;
  return `${y}-${t.slice(-4, -2)}-${t.slice(-2)}`;
};
const ymd = (v) => { const m = String(v || '').trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''; };
const num = (v) => { const n = parseFloat(String(v).trim()); return Number.isFinite(n) ? n : 0; };

const isJson = (p) => /\.json$/i.test(String(p || ''));
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const reused = [];
const NHI_COLS = ['code', 'en', 'zh', 'ingredient', 'price', 'priceSince', 'firstListed', 'lastPaidPrice', 'lastPaidSince', 'vendor', 'maker', 'form', 'class', 'group', 'atc', 'ruleChapters', 'ruleFiles', 'licId', 'single', 'strength'];
const FDA_COLS = ['licence', 'status', 'cancelDate', 'cancelReason', 'validUntil', 'issued', 'zh', 'en', 'indication', 'form', 'package', 'category', 'controlled', 'ingredients', 'applicant', 'maker', 'country', 'licId'];

/* ---------- NHI ---------- */
let nhi = [], hist = {};
if (isJson(nhiFile)) {
  const p = readJson(nhiFile);
  if (JSON.stringify(p.cols) !== JSON.stringify(NHI_COLS)) throw new Error('previous nhi.json has other columns');
  nhi = p.rows;
  const h = path.join(path.dirname(nhiFile), 'hist.json'); if (fs.existsSync(h)) hist = readJson(h).hist || {};
  reused.push('nhi');
} else {
const N = parseCSV(fs.readFileSync(nhiFile, 'utf8'));
const ni = (k) => { const i = N.head.indexOf(k); if (i < 0) throw new Error('NHI column missing: ' + k); return i; };
const C = { code: ni('藥品代號'), en: ni('藥品英文名稱'), zh: ni('藥品中文名稱'), ing: ni('成分'), amt: ni('規格量'), unit: ni('規格單位'), mix: ni('單複方'), price: ni('支付價'),
  from: ni('有效起日'), to: ni('有效迄日'), vendor: ni('藥商'), maker: ni('製造廠名稱'), form: ni('劑型'), cls: ni('藥品分類'), grp: ni('分類分組名稱'), atc: ni('ATC代碼'),
  rule: ni('給付規定章節'), link: ni('藥品代碼超連結'), ruleLink: ni('給付規定章節連結') };

const byCode = new Map();
for (const r of N.rows) {
  const code = clean(r[C.code]); if (!code) continue;
  let e = byCode.get(code); if (!e) byCode.set(code, (e = { rows: [] }));
  e.rows.push(r);
}
for (const [code, e] of byCode) {
  const rs = e.rows.map((r) => ({ r, from: roc(r[C.from]), open: String(r[C.to]).trim() === '9991231', price: num(r[C.price]) }))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  const cur = rs.find((x) => x.open) || rs[rs.length - 1];
  const r = cur.r;
  const paid = rs.filter((x) => x.price > 0);
  const lastPaid = paid.length ? paid[paid.length - 1] : null;
  const lic = (String(r[C.link]).match(/licId=(\d{8})/) || [])[1] || '';
  const ruleFiles = String(r[C.ruleLink] || '').split(',').map((u) => (u.match(/DurgFileName=([^&,]+)/) || [])[1] || '').filter(Boolean).join(',');
  const amt = clean(r[C.amt]), unit = clean(r[C.unit]);
  nhi.push([
    code, clean(r[C.en]), clean(r[C.zh]), clean(r[C.ing]),
    cur.price, cur.from, rs[0].from,
    cur.price > 0 || !lastPaid ? 0 : lastPaid.price, cur.price > 0 || !lastPaid ? '' : lastPaid.from,
    clean(r[C.vendor]), clean(r[C.maker]), clean(r[C.form]), clean(r[C.cls]), clean(r[C.grp]), clean(r[C.atc]).toUpperCase(),
    clean(r[C.rule]), ruleFiles, lic, clean(r[C.mix]), amt ? (amt + (unit ? ' ' + unit : '')) : '',
  ]);
  // keep only the rows where the price changed
  const h = []; let last = null;
  for (const x of rs) { if (x.price !== last) { h.push((x.from || '').replace(/-/g, '') + ':' + x.price); last = x.price; } }
  if (h.length > 1) hist[code] = h.join(';');
}
nhi.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/* ---------- TFDA licences ---------- */
let fda = [], typeMap = {};
if (isJson(fdaFile)) {
  const p = readJson(fdaFile);
  if (JSON.stringify(p.cols) !== JSON.stringify(FDA_COLS)) throw new Error('previous fda.json has other columns');
  fda = p.rows;
  const m = path.join(path.dirname(fdaFile), 'meta.json'); if (fs.existsSync(m)) typeMap = readJson(m).licTypes || {};
  reused.push('fda');
} else {
const F = parseCSV(fs.readFileSync(fdaFile, 'utf8'));
const fi = (k) => { const i = F.head.indexOf(k); if (i < 0) throw new Error('TFDA column missing: ' + k); return i; };
const D = { no: fi('許可證字號'), st: fi('註銷狀態'), cd: fi('註銷日期'), cr: fi('註銷理由'), valid: fi('有效日期'), issue: fi('發證日期'), zh: fi('中文品名'), en: fi('英文品名'),
  ind: fi('適應症'), form: fi('劑型'), pack: fi('包裝'), cat: fi('藥品類別'), ctrl: fi('管制藥品分類級別'), ing: fi('主成分略述'), app: fi('申請商名稱'), maker: fi('製造商名稱'), country: fi('製造廠國別') };
const lic = F.rows.map((r) => {
  const m = clean(r[D.no]).match(/^(.*?)字第0*(\d+)號$/);
  return m ? { r, pre: m[1], num: +m[2] } : null;
}).filter(Boolean);
// the two-digit type in NHI's licId (01 = 衛署藥製, 02 = 衛署藥輸, ...) is learnt from codes whose names match
const byNum = new Map(); lic.forEach((x) => { const a = byNum.get(x.num) || []; a.push(x); byNum.set(x.num, a); });
const vote = {};
const squash = (s) => String(s || '').replace(/[\s"「」]/g, '');
for (const row of nhi) {
  if (!row[17]) continue;
  const t = row[17].slice(0, 2), n = +row[17].slice(2);
  const zh = squash(row[2]);
  for (const x of byNum.get(n) || []) {
    const fz = squash(x.r[D.zh]);
    if (zh && fz && (zh.includes(fz) || fz.includes(zh) || zh.slice(-6) === fz.slice(-6))) { const k = t + '\t' + x.pre; vote[k] = (vote[k] || 0) + 1; }
  }
}
Object.entries(vote).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => { const [t, pre] = k.split('\t'); if (!typeMap[t] && n >= 3) typeMap[t] = pre; });
const preToType = {}; Object.entries(typeMap).forEach(([t, pre]) => { if (!preToType[pre]) preToType[pre] = t; });
const licKey = (pre, n) => pre + '|' + n;
const licByKey = new Map(lic.map((x) => [licKey(x.pre, x.num), x]));
const wanted = new Set();
for (const row of nhi) {
  if (!row[17]) continue;
  const pre = typeMap[row[17].slice(0, 2)]; const x = pre && licByKey.get(licKey(pre, +row[17].slice(2)));
  if (x) wanted.add(x);
}
fda = lic.filter((x) => !clean(x.r[D.st]) || wanted.has(x)).map((x) => {
  const r = x.r; const t = preToType[x.pre];
  return [clean(r[D.no]), clean(r[D.st]), ymd(r[D.cd]), clean(r[D.cr]), ymd(r[D.valid]), ymd(r[D.issue]), clean(r[D.zh]), clean(r[D.en]), clean(r[D.ind]),
    clean(r[D.form]), clean(r[D.pack]), clean(r[D.cat]), clean(r[D.ctrl]), clean(r[D.ing]).replace(/;;/g, '; '), clean(r[D.app]), clean(r[D.maker]), clean(r[D.country]),
    t ? t + String(x.num).padStart(6, '0') : ''];
});
}

/* ---------- TFDA appearance and leaflets (optional inputs) ---------- */
const keepLic = new Set(fda.map((r) => r[0]));
const MCP = 'https://mcp.fda.gov.tw/';
const short = (u) => String(u || '').split(';').map((x) => x.trim()).filter(Boolean).map((x) => (x.startsWith(MCP) ? x.slice(MCP.length) : x));
let looks = {}, leaflets = {};
if (isJson(looksFile) && fs.existsSync(looksFile)) { looks = readJson(looksFile).looks || {}; reused.push('appearance'); }
else if (looksFile && fs.existsSync(looksFile)) {
  const L = parseCSV(fs.readFileSync(looksFile, 'utf8'));
  const li = (k) => { const i = L.head.indexOf(k); if (i < 0) throw new Error('appearance column missing: ' + k); return i; };
  const c = ['許可證字號', '形狀', '特殊劑型', '顏色', '特殊氣味', '刻痕', '外觀尺寸', '標註一', '標註二', '外觀圖檔連結'].map(li);
  for (const r of L.rows) {
    const no = clean(r[c[0]]); if (!keepLic.has(no)) continue;
    (looks[no] = looks[no] || []).push([...c.slice(1, 9).map((i) => clean(r[i])), short(r[c[9]])[0] || '']);
  }
}
if (isJson(leafletFile) && fs.existsSync(leafletFile)) { leaflets = readJson(leafletFile).leaflets || {}; reused.push('leaflets'); }
else if (leafletFile && fs.existsSync(leafletFile)) {
  const L = parseCSV(fs.readFileSync(leafletFile, 'utf8'));
  const li = (k) => { const i = L.head.indexOf(k); if (i < 0) throw new Error('leaflet column missing: ' + k); return i; };
  const [cn, ci, cb] = ['許可證字號', '仿單圖檔連結', '外盒圖檔連結'].map(li);
  for (const r of L.rows) {
    const no = clean(r[cn]); if (!keepLic.has(no)) continue;
    const ins = short(r[ci]), box = short(r[cb]);
    if (ins.length || box.length) leaflets[no] = [ins, box];
  }
}
const LOOK_COLS = ['shape', 'special', 'colour', 'smell', 'score', 'size', 'mark1', 'mark2', 'photo'];

/* ---------- write ---------- */
fs.mkdirSync(OUT, { recursive: true });
const w = (f, o) => { const s = JSON.stringify(o); fs.writeFileSync(path.join(OUT, f), s); return (s.length / 1e6).toFixed(1) + ' MB'; };
const meta = {
  built: new Date().toISOString().slice(0, 10),
  counts: { nhiCodes: nhi.length, nhiPaid: nhi.filter((r) => r[4] > 0).length, licences: fda.length, licencesValid: fda.filter((r) => !r[1]).length },
  licTypes: typeMap,
  nhiCols: NHI_COLS, fdaCols: FDA_COLS,
  reused,   // sources that could not be downloaded this time and kept last week's data
};
// the version follows the content, so an unchanged week leaves the data files byte-identical
const v = crypto.createHash('sha1').update(JSON.stringify([nhi, fda, looks, leaflets])).digest('hex').slice(0, 10);
meta.v = v;
console.log('nhi.json', w('nhi.json', { v, cols: NHI_COLS, rows: nhi }));
console.log('fda.json', w('fda.json', { v, cols: FDA_COLS, rows: fda }));
console.log('hist.json', w('hist.json', { v, hist }));
console.log('extra.json', w('extra.json', { v, base: MCP, lookCols: LOOK_COLS, looks, leaflets }));
meta.counts.looks = Object.keys(looks).length; meta.counts.leaflets = Object.keys(leaflets).length;
w('meta.json', meta);  // written last: meta.v names the data version the pages load
console.log(JSON.stringify(meta.counts), 'licence types', Object.keys(typeMap).length, reused.length ? 'reused: ' + reused.join(', ') : 'all sources fresh');

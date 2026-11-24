// Shortages, recalls, NHI usage and the weekly change log for Research-toolkit/drugs/ (and usage for codelist/).
// Runs after tw-drugs.mjs, before tw-drug-rules.mjs. Every input is optional: a source that could not be
// downloaded keeps last week's part from the previous data folder.
// Usage: node .github/scripts/tw-drug-watch.mjs <dataDir> <prevDir> [--recall fda34.csv] [--short fda104.csv]
//        [--recovered fda106.csv] [--usage dirWithE41005-*.csv]
// Writes into <dataDir>:
//   alerts.json   recalls (TFDA 回收藥品資料集), current shortages (藥品供應資訊: 短缺中) and recoveries (已恢復供應)
//   usage.json    NHI 藥品使用量 per NHI code and year (with bundled payments), plus the reporting months per year
//   changes.json  what changed against last week's data, for the newest eight weeks
// and folds them into meta.json's version.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [dir, prevDir, ...rest] = process.argv.slice(2);
if (!dir || !prevDir) { console.error('usage: tw-drug-watch.mjs <dataDir> <prevDir> [--recall f] [--short f] [--recovered f] [--usage dir]'); process.exit(1); }
const opt = {}; for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const prevJson = (f) => { const p = path.join(prevDir, f); try { return fs.existsSync(p) ? readJson(p) : null; } catch (e) { return null; } };
const has = (p) => p && fs.existsSync(p) && fs.statSync(p).size > 0;
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
  return { head, rows: rows.slice(1).filter((x) => x.length >= head.length - 1 && x.some((v) => v.trim())) };
}
const col = (t, k) => { const i = t.head.indexOf(k); if (i < 0) throw new Error('column missing: ' + k); return i; };
const clean = (v) => String(v ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
const ymd = (v) => { const m = String(v || '').match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''; };
const licences = (v) => String(v || '').match(/[一-鿿]+字第\d+號/g) || [];
const reused = [];

/* ---------- recalls and shortages ---------- */
const prevAlerts = prevJson('alerts.json') || {};
let recalls = {}, short = {}, recovered = {};
// grades are written many ways: 1, 第一級, 疑似第一級, 二, 第2級 …
const grade = (g) => { const s = String(g || ''); return /一|1/.test(s) ? 1 : /二|2/.test(s) ? 2 : /三|3/.test(s) ? 3 : 0; };
if (has(opt.recall)) {
  const t = parseCSV(fs.readFileSync(opt.recall, 'utf8'));
  const [cg, cd, ct, cp, cl, cb, ch, cr] = ['回收分級', '文號', '日期', '產品', '許可證字號', '批號', '許可證持有者', '原因'].map((k) => col(t, k));
  for (const r of t.rows) {
    const row = [ymd(r[ct]), grade(r[cg]), clean(r[cb]), clean(r[cr]), clean(r[cd]), clean(r[cp]), clean(r[ch])];
    for (const l of licences(r[cl])) (recalls[l] = recalls[l] || []).push(row);
  }
  Object.values(recalls).forEach((a) => a.sort((x, y) => (x[0] < y[0] ? 1 : -1)));
} else { recalls = prevAlerts.recalls || {}; reused.push('recalls'); }
function supply(file, prev, label) {
  if (!has(file)) { reused.push(label); return prev || {}; }
  const t = parseCSV(fs.readFileSync(file, 'utf8')), out = {};
  const [cd, cn, cl, cs] = ['公告更新時間', '中文品名', '許可證字號', '供應狀態'].map((k) => col(t, k));
  for (const r of t.rows) for (const l of licences(r[cl])) out[l] = [ymd(r[cd]), clean(r[cn]).replace(/\s*\n\s*/g, ' / '), clean(r[cs])];
  return out;
}
short = supply(opt.short, prevAlerts.short, 'shortages');
recovered = supply(opt.recovered, prevAlerts.recovered, 'recoveries');
const RECALL_COLS = ['date', 'grade', 'batch', 'reason', 'notice', 'product', 'holder'];
const SUPPLY_COLS = ['date', 'name', 'status'];

/* ---------- NHI usage, one file per year (E41005-001 = ROC year 111, …) ---------- */
let usage = prevJson('usage.json');
if (opt.usage && fs.existsSync(opt.usage) && fs.readdirSync(opt.usage).some((f) => /\.csv$/i.test(f))) {
  const years = [], q = {};
  const files = fs.readdirSync(opt.usage).filter((f) => /\.csv$/i.test(f)).sort();
  const parsed = files.map((f) => parseCSV(fs.readFileSync(path.join(opt.usage, f), 'utf8'))).filter((t) => t.rows.length);
  parsed.sort((a, b) => +a.rows[0][0] - +b.rows[0][0]);
  parsed.forEach((t, yi) => {
    const [cy, cc, cf, ct, cm, ctot] = ['費用年', '藥品代碼', '申報起始年月', '申報結束年月', '含包裹支付的醫令量_男性', '含包裹支付的醫令量_合計'].map((k) => col(t, k));
    years.push({ year: +t.rows[0][cy] + 1911, from: t.rows[0][cf], to: t.rows[0][ct] });
    for (const r of t.rows) {
      const code = clean(r[cc]); if (!code) continue;
      const a = q[code] || (q[code] = []);
      a[yi] = [Math.round(+r[ctot] || 0), Math.round(+r[cm] || 0)];   // total, of which men
    }
  });
  // ROC 11501–11509 → "2026-01" to "2026-09": a year whose reports stop before December is a partial year
  years.forEach((y) => { const roc = (s) => `${+String(s).slice(0, -2) + 1911}-${String(s).slice(-2)}`; y.from = roc(y.from); y.to = roc(y.to); y.partial = !y.to.endsWith('-12'); });
  Object.values(q).forEach((a) => { for (let i = 0; i < years.length; i++) if (!a[i]) a[i] = 0; });
  const prevUsage = usage;
  usage = { years, cols: ['total', 'male'], q };
  // a year that failed to download this time: keep last week's complete set rather than lose a year
  if (prevUsage && prevUsage.years && prevUsage.years.length > years.length) { usage = prevUsage; reused.push('usage'); }
} else { reused.push('usage'); }
usage = usage || { years: [], cols: ['total', 'male'], q: {} };

/* ---------- this week against last week ---------- */
const nhiOf = (d) => {
  const parts = ['nhi-paid.json', 'nhi-rest.json', 'nhi.json'].map((f) => path.join(d, f)).filter((p) => fs.existsSync(p)).map(readJson);
  if (!parts.length) return null;
  const cols = parts[0].cols, rows = parts.flatMap((p) => p.rows);
  const C = {}; cols.forEach((c, i) => (C[c] = i));
  return { C, by: new Map(rows.map((r) => [r[C.code], r])) };
};
const meta = readJson(path.join(dir, 'meta.json'));
const prevMeta = prevJson('meta.json');
const now = nhiOf(dir), before = nhiOf(prevDir);
let weeks = (prevJson('changes.json') || {}).weeks || [];
if (now && before && prevMeta && prevMeta.built !== meta.built) {
  const C = now.C, w = { from: prevMeta.built, to: meta.built, added: [], up: [], down: [], delisted: [], relisted: [], rules: [], newShort: [], resolved: [], newRecalls: [] };
  for (const [code, r] of now.by) {
    const o = before.by.get(code), p = r[C.price];
    if (!o) { w.added.push([code, p]); continue; }
    const op = o[C.price];
    if (op > 0 && p > 0 && op !== p) (p > op ? w.up : w.down).push([code, op, p]);
    else if (op > 0 && !(p > 0)) w.delisted.push([code, op]);
    else if (!(op > 0) && p > 0) w.relisted.push([code, p]);
    // a chapter whose PDF has a new file name was revised
    if (r[C.ruleFiles] !== o[C.ruleFiles]) {
      const was = new Set(String(o[C.ruleFiles] || '').split(',').filter(Boolean));
      String(r[C.ruleFiles] || '').split(',').filter((f) => f && !was.has(f)).forEach((f) => w.rules.push(f));
    }
  }
  w.rules = [...new Set(w.rules)].sort();
  const pa = prevAlerts;
  if (pa.short) w.newShort = Object.keys(short).filter((l) => !pa.short[l]);
  if (pa.short) w.resolved = Object.keys(pa.short).filter((l) => !short[l]);
  if (pa.recalls) for (const [l, list] of Object.entries(recalls)) { const old = new Set((pa.recalls[l] || []).map((x) => x.join('|'))); list.forEach((x) => { if (!old.has(x.join('|'))) w.newRecalls.push([l, x[0], x[1]]); }); }
  // the very first comparison against data that predates the recall/shortage lists would list every alert as new
  if (!pa.short) { w.newShort = []; w.resolved = []; w.newRecalls = []; }
  const any = ['added', 'up', 'down', 'delisted', 'relisted', 'rules', 'newShort', 'resolved', 'newRecalls'].some((k) => w[k].length);
  if (any) weeks = [w, ...weeks.filter((x) => x.to !== w.to)].slice(0, 8);
}

/* ---------- write ---------- */
const out = (f, o) => { const s = JSON.stringify(o); fs.writeFileSync(path.join(dir, f), s); return (s.length / 1e6).toFixed(2) + ' MB'; };
const alerts = { recallCols: RECALL_COLS, supplyCols: SUPPLY_COLS, recalls, short, recovered };
const changes = { weeks };
const h = crypto.createHash('sha1').update(JSON.stringify([alerts, usage, changes])).digest('hex').slice(0, 10);
meta.v = crypto.createHash('sha1').update(meta.v + h).digest('hex').slice(0, 10);
meta.counts.recalls = Object.keys(recalls).length; meta.counts.shortages = Object.keys(short).length; meta.counts.usageYears = usage.years.length;
meta.reused = [...(meta.reused || []), ...reused];
console.log('alerts.json', out('alerts.json', { v: meta.v, ...alerts }));
// a small index for the result cards and filters: which licences are short now, and each one's latest recall
const recallIdx = {}; for (const [l, list] of Object.entries(recalls)) { const d = list.map((x) => x[0]).filter(Boolean).sort().pop() || ''; recallIdx[l] = [d, list.length]; }
console.log('alerts-index.json', out('alerts-index.json', { v: meta.v, short: Object.keys(short), recall: recallIdx }));
console.log('usage.json', out('usage.json', { v: meta.v, ...usage }));
console.log('changes.json', out('changes.json', { v: meta.v, ...changes }));
fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
console.log(`recalls on ${meta.counts.recalls} licences, ${meta.counts.shortages} shortages, usage years ${usage.years.map((y) => y.year + (y.partial ? '*' : '')).join(' ')}, ${weeks.length} weeks of changes${reused.length ? ', reused: ' + reused.join(', ') : ''}`);

// Drug safety communications and the risk-management-plan list for Research-toolkit/drugs/.
// Runs after tw-drug-watch.mjs. Both inputs are optional: one that could not be downloaded keeps
// last week's part from the previous data folder.
// Usage: node .github/scripts/tw-drug-safety.mjs <dataDir> <prevDir> [--comms fda53.json] [--rmp fda54.json]
//   fda53: TFDA 藥品安全資訊風險溝通資料 (dataset 9573), fda54: 須執行藥品風險管理計畫藥品名單 (dataset 9574)
// Writes <dataDir>/safety.json:
//   comms  [date, ingredient, products, reason, analysis, advice, indication], newest first
//   rmp    licence numbers (as in the licence list, e.g. 衛署藥輸字第022877號) that run a risk management plan
// and folds it into meta.json's version.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [dir, prevDir, ...rest] = process.argv.slice(2);
if (!dir || !prevDir) { console.error('usage: tw-drug-safety.mjs <dataDir> <prevDir> [--comms f] [--rmp f]'); process.exit(1); }
const opt = {}; for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
const has = (p) => p && fs.existsSync(p) && fs.statSync(p).size > 0;
const prev = (() => { const p = path.join(prevDir, 'safety.json'); try { return fs.existsSync(p) ? readJson(p) : null; } catch (e) { return null; } })();
const clean = (v) => String(v ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
const ymd = (v) => { const m = String(v || '').match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''; };
const reused = [];

let comms = null;
if (has(opt.comms)) {
  try {
    comms = readJson(opt.comms).map((x) => [ymd(x['發布日期']), clean(x['藥品成分']), clean(x['藥品名稱及許可證字號']), clean(x['訊息緣由']), clean(x['藥品安全有關資訊分析及描述']), clean(x['TFDA風險溝通說明']), clean(x['適應症'])])
      .filter((x) => x[0] && x[1]).sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
    if (!comms.length) comms = null;
  } catch (e) { console.warn('safety communications unreadable:', e.message); comms = null; }
}
if (!comms) { comms = prev ? prev.comms : []; reused.push('safety communications'); }

// the list writes licence numbers short (藥輸025224); the licence list writes them in full (衛部藥輸字第025224號)
let rmp = null;
if (has(opt.rmp)) {
  try {
    const fda = readJson(path.join(dir, 'fda.json')), li = fda.cols.indexOf('licence');
    const byShort = new Map();
    fda.rows.forEach((r) => { const m = String(r[li]).match(/^(?:衛署|衛部)?(.+?)字第(\d+)號$/); if (m) byShort.set(m[1] + m[2], r[li]); });
    rmp = [...new Set(readJson(opt.rmp).map((x) => { const s = clean(x['許可證字號']).replace(/^(衛署|衛部)/, '').replace(/字第/, '').replace(/號$/, ''); return byShort.get(s) || ''; }).filter(Boolean))];
    if (!rmp.length) rmp = null;
  } catch (e) { console.warn('risk management list unreadable:', e.message); rmp = null; }
}
if (!rmp) { rmp = prev ? prev.rmp : []; reused.push('risk management plans'); }

const meta = readJson(path.join(dir, 'meta.json'));
const body = { comms, rmp };
const h = crypto.createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 10);
meta.v = crypto.createHash('sha1').update(meta.v + h).digest('hex').slice(0, 10);
meta.counts = { ...(meta.counts || {}), safety: comms.length, rmp: rmp.length };
meta.reused = [...(meta.reused || []), ...reused];
fs.writeFileSync(path.join(dir, 'safety.json'), JSON.stringify({ v: meta.v, ...body }));
fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
console.log(`safety.json: ${comms.length} communications (newest ${comms[0] ? comms[0][0] : '—'}), ${rmp.length} licences with a risk management plan${reused.length ? '; reused: ' + reused.join(', ') : ''}`);

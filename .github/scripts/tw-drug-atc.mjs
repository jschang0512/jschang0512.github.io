// ATC codes for the licences that no NHI code points to (self-paid, pharmacy and general-sale drugs), from the
// TFDA 藥品藥理治療分類ATC碼資料集 (dataset 9119), so Research-toolkit/drugs/ can sort and match them by ATC too.
// Runs after tw-drug-safety.mjs. The input is optional: when it could not be downloaded, last week's file is kept.
// Usage: node .github/scripts/tw-drug-atc.mjs <dataDir> <prevDir> [--atc fda41.json]
// Writes <dataDir>/fda-atc.json { v, atc: { licence: main ATC code } } and folds it into meta.json's version.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [dir, prevDir, ...rest] = process.argv.slice(2);
if (!dir || !prevDir) { console.error('usage: tw-drug-atc.mjs <dataDir> <prevDir> [--atc f]'); process.exit(1); }
const opt = {}; for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
const has = (p) => p && fs.existsSync(p) && fs.statSync(p).size > 0;
const prev = (() => { const p = path.join(prevDir, 'fda-atc.json'); try { return fs.existsSync(p) ? readJson(p) : null; } catch (e) { return null; } })();

// the licences in the published list that no NHI code points to
const fda = readJson(path.join(dir, 'fda.json')), fc = {}; fda.cols.forEach((c, i) => (fc[c] = i));
const used = new Set();
for (const f of ['nhi-paid.json', 'nhi-rest.json', 'nhi.json']) {
  const p = path.join(dir, f); if (!fs.existsSync(p)) continue;
  const d = readJson(p), li = d.cols.indexOf('licId'); d.rows.forEach((r) => r[li] && used.add(r[li]));
}
const wanted = new Set(fda.rows.filter((f) => !(f[fc.licId] && used.has(f[fc.licId]))).map((f) => f[fc.licence]));

let atc = null, reused = false;
if (has(opt.atc)) {
  try {
    atc = {};
    for (const x of readJson(opt.atc)) {
      const l = String(x['許可證字號'] || '').trim(), code = String(x['代碼'] || '').trim().toUpperCase();
      if (!wanted.has(l) || !/^[A-Z]\d{2}/.test(code)) continue;
      // the main code first; a secondary one only fills a gap
      if (x['主或次項'] === '主' ? !(atc[l] && atc[l].main) : !atc[l]) atc[l] = { code, main: x['主或次項'] === '主' };
    }
    atc = Object.fromEntries(Object.entries(atc).map(([l, v]) => [l, v.code]));
    if (!Object.keys(atc).length) atc = null;
  } catch (e) { console.warn('ATC list unreadable:', e.message); atc = null; }
}
if (!atc) { atc = prev ? prev.atc : {}; reused = true; }

const meta = readJson(path.join(dir, 'meta.json'));
const h = crypto.createHash('sha1').update(JSON.stringify(atc)).digest('hex').slice(0, 10);
meta.v = crypto.createHash('sha1').update(meta.v + h).digest('hex').slice(0, 10);
meta.counts = { ...(meta.counts || {}), fdaAtc: Object.keys(atc).length };
if (reused) meta.reused = [...(meta.reused || []), 'licence ATC codes'];
fs.writeFileSync(path.join(dir, 'fda-atc.json'), JSON.stringify({ v: meta.v, atc }));
fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta));
console.log(`fda-atc.json: ATC codes for ${Object.keys(atc).length} of ${wanted.size} licences without an NHI code${reused ? ' (reused)' : ''}`);

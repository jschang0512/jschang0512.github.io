// Builds the small, fixed copy of the Taiwan drug data that the drug-lookup tests run against
// (.github/fixtures/tw-drugs/), from a full data folder: a few ingredients with everything the page shows for them.
// Usage: node .github/scripts/tw-drugs-fixture.mjs <fullDataDir> <outDir>
// The data are Taiwan government open data (Open Government Data License, Taiwan, v1.0).
import fs from 'node:fs';
import path from 'node:path';

const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error('usage: tw-drugs-fixture.mjs <fullDataDir> <outDir>'); process.exit(1); }
const ING = /METFORMIN|COLCHICINE|FINASTERIDE|DIMENHYDRINATE/i;
const read = (f) => JSON.parse(fs.readFileSync(path.join(src, f + '.json'), 'utf8'));
const pick = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => keys.has(k)));
fs.mkdirSync(out, { recursive: true });
const files = {};

const nhiP = read('nhi-paid'), nhiR = read('nhi-rest');
const nc = {}; nhiP.cols.forEach((c, i) => (nc[c] = i));
const keepRow = (r) => ING.test(r[nc.ingredient]);
files['nhi-paid'] = { ...nhiP, rows: nhiP.rows.filter(keepRow) };
files['nhi-rest'] = { ...nhiR, rows: nhiR.rows.filter(keepRow) };
const rows = [...files['nhi-paid'].rows, ...files['nhi-rest'].rows];
const codes = new Set(rows.map((r) => r[nc.code])), licIds = new Set(rows.map((r) => r[nc.licId]).filter(Boolean));

const fp = read('fda-paid'), fr = read('fda-rest');
const fc = {}; fp.cols.forEach((c, i) => (fc[c] = i));
const keepLic = (f) => licIds.has(f[fc.licId]) || ING.test(f[fc.ingredients]);
files['fda-paid'] = { ...fp, rows: fp.rows.filter(keepLic) };
files['fda-rest'] = { ...fr, rows: fr.rows.filter(keepLic) };
const lics = new Set([...files['fda-paid'].rows, ...files['fda-rest'].rows].map((f) => f[fc.licence]));
for (const n of ['fda-more-paid', 'fda-more-rest']) { const d = read(n); files[n] = { ...d, more: pick(d.more, lics) }; }

const ex = read('extra'); files.extra = { ...ex, looks: pick(ex.looks, lics), leaflets: pick(ex.leaflets, lics) };
const hi = read('hist'); files.hist = { ...hi, hist: pick(hi.hist, codes) };
const al = read('alerts'); files.alerts = { ...al, recalls: pick(al.recalls, lics), short: pick(al.short, lics), recovered: pick(al.recovered, lics) };
const ai = read('alerts-index'); files['alerts-index'] = { ...ai, short: ai.short.filter((l) => lics.has(l)), recall: pick(ai.recall, lics) };
const us = read('usage'); files.usage = { ...us, q: pick(us.q, codes) };
const ru = read('rules'), used = new Set(rows.flatMap((r) => String(r[nc.ruleFiles] || '').split(',').filter(Boolean)));
files.rules = { ...ru, files: pick(ru.files, used) };
files.changes = { ...read('changes'), weeks: [] };
const fa = read('fda-atc'); files['fda-atc'] = { ...fa, atc: pick(fa.atc, lics) };
const sa = read('safety'); files.safety = { ...sa, comms: sa.comms.filter((c) => ING.test(c[1])), rmp: sa.rmp.filter((l) => lics.has(l)) };

const meta = read('meta');
meta.counts = { ...meta.counts, nhiCodes: rows.length, nhiPaid: files['nhi-paid'].rows.length, licences: lics.size };
meta.tag = '';               // the tests read these files only, never the CDN
meta.reused = [];
files.meta = meta;

let total = 0;
for (const [n, d] of Object.entries(files)) { const s = JSON.stringify(d); fs.writeFileSync(path.join(out, n + '.json'), s); total += s.length; }
console.log(`fixture: ${rows.length} NHI codes, ${lics.size} licences, ${Object.keys(files).length} files, ${(total / 1024).toFixed(0)} KB`);

// Full text of the NHI reimbursement rules (藥品給付規定) that the NHI drug list points to, for Research-toolkit/drugs/.
// The NHI site does not allow pages on other sites to read its PDFs, so the text is extracted here with pdftotext.
// File names carry the rule's date (5.1._20250601.pdf), so a file already converted is never fetched again.
// Usage: node .github/scripts/tw-drug-rules.mjs <dataDir> [previous rules.json]
//   reads <dataDir>/nhi.json, writes <dataDir>/rules.json and folds the rules into <dataDir>/meta.json's version.
// Needs pdftotext (poppler-utils).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [dir, prevFile] = process.argv.slice(2);
if (!dir) { console.error('usage: tw-drug-rules.mjs <dataDir> [previous rules.json]'); process.exit(1); }
const URL = 'https://info.nhi.gov.tw/api/INAE3000/INAE3000S01/getPDF?DurgFileName=';

const nhi = JSON.parse(fs.readFileSync(path.join(dir, 'nhi.json'), 'utf8'));
const col = nhi.cols.indexOf('ruleFiles');
const wanted = [...new Set(nhi.rows.flatMap((r) => (r[col] ? r[col].split(',') : [])))].sort();
// bump when tidy() changes, so texts converted under the old rules are converted again
const TIDY = 2;
// prev: texts that can be kept as they are; older: any earlier text, kept when the PDF cannot be fetched now
let prev = {}, older = {};
try { if (prevFile && fs.existsSync(prevFile)) { const p = JSON.parse(fs.readFileSync(prevFile, 'utf8')); older = p.files || {}; if (p.tidy === TIDY) prev = older; } } catch (e) { prev = {}; older = {}; }

// PDF lines → paragraphs: a line that starts a numbered item starts a paragraph, other lines continue the one above
const START = /^(\(?\d{1,2}\)|\d{1,2}\.(\d{1,2}\.)*|[A-Za-z]\.|\([a-zA-Z]\)|[（(][一二三四五六七八九十]+[）)]|[一二三四五六七八九十]+、|[①-⑳]|註|備註|※|◎|●|■|【|附表|附件)/;
function tidy(text) {
  const out = [];
  for (const raw of text.replace(/\f/g, '\n').split('\n')) {
    if (!raw.trim()) continue;
    const indent = raw.match(/^\s*/)[0].length, line = raw.trim().replace(/\s{2,}/g, ' ');
    const last = out[out.length - 1];
    if (!last || START.test(line) || indent <= last.indent - 2) { out.push({ indent, text: line }); continue; }
    const cjk = /[　-鿿＀-￯]$/.test(last.text) || /^[　-鿿＀-￯]/.test(line);
    last.text += (cjk ? '' : ' ') + line;
  }
  const base = Math.min(...out.map((p) => p.indent));
  return out.map((p) => '  '.repeat(Math.min(4, Math.round((p.indent - base) / 3))) + p.text).join('\n');
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nhi-rules-'));
const files = {};
let fetched = 0, reused = 0, failed = 0, inARow = 0, blocked = false;
for (const name of wanted) {
  if (prev[name]) { files[name] = prev[name]; reused++; continue; }
  // the NHI site may refuse this machine altogether (it has refused GitHub's servers): after five failures in a row stop asking
  if (blocked) { if (older[name]) { files[name] = older[name]; reused++; } else failed++; continue; }
  try {
    const res = await fetch(URL + encodeURIComponent(name), { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const pdf = path.join(tmp, 'r.pdf');
    fs.writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
    const text = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', pdf, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    // a PDF whose Chinese font could not be read gives text without any Chinese: leave it out so the next run tries again
    if (!/[一-鿿]/.test(text)) throw new Error('no Chinese text extracted');
    files[name] = tidy(text);
    fetched++; inARow = 0;
  } catch (e) {
    if (older[name]) { files[name] = older[name]; reused++; } else failed++;
    console.warn('skip', name, e.message);
    if (++inARow >= 5 && !fetched) { blocked = true; console.warn('The NHI site is not answering; keeping last week\'s texts for the rest.'); }
  }
  await new Promise((r) => setTimeout(r, 250));   // gentle on the NHI server
}
fs.rmSync(tmp, { recursive: true, force: true });

const metaFile = path.join(dir, 'meta.json');
const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
const rv = crypto.createHash('sha1').update(JSON.stringify(files)).digest('hex').slice(0, 10);
meta.v = crypto.createHash('sha1').update(meta.v + rv).digest('hex').slice(0, 10);
meta.counts.rules = Object.keys(files).length;
fs.writeFileSync(path.join(dir, 'rules.json'), JSON.stringify({ v: meta.v, tidy: TIDY, files }));
fs.writeFileSync(metaFile, JSON.stringify(meta));
console.log(`rules.json: ${Object.keys(files).length} of ${wanted.length} files (${fetched} fetched, ${reused} reused, ${failed} failed), ${(fs.statSync(path.join(dir, 'rules.json')).size / 1e6).toFixed(1)} MB`);
// missing texts only mean "open the PDF" on the page; fail the run only when there is nothing at all
if (!Object.keys(files).length && wanted.length) { console.error('No rule text could be fetched or kept.'); process.exit(1); }

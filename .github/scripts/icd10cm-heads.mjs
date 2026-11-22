// ICD-10-CM names the code list builder (Research-toolkit/codelist/) needs beyond NLM Clinical Tables:
//   heads  names of the header codes that are not billable (I50, I50.2 …), which Clinical Tables leaves out
//   tree   chapters › sections (blocks such as F01-F09) › three-character categories, for browsing without a search
// Source: CDC NCHS ICD-10-CM release files (public domain):
//   icd10cm-Code Descriptions-YYYY.zip → icd10cm-order-YYYY.txt
//   icd10cm-table and index-YYYY.zip   → icd10cm-tabular-YYYY.xml
//   https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD10CM/
// Usage (once a year, when a new fiscal-year release comes out):
//   node .github/scripts/icd10cm-heads.mjs icd10cm-order-2026.txt icd10cm-tabular-2026.xml FY2026
// then bump the ?v= that codelist/index.html uses for icd10cm-heads.json.
import fs from 'node:fs';

const [orderFile, xmlFile, release = ''] = process.argv.slice(2);
if (!orderFile || !xmlFile) { console.error('usage: icd10cm-heads.mjs <icd10cm-order-YYYY.txt> <icd10cm-tabular-YYYY.xml> [release]'); process.exit(1); }
const dot = (c) => (c.length > 3 ? c.slice(0, 3) + '.' + c.slice(3) : c);

const heads = {};
for (const line of fs.readFileSync(orderFile, 'utf8').split(/\r?\n/)) {
  // fixed width: order(5) space code(7) space billable(1) space short(60) space long
  if (line.length < 16 || line[14] !== '0') continue;
  heads[dot(line.slice(6, 13).trim())] = line.slice(77).trim() || line.slice(16, 76).trim();
}

const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();
const xml = fs.readFileSync(xmlFile, 'utf8');
const tree = [];
for (const ch of xml.split('<chapter>').slice(1)) {
  const num = (ch.match(/<name>([^<]+)<\/name>/) || [])[1];
  const desc = unxml((ch.match(/<desc>([^<]+)<\/desc>/) || [])[1] || '');
  const sections = [];
  for (const sec of ch.split('<section id="').slice(1)) {
    const id = sec.slice(0, sec.indexOf('"'));
    const sdesc = unxml((sec.match(/<desc>([^<]+)<\/desc>/) || [])[1] || '');
    const cats = [];
    for (const m of sec.matchAll(/<diag>\s*<name>([A-Z][0-9][0-9A-Z])<\/name>\s*<desc>([^<]+)<\/desc>/g)) {
      cats.push([m[1], unxml(m[2]), heads[m[1]] ? 1 : 0]);   // 1 = has codes below it
    }
    if (cats.length) sections.push([id, sdesc.replace(/\s*\([A-Z0-9-]+\)\s*$/, ''), cats]);
  }
  tree.push([num, desc.replace(/\s*\([A-Z0-9-]+\)\s*$/, ''), (desc.match(/\(([A-Z0-9-]+)\)\s*$/) || [])[1] || '', sections]);
}
const out = 'Research-toolkit/codelist/icd10cm-heads.json';
fs.writeFileSync(out, JSON.stringify({ release, source: 'CDC NCHS ICD-10-CM tabular order file and tabular XML', heads, tree }));
const nSec = tree.reduce((a, c) => a + c[3].length, 0), nCat = tree.reduce((a, c) => a + c[3].reduce((b, s) => b + s[2].length, 0), 0);
console.log(out, Object.keys(heads).length, 'header codes,', tree.length, 'chapters,', nSec, 'sections,', nCat, 'categories,', (fs.statSync(out).size / 1e6).toFixed(2) + ' MB');

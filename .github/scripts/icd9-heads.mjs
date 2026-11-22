// Names of the ICD-9-CM header codes (categories such as 394 and subcategories such as 250.0 for diagnoses;
// 39 and 39.9 for procedures), which NLM Clinical Tables leaves out. Used by Research-toolkit/codelist/.
// Source: CDC NCHS ICD-9-CM tabular lists, final edition (FY2012, public domain):
//   https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD9-CM/2011/Dtab12.zip  (diagnoses)
//   https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Publications/ICD9-CM/2011/Ptab12.zip  (procedures)
// ICD-9-CM is frozen, so this only ever needs to run once:
//   node .github/scripts/icd9-heads.mjs Dtab12.rtf Ptab12.RTF
import fs from 'node:fs';

const [dFile, pFile] = process.argv.slice(2);
if (!dFile || !pFile) { console.error('usage: icd9-heads.mjs <Dtab12.rtf> <Ptab12.rtf>'); process.exit(1); }

// RTF to plain text, good enough for "code<TAB>title" lines
function rtfText(rtf) {
  return rtf
    .replace(/(\\[a-z]+-?\d*)\r?\n/gi, '$1 ').replace(/\r?\n/g, '')   // line breaks in RTF source are not text
    .replace(/\{\\\*[^{}]*\}/g, '')                       // destinations such as bookmarks
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\tab\b ?/g, '\t').replace(/\\(par|line)\b ?/g, '\n')
    .replace(/\\[a-z]+-?\d* ?/gi, '')                     // other control words
    .replace(/[{}]/g, '')
    .replace(/\r/g, '');
}
// a title is either on the code's line ("394<TAB>Diseases of mitral valve") or on the next line ("39.9" / "<TAB>Other operations on vessels")
function heads(file, code) {
  const out = {};
  const lines = rtfText(fs.readFileSync(file, 'latin1')).split('\n').map((s) => s.trim()).filter(Boolean);
  const same = new RegExp('^(' + code + ')\\t+(\\S.*)$'), alone = new RegExp('^(' + code + ')$');
  lines.forEach((line, i) => {
    let m = line.match(same), name = m && m[2];
    if (!m) { m = line.match(alone); if (m && lines[i + 1] && !/^(Excludes|Includes|Note|Code also|Use additional)/i.test(lines[i + 1])) name = lines[i + 1]; }
    if (m && name && !out[m[1]]) out[m[1]] = name.replace(/\s+/g, ' ').trim();
  });
  return out;
}
// diagnoses: 3-character categories (001, V58, E880) and 4-character subcategories (250.0, V58.6, E880.0)
const dx = heads(dFile, '(?:\\d{3}|V\\d{2}|E\\d{3})(?:\\.\\d)?');
// procedures: 2-digit categories (39) and 3-digit subcategories (39.9)
const px = heads(pFile, '\\d{2}(?:\\.\\d)?');
const out = 'Research-toolkit/codelist/icd9-heads.json';
fs.writeFileSync(out, JSON.stringify({ release: 'ICD-9-CM FY2012 (final)', source: 'CDC NCHS ICD-9-CM tabular lists', dx, px }));
console.log(out, Object.keys(dx).length, 'diagnosis headers,', Object.keys(px).length, 'procedure headers,', (fs.statSync(out).size / 1e3).toFixed(0) + ' KB');

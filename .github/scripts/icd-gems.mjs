// ICD-9-CM <-> ICD-10-CM diagnosis General Equivalence Mappings (CMS / CDC, 2018: the final release)
// → Research-toolkit/codelist/icd-gems.json. The GEMs are frozen, so this never needs rerunning.
// Run: node .github/scripts/icd-gems.mjs
//
// Each direction maps a source code (no dot) to one string: its targets separated by spaces, each as CODE or
// CODE~ (approximate only) or CODE~flags with the five GEM flags (approximate, no map, combination, scenario,
// choice) otherwise. A code with no equivalent maps to "-".
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://ftp.cdc.gov/pub/health_statistics/nchs/publications/ICD10CM/2018/';
const out = join(dirname(fileURLToPath(import.meta.url)), '../../Research-toolkit/codelist/icd-gems.json');

async function gem(file) {
  const r = await fetch(BASE + file);
  if (!r.ok) throw new Error(file + ': HTTP ' + r.status);
  const map = {};
  for (const line of (await r.text()).split(/\r?\n/)) {
    const [src, tgt, flags] = line.trim().split(/\s+/);
    if (!src || !flags) continue;
    const v = flags[1] === '1' ? '-' : flags === '00000' ? tgt : flags === '10000' ? tgt + '~' : tgt + '~' + flags;
    map[src] = map[src] ? map[src] + ' ' + v : v;
  }
  return map;
}

const [d9, d10] = await Promise.all([gem('2018_I9gem.txt'), gem('2018_I10gem.txt')]);
writeFileSync(out, JSON.stringify({
  release: '2018',
  source: 'CMS / CDC NCHS, 2018 diagnosis General Equivalence Mappings (2018_I9gem.txt, 2018_I10gem.txt), public domain',
  d9, d10,
}));
console.log('ICD-9 codes', Object.keys(d9).length, '· ICD-10 codes', Object.keys(d10).length);

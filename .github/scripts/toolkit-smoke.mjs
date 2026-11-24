// Smoke test for the Research Toolkit: opens the home page and every tool, fails on script errors or on files
// of this site that do not load, and on pages with an Example button loads the example and checks a figure is drawn.
// Run: serve the repository root (npx http-server . -p 8765), then
//   BASE=http://localhost:8765 node .github/scripts/toolkit-smoke.mjs
// CHANNEL=msedge (or chrome) uses an installed browser instead of Playwright's own Chromium.
import { readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = (process.env.BASE || 'http://localhost:8765').replace(/\/$/, '');
const root = process.env.ROOT || join(dirname(fileURLToPath(import.meta.url)), '../../Research-toolkit');
const tools = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(root, d.name, 'index.html')))
  .map((d) => d.name);
const pages = ['', ...tools];

const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
const failures = [];
for (const p of pages) {
  const url = `${BASE}/Research-toolkit/${p ? p + '/' : ''}`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('script error: ' + (e.message || e)));
  page.on('response', (r) => { if (r.url().startsWith(BASE) && r.status() >= 400) errs.push(`HTTP ${r.status()}: ${r.url().slice(BASE.length)}`); });
  page.on('requestfailed', (r) => { if (r.url().startsWith(BASE)) errs.push(`failed: ${r.url().slice(BASE.length)} (${r.failure()?.errorText})`); });
  page.on('dialog', (d) => d.accept());
  let note = '';
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1500);
    if (await page.$('#btnExample')) {
      await page.evaluate(() => document.getElementById('btnExample').click());
      await page.waitForTimeout(1500);
      if (await page.$('#preview')) {
        const drawn = await page.evaluate(() => {
          const el = document.querySelector('#preview svg, #preview canvas');
          if (!el) return 0;
          const b = el.getBoundingClientRect();
          return el.tagName.toLowerCase() === 'svg' ? (b.width > 50 && b.height > 50 ? el.querySelectorAll('*').length : 0) : b.width * b.height;
        });
        if (!drawn) errs.push('example loaded but no figure was drawn in #preview');
        note = 'example drawn';
      } else note = 'example loaded';
    }
  } catch (e) { errs.push('could not open: ' + (e.message || e).split('\n')[0]); }
  console.log(`${errs.length ? '✗' : '✓'} ${p || '(home)'}${note ? ' · ' + note : ''}`);
  errs.forEach((e) => console.log('    ' + e));
  if (errs.length) failures.push(p || '(home)');
  await ctx.close();
}
await browser.close();
if (failures.length) { console.log(`\n${failures.length} page(s) failed: ${failures.join(', ')}`); process.exit(1); }
console.log(`\nAll ${pages.length} pages passed.`);

// Feature tests for the Taiwan drug lookup (Research-toolkit/drugs/), run against the fixed copy of the data in
// .github/fixtures/tw-drugs/ (built by tw-drugs-fixture.mjs) so the results do not move with the weekly data.
// Run: serve the repository root (npx http-server . -p 8765), then
//   BASE=http://localhost:8765 node .github/scripts/drugs-test.mjs
// CHANNEL=msedge (or chrome) uses an installed browser instead of Playwright's own Chromium.
// FIX=<dir> reads the data from another folder (the default is .github/fixtures/tw-drugs/).
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = (process.env.BASE || 'http://localhost:8765').replace(/\/$/, '');
const FIX = process.env.FIX || join(dirname(fileURLToPath(import.meta.url)), '../fixtures/tw-drugs');
const URL0 = `${BASE}/Research-toolkit/drugs/`;
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
const results = [];

async function open(path = '', mobile = false) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' }
    : { viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  // the data come from the fixture; outside images are not needed
  await ctx.route('**/Research-toolkit/data/tw-drugs/**', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    const f = join(FIX, name);
    return existsSync(f) ? route.fulfill({ status: 200, contentType: 'application/json', body: readFileSync(f) }) : route.fulfill({ status: 404, body: '' });
  });
  await ctx.route(/^https:\/\/(mcp\.fda\.gov\.tw|cdn\.jsdelivr\.net\/gh|raw\.githubusercontent\.com)\//, (route) => route.abort());
  const page = await ctx.newPage();
  page.errs = [];
  page.on('pageerror', (e) => page.errs.push('script error: ' + (e.message || e)));
  page.on('dialog', (d) => d.accept());
  await page.goto(URL0 + path, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('#out .home, #out ul.res, #out .detail, #out .empty-state, #vPill .pill-f, #vBatch .batch, #vAlerts > *, #vChanges > *'), null, { timeout: 20000 }).catch(() => {});
  return page;
}
async function test(name, fn) {
  let page = null;
  try {
    page = await fn();
    const errs = page && page.errs ? page.errs : [];
    if (errs.length) throw new Error(errs.join('; '));
    results.push([name, true]); console.log('✓ ' + name);
  } catch (e) {
    results.push([name, false]); console.log('✗ ' + name + '\n    ' + String(e.message || e).split('\n')[0]);
  } finally { if (page) await page.context().close(); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const type = async (page, q) => { await page.fill('#q', q); await page.waitForTimeout(600); };

await test('start page shows the four tasks', async () => {
  const p = await open('?view=search');
  ok(await p.locator('#out .task').count() === 4, 'expected four task buttons');
  return p;
});
await test('search lists results with a price-group strip', async () => {
  const p = await open('?view=search');
  await type(p, 'metformin');
  ok(await p.locator('#out li[data-code]').count() > 10, 'too few results');
  ok(await p.locator('#out .gs-t').count() > 0, 'no price-group strip');
  ok(/筆健保品項|NHI items/.test(await p.locator('#status').innerText()), 'no summary line');
  return p;
});
await test('a misspelt name is corrected', async () => {
  const p = await open('?view=search');
  await type(p, 'metformine');
  ok(await p.locator('#out .fix-note').count() === 1, 'no correction note');
  ok(await p.locator('#out li[data-code]').count() > 0, 'no results after correction');
  return p;
});
await test('an indication finds drugs', async () => {
  const p = await open('?view=search');
  await type(p, '糖尿病');
  await p.waitForSelector('#out .ind-hit', { timeout: 10000 });
  return p;
});
await test('table and card views', async () => {
  const p = await open('?view=search');
  await type(p, 'metformin');
  await p.click('[data-rview="table"]'); ok(await p.locator('#out ul.res.tbl li[data-code]').count() > 0, 'no table rows');
  await p.click('[data-rview="cards"]'); ok(await p.locator('#out ul.res.cards li[data-code]').count() > 0, 'no cards');
  await p.click('[data-rview="list"]');
  return p;
});
await test('a full NHI code opens the drug with its key numbers and chart', async () => {
  const p = await open('?view=search');
  await type(p, 'AC57265100');
  await p.waitForSelector('#out .detail .kpis', { timeout: 10000 });
  ok(await p.locator('#out .detail .kpi:not([hidden])').count() >= 2, 'too few key numbers');
  await p.waitForSelector('#out .detail .tl svg', { timeout: 10000 });
  ok(await p.locator('#out .detail .tabs [data-tab]').count() === 5, 'expected five tabs');
  return p;
});
await test('cost per month and per DDD', async () => {
  const p = await open('?q=AC57265100&code=AC57265100');
  await p.waitForSelector('#out .detail', { timeout: 10000 });
  await p.click('#out .detail [data-tab="price"]');
  await p.fill('#out .cost [data-cq]', '2');
  ok(/\$\d/.test(await p.locator('#out .cost-sum').first().innerText()), 'no monthly cost');
  await p.fill('#out .ddd [data-dv]', '2');
  ok(/DDD/.test(await p.locator('#out [data-dddout]').innerText()) && /\$\d/.test(await p.locator('#out [data-dddout]').innerText()), 'no cost per DDD');
  return p;
});
await test('ingredient overview', async () => {
  const p = await open('?q=AC57265100&code=AC57265100');
  await p.waitForSelector('#out .detail [data-act="ing"]', { timeout: 10000 });
  await p.click('#out .detail [data-act="ing"]');
  await p.waitForSelector('#ingBody .ing-t tbody tr', { timeout: 15000 });
  ok(await p.evaluate(() => document.getElementById('ingDlg').open), 'dialog not open');
  return p;
});
await test('safety notice on colchicine', async () => {
  const p = await open('?q=A005225100&code=A005225100');
  await p.waitForSelector('#out .detail .banner.safe', { timeout: 10000 });
  return p;
});
await test('compare two drugs', async () => {
  const p = await open('?q=AC57265100&code=AC57265100');
  await p.waitForSelector('#out .detail [data-act="cmp"]', { timeout: 10000 });
  await p.click('#out .detail [data-act="cmp"]');
  await type(p, 'A036349100');
  await p.waitForSelector('#out .detail [data-act="cmp"]', { timeout: 10000 });
  await p.click('#out .detail [data-act="cmp"]');
  await p.click('#cmpGo');
  ok(await p.locator('#cmpBody tr').count() >= 10, 'comparison table too short');
  return p;
});
await test('filters show as removable chips', async () => {
  const p = await open('?view=search');
  await type(p, 'metformin');
  await p.click('#btnAdv');
  await p.fill('#aPmax', '1.6'); await p.waitForTimeout(400);
  ok(/1\.6/.test(await p.locator('#chips').innerText()), 'no chip for the price filter');
  await p.click('#chips [data-advk]'); await p.waitForTimeout(300);
  ok(!(await p.locator('#chips [data-advk]').count()), 'chip did not clear');
  return p;
});
await test('licences without an NHI code', async () => {
  const p = await open('?view=search');
  await p.selectOption('#scope', 'every');
  await type(p, 'finasteride');
  await p.waitForSelector('#out .lic-sec li[data-lic] .row', { timeout: 15000 });
  await p.locator('#out .lic-sec li[data-lic] .row').first().click();
  await p.waitForSelector('#out .detail[data-lic]', { timeout: 10000 });
  return p;
});
await test('pill finder', async () => {
  const p = await open('?view=pill');
  await p.waitForSelector('#vPill [data-pcol]', { timeout: 15000 });
  await p.waitForSelector('#pOut .empty-state, #pOut .res', { timeout: 15000 });
  await p.click('#vPill [data-pcol="白"]');
  await p.click('#vPill [data-pshape="橢圓形"]');
  await p.waitForSelector('#pOut .res li', { timeout: 10000 });
  return p;
});
await test('batch lookup', async () => {
  const p = await open('?view=batch');
  await p.waitForSelector('#bq', { timeout: 10000 });
  await p.fill('#bq', 'AC57265100\nA10BA02\nNOTREAL123');
  await p.click('#bGo');
  await p.waitForSelector('.batch-sum', { timeout: 15000 });
  ok(/找不到|not found/.test(await p.locator('.batch-sum').innerText()), 'no summary');
  ok(await p.locator('.batch-tbl tr.miss').count() === 1, 'expected one item not found');
  return p;
});
await test('news views and help', async () => {
  const p = await open('?view=alerts');
  ok(!(await p.locator('#newsBar').isHidden()), 'news bar hidden');
  await p.click('#newsBar [data-view="changes"]');
  await p.click('#btnHelp');
  ok(await p.evaluate(() => document.getElementById('helpDlg').open), 'help did not open');
  return p;
});
await test('phone: a drug opens as a full-screen sheet and closes', async () => {
  const p = await open('?view=search', true);
  await type(p, 'metformin');
  await p.locator('#out li[data-code] .row').first().click();
  await p.waitForSelector('#out .detail', { timeout: 10000 });
  ok(await p.evaluate(() => document.body.classList.contains('sheet-open')), 'sheet not open');
  await p.locator('#out .detail .d-back [data-act="close"]').click();
  await p.waitForTimeout(800);
  ok(!(await p.evaluate(() => document.body.classList.contains('sheet-open'))), 'sheet did not close');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 375), 'page scrolls sideways');
  return p;
});

await test('licences without an NHI code carry the TFDA ATC code and follow the ATC filter', async () => {
  const p = await open('?view=search');
  await p.selectOption('#scope', 'every');
  await type(p, 'finasteride');
  await p.waitForSelector('#out .lic-sec li[data-lic] .row', { timeout: 15000 });
  await p.waitForFunction(() => /ATC/.test(document.querySelector('#out .lic-sec .meta')?.innerText || ''), null, { timeout: 10000 });
  await p.fill('#q', ''); await p.waitForTimeout(300);
  await p.click('#btnAdv');
  await p.fill('#aAtc', 'D11AX'); await p.waitForTimeout(800);
  ok(await p.locator('#out .lic-sec li[data-lic]').count() > 0, 'the ATC filter left out the licences');
  return p;
});

await browser.close();
const bad = results.filter(([, v]) => !v);
if (bad.length) { console.log(`\n${bad.length} of ${results.length} drug-lookup tests failed.`); process.exit(1); }
console.log(`\nAll ${results.length} drug-lookup tests passed.`);

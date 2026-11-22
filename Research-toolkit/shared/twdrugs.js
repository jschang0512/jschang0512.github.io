/* Taiwan drug data (NHI drug list + TFDA licences) shared by drugs/ and codelist/.
 * Built weekly by .github/workflows/tw-drugs.yml into the branch "tw-drugs-data", with a git tag per version.
 * meta.json is read fresh from raw.githubusercontent.com; the data files come through jsDelivr at that version's
 * tag (a fixed, compressed, cached address), falling back to raw.githubusercontent.com. On a local server
 * everything is read from Research-toolkit/data/tw-drugs/.
 * Files: nhi-paid (reimbursed now, loaded first) + nhi-rest (no longer reimbursed, on request); fda (short
 * licence fields) + fda-more (indication and package, on request); hist, extra, rules (on request). */
(() => {
  const RT = window.RT;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const REPO = 'jschang0512/jschang0512.github.io';
  const BASE = local ? '/Research-toolkit/data/tw-drugs/' : `https://raw.githubusercontent.com/${REPO}/tw-drugs-data/`;
  const CDN = (tag) => `https://cdn.jsdelivr.net/gh/${REPO}@${tag}/`;
  const NHI_URL = 'https://info.nhi.gov.tw/api/INAE3000/INAE3000S01/getPDF?DurgFileName=';
  const LIC_URL = 'https://lmspiq.fda.gov.tw/web/DRPIQ/DRPIQ1000Result?licId=';
  const memo = {};

  // column positions, filled from the files themselves
  const N = {}, F = {};
  const colIndex = (cols, into) => cols.forEach((c, i) => (into[c] = i));

  async function meta() {
    if (memo.meta) return memo.meta;
    memo.meta = (async () => {
      try {
        const r = await fetch(BASE + 'meta.json', { cache: 'no-cache' });
        if (!r.ok) throw new Error(r.status);
        const m = await r.json();
        try { localStorage.setItem('rt:twdrugs:meta', JSON.stringify(m)); } catch (e) { /* ignore */ }
        return m;
      } catch (e) {
        // offline: the last version this browser saw is still in the service-worker cache
        let m = null; try { m = JSON.parse(localStorage.getItem('rt:twdrugs:meta') || 'null'); } catch (x) { m = null; }
        if (m) return m;
        memo.meta = null;
        throw new Error(RT.t('無法取得藥品資料（請確認網路連線）', 'Could not load the drug data (check your connection)'));
      }
    })();
    return memo.meta;
  }
  async function file(name) {
    if (memo[name]) return memo[name];
    memo[name] = (async () => {
      const m = await meta();
      const urls = [];
      if (!local && m.tag) urls.push(CDN(m.tag) + name + '.json');       // fixed address per version
      urls.push(BASE + name + '.json?v=' + m.v);
      let last = null;
      for (const u of urls) {
        try { const r = await fetch(u); if (r.ok) return await r.json(); last = new Error(name + '.json HTTP ' + r.status); } catch (e) { last = e; }
      }
      memo[name] = null;
      throw last;
    })();
    return memo[name];
  }
  const split = async () => ((await meta()).format || 1) >= 2;
  // NHI items reimbursed now: enough for most searches, about a third of the codes
  async function nhi() {
    if (memo.nhiD) return memo.nhiD;
    memo.nhiD = (async () => {
      const d = await file((await split()) ? 'nhi-paid' : 'nhi');
      if (!d._ready) {
        colIndex(d.cols, N);
        d.byCode = new Map(d.rows.map((r) => [r[N.code], r]));
        d.complete = !(await split());
        d._ready = true;
      }
      return d;
    })();
    memo.nhiD.catch(() => { memo.nhiD = null; });
    return memo.nhiD;
  }
  // every NHI code ever listed: adds the ones no longer reimbursed to the same object
  async function nhiAll() {
    const d = await nhi();
    if (d.complete) return d;
    if (!memo.rest) memo.rest = file('nhi-rest').then((rest) => {
      if (!d.complete) { rest.rows.forEach((r) => { d.rows.push(r); d.byCode.set(r[N.code], r); }); d.complete = true; }
      return d;
    }).catch((e) => { memo.rest = null; throw e; });
    return memo.rest;
  }
  async function fda() {
    const d = await file('fda');
    if (!d._ready) {
      colIndex(d.cols, F);
      d.byLicId = new Map(d.rows.filter((r) => r[F.licId]).map((r) => [r[F.licId], r]));
      d._ready = true;
    }
    return d;
  }
  // indication and package text, kept apart from the short licence fields
  let moreD = null;
  async function fdaMore() {
    if (F.indication != null) return null;          // first-version data: already in fda.json
    if (!moreD) moreD = await file('fda-more');
    return moreD;
  }
  function licText(f) {
    if (!f) return null;
    if (F.indication != null) return { indication: f[F.indication] || '', package: f[F.package] || '' };
    if (!moreD) return null;
    const x = moreD.more[f[F.licence]] || [];
    const o = {}; moreD.cols.forEach((c, i) => (o[c] = x[i] || ''));
    return o;
  }
  async function hist(code) {
    const d = await file('hist');
    const s = d.hist[code];
    const rows = s ? s.split(';').map((x) => { const [t, p] = x.split(':'); return { date: t ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` : '', price: +p }; }) : [];
    return rows;
  }
  // appearance (photo, shape, colour, markings) and leaflet / carton links, keyed by licence number
  async function extra() { return file('extra'); }
  // full text of the NHI reimbursement rules, keyed by PDF file name
  async function rules() { return file('rules'); }
  // recalls (per licence), shortages and recoveries (per licence); an empty set for data built before they existed
  async function alerts() { return ((await meta()).counts || {}).recalls != null ? file('alerts') : { recallCols: [], supplyCols: [], recalls: {}, short: {}, recovered: {} }; }
  // NHI usage per code and year: {years:[{year, from, to, partial}], q:{code:[[total, male], …]}}
  async function usage() { return ((await meta()).counts || {}).usageYears ? file('usage') : { years: [], q: {} }; }
  // what changed week by week: {weeks:[{from, to, added, up, down, delisted, relisted, rules, newShort, resolved, newRecalls}]}
  async function changes() { return ((await meta()).counts || {}).usageYears != null ? file('changes') : { weeks: [] }; }
  // the date in a rule PDF's name: 5.1._20250601.pdf → 2025-06-01
  const ruleDate = (f) => { const m = String(f || '').match(/_(\d{4})(\d{2})(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : ''; };
  // full-width letters and digits → half-width, lower case, no spaces
  const fold = (s) => String(s || '').replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ').toLowerCase();

  RT.twDrugs = {
    BASE, N, F, meta, nhi, nhiAll, fda, fdaMore, licText, hist, extra, rules, alerts, usage, changes, ruleDate, fold,
    /** 第一級…第四級管制藥品 (not 取消管制藥品註記, which marks a schedule that was lifted) */
    ctrlLevel: (v) => { const m = String(v || '').match(/^第(.)級管制藥品$/); return m ? '一二三四'.indexOf(m[1]) + 1 : 0; },
    /** NHI codes ending in G0 are the foil-packed (PTP) version of the same product; worked out from the data, not an NHIA definition */
    isFoil: (code) => /G0$/.test(code),
    ruleUrl: (f) => NHI_URL + encodeURIComponent(f),
    licUrl: (id) => LIC_URL + encodeURIComponent(id),
    /** NHI codes whose ATC code starts with the given prefix (A10BA → metformin, phenformin...), delisted ones included */
    async byAtc(prefix) {
      const d = await nhiAll(); const p = String(prefix || '').toUpperCase().trim();
      return p ? d.rows.filter((r) => r[N.atc].startsWith(p)) : [];
    },
    sourceNote: () => RT.t(
      '藥品資料：衛生福利部中央健康保險署「健保用藥品項」與藥品給付規定，衛生福利部食品藥物管理署「全部藥品許可證資料集」「藥品外觀資料集」「藥品仿單外盒資料集」，依政府資料開放授權條款第 1 版使用，每週自動更新。內容僅供參考，給付與許可證狀態以兩署公告為準。',
      'Drug data: National Health Insurance Administration “NHI drug list” and reimbursement rules; Taiwan FDA “All drug licences”, “Drug appearance” and “Leaflets and cartons” datasets; used under the Open Government Data License, Taiwan v1.0, refreshed weekly. For reference only: reimbursement and licence status are as published by the two agencies.'),
  };
})();

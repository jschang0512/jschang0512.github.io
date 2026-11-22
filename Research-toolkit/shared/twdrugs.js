/* Taiwan drug data (NHI drug list + TFDA licences) shared by drugs/ and codelist/.
 * Built weekly by .github/workflows/tw-drugs.yml into the branch "tw-drugs-data" and read from
 * raw.githubusercontent.com. On a local server it reads Research-toolkit/data/tw-drugs/ instead. */
(() => {
  const RT = window.RT;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const BASE = local ? '/Research-toolkit/data/tw-drugs/' : 'https://raw.githubusercontent.com/jschang0512/jschang0512.github.io/tw-drugs-data/';
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
      const r = await fetch(BASE + name + '.json?v=' + m.v);
      if (!r.ok) { memo[name] = null; throw new Error(name + '.json HTTP ' + r.status); }
      return r.json();
    })();
    return memo[name];
  }
  async function nhi() {
    const d = await file('nhi');
    if (!d._ready) {
      colIndex(d.cols, N);
      d.byCode = new Map(d.rows.map((r) => [r[N.code], r]));
      d._ready = true;
    }
    return d;
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
  // full-width letters and digits → half-width, lower case, no spaces
  const fold = (s) => String(s || '').replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ').toLowerCase();

  RT.twDrugs = {
    BASE, N, F, meta, nhi, fda, hist, extra, rules, fold,
    /** 第一級…第四級管制藥品 (not 取消管制藥品註記, which marks a schedule that was lifted) */
    ctrlLevel: (v) => { const m = String(v || '').match(/^第(.)級管制藥品$/); return m ? '一二三四'.indexOf(m[1]) + 1 : 0; },
    /** NHI codes ending in G0 are the foil-packed (PTP) version of the same product; worked out from the data, not an NHIA definition */
    isFoil: (code) => /G0$/.test(code),
    ruleUrl: (f) => NHI_URL + encodeURIComponent(f),
    licUrl: (id) => LIC_URL + encodeURIComponent(id),
    /** NHI codes whose ATC code starts with the given prefix (A10BA → metformin, phenformin...) */
    async byAtc(prefix) {
      const d = await nhi(); const p = String(prefix || '').toUpperCase().trim();
      return p ? d.rows.filter((r) => r[N.atc].startsWith(p)) : [];
    },
    sourceNote: () => RT.t(
      '藥品資料：衛生福利部中央健康保險署「健保用藥品項」與藥品給付規定，衛生福利部食品藥物管理署「全部藥品許可證資料集」「藥品外觀資料集」「藥品仿單外盒資料集」，依政府資料開放授權條款第 1 版使用，每週自動更新。內容僅供參考，給付與許可證狀態以兩署公告為準。',
      'Drug data: National Health Insurance Administration “NHI drug list” and reimbursement rules; Taiwan FDA “All drug licences”, “Drug appearance” and “Leaflets and cartons” datasets; used under the Open Government Data License, Taiwan v1.0, refreshed weekly. For reference only: reimbursement and licence status are as published by the two agencies.'),
  };
})();

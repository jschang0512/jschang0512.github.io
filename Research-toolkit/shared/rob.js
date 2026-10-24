/* Risk-of-bias assessment + robvis-style plots, shared by the RoB 2 and ROBINS-I pages.
 * Only domain names and judgement categories are used; the official signalling questions
 * live in the official tools (riskofbias.info) and are not reproduced here.
 */
(function () {
  const T = RT.t;

  const CSS = `
  /* the judgement grid needs a wider form column than the other tools */
  @media (min-width: 961px) { .tool { grid-template-columns: minmax(340px, 600px) minmax(0, 1fr); } }
  .rob-wrap { overflow-x: auto; margin: 0 -4px; }
  .rob-tbl { border-collapse: separate; border-spacing: 3px; font-size: 12.5px; }
  .rob-tbl th { font-weight: 600; color: var(--muted); font-size: 12.5px; text-align: center; padding: 0 2px; white-space: nowrap; }
  .rob-tbl td.nm input { width: 124px; }
  /* phones: the study name stays visible while the judgements scroll sideways */
  .rob-tbl td.nm, .rob-tbl th:first-child { position: sticky; left: 0; z-index: 1; background: var(--bg); }
  .rob-tbl select { width: 50px; padding: 5px 2px; text-align: center; text-align-last: center; font-weight: 700; border-radius: 6px; cursor: pointer; }
  .rob-tbl select.ov { width: 92px; }
  .rob-tbl .det td { padding: 6px 4px 10px; }
  .rob-det { display: grid; gap: 6px; }
  .rob-det .dom { font-size: 12px; font-weight: 600; margin-bottom: 2px; }
  .rob-legend { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12px; color: var(--muted); margin-top: 8px; }
  .rob-legend i { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; font-style: normal; font-weight: 700; font-size: 11px; margin-right: 4px; vertical-align: -4px; }
  .dom-row { display: grid; grid-template-columns: 58px minmax(0, 1fr); gap: 6px; margin-bottom: 6px; align-items: center; }
  `;

  /**
   * cfg: { key, variants: {id: {zh, en, domains:[{code, name}]}}, judgments:[{v, label, zh, sym, color, text, rank, only?:[codes], optional?:true}],
   *        overall(values, J) → v, exampleStudies, refs, noteZh, noteEn, filePrefix }
   */
  RT.robTool = function (cfg) {
    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: CSS }));
    const J = Object.fromEntries(cfg.judgments.map((j) => [j.v, j]));
    const PALETTES = {
      modern: { zh: '精緻（預設）', en: 'Refined (default)', map: (j) => ({ 0: '#2E9E5B', 1: '#93C572', 2: '#F2C14E', 3: '#D64545', 4: '#7A1F2B', 9: '#8FB3D9' }[j.rank]) },
      robvis: { zh: 'robvis 經典（綠／黃／紅）', en: 'robvis classic (green / yellow / red)', map: (j) => j.color },
      cb: { zh: '色盲友善（藍／橘／朱紅）', en: 'Colour-blind safe (blue / orange / vermilion)', map: (j) => ({ 0: '#56B4E9', 1: '#9ED3F2', 2: '#E69F00', 3: '#D55E00', 4: '#5A1E00', 9: '#BBBBBB' }[j.rank]) },
      gray: { zh: '灰階（期刊黑白）', en: 'Grayscale (print)', map: (j) => ({ 0: '#FFFFFF', 1: '#E6E6E6', 2: '#BDBDBD', 3: '#6E6E6E', 4: '#262626', 9: '#F2F2F2' }[j.rank]) },
    };
    const DEF = {
      variant: Object.keys(cfg.variants)[0], allowNI: false, names: {}, studies: structuredClone(cfg.exampleStudies || []),
      plot: 'traffic', title: '', symbols: true, showResult: false, palette: 'modern', cellR: 12, useWeights: false, pctLabels: true, barW: 520,
      st: { ...RT.STYLE_DEF, fontSize: 12.5, lh: 1.3 },
    };
    let S = RT.load(cfg.key, DEF);
    // One-time move to the refined palette for people who had the old default saved
    if (!S.styleV2) { if (S.palette === 'robvis') S.palette = 'modern'; S.styleV2 = true; }
    const form = document.getElementById('form');
    document.getElementById('styleFields').innerHTML = RT.styleFieldsHTML(['font', 'fontSize', 'lh']);
    document.getElementById('refs').innerHTML = RT.refsHTML(cfg.refs, [RT.LICENSES.rob]);
    document.getElementById('variantSel').innerHTML = Object.entries(cfg.variants).map(([id, v]) => `<option value="${id}">${RT.esc(T(v.zh, v.en))}</option>`).join('');
    document.getElementById('paletteSel').innerHTML = Object.entries(PALETTES).map(([id, p]) => `<option value="${id}">${RT.esc(T(p.zh, p.en))}</option>`).join('');

    const domains = () => cfg.variants[S.variant].domains.map((d) => ({ ...d, name: (S.names[S.variant] || {})[d.code] || d.name }));
    const colorOf = (v) => (J[v] ? PALETTES[S.palette]?.map(J[v]) || J[v].color : '#E0E0E0');
    const lum = (rgb) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
    const uiPair = (c) => {
      const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(c || ''); if (!m) return { bg: c, fg: '' };
      let rgb = m.slice(1).map((x) => parseInt(x, 16));
      const dark = [31, 41, 51];
      const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      if (cr(rgb, dark) >= 4.5) return { bg: c, fg: '#1F2933' };
      for (let i = 0; i < 12 && cr(rgb, [255, 255, 255]) < 4.5; i++) rgb = rgb.map((x) => Math.round(x * 0.92));
      return { bg: '#' + rgb.map((x) => x.toString(16).padStart(2, '0')).join(''), fg: '#FFFFFF' };
    };
    const textOn = (c) => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(c || ''); if (!m) return '#000'; const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16)); return 0.299 * r + 0.587 * g + 0.114 * b < (S.palette === 'modern' ? 150 : 110) ? '#FFFFFF' : '#1F2933'; };
    const inVariant = (j) => !j.variants || j.variants.includes(S.variant);
    const allowed = (code) => cfg.judgments.filter((j) => inVariant(j) && (!j.optional || S.allowNI) && (!j.only || j.only.includes(code)) && (!j.allow || j.allow(code, S.variant)));
    /** overall is only derived once every domain has a judgement (tools define overall from all domains) */
    const overallOf = (st) => {
      const byCode = Object.fromEntries(domains().map((d) => [d.code, st.j[d.code] || '']));
      const vals = Object.values(byCode);
      if (vals.some((v) => !v)) return '';
      return cfg.overall(vals, J, byCode, S.variant);
    };
    const isIncomplete = (st) => domains().some((d) => !st.j[d.code]);
    const effOverall = (st) => (st.overall && st.overall !== 'auto' ? st.overall : overallOf(st));

    /* ---------------- form ---------------- */
    function syncInputs() {
      RT.syncForm(form, S);
      document.getElementById('variantSel').value = S.variant;
      document.getElementById('paletteSel').value = S.palette;
      renderDomains(); renderGrid(); renderLegend();
    }
    RT.bindForm(form, () => S, () => { renderGrid(); renderLegend(); update(); });
    // "Bias in selection of participants into the study (or into the analysis)" → "selection participants into study"
    const domainKey = (name) => String(name || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/^bias (due to|in) /, '')
      .replace(/\b(the|of)\b/g, ' ').replace(/outcomes/g, 'outcome').replace(/\s+/g, ' ').trim();
    document.getElementById('variantSel').onchange = (e) => {
      const from = cfg.variants[S.variant].domains, to = cfg.variants[e.target.value].domains;
      const map = {};   // new code → old code with the same domain
      to.forEach((d) => { const hit = from.find((o) => domainKey(o.name) === domainKey(d.name)); if (hit) map[d.code] = hit.code; });
      const fresh = to.filter((d) => !map[d.code]).map((d) => d.code);
      S.studies.forEach((st) => {
        const j = {}, sup = {};
        to.forEach((d) => { if (map[d.code]) { j[d.code] = st.j[map[d.code]] || ''; sup[d.code] = (st.sup || {})[map[d.code]] || ''; } });
        st.j = j; st.sup = sup;
      });
      S.variant = e.target.value;
      // drop judgements that the chosen version does not allow in that domain
      let dropped = 0;
      S.studies.forEach((st) => {
        domains().forEach((d) => { const v = st.j[d.code]; if (v && !allowed(d.code).some((j) => j.v === v)) { st.j[d.code] = ''; dropped++; } });
        if (st.overall && st.overall !== 'auto' && !allowed('overall').some((j) => j.v === st.overall)) st.overall = 'auto';
      });
      renderDomains(); renderGrid(); renderLegend(); update();
      RT.toast(T(`已依 domain 名稱對應判斷${fresh.length ? `；${fresh.join('、')} 是新的 domain，請判斷` : ''}${dropped ? `；${dropped} 格判斷在此版本不適用，已清空` : ''}。`, `Judgements carried over by domain name${fresh.length ? `; ${fresh.join(', ')} ${fresh.length === 1 ? 'is a new domain' : 'are new domains'}, please judge` : ''}${dropped ? `; ${dropped} not allowed in this version, cleared` : ''}.`), 7000);
    };
    document.getElementById('paletteSel').onchange = (e) => { S.palette = e.target.value; renderGrid(); renderLegend(); update(); };
    function renderDomains() {
      const host = document.getElementById('domains');
      host.innerHTML = '';
      domains().forEach((d) => {
        const r = RT.h(`<div class="dom-row"><b style="font-size:12.5px">${RT.esc(d.code)}</b><input></div>`);
        const inp = r.querySelector('input');
        inp.value = d.name;
        inp.oninput = () => { (S.names[S.variant] ||= {})[d.code] = inp.value; update(); };
        host.appendChild(r);
      });
    }
    function renderLegend() {
      document.getElementById('legend').innerHTML = cfg.judgments.filter((j) => inVariant(j) && (!j.optional || S.allowNI)).map((j) => {
        const c = colorOf(j.v);
        const p = uiPair(c);
        return `<span><i style="background:${p.bg};color:${p.fg};border:1px solid rgba(0,0,0,.2)">${RT.esc(j.uiSym || j.sym)}</i>${RT.esc(T(j.zh, j.label))}${j.only ? ` <small>${T('（僅 D1 與整體）', '(D1 and overall only)')}</small>` : ''}</span>`;
      }).join('');
    }
    // The grid is narrow: a closed select shows only its short label, the open list shows the full one
    const labelMode = (sel, full) => { for (const o of sel.options) { o.dataset.full ??= o.textContent; o.textContent = full ? o.dataset.full : (o.dataset.short ?? o.dataset.full); } };
    const compactSel = (sel, name) => {
      const shorten = () => { labelMode(sel, false); const o = sel.selectedOptions[0]; if (name) { sel.title = name + (o && sel.value ? '：' + o.dataset.full : '：' + T('尚未判斷', 'not judged')); sel.setAttribute('aria-label', sel.title); } };
      sel.addEventListener('mousedown', () => labelMode(sel, true));
      sel.addEventListener('focus', () => labelMode(sel, true));
      sel.addEventListener('change', shorten);
      sel.addEventListener('blur', shorten);
      shorten();
    };
    const styleSel = (sel, v) => { const p = v ? uiPair(colorOf(v)) : { bg: '', fg: '' }; sel.style.background = p.bg || ''; sel.style.color = p.fg; };
    const open = new Set();
    function renderGrid() {
      const host = document.getElementById('grid');
      const doms = domains();
      const opt = (code, v) => `<option value="" data-short="·">·</option>` + allowed(code).map((j) => `<option value="${j.v}"${j.v === v ? ' selected' : ''} title="${RT.esc(j.label)}" data-short="${RT.esc(j.uiSym || j.sym)}">${RT.esc(j.uiSym || j.sym)} ${RT.esc(T(j.zh, j.label))}</option>`).join('');
      host.innerHTML = `<div class="rob-wrap"><table class="rob-tbl"><thead><tr><th>${T('研究', 'Study')}</th>${doms.map((d) => `<th title="${RT.esc(d.name)}">${RT.esc(d.code)}</th>`).join('')}<th>${T('整體', 'Overall')}</th><th></th></tr></thead><tbody></tbody></table></div>`;
      const tb = host.querySelector('tbody');
      S.studies.forEach((st, i) => {
        const tr = RT.h(`<table><tr><td class="nm"><input placeholder="${T('研究（作者 年份）', 'Study (Author Year)')}"></td>${doms.map((d) => `<td><select data-d="${d.code}" title="${RT.esc(d.name)}">${opt(d.code, st.j[d.code])}</select></td>`).join('')}<td><select class="ov"></select></td><td style="white-space:nowrap"><button class="small" data-a="det" title="${T('理由與細節', 'Support & details')}">${open.has(i) ? '▴' : '▾'}</button><button class="icon" data-a="del" title="${T('刪除', 'Delete')}">✕</button></td></tr></table>`).querySelector('tr');
        const nm = tr.querySelector('.nm input');
        nm.value = st.name;
        nm.oninput = () => { st.name = nm.value; update(); };
        tr.querySelectorAll('select[data-d]').forEach((sel) => {
          styleSel(sel, st.j[sel.dataset.d]);
          sel.onchange = () => { st.j[sel.dataset.d] = sel.value; styleSel(sel, sel.value); refreshOverall(tr, st); update(); };
          compactSel(sel, sel.dataset.d + '. ' + ((doms.find((d) => d.code === sel.dataset.d) || {}).name || ''));
        });
        refreshOverall(tr, st);
        tr.querySelector('select.ov').onchange = (e) => { st.overall = e.target.value; refreshOverall(tr, st); update(); };
        tr.querySelector('[data-a="det"]').onclick = () => { open.has(i) ? open.delete(i) : open.add(i); renderGrid(); };
        tr.querySelector('[data-a="del"]').onclick = () => { S.studies.splice(i, 1); open.clear(); renderGrid(); update(); };
        tb.appendChild(tr);
        if (open.has(i)) {
          const det = RT.h(`<table><tr class="det"><td colspan="${doms.length + 3}"><div class="rob-det">
            <div class="grid2"><label class="field"><span>${T('結果／比較（選填）', 'Result / comparison (optional)')}</span><input data-k2="result"></label>
            <label class="field"><span>${T('權重（選填，用於加權摘要圖）', 'Weight (optional, for weighted summary)')}</span><input class="n" data-k2="w"></label></div>
            ${doms.map((d) => `<label><div class="dom">${RT.esc(d.code)}. ${RT.esc(d.name)}</div><textarea rows="2" data-s="${d.code}" placeholder="${T('支持判斷的理由（引用文章內容）', 'Support for judgement (quote the report)')}"></textarea></label>`).join('')}
            </div></td></tr></table>`).querySelector('tr');
          det.querySelectorAll('[data-k2]').forEach((el) => { el.value = st[el.dataset.k2] ?? ''; el.oninput = () => { st[el.dataset.k2] = el.value; update(); }; });
          det.querySelectorAll('[data-s]').forEach((el) => { el.value = (st.sup || {})[el.dataset.s] || ''; el.oninput = () => { (st.sup ||= {})[el.dataset.s] = el.value; update(); }; });
          tb.appendChild(det);
        }
      });
    }
    function refreshOverall(tr, st) {
      const sel = tr.querySelector('select.ov');
      const auto = overallOf(st);
      sel.innerHTML = `<option value="auto" data-short="${T('自動', 'Auto')}${auto ? ' ' + RT.esc(J[auto].sym) : isIncomplete(st) ? ' …' : ''}">${T('自動', 'Auto')}${auto ? ': ' + RT.esc(J[auto].sym) : isIncomplete(st) ? T('：未完成', ': incomplete') : ''}</option>` +
        allowed('overall').map((j) => `<option value="${j.v}" data-short="${T('手動', 'Set')} ${RT.esc(j.sym)}">${RT.esc(j.sym)} ${RT.esc(T(j.zh, j.label))}</option>`).join('');
      sel.value = st.overall && st.overall !== 'auto' ? st.overall : 'auto';
      styleSel(sel, effOverall(st));
      sel.title = st.overall && st.overall !== 'auto' ? T('已手動指定整體判斷', 'Overall set manually') : T('依規則自動計算；可手動改', 'Calculated by the rule; you may override');
      if (!sel.dataset.compact) { sel.dataset.compact = '1'; sel.addEventListener('mousedown', () => labelMode(sel, true)); sel.addEventListener('focus', () => labelMode(sel, true)); sel.addEventListener('blur', () => labelMode(sel, false)); }
      labelMode(sel, false);
    }
    document.getElementById('addStudy').onclick = () => { S.studies.push({ name: '', j: {}, sup: {}, overall: 'auto', result: '', w: '' }); renderGrid(); update(); };
    document.getElementById('pasteStudies').onclick = async () => {
      const codes = domains().map((d) => d.code);
      const txt = await RT.promptText(T('批次貼上判斷', 'Paste judgements'),
        T(`每行一個研究：<code>研究, ${codes.join(', ')}[, Overall]</code>，可從 Excel 複製（Tab 分隔）。判斷可寫代碼或文字，例如 ${cfg.judgments.map((j) => `<code>${j.v}</code>／${j.label}`).join('、')}。會取代目前清單。`,
          `One study per line: <code>Study, ${codes.join(', ')}[, Overall]</code> — copy from Excel (tab-separated) works. Judgements as codes or words, e.g. ${cfg.judgments.map((j) => `<code>${j.v}</code> / ${j.label}`).join(', ')}. Replaces the current list.`),
        S.studies.map((st) => [st.name, ...codes.map((c) => st.j[c] || ''), st.overall && st.overall !== 'auto' ? st.overall : ''].join('\t')).join('\n'));
      if (txt === null) return;
      const norm = (x) => {
        const t = String(x || '').trim().toLowerCase();
        if (!t) return '';
        const hit = cfg.judgments.find((j) => j.v.toLowerCase() === t || j.label.toLowerCase() === t || j.sym === t || (j.alias || []).includes(t));
        return hit ? hit.v : '';
      };
      const unknown = [];
      let skipped = 0;
      S.studies = txt.split(/\r?\n/).map((l) => l.split(/\t|,|;/).map((x) => x.trim())).filter((p) => {
        if (p.some(Boolean)) return true;
        skipped++; return false;
      }).map((p) => {
        const st = { name: p[0], j: {}, sup: {}, overall: 'auto', result: '', w: '' };
        codes.forEach((c, i) => { st.j[c] = norm(p[i + 1]); if (p[i + 1] && !st.j[c]) unknown.push(p[i + 1]); });
        const ov = norm(p[codes.length + 1]);
        if (ov) st.overall = ov; else if (p[codes.length + 1]) unknown.push(p[codes.length + 1]);
        return st;
      });
      open.clear(); renderGrid(); update();
      const uq = [...new Set(unknown)];
      RT.toast(T(`已匯入 ${S.studies.length} 個研究`, `Imported ${S.studies.length} ${S.studies.length === 1 ? 'study' : 'studies'}`) +
        (unknown.length ? T(`；${unknown.length} 格無法辨識（${uq.slice(0, 4).join('、')}）已留空`, `; ${unknown.length} ${unknown.length === 1 ? 'cell' : 'cells'} not recognised (${uq.slice(0, 4).join(', ')}) left blank`) : '') +
        (skipped ? T(`；略過 ${skipped} 個空白列`, `; skipped ${skipped} empty ${skipped === 1 ? 'row' : 'rows'}`) : ''), unknown.length ? 8000 : 3000);
    };

    /* ---------------- plots ---------------- */
    // Study name, plus the assessed result in brackets only when that option is on (off by default)
    const studyLabel = (st) => (st.name || '—') + (S.showResult && st.result && st.result.trim() ? ` (${st.result.trim()})` : '');
    const INK = '#1F2933', MUTED = '#6B7480', GRID_LINE = '#E4E7EC', ZEBRA = '#F7F8FA', OV_BAND = '#EEF1F5';
    const legendItems = () => cfg.judgments.filter((j) => inVariant(j) && (!j.optional || S.allowNI) && S.studies.some((st) => Object.values(st.j).includes(j.v) || effOverall(st) === j.v));
    // ---- shared legend pieces ----
    // 10% slack: Word lays text out slightly wider than the browser, and would otherwise wrap and clip it
    const SLACK = 1.1;
    const legendMetrics = () => {
      const fs = Number(S.st.fontSize) || 12.5, lfs = fs * 0.88, llh = lfs * 1.3;
      const doms = domains();
      const codeW = Math.max(...doms.map((d) => RT.textWidth(d.code + ':', lfs, true))) * SLACK + 6, iconW = lfs * 1.7;
      const needD = Math.min(560, codeW + Math.max(...doms.map((d) => RT.textWidth(d.name, lfs))) * SLACK + 4);
      const needJ = Math.min(560, iconW + Math.max(RT.textWidth('Judgement', lfs, true), ...legendItems().map((j) => RT.textWidth(j.label, lfs))) * SLACK + 4);
      return { fs, lfs, llh, doms, codeW, iconW, needD, needJ };
    };
    // lines are wrapped for width / slack but the box keeps the full width, so Word never re-wraps and clips them
    const textBox = (text, w, size) => Object.assign(RT.box([{ text }], w / SLACK, { align: 'left', fill: 'none', stroke: 'none', pad: 0, padX: 0, lh: 1.3, color: INK, size }), { w });
    // "Domains" list: bold code, name beside it, wrapped lines hang under the name
    function domainLegend(x, y, w) {
      const { lfs, llh, doms, codeW } = legendMetrics();
      let body = RT.rich([{ runs: [{ t: 'Domains', bold: true, size: lfs, color: INK }] }], x, y, { lh: llh });
      let yy = y + llh + 2;
      doms.forEach((d) => {
        const nb = textBox(d.name, w - codeW, lfs);
        body += RT.rich([{ runs: [{ t: d.code + ':', bold: true, size: lfs, color: INK }] }], x, yy, { lh: llh });
        body += RT.drawBox(nb, x + codeW, yy);
        yy += nb.h;
      });
      return { body, h: yy - y };
    }
    // "Judgement" list: one icon + label per line
    function judgementLegend(x, y, w) {
      const { lfs, llh, iconW } = legendMetrics();
      let body = RT.rich([{ runs: [{ t: 'Judgement', bold: true, size: lfs, color: INK }] }], x, y, { lh: llh });
      let yy = y + llh + 2;
      legendItems().forEach((j) => {
        const c = colorOf(j.v);
        const lb = textBox(j.label, w - iconW, lfs);
        body += RT.circle(x + lfs * 0.62, yy + llh / 2, lfs * 0.62, { fill: c, stroke: S.palette === 'gray' ? '#555' : 'none', sw: 1, text: S.symbols ? j.sym : '', color: textOn(c), size: lfs * 0.85 });
        body += RT.drawBox(lb, x + iconW, yy);
        yy += lb.h + 3;
      });
      return { body, h: yy - y };
    }

    // ---- traffic-light plot ----
    // withLegend: Domains + Judgement stacked under the grid (the "traffic light only" figure)
    function traffic(y0, dx = 0, withLegend = true) {
      const fs = Number(S.st.fontSize) || 12.5, lh = fs * (Number(S.st.lh) || 1.3), M = 16 + dx;
      const r = Number(S.cellR) || 12, cw = 2 * r + 10, rh = 2 * r + 8;
      const doms = domains();
      const names = S.studies.map(studyLabel);
      const nameW = Math.max(110, ...names.map((n) => RT.textWidth(n, fs))) + 16;
      const ovGap = 18;
      const gridW = nameW + 8 + (doms.length + 1) * cw + ovGap;
      const lm = legendMetrics();
      const legW = withLegend ? Math.max(gridW, 320, lm.needD, lm.needJ) : gridW;
      const G = M + (legW - gridW) / 2;   // grid is centred over the legend
      const gx = G + nameW + 8;
      const colX = (i) => gx + i * cw + cw / 2 + (i === doms.length ? ovGap : 0);
      const gridR = colX(doms.length) + cw / 2;
      let body = '', y = y0;
      if (S.title) { body += RT.rich([{ runs: [{ t: S.title, bold: true, size: fs * 1.1, color: '#000' }] }], (gx + gridR) / 2, y, { lh: fs * 1.4, anchor: 'middle' }); y += fs * 1.6; }
      // header: column codes over a hairline; the Overall column sits on a light band
      const hh = fs * 1.8, gridBot = y + hh + 4 + S.studies.length * rh;
      const domR = colX(doms.length - 1) + cw / 2;
      const ovW = Math.max(cw, RT.textWidth('Overall', fs * 0.95, true) * SLACK + 12);   // band wide enough for the label (also in Word)
      body += RT.rect(colX(doms.length) - ovW / 2, y, ovW, gridBot - y + 4, { fill: OV_BAND, radius: 6 });
      doms.forEach((d, i) => { body += RT.rich([{ runs: [{ t: d.code, bold: true, size: fs * 0.95, color: INK }] }], colX(i), y + (hh - lh) / 2, { lh, anchor: 'middle' }); });
      body += RT.rich([{ runs: [{ t: 'Overall', bold: true, size: fs * 0.95, color: INK }] }], colX(doms.length), y + (hh - lh) / 2, { lh, anchor: 'middle' });
      y += hh;
      body += RT.line([[G, y], [domR, y]], { color: GRID_LINE, sw: 1 });
      y += 4;
      // zebra rows first, so the circles sit on top
      S.studies.forEach((st, si) => { if (si % 2 === 1) body += RT.rect(G, y + si * rh, domR - G, rh, { fill: ZEBRA }); });
      S.studies.forEach((st, si) => {
        body += RT.rich([{ runs: [{ t: names[si], size: fs, color: INK }] }], gx - 10, y + (rh - lh) / 2, { lh, anchor: 'end' });
        [...doms.map((d) => st.j[d.code]), effOverall(st)].forEach((v, i) => {
          const c = v ? colorOf(v) : '#FFFFFF';
          const stroke = !v ? '#C9CED6' : S.palette === 'gray' ? '#555' : '#FFFFFF';
          body += RT.circle(colX(i), y + rh / 2, r, { fill: c, stroke, sw: v ? 1.5 : 1, text: v && S.symbols ? J[v].sym : '', color: textOn(c), size: r * 1.3 });
        });
        y += rh;
      });
      body += RT.line([[G, y + 2], [domR, y + 2]], { color: GRID_LINE, sw: 1 });
      y += 6;
      if (withLegend) {
        y += fs * 0.9;
        const d = domainLegend(M, y, legW);
        body += d.body; y += d.h + fs * 0.7;
        const j = judgementLegend(M, y, legW);
        body += j.body; y += j.h;
      }
      const right = Math.max(gridR, colX(doms.length) + ovW / 2) - dx;   // right edge of the grid incl. the Overall band
      return { body, W: M + legW + 16 - dx, H: y, right };
    }

    // ---- proportion (summary) plot ----
    // short: rows labelled D1…Dn and "Overall" (the Domains legend explains the codes)
    // totalW: make labels + bars exactly this wide (bars take what the labels leave)
    function summary(y0, dx = 0, { short = false, totalW = 0 } = {}) {
      const fs = Number(S.st.fontSize) || 12.5, lhK = Number(S.st.lh) || 1.3, M = 16 + dx;
      const doms = domains();
      const rowsDef = [
        ...doms.map((d) => ({ label: short ? d.code : d.name, get: (st) => st.j[d.code] })),
        { label: short ? 'Overall' : 'Overall risk of bias', bold: true, get: (st) => effOverall(st) },
      ];
      const labW = Math.min(500, Math.max(short ? 40 : 160, ...rowsDef.map((r) => RT.textWidth(r.label, fs, r.bold) * SLACK)) + 12);
      const bx = M + labW + 14, bh = fs * 1.5, gap = fs * 0.65;
      const bw = totalW ? Math.max(200, totalW - labW - 14) : Number(S.barW) || 520;
      const weight = (st) => { const w = RT.num(st.w); return S.useWeights && w !== null && w > 0 ? w : 1; };
      const order = cfg.judgments.filter((j) => inVariant(j) && (!j.optional || S.allowNI)).slice().sort((a, b) => a.rank - b.rank);
      let body = '', y = y0;
      if (S.title) { body += RT.rich([{ runs: [{ t: S.title, bold: true, size: fs * 1.1, color: '#000' }] }], bx + bw / 2, y, { lh: fs * 1.4, anchor: 'middle' }); y += fs * 1.6; }
      // lay the rows out first so the gridlines can be drawn underneath the bars
      const rows = rowsDef.map((rd) => {
        const lb = RT.box([{ text: rd.label, bold: rd.bold }], labW, { size: fs, align: 'right', fill: 'none', stroke: 'none', pad: 0, padX: 0, lh: lhK, color: INK });
        return { rd, lb, h: Math.max(bh, lb.h) };
      });
      const overallGap = fs * 0.7;
      const plotH = rows.reduce((a, rr) => a + rr.h + gap, 0) - gap + overallGap;
      [0, 25, 50, 75, 100].forEach((pc) => {
        const x = bx + (bw * pc) / 100;
        body += RT.line([[x, y - 4], [x, y + plotH + 4]], { color: pc === 0 ? '#C9CED6' : GRID_LINE, sw: 1 });
      });
      rows.forEach(({ rd, lb, h }, ri) => {
        if (ri === rows.length - 1) {   // Overall row: set apart by a hairline
          const ly = y - gap / 2 + overallGap / 2;
          body += RT.line([[M, ly], [bx + bw, ly]], { color: '#C9CED6', sw: 1 });
          y += overallGap;
        }
        body += RT.drawBox(lb, M, y + (h - lb.h) / 2);
        const tot = S.studies.reduce((a, st) => a + (rd.get(st) ? weight(st) : 0), 0);
        let x = bx;
        const by = y + (h - bh) / 2;
        if (!tot) body += RT.rect(bx, by, bw, bh, { fill: '#FFFFFF', stroke: '#BDBDBD', sw: 1 });
        order.forEach((j) => {
          const part = S.studies.reduce((a, st) => a + (rd.get(st) === j.v ? weight(st) : 0), 0);
          if (!tot || !part) return;
          const w = (bw * part) / tot, c = colorOf(j.v);
          // white hairline between segments
          body += RT.rect(x, by, w, bh, { fill: c, stroke: S.palette === 'gray' ? '#555' : '#FFFFFF', sw: S.palette === 'gray' ? 0.8 : 1 });
          const pct = Math.round((100 * part) / tot) + '%';
          if (S.pctLabels && w > RT.textWidth(pct, fs * 0.82, true) + 10) body += RT.rich([{ runs: [{ t: pct, size: fs * 0.82, bold: true, color: textOn(c) }] }], x + w / 2, by + (bh - fs * 1.05) / 2, { lh: fs * 1.05, anchor: 'middle' });
          x += w;
        });
        y += h + gap;
      });
      // percentage scale under the gridlines
      [0, 25, 50, 75, 100].forEach((pc) => {
        const x = bx + (bw * pc) / 100;
        body += RT.rich([{ runs: [{ t: pc + '%', size: fs * 0.8, color: MUTED }] }], x, y + 2, { lh: fs * 1.1, anchor: 'middle' });
      });
      y += fs * 1.6;
      const weighted = S.useWeights && S.studies.some((st) => { const w = RT.num(st.w); return w !== null && w > 0; });
      if (weighted) { body += RT.rich([{ runs: [{ t: 'Bars weighted by study weight', italic: true, size: fs * 0.8, color: MUTED }] }], bx, y, { lh: fs * 1.1 }); y += fs * 1.3; }
      return { body, W: bx + bw + 16 - dx, H: y, bx: bx - dx, bw };
    }

    // ---- the three figures ----
    function build() {
      RT.applyStyle(S.st);
      RT.beginScene();
      const M = 16;
      if (!S.studies.length) return RT.figure(400, 80, RT.rich([{ runs: [{ t: T('尚未輸入研究', 'No studies yet'), size: 13, color: '#777' }] }], 200, 30, { lh: 16, anchor: 'middle' }));
      const lm = legendMetrics();

      // 1. Traffic light only: grid, then Domains and Judgement under it
      if (S.plot === 'traffic') { const t = traffic(M); return RT.figure(t.W, t.H + M, t.body); }

      // 2. Proportions only: D1…Dn bars, then the Domains list
      if (S.plot === 'summary') {
        const sm = summary(M, 0, { short: true });
        const y = sm.H + lm.fs * 0.4;
        const d = domainLegend(M, y, lm.needD);
        return RT.figure(Math.max(sm.W, M + lm.needD + 16), y + d.h + M, sm.body + d.body);
      }

      // 3. Both: grid (no legend), D1…Dn bars, then Domains (left) and Judgement (right) side by side.
      //    The bar chart spans exactly the two legend columns; the grid is right-aligned with the bars.
      const colGap = 48, legTotal = lm.needD + colGap + lm.needJ;
      const t0 = traffic(M, 0, false), s0 = summary(0, 0, { short: true, totalW: legTotal });
      const barsRight = s0.bx + s0.bw;                     // right edge of the bars (chart starting at M)
      let shiftT = barsRight - t0.right;                    // move the grid so its right edge meets the bars
      const off = Math.max(0, -shiftT);                     // grid wider than the chart: move everything else right
      shiftT += off;
      const W = Math.max(t0.W + shiftT, s0.W + off, M + off + legTotal + 16);
      RT.beginScene();
      const tt = traffic(M, shiftT, false);
      const sTop = tt.H + lm.fs * 1.2;
      const sm = summary(sTop, off, { short: true, totalW: legTotal });
      const ly = sm.H + lm.fs * 0.6;
      const lx = M + off;
      const d = domainLegend(lx, ly, lm.needD);
      const j = judgementLegend(lx + lm.needD + colGap, ly, lm.needJ);
      return RT.figure(W, ly + Math.max(d.h, j.h) + M, tt.body + sm.body + d.body + j.body);
    }
    const tableRows = () => S.studies.map((st) => [studyLabel(st), ...domains().map((d) => st.j[d.code] || ''), effOverall(st)]);
    const docxTable = () => {
      RT.applyStyle(S.st);
      const doms = domains();
      const cell = (v) => (v ? { text: J[v].label, fill: colorOf(v), color: textOn(colorOf(v)), align: 'center', valign: 'center' } : { text: '' });
      const head = ['Study', ...doms.map((d) => d.code), 'Overall'];
      const note = 'Domains: ' + doms.map((d) => `${d.code}, ${d.name}`).join('; ') + '.';
      const sup = [];
      S.studies.forEach((st) => doms.forEach((d) => { const t = (st.sup || {})[d.code]; if (t && t.trim()) sup.push(`${st.name} — ${d.code} (${st.j[d.code] ? J[st.j[d.code]].label : 'not assessed'}): ${t.trim()}`); }));
      return RT.buildDocxTable({
        title: S.title || `Risk of bias (${cfg.short})`, headers: head, widths: [3, ...doms.map(() => 1.3), 1.5], landscape: doms.length > 5,
        rows: tableRows().map((r) => [{ text: r[0], bold: true }, ...r.slice(1).map(cell)]),
        note: note + (sup.length ? '\n\nSupport for judgements:\n' + sup.join('\n') : ''), sizePt: 9,
      });
    };
    document.getElementById('csvBtn').onclick = () => {
      const doms = domains();
      const rows = [['Study', 'Result', ...doms.map((d) => `${d.code} ${d.name}`), 'Overall', 'Overall set manually', 'Weight', ...doms.map((d) => `${d.code} support`)]];
      S.studies.forEach((st) => rows.push([st.name, st.result || '', ...doms.map((d) => (st.j[d.code] ? J[st.j[d.code]].label : '')), effOverall(st) ? J[effOverall(st)].label : '', st.overall && st.overall !== 'auto' ? 'yes' : 'no', st.w || '', ...doms.map((d) => (st.sup || {})[d.code] || '')]));
      RT.downloadCSV(rows, `${cfg.filePrefix}_assessments.csv`);
    };
    document.getElementById('docxBtn').onclick = async () => { try { RT.download(await docxTable(), `${cfg.filePrefix}_table.docx`); } catch (e) { RT.toast(String(e.message || e), 6000); } };

    let fig;
    const preview = document.getElementById('preview');
    const exporter = RT.exportPanel(document.getElementById('export'), () => fig, `${cfg.filePrefix}_plot`, { fontSize: { get: () => S.st.fontSize, set: (v) => { S.st.fontSize = v; syncInputs(); update(); } } });
    const hist = RT.history(() => S, (s) => { S = s; syncInputs(); render(); });
    function render() {
      try { fig = build(); preview.innerHTML = fig.svg; }
      catch (e) { console.error(e); preview.innerHTML = `<div class="msg">⚠ ${RT.esc(e.message)}</div>`; }
      exporter.refresh();
      const doms = domains(), msgs = [];
      S.studies.forEach((st, i) => {
        const nm = st.name && st.name.trim() ? st.name.trim() : T(`第 ${i + 1} 列`, `Row ${i + 1}`);
        if (!st.name || !st.name.trim()) msgs.push(T(`第 ${i + 1} 列沒有研究名稱`, `Row ${i + 1} has no study name`));
        const miss = doms.filter((d) => !st.j[d.code]).map((d) => d.code);
        if (miss.length) msgs.push(T(`${nm}：${miss.join('、')} 尚未判斷`, `${nm}: ${miss.join(', ')} not judged`));
      });
      document.getElementById('msgs').innerHTML = msgs.length
        ? msgs.slice(0, 6).map((m) => `<div class="msg">⚠ ${RT.esc(m)}</div>`).join('') + (msgs.length > 6 ? `<div class="msg">${T(`另有 ${msgs.length - 6} 項`, `and ${msgs.length - 6} more`)}</div>` : '')
        : (S.studies.length ? `<div class="msg ok">✓ ${T('每個研究的每個 domain 都已判斷', 'Every domain is judged for every study')}</div>` : '');
      exporter.setIssues(msgs.length);
      RT.save(cfg.key, S);
    }
    const update = RT.debounce(() => { render(); hist.push(); }, 80);
    document.getElementById('btnUndo').onclick = hist.undo;
    document.getElementById('btnRedo').onclick = hist.redo;
    document.getElementById('btnExample').onclick = () => { S.studies = structuredClone(cfg.exampleStudies); open.clear(); syncInputs(); update(); RT.toast(T('已載入範例（虛構研究與判斷，僅供示範；按 ↶ 可復原）', 'Example loaded (fictional studies and judgements; ↶ to undo)')); };
    document.getElementById('btnReset').onclick = () => { S.studies = []; open.clear(); syncInputs(); update(); RT.toast(T('已清空（按 ↶ 可復原）', 'Cleared (↶ to undo)')); };
    document.getElementById('btnSaveJson').onclick = () => RT.downloadJSON(S, `${cfg.filePrefix}.json`);
    document.getElementById('btnLoadJson').onclick = async () => { try { S = RT.merge(DEF, await RT.pickJSON()); syncInputs(); update(); } catch (e) { RT.toast(T('讀取失敗：', 'Could not open file: ') + e.message, 6000); } };
    syncInputs();
    render();
    hist.push();
    return { get state() { return S; }, get fig() { return fig; } };
  };

  /** Shared HTML skeleton for both tools (filled by the page) */
  RT.robPage = (o) => `
  <header class="topbar">
    <a class="back" href="../index.html" data-en="← Home">← 工具首頁</a>
    <h1>${o.title}</h1><span class="sub" data-en="${o.subEn}">${o.subZh}</span>
    <span class="spacer"></span>
    <div class="btns">
      <button class="small" id="btnUndo" title="復原 (Ctrl+Z)" data-en-title="Undo (Ctrl+Z)">↶</button>
      <button class="small" id="btnRedo" title="重做 (Ctrl+Y)" data-en-title="Redo (Ctrl+Y)">↷</button>
      <button class="small" id="btnSaveJson" title="下載 .json，之後可再開啟或傳給共同作者" data-en-title="Download a .json file to reopen later or share with co-authors" data-en="Save project">儲存設定檔</button>
      <button class="small" id="btnLoadJson" title="開啟先前儲存的 .json 設定檔" data-en-title="Open a previously saved .json project file" data-en="Open project">開啟設定檔</button>
      <button class="small" id="btnExample" data-en="Example">範例</button>
      <button class="small" id="btnReset" data-en="Clear">清空</button>
    </div>
  </header>
  <main class="tool">
    <section id="form">
      <!-- long tool note: open on wide screens, collapsed on phones so the inputs come first -->
      <details class="card tool-note"${window.matchMedia && matchMedia('(min-width: 961px)').matches ? ' open' : ''}><summary data-en="About this tool: version and judgement rules">工具說明：版本與判斷規則</summary><div class="note-box">${o.noteZh ? `<span data-en="${RT.esc(o.noteEn)}">${o.noteZh}</span>` : ''}</div></details>
      <div class="card">
        <h2><span class="step-no">1</span> <span data-en="Tool version &amp; domains">版本與 domain</span></h2>
        <label class="field"><span data-en="Version / design">版本／設計</span><select id="variantSel"></select></label>
        ${o.niToggle ? `<label class="check"><input type="checkbox" data-k="allowNI"> <span data-en="Allow “No information”">允許「No information」</span></label>` : ''}
        <details><summary data-en="Domain names (editable — match them to the official version you use)">Domain 名稱（可編輯，請對照你使用的官方版本）</summary><div id="domains"></div></details>
      </div>
      <div class="card">
        <h2><span class="step-no">2</span> <span data-en="Judgements per study">各研究判斷</span></h2>
        <p class="hint" data-en="Pick a judgement for each domain; the overall is calculated (you can override it). ▾ adds the result assessed, a weight and the support text.">每個 domain 選一個判斷，整體判斷會自動計算，可手動覆蓋。按 ▾ 填評估的結果、權重與判斷理由。</p>
        <div id="grid"></div>
        <div class="btns" style="margin-top:8px"><button class="small" id="addStudy" data-en="+ Add study">＋ 新增研究</button><button class="small" id="pasteStudies" data-en="Paste from Excel…">從 Excel 貼上…</button></div>
        <div class="rob-legend" id="legend"></div>
      </div>
      <div class="card">
        <details>
          <summary><span class="step-no" style="display:inline-grid">3</span> <span data-en="Plot &amp; appearance">圖表與外觀</span></summary>
          <div class="grid2">
            <label class="field"><span data-en="Plot">圖表</span><select data-k="plot">
              <option value="traffic" data-en="Traffic-light plot">紅綠燈圖（traffic-light）</option>
              <option value="summary" data-en="Summary bar plot">摘要長條圖（summary）</option>
              <option value="both" data-en="Both">兩者都要</option></select></label>
            <label class="field"><span data-en="Colours">配色</span><select id="paletteSel"></select></label>
            <label class="field"><span data-en="Circle radius (px)">圓點大小 (px)</span><input type="number" data-k="cellR" min="6" max="30" step="1"></label>
            <label class="field"><span data-en="Summary bar width (px)">摘要長條寬 (px)</span><input type="number" data-k="barW" min="200" max="1200" step="10"></label>
          </div>
          <label class="field"><span data-en="Plot title (optional)">圖標題（選填）</span><input data-k="title"></label>
          <label class="check"><input type="checkbox" data-k="symbols"> <span data-en="Symbols inside circles (needed for black-and-white print)">圓點內顯示符號（黑白印刷時必要）</span></label>
          <label class="check"><input type="checkbox" data-k="showResult"> <span data-en="Show the assessed result after the study name">在研究名稱後顯示評估的結果（outcome）</span></label>
          <label class="check"><input type="checkbox" data-k="pctLabels"> <span data-en="Percent labels on summary bars">摘要長條顯示百分比</span></label>
          <label class="check"><input type="checkbox" data-k="useWeights"> <span data-en="Weight summary bars by study weight">摘要長條依研究權重加權</span></label>
          <div id="styleFields"></div>
        </details>
      </div>
      <div class="card" id="refs"></div>
    </section>
    <section class="preview-col">
      <div class="paper" id="preview"></div>
      <div class="msgs" id="msgs"></div>
      <div class="card" id="export"></div>
      <div class="card">
        <h2 data-en="Tables">表格</h2>
        <div class="btns"><button id="docxBtn" data-en="Word table (with support text)">Word 表格（含理由）</button><button id="csvBtn" data-en="CSV (Excel)">CSV（Excel）</button></div>
      </div>
    </section>
  </main>`;
})();

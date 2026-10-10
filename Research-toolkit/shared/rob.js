/* Risk-of-bias assessment + robvis-style plots, shared by the RoB 2 and ROBINS-I pages.
 * Only domain names and judgement categories are used; the official signalling questions
 * live in the official tools (riskofbias.info) and are not reproduced here.
 */
(function () {
  const T = RT.t;

  const CSS = `
  .rob-wrap { overflow-x: auto; margin: 0 -4px; }
  .rob-tbl { border-collapse: separate; border-spacing: 3px; font-size: 12.5px; }
  .rob-tbl th { font-weight: 600; color: var(--muted); font-size: 11.5px; text-align: center; padding: 0 2px; white-space: nowrap; }
  .rob-tbl td.nm input { width: 140px; }
  .rob-tbl select { width: 46px; padding: 5px 2px; text-align: center; font-weight: 700; border-radius: 6px; cursor: pointer; }
  .rob-tbl select.ov { width: 62px; }
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
      robvis: { zh: 'robvis 預設（綠／黃／紅）', en: 'robvis default (green / yellow / red)', map: (j) => j.color },
      cb: { zh: '色盲友善（藍／橘／朱紅）', en: 'Colour-blind safe (blue / orange / vermilion)', map: (j) => ({ 0: '#56B4E9', 1: '#9ED3F2', 2: '#E69F00', 3: '#D55E00', 4: '#5A1E00', 9: '#BBBBBB' }[j.rank]) },
      gray: { zh: '灰階（期刊黑白）', en: 'Grayscale (print)', map: (j) => ({ 0: '#FFFFFF', 1: '#E6E6E6', 2: '#BDBDBD', 3: '#6E6E6E', 4: '#262626', 9: '#F2F2F2' }[j.rank]) },
    };
    const DEF = {
      variant: Object.keys(cfg.variants)[0], allowNI: false, names: {}, studies: structuredClone(cfg.exampleStudies || []),
      plot: 'traffic', title: '', symbols: true, palette: 'robvis', cellR: 12, useWeights: false, pctLabels: true, barW: 520,
      st: { ...RT.STYLE_DEF, fontSize: 12.5, lh: 1.3 },
    };
    let S = RT.load(cfg.key, DEF);
    const form = document.getElementById('form');
    document.getElementById('styleFields').innerHTML = RT.styleFieldsHTML(['font', 'fontSize', 'lh']);
    document.getElementById('refs').innerHTML = RT.refsHTML(cfg.refs, [RT.LICENSES.rob]);
    document.getElementById('variantSel').innerHTML = Object.entries(cfg.variants).map(([id, v]) => `<option value="${id}">${RT.esc(T(v.zh, v.en))}</option>`).join('');
    document.getElementById('paletteSel').innerHTML = Object.entries(PALETTES).map(([id, p]) => `<option value="${id}">${RT.esc(T(p.zh, p.en))}</option>`).join('');

    const domains = () => cfg.variants[S.variant].domains.map((d) => ({ ...d, name: (S.names[S.variant] || {})[d.code] || d.name }));
    const colorOf = (v) => (J[v] ? PALETTES[S.palette]?.map(J[v]) || J[v].color : '#E0E0E0');
    const textOn = (c) => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(c || ''); if (!m) return '#000'; const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16)); return 0.299 * r + 0.587 * g + 0.114 * b < 110 ? '#FFFFFF' : '#000000'; };
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
    document.getElementById('variantSel').onchange = (e) => {
      S.variant = e.target.value;
      // drop judgements that the chosen version does not allow in that domain
      let dropped = 0;
      S.studies.forEach((st) => {
        domains().forEach((d) => { const v = st.j[d.code]; if (v && !allowed(d.code).some((j) => j.v === v)) { st.j[d.code] = ''; dropped++; } });
        if (st.overall && st.overall !== 'auto' && !allowed('overall').some((j) => j.v === st.overall)) st.overall = 'auto';
      });
      renderDomains(); renderGrid(); renderLegend(); update();
      RT.toast(T('已切換版本：各版本的 domain 編號與內容不同，請逐一確認判斷。', 'Version switched: domain numbering differs between versions — re-check each judgement.') + (dropped ? T(`（已清除 ${dropped} 個此版本不允許的判斷）`, ` (${dropped} judgement(s) not allowed in this version were cleared)`) : ''), 6000);
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
        return `<span><i style="background:${c};color:${textOn(c)};border:1px solid rgba(0,0,0,.2)">${RT.esc(j.sym)}</i>${RT.esc(T(j.zh, j.label))}${j.only ? ` <small>(${j.only.join(', ')} ${T('與整體', '& overall')})</small>` : ''}</span>`;
      }).join('');
    }
    const styleSel = (sel, v) => { const c = v ? colorOf(v) : ''; sel.style.background = c || ''; sel.style.color = c ? textOn(c) : ''; };
    const open = new Set();
    function renderGrid() {
      const host = document.getElementById('grid');
      const doms = domains();
      const opt = (code, v) => `<option value="">·</option>` + allowed(code).map((j) => `<option value="${j.v}"${j.v === v ? ' selected' : ''} title="${RT.esc(j.label)}">${RT.esc(j.sym)} ${RT.esc(T(j.zh, j.label))}</option>`).join('');
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
      sel.innerHTML = `<option value="auto">${T('自動', 'Auto')}${auto ? ': ' + RT.esc(J[auto].sym) : isIncomplete(st) ? T('：未完成', ': incomplete') : ''}</option>` +
        allowed('overall').map((j) => `<option value="${j.v}">${RT.esc(j.sym)} ${RT.esc(T(j.zh, j.label))}</option>`).join('');
      sel.value = st.overall && st.overall !== 'auto' ? st.overall : 'auto';
      styleSel(sel, effOverall(st));
      sel.title = st.overall && st.overall !== 'auto' ? T('已手動指定整體判斷', 'Overall set manually') : T('依規則自動計算；可手動改', 'Calculated by the rule; you may override');
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
      S.studies = txt.split(/\r?\n/).filter((l) => l.trim()).map((l) => {
        const p = l.split(/\t|,|;/).map((x) => x.trim());
        const st = { name: p[0], j: {}, sup: {}, overall: 'auto', result: '', w: '' };
        codes.forEach((c, i) => { st.j[c] = norm(p[i + 1]); });
        const ov = norm(p[codes.length + 1]);
        if (ov) st.overall = ov;
        return st;
      });
      open.clear(); renderGrid(); update();
    };

    /* ---------------- plots ---------------- */
    const legendItems = () => cfg.judgments.filter((j) => inVariant(j) && (!j.optional || S.allowNI) && S.studies.some((st) => Object.values(st.j).includes(j.v) || effOverall(st) === j.v));
    function traffic(y0) {
      const fs = Number(S.st.fontSize) || 12.5, lh = fs * (Number(S.st.lh) || 1.3), M = 16;
      const r = Number(S.cellR) || 12, cw = 2 * r + 10, rh = 2 * r + 8;
      const doms = domains();
      const names = S.studies.map((st) => (st.name || '—') + (st.result && st.result.trim() ? ` (${st.result.trim()})` : ''));
      const nameW = Math.max(110, ...names.map((n) => RT.textWidth(n, fs))) + 16;
      const gx = M + nameW + 8, ovGap = 10;
      const colX = (i) => gx + i * cw + cw / 2 + (i === doms.length ? ovGap : 0);
      const gridR = colX(doms.length) + cw / 2;
      let body = '', y = y0;
      if (S.title) { body += RT.rich([{ runs: [{ t: S.title, bold: true, size: fs * 1.1, color: '#000' }] }], (gx + gridR) / 2, y, { lh: fs * 1.4, anchor: 'middle' }); y += fs * 1.6; }
      // header band
      const hh = fs * 1.7;
      body += RT.rect(gx, y, colX(doms.length - 1) + cw / 2 - gx, hh, { fill: '#E7E7E7' });
      body += RT.rect(colX(doms.length) - cw / 2, y, cw, hh, { fill: '#E7E7E7' });
      doms.forEach((d, i) => { body += RT.rich([{ runs: [{ t: d.code, bold: true, size: fs, color: '#000' }] }], colX(i), y + (hh - lh) / 2, { lh, anchor: 'middle' }); });
      body += RT.rich([{ runs: [{ t: 'Overall', bold: true, size: fs, color: '#000' }] }], colX(doms.length), y + (hh - lh) / 2, { lh, anchor: 'middle' });
      y += hh + 4;
      const gridTop = y;
      S.studies.forEach((st, si) => {
        if (si % 2 === 1) body += RT.rect(M, y, gridR - M, rh, { fill: '#F5F5F5' });
        body += RT.rich([{ runs: [{ t: names[si], size: fs, color: '#000' }] }], gx - 8, y + (rh - lh) / 2, { lh, anchor: 'end' });
        [...doms.map((d) => st.j[d.code]), effOverall(st)].forEach((v, i) => {
          const c = v ? colorOf(v) : '#FFFFFF';
          body += RT.circle(colX(i), y + rh / 2, r, { fill: c, stroke: v ? (S.palette === 'gray' ? '#555' : 'none') : '#BDBDBD', sw: 1, text: v && S.symbols ? J[v].sym : '', color: textOn(c), size: r * 1.15 });
        });
        y += rh;
      });
      body += RT.line([[colX(doms.length) - cw / 2 - ovGap / 2, gridTop], [colX(doms.length) - cw / 2 - ovGap / 2, y]], { color: '#BDBDBD', sw: 1 });
      // legend: domains (left) + judgements (right)
      y += fs * 0.9;
      const legW = Math.max(gridR, 560) - M;
      const leftW = legW * 0.62;
      const dl = RT.box([{ text: 'Domains:', bold: true }, ...doms.map((d) => ({ text: `${d.code}: ${d.name}`, indent: 0 }))], leftW, { size: fs * 0.88, align: 'left', fill: 'none', stroke: 'none', pad: 0, padX: 0, lh: Number(S.st.lh) || 1.3 });
      body += RT.drawBox(dl, M, y);
      let jy = y;
      const jx = M + leftW + 16;
      body += RT.rich([{ runs: [{ t: 'Judgement', bold: true, size: fs * 0.88, color: '#000' }] }], jx, jy, { lh: fs * 1.2 });
      jy += fs * 1.35;
      legendItems().forEach((j) => {
        const c = colorOf(j.v);
        body += RT.circle(jx + fs * 0.6, jy + fs * 0.6, fs * 0.6, { fill: c, stroke: S.palette === 'gray' ? '#555' : 'none', sw: 1, text: S.symbols ? j.sym : '', color: textOn(c), size: fs * 0.7 });
        const lb = RT.box([{ text: j.label }], legW - leftW - fs * 2, { size: fs * 0.88, align: 'left', fill: 'none', stroke: 'none', pad: 0, padX: 0, lh: 1.2 });
        body += RT.drawBox(lb, jx + fs * 1.6, jy);
        jy += Math.max(fs * 1.45, lb.h + 3);
      });
      return { body, W: Math.max(gridR + M, legW + 2 * M), H: Math.max(y + dl.h, jy) };
    }
    function summary(y0) {
      const fs = Number(S.st.fontSize) || 12.5, lhK = Number(S.st.lh) || 1.3, M = 16;
      const doms = domains();
      const rowsDef = [...doms.map((d) => ({ label: d.name, get: (st) => st.j[d.code] })), { label: 'Overall risk of bias', bold: true, get: (st) => effOverall(st) }];
      const labW = Math.min(340, Math.max(160, ...rowsDef.map((r) => RT.textWidth(r.label, fs, r.bold))) + 12);
      const bx = M + labW + 10, bw = Number(S.barW) || 520, bh = fs * 1.7, gap = fs * 0.55;
      const weight = (st) => { const w = RT.num(st.w); return S.useWeights && w !== null && w > 0 ? w : 1; };
      const order = cfg.judgments.filter((j) => inVariant(j) && (!j.optional || S.allowNI)).slice().sort((a, b) => a.rank - b.rank);
      let body = '', y = y0;
      if (S.title) { body += RT.rich([{ runs: [{ t: S.title, bold: true, size: fs * 1.1, color: '#000' }] }], bx + bw / 2, y, { lh: fs * 1.4, anchor: 'middle' }); y += fs * 1.6; }
      rowsDef.forEach((rd) => {
        const lb = RT.box([{ text: rd.label, bold: rd.bold }], labW, { size: fs, align: 'right', fill: 'none', stroke: 'none', pad: 0, padX: 0, lh: lhK });
        const h = Math.max(bh, lb.h);
        body += RT.drawBox(lb, M, y + (h - lb.h) / 2);
        const tot = S.studies.reduce((a, st) => a + (rd.get(st) ? weight(st) : 0), 0);
        let x = bx;
        const by = y + (h - bh) / 2;
        if (!tot) body += RT.rect(bx, by, bw, bh, { fill: '#FFFFFF', stroke: '#BDBDBD', sw: 1 });
        order.forEach((j) => {
          const part = S.studies.reduce((a, st) => a + (rd.get(st) === j.v ? weight(st) : 0), 0);
          if (!tot || !part) return;
          const w = (bw * part) / tot, c = colorOf(j.v);
          body += RT.rect(x, by, w, bh, { fill: c, stroke: S.palette === 'gray' ? '#555' : 'none', sw: 0.8 });
          const pct = Math.round((100 * part) / tot) + '%';
          if (S.pctLabels && w > RT.textWidth(pct, fs * 0.85) + 6) body += RT.rich([{ runs: [{ t: pct, size: fs * 0.85, color: textOn(c) }] }], x + w / 2, by + (bh - fs * 1.1) / 2, { lh: fs * 1.1, anchor: 'middle' });
          x += w;
        });
        y += h + gap;
      });
      // axis
      body += RT.line([[bx, y], [bx + bw, y]], { color: '#333', sw: 1 });
      [0, 25, 50, 75, 100].forEach((p) => {
        const x = bx + (bw * p) / 100;
        body += RT.line([[x, y], [x, y + 4]], { color: '#333', sw: 1 });
        body += RT.rich([{ runs: [{ t: p + '%', size: fs * 0.85, color: '#333' }] }], x, y + 5, { lh: fs * 1.1, anchor: 'middle' });
      });
      y += fs * 1.6;
      // legend row
      let lx = bx;
      legendItems().sort((a, b) => a.rank - b.rank).forEach((j) => {
        const c = colorOf(j.v), tw = RT.textWidth(j.label, fs * 0.88);
        if (lx + fs + 6 + tw > bx + bw && lx > bx) { lx = bx; y += fs * 1.4; }
        body += RT.rect(lx, y + 1, fs * 0.9, fs * 0.9, { fill: c, stroke: '#555', sw: 0.6 });
        body += RT.rich([{ runs: [{ t: j.label, size: fs * 0.88, color: '#000' }] }], lx + fs * 1.2, y - fs * 0.05, { lh: fs * 1.15 });
        lx += fs * 1.2 + tw + fs;
      });
      y += fs * 1.4;
      if (S.useWeights) { body += RT.rich([{ runs: [{ t: 'Bars weighted by study weight', italic: true, size: fs * 0.8, color: '#555' }] }], bx, y, { lh: fs * 1.1 }); y += fs * 1.2; }
      return { body, W: bx + bw + M, H: y };
    }
    function build() {
      RT.applyStyle(S.st);
      RT.beginScene();
      const M = 16;
      if (!S.studies.length) return RT.figure(400, 80, RT.rich([{ runs: [{ t: T('尚未輸入研究', 'No studies yet'), size: 13, color: '#777' }] }], 200, 30, { lh: 16, anchor: 'middle' }));
      if (S.plot === 'summary') { const s = summary(M); return RT.figure(s.W, s.H + M, s.body); }
      const t = traffic(M);
      if (S.plot === 'traffic') return RT.figure(t.W, t.H + M, t.body);
      const s = summary(t.H + 28);
      return RT.figure(Math.max(t.W, s.W), s.H + M, t.body + s.body);
    }
    const tableRows = () => S.studies.map((st) => [st.name + (st.result ? ` (${st.result})` : ''), ...domains().map((d) => st.j[d.code] || ''), effOverall(st)]);
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
    const exporter = RT.exportPanel(document.getElementById('export'), () => fig, `${cfg.filePrefix}_plot`);
    const hist = RT.history(() => S, (s) => { S = s; syncInputs(); render(); });
    function render() {
      try { fig = build(); preview.innerHTML = fig.svg; }
      catch (e) { console.error(e); preview.innerHTML = `<div class="msg">⚠ ${RT.esc(e.message)}</div>`; }
      exporter.refresh();
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
      <button class="small" id="btnSaveJson" title="把目前所有輸入與設定下載成 .json 檔，之後可用「開啟設定檔」繼續編輯或分享給共同作者" data-en-title="Download all inputs and settings as a .json file; reopen it later or share it with co-authors" data-en="Save project">儲存設定檔</button>
      <button class="small" id="btnLoadJson" title="開啟先前儲存的 .json 設定檔" data-en-title="Open a previously saved .json project file" data-en="Open project">開啟設定檔</button>
      <button class="small" id="btnExample" data-en="Example">範例</button>
      <button class="small" id="btnReset" data-en="Clear">清空</button>
    </div>
  </header>
  <main class="tool">
    <section id="form">
      <div class="card"><div class="msg" style="margin:0">${o.noteZh ? `<span data-en="${RT.esc(o.noteEn)}">${o.noteZh}</span>` : ''}</div></div>
      <div class="card">
        <h2><span class="step-no">1</span> <span data-en="Tool version &amp; domains">版本與 domain</span></h2>
        <label class="field"><span data-en="Version / design">版本／設計</span><select id="variantSel"></select></label>
        ${o.niToggle ? `<label class="check"><input type="checkbox" data-k="allowNI"> <span data-en="Allow “No information”">允許「No information」</span></label>` : ''}
        <details><summary data-en="Domain names (editable — match them to the official version you use)">Domain 名稱（可編輯，請對照你使用的官方版本）</summary><div id="domains"></div></details>
      </div>
      <div class="card">
        <h2><span class="step-no">2</span> <span data-en="Judgements per study">各研究判斷</span></h2>
        <p class="hint" data-en="Choose a judgement per domain; the overall judgement is calculated by the tool’s rule (you can override it). ▾ opens fields for the result assessed, a weight and the support for each judgement.">每個 domain 選擇判斷；整體判斷依工具規則自動計算（可手動覆蓋）。按 ▾ 可填評估的結果、權重與每項判斷的理由。</p>
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
          <label class="check"><input type="checkbox" data-k="pctLabels"> <span data-en="Percent labels on summary bars">摘要長條顯示百分比</span></label>
          <label class="check"><input type="checkbox" data-k="useWeights"> <span data-en="Weight summary bars by study weight">摘要長條依研究權重加權</span></label>
          <div id="styleFields"></div>
        </details>
      </div>
      <div class="card">
        <h2 data-en="Tables">表格</h2>
        <div class="btns"><button id="docxBtn" data-en="Word table (with support text)">Word 表格（含理由）</button><button id="csvBtn" data-en="CSV (Excel)">CSV（Excel）</button></div>
      </div>
      <div class="card" id="refs"></div>
    </section>
    <section class="preview-col">
      <div class="paper" id="preview"></div>
      <div class="card" id="export"></div>
    </section>
  </main>`;
})();

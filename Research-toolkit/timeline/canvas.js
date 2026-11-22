/* Study Design Timeline — editing on the figure.
 * Click a row (or an annotation) to select it and open its panel; double-click any text to type over it; drag the blue
 * handle to move a row's text; the toolbar adds rows, text boxes, arrows and brackets, edits the types and legend, and
 * hides the settings column so the figure can take the whole width.
 * Runs after the page script and uses its globals (S, SEL, TL, fig, preview, redraw, update, syncInputs, mountKinds, …). */
(function () {
  'use strict';
  const T = RT.t, esc = RT.esc;
  const col = document.querySelector('.preview-col');
  const syncLater = RT.debounce(() => syncInputs(), 250);
  const changed = () => { update(); syncLater(); };
  const baseFs = () => Number(S.st.fontSize) || 15;
  let NSEL = null;          // selected annotation (index into S.notes)
  let MODE = null;          // what the panel shows: 'row' | 'note' | 'kinds'

  /* ---------------- figure ↔ screen ---------------- */
  function toScreen(x, y, w, h) {
    const svg = preview.querySelector('svg');
    if (!svg || !fig) return null;
    const r = svg.getBoundingClientRect(), k = r.width / fig.w;
    return { left: r.left + x * k, top: r.top + y * k, width: w * k, height: h * k, k };
  }
  const inBox = (p, b, pad = 0) => b && p[0] >= b.x - pad && p[0] <= b.x + b.w + pad && p[1] >= b.y - pad && p[1] <= b.y + b.h + pad;
  function rowAt(p) {
    for (let k = TL.texts.length - 1; k >= 0; k--) if (inBox(p, TL.texts[k], 2)) return TL.texts[k].i;
    for (let k = TL.bars.length - 1; k >= 0; k--) { const b = TL.bars[k]; if (b.y !== null && p[0] >= b.xs - 3 && p[0] <= b.xe + 3 && p[1] >= b.y - 2 && p[1] <= b.y + b.h + 2) return b.i; }
    return null;
  }
  /** the middle of the part of the figure that is on screen, in figure units */
  function visibleCenter() {
    const svg = preview.querySelector('svg'); if (!svg || !fig) return [200, 100];
    const r = svg.getBoundingClientRect(), k = r.width / fig.w;
    const top = Math.max(r.top, 0), bot = Math.min(r.bottom, window.innerHeight), left = Math.max(r.left, 0), right = Math.min(r.right, window.innerWidth);
    const x = ((left + right) / 2 - r.left) / k, y = ((top + bot) / 2 - r.top) / k;
    return [Math.max(40, Math.min(fig.w - 140, x)), Math.max(30, Math.min(fig.h - 40, y))];
  }

  /* ---------------- toolbar and the full-width mode ---------------- */
  const bar = RT.h(`<div class="tl-bar" role="toolbar" aria-label="${T('圖上編輯', 'Edit on the figure')}">
    <button type="button" class="small" data-x="canvas"></button>
    <span class="tl-sep" aria-hidden="true"></span>
    <button type="button" class="small" data-x="tpl" aria-haspopup="dialog">${T('範本', 'Template')} ▾</button>
    <button type="button" class="small" data-x="layout" aria-haspopup="dialog">${T('版面', 'Layout')} ▾</button>
    <button type="button" class="small" data-x="style" aria-haspopup="dialog">${T('風格', 'Style')} ▾</button>
    <span class="tl-sep" aria-hidden="true"></span>
    <button type="button" class="small" data-x="addrow">${T('＋ 列', '+ Row')}</button>
    <button type="button" class="small" data-x="kinds" aria-haspopup="dialog">${T('類別與圖例', 'Types & legend')}</button>
    <span class="tl-sep" aria-hidden="true"></span>
    <span class="fe-kit-here"></span>
  </div>`);
  col.prepend(bar);
  // the settings column is hidden unless it was opened last time: the figure comes first
  let canvas = true;
  try { canvas = localStorage.getItem('rt:timeline-settings') !== '1'; } catch (e) { /* ignore */ }
  function setCanvas(on) {
    canvas = on;
    document.body.classList.toggle('tl-canvas', on);
    const b = bar.querySelector('[data-x="canvas"]');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg> ' + T('設定', 'Settings');
    b.title = on ? T('打開左側的完整設定', 'Open the full settings on the left') : T('收起設定，讓圖佔滿寬度', 'Close the settings so the figure takes the full width');
    b.setAttribute('aria-pressed', String(!on));
    try { localStorage.setItem('rt:timeline-settings', on ? '0' : '1'); } catch (e) { /* ignore */ }
    setTimeout(place, 0);
  }
  // under the figure: the export panel and the design check side by side; the "actual size" button joins the toolbar
  const hint = document.querySelector('.drag-hint');
  const bottom = document.createElement('div'); bottom.className = 'tl-bottom';
  (hint || preview).after(bottom);
  ['export', 'designCheck'].forEach((id) => { const el = document.getElementById(id); if (el) bottom.appendChild(el); });
  // a draft legend in the style of Schneeweiss et al., from the windows on the figure
  const legendRefresh = RT.feCaption(bottom, () => {
    if (!S.rows.length) return '';
    const win = (r) => String(r.label || '').split('\n')[0].trim() + ' (' + winOf(r).replace(/^\(\s*|\s*\)$/g, '').replace(/\u00a0/g, ' ') + ')';
    // "Day 0" as the title says nothing new: then the description alone defines it
    const t0 = String(S.day0Title || '').trim(), d0 = String(S.day0Text || '').replace(/\n/g, ' ').trim();
    const day0 = [/^day\s*0$/i.test(t0) ? '' : t0, d0].filter(Boolean).join(': ') || 'the index date';
    return `Figure. Study design diagram. Day 0 = ${day0}. Time windows: ${S.rows.map(win).join('; ')}. Days in brackets are relative to Day 0, both ends inclusive. Diagram format follows Schneeweiss et al. (Ann Intern Med 2019;170:398–406).`;
  });
  const adoptZoom = () => { const z = document.querySelector('.paper-zoom'); if (z && z.parentNode !== bar) bar.appendChild(z); };
  adoptZoom(); document.addEventListener('DOMContentLoaded', () => setTimeout(adoptZoom, 0));
  function addNote(type) {
    const [cx, cy] = visibleCenter(), fs = baseFs(), R = Math.round;
    const n = type === 'text' ? { type, x: R(cx - 50), y: R(cy - fs), text: 'Note', size: fs, color: '#C00000', frame: 'none', bold: false, align: 'left' }
      : type === 'arrow' ? { type, x: R(cx - 70), y: R(cy - 30), x2: R(cx + 30), y2: R(cy + 10), color: '#C00000', sw: 1.6, dash: false }
        : { type, x: R(cx - 90), y: R(cy), x2: R(cx + 90), y2: R(cy), text: 'Period', size: R(fs * 0.9), color: '#333333', sw: 1.4, flip: false, bold: false };
    (S.notes ||= []).push(n);
    selectNote(S.notes.length - 1);
    syncInputs(); update();
  }
  bar.addEventListener('click', (e) => {
    const x = e.target.closest('[data-x]'); if (!x) return;
    const a = x.dataset.x;
    if (!a) return;
    if (a === 'canvas') setCanvas(!canvas);
    else if (a === 'addrow') {
      S.rows.push(row({ kind: 'cov', color: kindColor('cov'), label: 'New row', s: '-30', e: '-1' }));
      select(S.rows.length - 1);
      syncInputs(); update();
    } else if (MENUS.includes(a)) { if (MODE === a) closePanel(); else openMenu(a); }
    else addNote(a);
  });
  setCanvas(canvas);
  RT.feKit({
    bar, anchor: bar.querySelector('.fe-kit-here'), key: 'timeline', preview, form: document.getElementById('form'),
    addNote: (t) => addNote(t), openSettings: () => setCanvas(false),
    menuButtons: () => [...bar.querySelectorAll('[data-x="tpl"], [data-x="layout"], [data-x="style"], [data-x="kinds"]')],
    tips: [
      ['點一列可開啟它的設定；拖曳色條兩端改天數，拖中間整段移動。', 'Click a row for its settings; drag a bar’s ends to change days, or its middle to move it.'],
      ['雙擊任何文字直接修改；「＋ 註解」加文字框、箭頭、括號；藍色把手可以移動一列的文字。', 'Double-click any text to edit it; + Note adds text boxes, arrows and brackets; the blue handle moves a row’s text.'],
      ['範本、版面、風格在上方；完整設定按「設定」；版本和色覺預覽在「更多」，匯出與圖說在圖的下方。', 'Templates, layout and style are above; everything else under Settings; versions and the colour check are in More; export and the legend are below the figure.'],
    ],
  });
  bar.querySelector('.fe-kit-here').remove();

  /* ---------------- selection ---------------- */
  function resetPlacement() { pinned = null; scrolledFor = null; }
  function select(i) {
    SEL = i === null || !S.rows[i] ? null : i;
    NSEL = null; MODE = SEL === null ? null : 'row';
    resetPlacement(); closeEditor(); buildPanel(); redraw(); place();
  }
  function selectNote(k) {
    NSEL = k === null || !(S.notes || [])[k] ? null : k;
    SEL = null; MODE = NSEL === null ? null : 'note';
    resetPlacement(); closeEditor(); buildPanel(); redraw(); place();
  }
  const MENUS = ['kinds', 'tpl', 'layout', 'style'];
  function openMenu(m) { SEL = null; NSEL = null; MODE = m; resetPlacement(); closeEditor(); buildPanel(); redraw(); place(); }
  function closePanel() { if (MODE === 'note') selectNote(null); else select(null); }

  /* ---------------- annotation handles (called by the page's decorate) ---------------- */
  const NS = 'http://www.w3.org/2000/svg';
  function decorateNotes(g) {
    (TL.notes || []).forEach((b) => {
      const sel = b.k === NSEL, n = S.notes[b.k]; if (!n) return;
      const label = T('註解：', 'Annotation: ') + (n.text || NOTE_KIND()[n.type]);
      if (b.type === 'arrow') {
        g.appendChild(RT.svgEl('line', { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, stroke: 'transparent', 'stroke-width': 14, 'stroke-linecap': 'round', class: 'note-hit', 'data-note': b.k, tabindex: 0, role: 'button', 'aria-label': label }));
      } else {
        g.appendChild(RT.svgEl('rect', { x: b.x - 3, y: b.y - 3, width: b.w + 6, height: b.h + 6, fill: 'transparent', class: 'note-hit', 'data-note': b.k, tabindex: 0, role: 'button', 'aria-label': label }));
      }
      if (!sel) return;
      g.insertBefore(RT.svgEl('rect', { x: b.x - 6, y: b.y - 6, width: b.w + 12, height: b.h + 12, rx: 4, fill: 'none', stroke: '#2563EB', 'stroke-width': 1.6, 'stroke-dasharray': '5 3', 'pointer-events': 'none' }), g.firstChild);
      if (b.type !== 'text') {
        [[1, b.x1, b.y1], [2, b.x2, b.y2]].forEach(([end, x, y]) => g.appendChild(RT.svgEl('circle', { cx: x, cy: y, r: 6.5, fill: '#FFFFFF', stroke: '#2563EB', 'stroke-width': 2, class: 'note-end', 'data-note': b.k, 'data-note-end': end, role: 'button', 'aria-label': T('拖曳端點', 'Drag this end') })));
      }
    });
  }

  /* ---------------- pointer: rows, row text, annotations ---------------- */
  let down = null, txtDrag = null, noteDrag = null;
  preview.addEventListener('pointerdown', (e) => {
    const t = e.target.closest ? e.target : null;
    const h = t && t.closest('.txt-move');
    if (h) {
      const i = Number(h.dataset.txt), r = S.rows[i], p = RT.figPoint(preview, fig, e);
      txtDrag = { i, p0: p, dx0: Number(r.tdx) || 0, dy0: Number(r.tdy) || 0, moved: false };
      preview.setPointerCapture(e.pointerId); e.preventDefault(); e.stopImmediatePropagation();
      return;
    }
    const nh = t && t.closest('[data-note]');
    if (nh) {
      const k = Number(nh.dataset.note), n = S.notes[k];
      noteDrag = { k, end: nh.dataset.noteEnd ? Number(nh.dataset.noteEnd) : 0, p0: RT.figPoint(preview, fig, e), n0: { ...n }, moved: false };
      preview.setPointerCapture(e.pointerId); e.preventDefault(); e.stopImmediatePropagation();
      return;
    }
    down = { x: e.clientX, y: e.clientY };
  }, true);
  preview.addEventListener('pointermove', (e) => {
    if (txtDrag) {
      const p = RT.figPoint(preview, fig, e), r = S.rows[txtDrag.i];
      r.tdx = Math.round(txtDrag.dx0 + p[0] - txtDrag.p0[0]); r.tdy = Math.round(txtDrag.dy0 + p[1] - txtDrag.p0[1]);
      txtDrag.moved = true; redraw(); place(); e.stopImmediatePropagation();
      return;
    }
    if (noteDrag) {
      const p = RT.figPoint(preview, fig, e), n = S.notes[noteDrag.k], o = noteDrag.n0;
      const dx = Math.round(p[0] - noteDrag.p0[0]), dy = Math.round(p[1] - noteDrag.p0[1]);
      if (!noteDrag.moved && Math.hypot(dx, dy) < 3) return;
      if (noteDrag.end === 1) { n.x = o.x + dx; n.y = o.y + dy; }
      else if (noteDrag.end === 2) { n.x2 = o.x2 + dx; n.y2 = o.y2 + dy; }
      else { n.x = o.x + dx; n.y = o.y + dy; if (n.type !== 'text') { n.x2 = o.x2 + dx; n.y2 = o.y2 + dy; } }
      // keep it on the figure's left/top edge; past the right or bottom edge the figure grows
      if (n.x < 0) { const s0 = -n.x; n.x += s0; if (n.type !== 'text' && noteDrag.end !== 1) n.x2 += s0; }
      if (n.y < 0) { const s0 = -n.y; n.y += s0; if (n.type !== 'text' && noteDrag.end !== 1) n.y2 += s0; }
      noteDrag.moved = true; redraw(); place(); e.stopImmediatePropagation();
    }
  }, true);
  preview.addEventListener('pointerup', (e) => {
    if (txtDrag) { const m = txtDrag.moved; txtDrag = null; e.stopImmediatePropagation(); if (m) { syncInputs(); update(); } return; }
    if (noteDrag) {
      const { k, moved } = noteDrag; noteDrag = null; e.stopImmediatePropagation();
      if (moved) { if (NSEL !== k) selectNote(k); syncInputs(); update(); } else if (NSEL !== k) selectNote(k);
      return;
    }
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4; down = null;
    if (moved) return;
    const i = rowAt(RT.figPoint(preview, fig, e));
    if (i !== SEL || NSEL !== null || MENUS.includes(MODE)) setTimeout(() => select(i), 0);   // after the page's own pointerup
  }, true);
  // arrow keys: nudge a row's text (its handle) or an annotation
  preview.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    const t = e.target.closest ? e.target : null;
    const h = t && t.closest('.txt-move'), nh = t && t.closest('.note-hit');
    if (nh && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selectNote(Number(nh.dataset.note)); return; }
    if (!d || (!h && !nh)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const k = e.shiftKey ? 10 : 1;
    if (h) {
      const r = S.rows[Number(h.dataset.txt)];
      r.tdx = (Number(r.tdx) || 0) + d[0] * k; r.tdy = (Number(r.tdy) || 0) + d[1] * k;
      redraw(); preview.querySelector('.txt-move')?.focus({ preventScroll: true });
    } else {
      const j = Number(nh.dataset.note), n = S.notes[j];
      n.x += d[0] * k; n.y += d[1] * k; if (n.type !== 'text') { n.x2 += d[0] * k; n.y2 += d[1] * k; }
      redraw(); preview.querySelector(`.note-hit[data-note="${j}"]`)?.focus({ preventScroll: true });
    }
    place(); changed();
  }, true);
  preview.addEventListener('dblclick', (e) => {
    const p = RT.figPoint(preview, fig, e);
    const nb = [...(TL.notes || [])].reverse().find((b) => b.type !== 'arrow' && inBox(p, b, 4));
    if (nb) { if (NSEL !== nb.k) selectNote(nb.k); openEditor('note', nb.k); return; }
    const t = [...TL.texts].reverse().find((b) => inBox(p, b, 3));
    if (t) { if (SEL !== t.i) select(t.i); openEditor('row', t.i); return; }
    if (inBox(p, TL.d0, 3)) { openEditor('d0'); return; }
    if (inBox(p, TL.legend, 3)) { openEditor('legend'); return; }
    if (inBox(p, TL.foot, 3)) openEditor('foot');
  });

  /* ---------------- the panel ---------------- */
  const panel = document.createElement('div');
  panel.className = 'tl-panel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  document.body.appendChild(panel);
  let built = null;   // what the panel was built for: { mode, i, kv }
  const opts = (list, cur) => list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const head = (title, sub) => `<div class="tl-p-head"><b>${title}</b>${sub ? `<span class="muted">· ${esc(sub)}</span>` : ''}<span class="spacer"></span><button type="button" class="icon" data-q="close" aria-label="${T('關閉', 'Close')}">✕</button></div>`;
  const SIZES = () => [9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32].map((v) => [v, v + ' px']);
  function buildPanel() {
    if (MODE === 'row' && SEL !== null && S.rows[SEL]) buildRow();
    else if (MODE === 'note' && NSEL !== null && S.notes[NSEL]) buildNote();
    else if (MODE === 'kinds') buildKinds();
    else if (MODE === 'tpl') buildTpl();
    else if (MODE === 'layout' || MODE === 'style') buildLook();
    else { panel.hidden = true; built = null; return; }
    panel.hidden = false;
  }
  function buildRow() {
    const r = S.rows[SEL], i = SEL;
    built = { mode: 'row', i, kv: KINDS_V };
    panel.setAttribute('aria-label', T('這一列的設定', 'Settings for this row'));
    panel.innerHTML = head(`${T('第', 'Row')} ${i + 1} ${T('列', '')}`, kindName(r.kind)) + `
      <label class="tl-f"><span>${T('標題', 'Title')}</span><textarea rows="1" data-p="label">${esc(r.label)}</textarea></label>
      <label class="tl-f"><span>${T('細項（每行一項）', 'Details (one per line)')}</span><textarea rows="2" data-p="details">${esc(r.details)}</textarea></label>
      <div class="tl-g4">
        <label class="tl-f"><span>${T('起點', 'Start')}</span><input data-p="s" value="${esc(r.s)}" placeholder="${T('開放', 'open')}"></label>
        <label class="tl-f"><span>${T('終點', 'End')}</span><input data-p="e" value="${esc(r.e)}" placeholder="${T('開放', 'open')}"></label>
        <label class="tl-f"><span>${T('類別', 'Type')}</span><select data-p="kind">${opts(kindList(), r.kind)}</select></label>
        <label class="tl-f"><span>${T('形狀', 'Shape')}</span><select data-p="shape">${opts(SHAPES(), r.shape)}</select></label>
        <label class="tl-f"><span>${T('顏色', 'Colour')}</span><input type="color" data-p="color" value="${esc(colorOf(r))}"></label>
        <label class="tl-f"><span>${T('文字位置', 'Text')}</span><select data-p="pos">${opts(POS(), r.pos || 'auto')}</select></label>
        <label class="tl-f"><span>${T('字級', 'Size')}</span><select data-p="fsK">${opts(FS_STEPS.map((k) => [k, Math.round(k * 100) + '%']), nearestFs(r.fsK))}</select></label>
        <label class="tl-f"><span>${T('標題粗細', 'Weight')}</span><select data-p="bold">${opts([['', T('跟著整張圖', 'As figure')], ['b', T('粗體', 'Bold')], ['n', T('一般', 'Regular')]], r.bold || '')}</select></label>
      </div>
      <div class="tl-g2">
        <label class="tl-f"><span>${T('區間文字（留空自動）', 'Window label (blank = auto)')}</span><input data-p="win" value="${esc(r.win)}" placeholder="${esc(autoWin(r))}"></label>
        <label class="tl-f"><span>${T('最小高度', 'Min height')}</span><input type="number" min="0" max="400" step="2" data-p="minH" value="${Number(r.minH) || ''}"></label>
      </div>
      <div class="tl-segs-h"><span>${T('同一列的其他段', 'More segments on this row')}</span><button type="button" class="small" data-q="addseg">${T('＋ 加一段', '+ Add a segment')}</button></div>
      <div class="tl-segs">${segsOf(r).map((g, k) => `<div class="tl-seg" data-k="${k}"><input data-g="s" value="${esc(g.s)}" placeholder="${T('起', 'From')}" aria-label="${T('起', 'From')}"><input data-g="e" value="${esc(g.e)}" placeholder="${T('迄', 'To')}" aria-label="${T('迄', 'To')}"${g.shape === 'event' ? ' disabled' : ''}><select data-g="shape" aria-label="${T('形狀', 'Shape')}">${opts([['bar', T('色段', 'Segment')], ['event', T('事件', 'Event')]], g.shape)}</select><input type="color" data-g="color" value="${esc(g.color || colorOf(r))}" aria-label="${T('顏色', 'Colour')}"><input data-g="win" value="${esc(g.win)}" placeholder="${T('段內文字', 'Label')}" aria-label="${T('段內文字', 'Label')}"><button type="button" class="icon" data-q="delseg" aria-label="${T('刪除這段', 'Remove segment')}">✕</button></div>`).join('')}</div>
      <div class="tl-p-foot">
        <button type="button" class="small" data-q="up" aria-label="${T('上移', 'Move up')}"${i === 0 ? ' disabled' : ''}>↑</button>
        <button type="button" class="small" data-q="down" aria-label="${T('下移', 'Move down')}"${i === S.rows.length - 1 ? ' disabled' : ''}>↓</button>
        <button type="button" class="small" data-q="dup">${T('複製', 'Duplicate')}</button>
        <button type="button" class="small" data-q="resetpos"${Number(r.tdx) || Number(r.tdy) ? '' : ' hidden'}>${T('文字回到自動位置', 'Text back in place')}</button>
        <span class="spacer"></span>
        <button type="button" class="small danger" data-q="del">${T('刪除這列', 'Delete row')}</button>
      </div>`;
  }
  function buildNote() {
    const n = S.notes[NSEL];
    built = { mode: 'note', i: NSEL };
    panel.setAttribute('aria-label', T('註解的設定', 'Annotation settings'));
    const size = `<label class="tl-f"><span>${T('字級', 'Size')}</span><select data-n="size">${opts(SIZES(), Math.round(Number(n.size) || baseFs()))}</select></label>`;
    const color = `<label class="tl-f"><span>${T('顏色', 'Colour')}</span><input type="color" data-n="color" value="${esc(n.color || '#000000')}"></label>`;
    const sw = `<label class="tl-f"><span>${T('線粗', 'Line')}</span><select data-n="sw">${opts([[1, '1'], [1.4, '1.4'], [1.6, '1.6'], [2.5, '2.5'], [4, '4']], Number(n.sw) || 1.6)}</select></label>`;
    const bold = `<label class="check" style="margin:2px 0 6px"><input type="checkbox" data-n="bold"${n.bold ? ' checked' : ''}> ${T('粗體', 'Bold')}</label>`;
    let body = '';
    if (n.type === 'text') {
      body = `<label class="tl-f"><span>${T('文字（雙擊圖上的文字也能改）', 'Text (or double-click it on the figure)')}</span><textarea rows="2" data-n="text">${esc(n.text)}</textarea></label>
        <div class="tl-g4">${size}${color}
          <label class="tl-f"><span>${T('外框', 'Frame')}</span><select data-n="frame">${opts([['none', T('無', 'None')], ['line', T('線框', 'Outline')], ['white', T('白底線框', 'White box')], ['fill', T('色底', 'Filled')]], n.frame || 'none')}</select></label>
          <label class="tl-f"><span>${T('對齊', 'Align')}</span><select data-n="align">${opts([['left', T('靠左', 'Left')], ['center', T('置中', 'Centre')], ['right', T('靠右', 'Right')]], n.align || 'left')}</select></label>
        </div>
        <div class="tl-g2">${bold}<label class="tl-f"${n.frame === 'fill' ? '' : ' hidden'}><span>${T('底色', 'Fill')}</span><input type="color" data-n="fill" value="${esc(n.fill || '#FFF2CC')}"></label></div>`;
    } else if (n.type === 'arrow') {
      body = `<div class="tl-g4">${color}${sw}</div><label class="check" style="margin:2px 0 6px"><input type="checkbox" data-n="dash"${n.dash ? ' checked' : ''}> ${T('虛線', 'Dashed')}</label>
        <p class="tl-tip">${T('拖曳兩端的圓點調整方向與長度，拖曳線本身整支移動。', 'Drag the round ends to aim and size it, or drag the line to move it.')}</p>`;
    } else {
      body = `<label class="tl-f"><span>${T('文字', 'Text')}</span><input data-n="text" value="${esc(n.text)}"></label>
        <div class="tl-g4">${size}${color}${sw}</div>
        <div class="tl-g2">${bold}<label class="check" style="margin:2px 0 6px"><input type="checkbox" data-n="flip"${n.flip ? ' checked' : ''}> ${T('翻面', 'Flip')}</label></div>
        <p class="tl-tip">${T('拖曳兩端的圓點改長度；拉成直的就是垂直括號。', 'Drag the round ends to resize; drag one end up or down for a vertical bracket.')}</p>`;
    }
    panel.innerHTML = head(NOTE_KIND()[n.type] || n.type, '') + body + `<div class="tl-p-foot"><button type="button" class="small" data-q="ndup">${T('複製', 'Duplicate')}</button><span class="spacer"></span><button type="button" class="small danger" data-q="ndel">${T('刪除', 'Delete')}</button></div>`;
  }
  function buildKinds() {
    built = { mode: 'kinds', kv: KINDS_V };
    const lg = S.legend || (S.legend = { on: false, title: '', all: false });
    panel.setAttribute('aria-label', T('類別與圖例', 'Types and legend'));
    panel.innerHTML = head(T('類別與圖例', 'Types & legend'), '') +
      `<p class="tl-tip" style="margin-top:0">${T('改名稱或顏色，這個類別的每一列會一起改。', 'Rename or recolour a type and every row of it follows.')}</p><div class="tl-kinds"></div>
      <label class="check" style="margin-top:10px"><input type="checkbox" data-l="on"${lg.on ? ' checked' : ''}> ${T('在圖下方加圖例', 'Add a legend under the figure')}</label>
      <div class="tl-legend-opts"${lg.on ? '' : ' hidden'}>
        <label class="tl-f"><span>${T('圖例標題（選填）', 'Legend title (optional)')}</span><input data-l="title" value="${esc(lg.title || '')}"></label>
        <label class="check"><input type="checkbox" data-l="all"${lg.all ? ' checked' : ''}> ${T('列出全部類別（不勾＝只列圖上用到的）', 'List every type (off = only those on the figure)')}</label>
      </div>`;
    mountKinds(panel.querySelector('.tl-kinds'));
  }
  function buildTpl() {
    built = { mode: 'tpl' };
    panel.setAttribute('aria-label', T('研究設計範本', 'Study design templates'));
    const card = (id) => { const t = TEMPLATES[id]; return t ? `<button type="button" class="tpl" data-tpl="${id}">${fitBadge(t.fit)}<b>${esc(T(t.zh, t.en))}</b><span class="d">${esc(T(t.dzh, t.den))}</span></button>` : ''; };
    panel.innerHTML = head(T('研究設計範本', 'Study design templates'), '') +
      `<p class="tl-tip" style="margin-top:0">${T('範本會取代全部時間窗，天數是示意值；按 ↶ 可復原。', 'A template replaces every time window; its days are placeholders. ↶ undoes.')}</p>
      <label class="check"><input type="checkbox" data-k="useConv"${S.useConv !== false ? ' checked' : ''}> ${T('一併套用此設計慣用的版面與配色', 'Also apply the design’s usual layout and colours')}</label>` +
      TPL_GROUPS.map(([name, ids]) => `<div class="tpl-group">${name}</div><div class="tpl-row">${ids.map(card).join('')}</div>`).join('');
  }
  function buildLook() {
    const layout = MODE === 'layout';
    built = { mode: MODE };
    panel.setAttribute('aria-label', layout ? T('版面', 'Layout') : T('風格', 'Style'));
    const sel = (k, list) => `<select data-k="${k}">${list.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select>`;
    panel.innerHTML = head(layout ? T('版面', 'Layout') : T('風格', 'Style'), '') + (layout
      ? `<div class="tl-g2b">
          <label class="tl-f"><span>${T('版面', 'Layout')}</span>${sel('style', [['block', T('區塊式（文字在色條內）', 'Block (text inside bars)')], ['classic', T('經典（左側標籤欄）', 'Classic (label column)')], ['track', T('單軌時間線（懷孕世代）', 'Single track (pregnancy)')]])}</label>
          <label class="tl-f"><span>${T('時間比例', 'Time scale')}</span>${sel('scale', [['sqrt', T('平方根（適中壓縮）', 'Square root')], ['linear', T('線性（實際比例）', 'Linear')], ['log', T('對數（強壓縮）', 'Log')], ['equal', T('等距', 'Equal spacing')]])}</label>
          <label class="tl-f"><span>${T('時間單位', 'Time unit')}</span>${sel('unit', [['Days', 'Day(s)'], ['Weeks', 'Week(s)'], ['Months', 'Month(s)'], ['Years', 'Year(s)']])}</label>
          <label class="tl-f" data-show="style=block|track"><span>${T('圖寬 (px)', 'Width (px)')}</span><input type="number" data-k="blockW" min="500" max="2400" step="10"></label>
          <label class="tl-f" data-show="style=block"><span>${T('Day 0 位置（% 圖寬）', 'Day 0 position (%)')}</span><input type="number" data-k="day0Pos" min="15" max="85" step="1"></label>
          <label class="tl-f" data-show="style=block|classic"><span>${T('列間距 (px)', 'Row gap (px)')}</span><input type="number" data-k="rowGap" min="0" max="60" step="1"></label>
        </div>
        <label class="check"><input type="checkbox" data-k="showWin"> ${T('顯示區間文字', 'Show window labels')}</label>
        <label class="check" data-show="style=block|track"><input type="checkbox" data-k="axis"> ${T('時間軸箭頭', 'Axis arrow')}</label>
        <p class="tl-tip">${T('Day 0、參考線、日曆時間面板和細部外觀在「設定」裡。', 'Day 0, reference lines, the calendar panel and finer details are under Settings.')}</p>`
      : `<div class="tl-g2b">
          <label class="tl-f"><span>${T('套用風格', 'Apply a style')}</span><select data-th><option value="">${T('選擇風格…', 'Choose a style…')}</option>${Object.entries(THEMES).map(([id, t]) => `<option value="${id}">${esc(T(t.zh, t.en))}</option>`).join('')}</select></label>
          <label class="tl-f"><span>${T('配色', 'Palette')}</span><select data-pal>${Object.entries(PALETTES).map(([id, p]) => `<option value="${id}"${id === S.palette ? ' selected' : ''}>${esc(T(p.zh, p.en))}</option>`).join('')}</select></label>
        </div>${RT.styleFieldsHTML(['font', 'fontSize', 'lh'])}
        <label class="check"><input type="checkbox" data-k="titleBold"> ${T('列標題粗體', 'Bold row titles')}</label>
        <label class="check"><input type="checkbox" data-k="gray"> ${T('灰階輸出', 'Grayscale output')}</label>`);
    RT.syncForm(panel, S);
  }
  // a template, style or palette from the menus
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tpl]'); if (!b || MODE !== 'tpl') return;
    loadTemplate(S, b.dataset.tpl); syncInputs(); update(); closePanel();
    RT.toast(T('已載入範本（按 ↶ 可復原）', 'Template loaded (↶ to undo)'));
  });
  panel.addEventListener('change', (e) => {
    const el = e.target;
    if (el.hasAttribute('data-th') && el.value) {
      const id = el.value, th = THEMES[id], keepTrack = S.style === 'track'; el.value = '';
      applyThemeTo(S, id); if (keepTrack && th.s.style !== 'track') S.style = 'track';
      S.kindColors = {}; applyPalette(S); syncInputs(); update(); RT.syncForm(panel, S);
      RT.toast(T('已套用風格：', 'Style applied: ') + T(th.zh, th.en) + T('（按 ↶ 可復原）', ' (↶ to undo)'));
    } else if (el.hasAttribute('data-pal')) { S.palette = el.value; S.kindColors = {}; applyPalette(S); syncInputs(); update(); }
  });
  panel.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.k && MENUS.includes(MODE)) {
      const v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value;
      RT.setPath(S, el.dataset.k, v);
      RT.syncVisibility(panel, S);
      syncInputs(); update();
      return;
    }
    if (MODE === 'row') {
      const r = S.rows[SEL]; if (!r) return;
      if (el.dataset.p) {
        const f = el.dataset.p;
        r[f] = f === 'fsK' ? Number(el.value) || 1 : f === 'minH' ? Number(el.value) || 0 : el.value;
        if (f === 'kind') { r.color = kindColor(r.kind); panel.querySelector('[data-p="color"]').value = r.color; panel.querySelector('.tl-p-head .muted').textContent = '· ' + kindName(r.kind); }
        if (f === 's' || f === 'e' || f === 'shape') panel.querySelector('[data-p="win"]').placeholder = autoWin(r);
        changed();
      } else if (el.dataset.g) {
        const g = segsOf(r)[Number(el.closest('.tl-seg').dataset.k)]; if (!g) return;
        g[el.dataset.g] = el.value;
        if (el.dataset.g === 'shape') { if (g.shape === 'event') g.e = ''; buildPanel(); }
        changed();
      }
    } else if (MODE === 'note') {
      const n = S.notes[NSEL]; if (!n || !el.dataset.n) return;
      const f = el.dataset.n;
      n[f] = el.type === 'checkbox' ? el.checked : f === 'size' || f === 'sw' ? Number(el.value) : el.value;
      if (f === 'frame') buildPanel();
      changed();
    } else if (MODE === 'kinds' && el.dataset.l) {
      const lg = S.legend; lg[el.dataset.l] = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.l === 'on') panel.querySelector('.tl-legend-opts').hidden = !el.checked;
      changed();
    }
  });
  panel.addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]'); if (!q) return;
    const a = q.dataset.q;
    if (a === 'close') { closePanel(); return; }
    if (MODE === 'note') {
      if (a === 'ndup') { const c = structuredClone(S.notes[NSEL]); c.x += 16; c.y += 16; if (c.x2 !== undefined) { c.x2 += 16; c.y2 += 16; } S.notes.push(c); selectNote(S.notes.length - 1); }
      if (a === 'ndel') { S.notes.splice(NSEL, 1); selectNote(null); }
      syncInputs(); update();
      return;
    }
    const i = SEL, r = S.rows[i]; if (!r) return;
    switch (a) {
      case 'addseg': (r.segs ||= []).push(newSegFor(r)); break;
      case 'delseg': r.segs.splice(Number(q.closest('.tl-seg').dataset.k), 1); break;
      case 'up': if (i > 0) { [S.rows[i - 1], S.rows[i]] = [S.rows[i], S.rows[i - 1]]; SEL = i - 1; } break;
      case 'down': if (i < S.rows.length - 1) { [S.rows[i + 1], S.rows[i]] = [S.rows[i], S.rows[i + 1]]; SEL = i + 1; } break;
      case 'dup': S.rows.splice(i + 1, 0, structuredClone(r)); SEL = i + 1; break;
      case 'resetpos': r.tdx = 0; r.tdy = 0; break;
      case 'del': S.rows.splice(i, 1); SEL = null; MODE = null; break;
      default: return;
    }
    buildPanel(); syncInputs(); update();
  });

  /* ---------------- typing over text on the figure ---------------- */
  const ed = document.createElement('div');
  ed.className = 'tl-ed'; ed.hidden = true;
  ed.setAttribute('role', 'dialog');
  document.body.appendChild(ed);
  let edFor = null;
  function openEditor(kind, i) {
    edFor = { kind, i };
    const fields = kind === 'row' ? [['label', T('標題', 'Title'), S.rows[i].label, 1], ['details', T('細項（每行一項）', 'Details (one per line)'), S.rows[i].details, 3]]
      : kind === 'note' ? [['text', T('文字', 'Text'), S.notes[i].text, S.notes[i].type === 'text' ? 3 : 1]]
        : kind === 'd0' ? [['day0Title', T('Day 0 標題', 'Day 0 title'), S.day0Title, 1], ['day0Text', T('說明文字', 'Description'), S.day0Text, 2]]
          : kind === 'legend' ? [['title', T('圖例標題', 'Legend title'), (S.legend || {}).title, 1]]
            : [['footnote', T('註腳', 'Footnote'), S.footnote, 3]];
    ed.setAttribute('aria-label', T('編輯文字', 'Edit text'));
    ed.innerHTML = fields.map(([k, l, v, rows]) => `<label class="tl-f"><span>${esc(l)}</span><textarea data-t="${k}" rows="${rows}">${esc(v || '')}</textarea></label>`).join('') +
      `<div class="tl-ed-foot"><span class="muted">${T('Esc 或點外面就完成', 'Esc or click outside to finish')}</span><button type="button" class="small primary" data-q="done">${T('完成', 'Done')}</button></div>`;
    ed.hidden = false;
    placeEditor();
    const first = ed.querySelector('textarea'); first.focus(); first.select();
  }
  function closeEditor() { if (ed.hidden) return; ed.hidden = true; edFor = null; syncInputs(); if (MODE) buildPanel(); }
  ed.addEventListener('input', (e) => {
    const k = e.target.dataset.t; if (!k || !edFor) return;
    const v = e.target.value;
    if (edFor.kind === 'row') { const r = S.rows[edFor.i]; if (r) r[k] = v; const p = panel.querySelector(`[data-p="${k}"]`); if (p && MODE === 'row') p.value = v; }
    else if (edFor.kind === 'note') { const n = S.notes[edFor.i]; if (n) n.text = v; const p = panel.querySelector('[data-n="text"]'); if (p && MODE === 'note') p.value = v; }
    else if (edFor.kind === 'legend') (S.legend ||= {}).title = v;
    else S[k] = v;
    update();
  });
  ed.addEventListener('click', (e) => { if (e.target.closest('[data-q="done"]')) closeEditor(); });
  ed.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeEditor(); } });
  function placeEditor() {
    if (ed.hidden || !edFor) return;
    const box = edFor.kind === 'row' ? TL.texts.find((t) => t.i === edFor.i) : edFor.kind === 'note' ? (TL.notes || []).find((b) => b.k === edFor.i)
      : edFor.kind === 'd0' ? TL.d0 : edFor.kind === 'legend' ? TL.legend : TL.foot;
    const sr = box && toScreen(box.x, box.y, box.w, box.h);
    const w = Math.min(window.innerWidth - 16, Math.max(280, sr ? Math.min(sr.width + 24, 520) : 320));
    let left = sr ? sr.left - 12 : 16, top = sr ? sr.top + sr.height + 6 : 80;
    left = Math.max(8, Math.min(window.innerWidth - w - 8, left));
    if (top + ed.offsetHeight > window.innerHeight - 8 && sr) top = Math.max(8, sr.top - ed.offsetHeight - 6);
    ed.style.width = w + 'px'; ed.style.left = left + 'px'; ed.style.top = Math.max(8, top) + 'px';
  }

  /* ---------------- where the panel goes ---------------- */
  // in order: beside the figure (over the settings column), beside the selection, below it, above it; with no room,
  // the page scrolls the selection up first, and only then does the panel sit over the figure (phones: a bottom sheet).
  // Dragged by its title bar, it stays put until something else is selected.
  let pinned = null, scrolledFor = null;
  const selKey = () => MODE + ':' + (MODE === 'row' ? SEL : MODE === 'note' ? NSEL : '');
  function targetRect() {
    if (MENUS.includes(MODE)) { const r = bar.querySelector(`[data-x="${MODE}"]`).getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }
    let parts = [];
    if (MODE === 'row') parts = [...TL.bars.filter((b) => b.i === SEL && b.y !== null).map((b) => ({ x: b.xs, y: b.y, w: b.xe - b.xs, h: b.h })), ...TL.texts.filter((t) => t.i === SEL)];
    else if (MODE === 'note') parts = (TL.notes || []).filter((b) => b.k === NSEL);
    if (!parts.length) return null;
    const x1 = Math.min(...parts.map((p) => p.x)), x2 = Math.max(...parts.map((p) => p.x + p.w)), y1 = Math.min(...parts.map((p) => p.y)), y2 = Math.max(...parts.map((p) => p.y + p.h));
    return toScreen(x1, y1, Math.max(4, x2 - x1), Math.max(4, y2 - y1));
  }
  function place() {
    placeEditor();
    if (panel.hidden || !MODE) return;
    if (window.innerWidth < 640) { panel.classList.add('sheet'); panel.style.left = ''; panel.style.top = ''; panel.style.width = ''; return; }
    panel.classList.remove('sheet');
    if (pinned && pinned.key === selKey()) { panel.style.left = pinned.left + 'px'; panel.style.top = pinned.top + 'px'; return; }
    const sr = targetRect(); if (!sr) return;
    const pr = preview.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, GAP = 10;
    const fitW = (room) => Math.min(440, room - 16);
    const clampTop = (t, h) => Math.max(8, Math.min(vh - h - 8, t));
    const put = (left, top, w) => { panel.style.width = w + 'px'; const h = panel.offsetHeight; panel.style.left = Math.round(left) + 'px'; panel.style.top = Math.round(clampTop(top, h)) + 'px'; };
    const roomFigL = pr.left - GAP, roomR = vw - (sr.left + sr.width) - GAP, roomL = sr.left - GAP;
    if (MENUS.includes(MODE)) { const w = Math.min(MODE === 'tpl' ? 620 : 440, vw - 16); put(Math.max(8, Math.min(vw - w - 8, sr.left)), sr.top + sr.height + 6, w); return; }
    if (roomFigL >= 300) { const w = fitW(roomFigL); put(pr.left - GAP - w, sr.top - 10, w); return; }
    if (roomR >= 300) { const w = fitW(roomR); put(sr.left + sr.width + GAP, sr.top - 10, w); return; }
    if (roomL >= 300) { const w = fitW(roomL); put(sr.left - GAP - w, sr.top - 10, w); return; }
    const w = Math.min(440, vw - 16); panel.style.width = w + 'px';
    const ph = panel.offsetHeight, left = Math.max(8, Math.min(vw - w - 8, sr.left + sr.width / 2 - w / 2));
    if (sr.top + sr.height + GAP + ph <= vh - 8) put(left, sr.top + sr.height + GAP, w);
    else if (sr.top - GAP - ph >= 8) put(left, sr.top - GAP - ph, w);
    else if (scrolledFor !== selKey() && scrollUp(sr.top - 76)) scrolledFor = selKey();
    else put(left, vh - ph - 8, w);
  }
  function scrollUp(dy) {
    if (dy <= 0) return false;
    const box = canvas || col.scrollHeight <= col.clientHeight ? document.scrollingElement : col;
    const max = box.scrollHeight - box.clientHeight - box.scrollTop;
    if (max < 40) return false;
    box.scrollBy({ top: Math.min(dy, max) });
    setTimeout(place, 30);
    return true;
  }
  panel.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('.tl-p-head'); if (!h || e.target.closest('button') || panel.classList.contains('sheet')) return;
    const r0 = panel.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
    h.setPointerCapture(e.pointerId);
    const mv = (ev) => { pinned = { key: selKey(), left: Math.max(0, Math.min(window.innerWidth - 60, r0.left + ev.clientX - x0)), top: Math.max(0, Math.min(window.innerHeight - 40, r0.top + ev.clientY - y0)) }; panel.style.left = pinned.left + 'px'; panel.style.top = pinned.top + 'px'; };
    const up = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); };
    h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    e.preventDefault();
  });
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);

  /* ---------------- keyboard and clicks outside ---------------- */
  const typing = (el) => el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!ed.hidden) { closeEditor(); return; }
      if (MODE && !e.target.closest('#form')) closePanel();
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && NSEL !== null && !typing(document.activeElement)) {
      e.preventDefault(); S.notes.splice(NSEL, 1); selectNote(null); syncInputs(); update();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (!ed.hidden && !ed.contains(e.target)) closeEditor();
    if (MENUS.includes(MODE) && MODE !== 'kinds' && !panel.contains(e.target) && !e.target.closest('.tl-bar')) closePanel();
  }, true);

  // the page calls these: decorate() for annotation handles, render() → afterRender() to keep the panel in step
  window.TLX = {
    decorate: decorateNotes,
    afterRender() {
      if (SEL !== null && !S.rows[SEL]) SEL = null;
      if (NSEL !== null && !(S.notes || [])[NSEL]) NSEL = null;
      if ((MODE === 'row' && SEL === null) || (MODE === 'note' && NSEL === null)) MODE = null;
      if (!MODE) { if (!panel.hidden) { panel.hidden = true; built = null; } }
      else if (!built || built.mode !== MODE || (MODE === 'row' && built.i !== SEL) || (MODE === 'note' && built.i !== NSEL)) buildPanel();
      else if ((MODE === 'row' || MODE === 'kinds') && built.kv !== KINDS_V && !panel.contains(document.activeElement)) buildPanel();
      else if ((MODE === 'layout' || MODE === 'style') && !panel.contains(document.activeElement)) { RT.syncForm(panel, S); }
      else if (MODE === 'row') {
        const r = S.rows[SEL];
        panel.querySelectorAll('[data-p]').forEach((el) => {
          if (el === document.activeElement) return;
          const f = el.dataset.p, v = f === 'color' ? colorOf(r) : f === 'fsK' ? String(nearestFs(r.fsK)) : f === 'minH' ? (Number(r.minH) || '') : (r[f] ?? '');
          if (String(el.value) !== String(v)) el.value = v;
        });
        const rp = panel.querySelector('[data-q="resetpos"]'); if (rp) rp.hidden = !(Number(r.tdx) || Number(r.tdy));
        if (panel.querySelectorAll('.tl-seg').length !== segsOf(r).length) buildPanel();
      }
      setTimeout(place, 0);
      legendRefresh();
      RT.feThumb('timeline', () => preview.querySelector('svg'));
    },
  };
  window.TLX.afterRender();
})();

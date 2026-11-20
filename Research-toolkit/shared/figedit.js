/* Research Toolkit — figure-first editing, shared by the figure tools.
 * RT.figEdit(cfg) turns a tool page into: a toolbar above the figure (Settings toggle, quick menus, + Text / + Arrow /
 * + Bracket, actual size), the figure, then the export and other cards side by side. The settings column is hidden
 * until Settings is pressed. Quick menus show the tool's own form fields (proxies that write into the real ones, so
 * every tool keeps its own logic). Annotations are kept in the tool's state (S.notes) and drawn on every figure by
 * the hook in common.js. Clicking a part of the figure that the tool maps to a form field (RT.fieldHits) opens that
 * field, and the fields beside it, in a panel next to the figure; double-clicking goes straight into its text.
 * The tool provides RT.currentState, RT.refresh (render + history) and, when it has one, RT.renderNow (render only).
 *
 * cfg: { key, menus: [{ id, label, items: ['data-k path' | '#selector' | { h: 'heading' }] }], hint }
 */
(function () {
  'use strict';
  const T = RT.t, esc = RT.esc;

  RT.figEdit = (cfg) => {
    const col = document.querySelector('.preview-col'), preview = document.getElementById('preview'), form = document.getElementById('form');
    if (!col || !preview) return;
    const st = () => RT.currentState();
    const notes = () => (st().notes ||= []);
    const renderNow = () => (RT.renderNow ? RT.renderNow() : RT.refresh && RT.refresh());
    const commit = () => RT.refresh && RT.refresh();
    const figNow = () => { const svg = preview.querySelector('svg'); if (!svg) return null; const vb = svg.viewBox && svg.viewBox.baseVal; return vb && vb.width ? { w: vb.width, h: vb.height } : null; };
    const fsOf = () => Number((st().st || {}).fontSize) || 13;

    /* ---------------- annotations on every figure ---------------- */
    let BOXES = [];
    RT.figureHook = (w, h, body) => {
      const s = st(); if (!s || !(s.notes || []).length) { BOXES = []; return { w, h, body }; }
      const r = RT.drawNotes(s.notes, fsOf(), Number((s.st || {}).lh) || 1.3);
      BOXES = r.boxes;
      return { w: Math.max(w, r.maxX + 16), h: Math.max(h, r.maxY + 16), body: body + r.svg };
    };

    /* ---------------- toolbar ---------------- */
    const bar = RT.h(`<div class="fe-bar" role="toolbar" aria-label="${T('圖上編輯', 'Edit on the figure')}">
      <button type="button" class="small" data-x="settings"></button>
      ${(cfg.menus || []).length ? '<span class="fe-sep" aria-hidden="true"></span>' : ''}
      ${(cfg.menus || []).map((m) => `<button type="button" class="small" data-x="menu" data-m="${esc(m.id)}" aria-haspopup="dialog">${esc(m.label)} ▾</button>`).join('')}
      <span class="fe-sep" aria-hidden="true"></span>
      <button type="button" class="small" data-x="text">${T('＋ 文字', '+ Text')}</button>
      <button type="button" class="small" data-x="arrow">${T('＋ 箭頭', '+ Arrow')}</button>
      <button type="button" class="small" data-x="brace">${T('＋ 括號', '+ Bracket')}</button>
      <span class="spacer"></span>
    </div>`);
    col.prepend(bar);
    // under the figure: a short hint, the messages, then every other card side by side
    const hint = RT.h(`<p class="hint fe-hint">${esc(cfg.hint || T('點選註解可開啟設定・雙擊文字直接修改・拖曳移動（方向鍵微調）', 'Click a note for its settings · double-click text to edit it · drag to move (arrow keys nudge)'))}</p>`);
    preview.after(hint);
    const bottom = document.createElement('div'); bottom.className = 'fe-bottom';
    const msgs = document.getElementById('msgs');
    (msgs && msgs.parentNode === col ? msgs : hint).after(bottom);
    [...col.children].filter((el) => el !== bar && el !== preview && el !== hint && el !== bottom && el !== msgs && !el.classList.contains('paper-zoom') && col.contains(el) && [...col.children].indexOf(el) > [...col.children].indexOf(bottom)).forEach((el) => bottom.appendChild(el));
    const adoptZoom = () => { const z = document.querySelector('.paper-zoom'); if (z && z.parentNode !== bar) bar.appendChild(z); };
    adoptZoom(); document.addEventListener('DOMContentLoaded', () => setTimeout(adoptZoom, 0));

    // settings column: hidden unless it was open last time
    const KEY = 'rt:fe-settings:' + (cfg.key || location.pathname);
    let canvas = true;
    try { canvas = localStorage.getItem(KEY) !== '1'; } catch (e) { /* ignore */ }
    function setCanvas(on) {
      canvas = on;
      document.body.classList.toggle('fe-canvas', on);
      const b = bar.querySelector('[data-x="settings"]');
      b.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg> ' + T('設定', 'Settings');
      b.title = on ? T('打開左側的完整設定', 'Open the full settings on the left') : T('收起設定，讓圖佔滿寬度', 'Close the settings so the figure takes the full width');
      b.setAttribute('aria-pressed', String(!on));
      try { localStorage.setItem(KEY, on ? '0' : '1'); } catch (e) { /* ignore */ }
      setTimeout(place, 0);
    }
    setCanvas(canvas);

    /* ---------------- the floating panel ---------------- */
    const panel = document.createElement('div');
    panel.className = 'fe-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog');
    document.body.appendChild(panel);
    let MODE = null, NSEL = null, pinned = null;
    const head = (title) => `<div class="fe-p-head"><b>${esc(title)}</b><span class="spacer"></span><button type="button" class="icon" data-q="close" aria-label="${T('關閉', 'Close')}">✕</button></div>`;

    // a proxy for one of the tool's own form controls: it shows the same value and writes back into the original,
    // firing the same events, so the tool reacts exactly as if the original had been changed
    const findOrig = (it) => (typeof it !== 'string' ? null : it.startsWith('#') ? document.querySelector(it) : (form || document).querySelector(`[data-k="${CSS.escape(it)}"]`));
    // the text of a real <label> around the control, if any
    const ownLabel = (orig) => (orig.closest('label') ? labelOf(orig) : '');
    // the name of the section a control sits in: its row's heading, a label just above it, or its card's title
    function sectionOf(orig) {
      if (orig.closest('tr')) return '';
      const blk = orig.closest('.block'), bh = blk && blk.querySelector('.block-head b'); if (bh) return bh.textContent.trim();
      for (let p = orig.previousElementSibling; p; p = p.previousElementSibling) if (p.classList.contains('lbl')) return p.textContent.trim();
      const card = orig.closest('.card'), h = card && card.querySelector('h2');
      return h ? h.textContent.replace(/^\s*\d+\s*/, '').trim() : '';
    }
    function labelOf(orig) {
      const lab = orig.closest('label');
      if (!lab) return orig.getAttribute('aria-label') || orig.title || '';
      const sp = lab.querySelector(':scope > span');
      if (sp && !sp.contains(orig)) return sp.textContent.trim();
      return [...lab.childNodes].filter((n) => n !== orig && !(n.contains && n.contains(orig))).map((n) => n.textContent).join(' ').trim();
    }
    function proxyFor(orig) {
      let p;
      if (orig.tagName === 'SELECT') { p = document.createElement('select'); p.innerHTML = orig.innerHTML; }
      else if (orig.tagName === 'TEXTAREA') { p = document.createElement('textarea'); p.rows = Math.min(4, orig.rows || 2); }
      else { p = document.createElement('input'); p.type = orig.type || 'text'; ['min', 'max', 'step', 'placeholder', 'maxlength', 'list'].forEach((a) => { if (orig.hasAttribute(a)) p.setAttribute(a, orig.getAttribute(a)); }); }
      p._orig = orig;
      const back = (type) => () => {
        if (p.type === 'checkbox' || p.type === 'radio') orig.checked = p.checked; else orig.value = p.value;
        orig.dispatchEvent(new Event(type, { bubbles: true }));
        setTimeout(refreshProxies, 30);
      };
      p.addEventListener('input', back('input'));
      p.addEventListener('change', back('change'));
      return p;
    }
    function syncProxy(p) {
      const o = p._orig;
      if (p === document.activeElement) return;
      if (p.tagName === 'SELECT' && p.options.length !== o.options.length) p.innerHTML = o.innerHTML;
      if (p.type === 'checkbox' || p.type === 'radio') p.checked = o.checked; else if (p.value !== o.value) p.value = o.value;
      const row = p.closest('.fe-row'), sh = o.closest('[data-show]');
      if (row) row.hidden = !!(sh && sh.hidden) || o.disabled;
    }
    function refreshProxies() { panel.querySelectorAll('.fe-row input, .fe-row select, .fe-row textarea').forEach((p) => { if (p._orig) syncProxy(p); }); }
    function buildMenu(m) {
      panel.setAttribute('aria-label', m.label);
      panel.innerHTML = head(m.label) + '<div class="fe-fields"></div>';
      const host = panel.querySelector('.fe-fields');
      m.items.forEach((it) => {
        if (it && it.h) { host.appendChild(RT.h(`<div class="fe-sub">${esc(it.h)}</div>`)); return; }
        const orig = findOrig(it); if (!orig) return;
        const p = proxyFor(orig), text = labelOf(orig);
        const row = document.createElement('label');
        if (p.type === 'checkbox') { row.className = 'fe-row check'; row.append(p, document.createTextNode(' ' + text)); }
        else { row.className = 'fe-row fe-f' + (p.tagName === 'TEXTAREA' ? ' wide' : ''); const sp = document.createElement('span'); sp.textContent = text; row.append(sp, p); }
        host.appendChild(row);
      });
      refreshProxies();
    }
    const SIZES = () => [9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32].map((v) => [v, v + ' px']);
    const opts = (list, cur) => list.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(l)}</option>`).join('');
    const KIND = () => ({ text: T('文字框', 'Text box'), arrow: T('箭頭', 'Arrow'), brace: T('括號', 'Bracket') });
    function buildNote() {
      const n = notes()[NSEL];
      panel.setAttribute('aria-label', T('註解的設定', 'Annotation settings'));
      const size = `<label class="fe-f"><span>${T('字級', 'Size')}</span><select data-n="size">${opts(SIZES(), Math.round(Number(n.size) || fsOf()))}</select></label>`;
      const color = `<label class="fe-f"><span>${T('顏色', 'Colour')}</span><input type="color" data-n="color" value="${esc(n.color || '#000000')}"></label>`;
      const sw = `<label class="fe-f"><span>${T('線粗', 'Line')}</span><select data-n="sw">${opts([[1, '1'], [1.4, '1.4'], [1.6, '1.6'], [2.5, '2.5'], [4, '4']], Number(n.sw) || 1.6)}</select></label>`;
      const bold = `<label class="check"><input type="checkbox" data-n="bold"${n.bold ? ' checked' : ''}> ${T('粗體', 'Bold')}</label>`;
      let body;
      if (n.type === 'text') {
        body = `<label class="fe-f wide"><span>${T('文字（雙擊圖上的文字也能改）', 'Text (or double-click it on the figure)')}</span><textarea rows="2" data-n="text">${esc(n.text)}</textarea></label>
          <div class="fe-g4">${size}${color}
            <label class="fe-f"><span>${T('外框', 'Frame')}</span><select data-n="frame">${opts([['none', T('無', 'None')], ['line', T('線框', 'Outline')], ['white', T('白底線框', 'White box')], ['fill', T('色底', 'Filled')]], n.frame || 'none')}</select></label>
            <label class="fe-f"><span>${T('對齊', 'Align')}</span><select data-n="align">${opts([['left', T('靠左', 'Left')], ['center', T('置中', 'Centre')], ['right', T('靠右', 'Right')]], n.align || 'left')}</select></label>
          </div><div class="fe-g2">${bold}<label class="fe-f"${n.frame === 'fill' ? '' : ' hidden'}><span>${T('底色', 'Fill')}</span><input type="color" data-n="fill" value="${esc(n.fill || '#FFF2CC')}"></label></div>`;
      } else if (n.type === 'arrow') {
        body = `<div class="fe-g4">${color}${sw}</div><label class="check"><input type="checkbox" data-n="dash"${n.dash ? ' checked' : ''}> ${T('虛線', 'Dashed')}</label>
          <p class="fe-tip">${T('拖曳兩端的圓點調整方向與長度，拖曳線本身整支移動。', 'Drag the round ends to aim and size it, or drag the line to move it.')}</p>`;
      } else {
        body = `<label class="fe-f wide"><span>${T('文字', 'Text')}</span><input data-n="text" value="${esc(n.text)}"></label>
          <div class="fe-g4">${size}${color}${sw}</div><div class="fe-g2">${bold}<label class="check"><input type="checkbox" data-n="flip"${n.flip ? ' checked' : ''}> ${T('翻面', 'Flip')}</label></div>
          <p class="fe-tip">${T('拖曳兩端的圓點改長度；把一端往上或往下拉就是垂直括號。', 'Drag the round ends to resize; drag one end up or down for a vertical bracket.')}</p>`;
      }
      panel.innerHTML = head(KIND()[n.type] || n.type) + body + `<div class="fe-p-foot"><button type="button" class="small" data-q="ndup">${T('複製', 'Duplicate')}</button><span class="spacer"></span><button type="button" class="small danger" data-q="ndel">${T('刪除', 'Delete')}</button></div>`;
    }
    // the field behind a clicked part of the figure, plus the other fields of the same row or block
    let FIELD = null;
    function relatedOrigs(el) {
      const box = el.closest('.list-row, .block, .rob-det, tr');
      if (!box) return [el];
      const all = [...box.querySelectorAll('input:not([type=hidden]):not([type=file]):not([type=button]), select, textarea')].filter((x) => !x.closest('[hidden]') && !x.closest('.block-head'));
      if (all.length > 12) return [el];
      return all.includes(el) ? all : [el, ...all];
    }
    function buildField() {
      const el = FIELD.el, title = FIELD.title || (el.closest('tr') && el.value) || ownLabel(el) || sectionOf(el) || labelOf(el) || T('編輯', 'Edit');
      panel.setAttribute('aria-label', title);
      panel.innerHTML = head(title) + '<div class="fe-fields"></div>' + `<p class="fe-tip">${T('改這裡，圖和設定欄會一起變。', 'Changes here update the figure and the settings column.')}</p>`;
      const host = panel.querySelector('.fe-fields');
      relatedOrigs(el).forEach((o) => {
        const p = proxyFor(o), text = ownLabel(o) || o.placeholder || labelOf(o) || '';
        const row = document.createElement('label');
        if (p.type === 'checkbox') { row.className = 'fe-row check'; row.append(p, document.createTextNode(' ' + text)); }
        else { row.className = 'fe-row fe-f' + (p.tagName === 'TEXTAREA' || (p.type === 'text' && relatedOrigs(el).length === 1) ? ' wide' : ''); const sp = document.createElement('span'); sp.textContent = text; row.append(sp, p); }
        if (o === el) p.dataset.main = '1';
        host.appendChild(row);
      });
      refreshProxies();
    }
    function openField(idx, el, typeIn) {
      if (!el) return;
      FIELD = { idx, el };
      MODE = 'field'; NSEL = null; pinned = null;
      buildField(); panel.hidden = false; place();
      decorate(true);
      const main = panel.querySelector('[data-main]');
      if (main && (typeIn || main.type === 'number' || main.tagName === 'TEXTAREA' || main.type === 'text')) { main.focus({ preventScroll: true }); if (typeIn && main.select) main.select(); }
    }
    function open(mode, arg) {
      MODE = mode; pinned = null; FIELD = null;
      if (mode === 'note') { NSEL = arg; buildNote(); }
      else { NSEL = null; buildMenu(cfg.menus.find((m) => m.id === arg)); MODE = 'menu:' + arg; }
      panel.hidden = false;
      renderNow(); place();
    }
    function close() { if (!MODE) return; const wasField = MODE === 'field'; MODE = null; NSEL = null; FIELD = null; panel.hidden = true; if (wasField) decorate(true); else renderNow(); }
    panel.addEventListener('input', (e) => {
      if (MODE !== 'note') return;
      const el = e.target, n = notes()[NSEL]; if (!n || !el.dataset.n) return;
      const f = el.dataset.n;
      n[f] = el.type === 'checkbox' ? el.checked : f === 'size' || f === 'sw' ? Number(el.value) : el.value;
      if (f === 'frame') buildNote();
      commit();
    });
    panel.addEventListener('click', (e) => {
      const q = e.target.closest('[data-q]'); if (!q) return;
      if (q.dataset.q === 'close') { close(); return; }
      const ns = notes();
      if (q.dataset.q === 'ndup') { const c = structuredClone(ns[NSEL]); c.x += 16; c.y += 16; if (c.x2 !== undefined) { c.x2 += 16; c.y2 += 16; } ns.push(c); commit(); open('note', ns.length - 1); }
      if (q.dataset.q === 'ndel') { ns.splice(NSEL, 1); close(); commit(); }
    });
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      const x = b.dataset.x;
      if (x === 'settings') setCanvas(!canvas);
      else if (x === 'menu') { if (MODE === 'menu:' + b.dataset.m) close(); else open('menu', b.dataset.m); }
      else addNote(x);
    });

    /* ---------------- annotations: add, select, drag, nudge, type over ---------------- */
    function visibleCenter() {
      const svg = preview.querySelector('svg'), f = figNow(); if (!svg || !f) return [200, 100];
      const r = svg.getBoundingClientRect(), k = r.width / f.w;
      const top = Math.max(r.top, 0), bot = Math.min(r.bottom, window.innerHeight), left = Math.max(r.left, 0), right = Math.min(r.right, window.innerWidth);
      return [Math.max(40, Math.min(f.w - 140, ((left + right) / 2 - r.left) / k)), Math.max(30, Math.min(f.h - 40, ((top + bot) / 2 - r.top) / k))];
    }
    function addNote(type) {
      const [cx, cy] = visibleCenter(), fs = fsOf(), R = Math.round;
      const n = type === 'text' ? { type, x: R(cx - 40), y: R(cy - fs), text: 'Note', size: fs, color: '#C00000', frame: 'none', bold: false, align: 'left' }
        : type === 'arrow' ? { type, x: R(cx - 70), y: R(cy - 30), x2: R(cx + 30), y2: R(cy + 10), color: '#C00000', sw: 1.6, dash: false }
          : { type, x: R(cx - 90), y: R(cy), x2: R(cx + 90), y2: R(cy), text: 'Period', size: R(fs * 0.9), color: '#333333', sw: 1.4, flip: false, bold: false };
      notes().push(n);
      commit();
      open('note', notes().length - 1);
    }
    const figPoint = (e) => { const f = figNow(); return RT.figPoint(preview, f, e); };
    function decorate(force) {
      const svg0 = preview.querySelector('svg');
      if (svg0) {
        svg0.querySelectorAll('[data-field].fe-on').forEach((r) => { r.classList.remove('fe-on'); });
        if (MODE === 'field' && FIELD) { const r = svg0.querySelector(`[data-field="${FIELD.idx}"]`); if (r) r.classList.add('fe-on'); }
        if (MODE === 'field' && FIELD && !FIELD.el.isConnected) close();
      }
      if (svg0 && !svg0.querySelector('.field-ui') && (RT.lastHits || []).length) RT.fieldHits(preview, RT.lastHits);
      if (force === true) { place(); return; }
      const svg = preview.querySelector('svg'); if (!svg || svg.querySelector('.fe-ui')) return;
      const g = RT.svgEl('g', { class: 'fe-ui' });
      BOXES.forEach((b) => {
        const n = notes()[b.k]; if (!n) return;
        const label = T('註解：', 'Annotation: ') + (n.text || KIND()[n.type]);
        if (b.type === 'arrow') g.appendChild(RT.svgEl('line', { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, stroke: 'transparent', 'stroke-width': 14, 'stroke-linecap': 'round', class: 'fe-hit', 'data-fe-note': b.k, tabindex: 0, role: 'button', 'aria-label': label }));
        else g.appendChild(RT.svgEl('rect', { x: b.x - 3, y: b.y - 3, width: b.w + 6, height: b.h + 6, fill: 'transparent', class: 'fe-hit', 'data-fe-note': b.k, tabindex: 0, role: 'button', 'aria-label': label }));
        if (b.k !== NSEL || MODE !== 'note') return;
        g.insertBefore(RT.svgEl('rect', { x: b.x - 6, y: b.y - 6, width: b.w + 12, height: b.h + 12, rx: 4, fill: 'none', stroke: '#2563EB', 'stroke-width': 1.6, 'stroke-dasharray': '5 3', 'pointer-events': 'none' }), g.firstChild);
        if (b.type !== 'text') [[1, b.x1, b.y1], [2, b.x2, b.y2]].forEach(([end, x, y]) => g.appendChild(RT.svgEl('circle', { cx: x, cy: y, r: 6.5, fill: '#FFFFFF', stroke: '#2563EB', 'stroke-width': 2, class: 'fe-end', 'data-fe-note': b.k, 'data-fe-end': end, role: 'button', 'aria-label': T('拖曳端點', 'Drag this end') })));
      });
      svg.appendChild(g);
      refreshProxies();
      place();
    }
    const hitOf = (e) => { const r = e.target.closest && e.target.closest('[data-field]'); if (!r || !preview._hits) return null; const i = Number(r.dataset.field), h = preview._hits[i]; return h ? { i, h } : null; };
    preview.addEventListener('click', (e) => {
      const x = hitOf(e); if (!x) return;
      e.stopImmediatePropagation(); e.preventDefault();
      let el = null; try { el = x.h.find(); } catch (err) { /* ignore */ }
      if (el) openField(x.i, el, false);
    }, true);
    preview.addEventListener('dblclick', (e) => {
      const x = hitOf(e); if (!x) return;
      e.stopImmediatePropagation(); e.preventDefault();
      let el = null; try { el = x.h.find(); } catch (err) { /* ignore */ }
      if (el) openField(x.i, el, true);
    }, true);
    // every time the tool redraws, the handles go back on
    new MutationObserver(() => setTimeout(decorate, 0)).observe(preview, { childList: true });
    let drag = null;
    preview.addEventListener('pointerdown', (e) => {
      const h = e.target.closest && e.target.closest('[data-fe-note]'); if (!h) return;
      const k = Number(h.dataset.feNote), n = notes()[k];
      drag = { k, end: h.dataset.feEnd ? Number(h.dataset.feEnd) : 0, p0: figPoint(e), n0: { ...n }, moved: false };
      preview.setPointerCapture(e.pointerId); e.preventDefault(); e.stopImmediatePropagation();
    }, true);
    preview.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = figPoint(e), n = notes()[drag.k], o = drag.n0;
      const dx = Math.round(p[0] - drag.p0[0]), dy = Math.round(p[1] - drag.p0[1]);
      if (!drag.moved && Math.hypot(dx, dy) < 3) return;
      if (drag.end === 1) { n.x = o.x + dx; n.y = o.y + dy; }
      else if (drag.end === 2) { n.x2 = o.x2 + dx; n.y2 = o.y2 + dy; }
      else { n.x = o.x + dx; n.y = o.y + dy; if (n.type !== 'text') { n.x2 = o.x2 + dx; n.y2 = o.y2 + dy; } }
      if (n.x < 0) { const s0 = -n.x; n.x += s0; if (n.type !== 'text' && drag.end !== 1) n.x2 += s0; }
      if (n.y < 0) { const s0 = -n.y; n.y += s0; if (n.type !== 'text' && drag.end !== 1) n.y2 += s0; }
      drag.moved = true; renderNow(); e.stopImmediatePropagation();
    }, true);
    preview.addEventListener('pointerup', (e) => {
      if (!drag) { if ((MODE === 'note' || MODE === 'field') && !(e.target.closest && e.target.closest('.fe-ui, [data-field]'))) close(); return; }
      const { k, moved } = drag; drag = null; e.stopImmediatePropagation();
      if (moved) commit();
      if (MODE !== 'note' || NSEL !== k) open('note', k); else place();
    }, true);
    preview.addEventListener('keydown', (e) => {
      const h = e.target.closest && e.target.closest('.fe-hit'); if (!h) return;
      const k = Number(h.dataset.feNote);
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open('note', k); return; }
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const n = notes()[k], m = e.shiftKey ? 10 : 1;
      n.x += d[0] * m; n.y += d[1] * m; if (n.type !== 'text') { n.x2 += d[0] * m; n.y2 += d[1] * m; }
      commit(); setTimeout(() => preview.querySelector(`.fe-hit[data-fe-note="${k}"]`)?.focus({ preventScroll: true }), 120);
    }, true);
    // double-click an annotation's text to type over it
    const ed = document.createElement('div');
    ed.className = 'fe-ed'; ed.hidden = true; ed.setAttribute('role', 'dialog'); ed.setAttribute('aria-label', T('編輯文字', 'Edit text'));
    document.body.appendChild(ed);
    let edFor = null;
    preview.addEventListener('dblclick', (e) => {
      const p = figPoint(e);
      const b = [...BOXES].reverse().find((x) => x.type !== 'arrow' && p[0] >= x.x - 4 && p[0] <= x.x + x.w + 4 && p[1] >= x.y - 4 && p[1] <= x.y + x.h + 4);
      if (!b) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (MODE !== 'note' || NSEL !== b.k) open('note', b.k);
      edFor = b.k;
      const n = notes()[b.k];
      ed.innerHTML = `<label class="fe-f wide"><span>${T('文字', 'Text')}</span><textarea rows="${n.type === 'text' ? 3 : 1}">${esc(n.text || '')}</textarea></label><div class="fe-ed-foot"><span class="muted">${T('Esc 或點外面就完成', 'Esc or click outside to finish')}</span><button type="button" class="small primary" data-q="done">${T('完成', 'Done')}</button></div>`;
      ed.hidden = false; placeEditor();
      const ta = ed.querySelector('textarea'); ta.focus(); ta.select();
    }, true);
    function closeEditor() { if (ed.hidden) return; ed.hidden = true; edFor = null; if (MODE === 'note') buildNote(); }
    ed.addEventListener('input', (e) => { const n = notes()[edFor]; if (!n) return; n.text = e.target.value; const p = panel.querySelector('[data-n="text"]'); if (p) p.value = n.text; commit(); });
    ed.addEventListener('click', (e) => { if (e.target.closest('[data-q="done"]')) closeEditor(); });
    ed.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeEditor(); } });
    function toScreen(x, y, w, h) { const svg = preview.querySelector('svg'), f = figNow(); if (!svg || !f) return null; const r = svg.getBoundingClientRect(), k = r.width / f.w; return { left: r.left + x * k, top: r.top + y * k, width: w * k, height: h * k }; }
    function placeEditor() {
      if (ed.hidden || edFor === null) return;
      const b = BOXES.find((x) => x.k === edFor), sr = b && toScreen(b.x, b.y, b.w, b.h);
      const w = Math.min(window.innerWidth - 16, Math.max(280, sr ? Math.min(sr.width + 24, 520) : 320));
      let left = sr ? sr.left - 12 : 16, top = sr ? sr.top + sr.height + 6 : 80;
      left = Math.max(8, Math.min(window.innerWidth - w - 8, left));
      if (top + ed.offsetHeight > window.innerHeight - 8 && sr) top = Math.max(8, sr.top - ed.offsetHeight - 6);
      ed.style.width = w + 'px'; ed.style.left = left + 'px'; ed.style.top = Math.max(8, top) + 'px';
    }

    /* ---------------- where the panel goes ---------------- */
    function place() {
      placeEditor();
      if (panel.hidden || !MODE) return;
      if (window.innerWidth < 640) { panel.classList.add('sheet'); panel.style.left = ''; panel.style.top = ''; panel.style.width = ''; return; }
      panel.classList.remove('sheet');
      if (pinned && pinned.mode === MODE + NSEL) { panel.style.left = pinned.left + 'px'; panel.style.top = pinned.top + 'px'; return; }
      const vw = window.innerWidth, vh = window.innerHeight, GAP = 10;
      const put = (left, top, w) => { panel.style.width = w + 'px'; const h = panel.offsetHeight; panel.style.left = Math.round(Math.max(8, Math.min(vw - w - 8, left))) + 'px'; panel.style.top = Math.round(Math.max(8, Math.min(vh - h - 8, top))) + 'px'; };
      if (MODE.startsWith('menu:')) {
        const r = bar.querySelector(`[data-m="${CSS.escape(MODE.slice(5))}"]`).getBoundingClientRect();
        put(r.left, r.bottom + 6, Math.min(440, vw - 16)); return;
      }
      let sr = null;
      if (MODE === 'field') { const r = FIELD && preview.querySelector(`[data-field="${FIELD.idx}"]`); if (r) { const q = r.getBoundingClientRect(); sr = { left: q.left, top: q.top, width: q.width, height: q.height }; } }
      else { const b = BOXES.find((x) => x.k === NSEL); sr = b && toScreen(b.x, b.y, Math.max(4, b.w), Math.max(4, b.h)); }
      if (!sr) return;
      const pr = preview.getBoundingClientRect(), roomFigL = pr.left - GAP, roomR = vw - (sr.left + sr.width) - GAP, roomL = sr.left - GAP;
      const fitW = (room) => Math.min(400, room - 16);
      if (roomFigL >= 300) { const w = fitW(roomFigL); put(pr.left - GAP - w, sr.top - 10, w); return; }
      if (roomR >= 300) { const w = fitW(roomR); put(sr.left + sr.width + GAP, sr.top - 10, w); return; }
      if (roomL >= 300) { const w = fitW(roomL); put(sr.left - GAP - w, sr.top - 10, w); return; }
      const w = Math.min(400, vw - 16); panel.style.width = w + 'px';
      const ph = panel.offsetHeight, left = sr.left + sr.width / 2 - w / 2;
      if (sr.top + sr.height + GAP + ph <= vh - 8) put(left, sr.top + sr.height + GAP, w);
      else put(left, sr.top - GAP - ph, w);
    }
    panel.addEventListener('pointerdown', (e) => {
      const h = e.target.closest('.fe-p-head'); if (!h || e.target.closest('button') || panel.classList.contains('sheet')) return;
      const r0 = panel.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY;
      h.setPointerCapture(e.pointerId);
      const mv = (ev) => { pinned = { mode: MODE + NSEL, left: Math.max(0, Math.min(window.innerWidth - 60, r0.left + ev.clientX - x0)), top: Math.max(0, Math.min(window.innerHeight - 40, r0.top + ev.clientY - y0)) }; panel.style.left = pinned.left + 'px'; panel.style.top = pinned.top + 'px'; };
      const up = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up); };
      h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
      e.preventDefault();
    });
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);

    /* ---------------- keyboard and clicks outside ---------------- */
    const typing = (el) => el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (!ed.hidden) closeEditor(); else if (MODE) close(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && MODE === 'note' && NSEL !== null && !typing(document.activeElement)) {
        e.preventDefault(); notes().splice(NSEL, 1); close(); commit();
      }
    });
    document.addEventListener('pointerdown', (e) => {
      if (!ed.hidden && !ed.contains(e.target)) closeEditor();
      if (MODE && MODE.startsWith('menu:') && !panel.contains(e.target) && !e.target.closest('.fe-bar')) close();
    }, true);
    decorate();
  };
})();

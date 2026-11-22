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

  /* ---------------- a small drop-down under a toolbar button ---------------- */
  let POP = null;
  function popover(anchor, build) {
    if (POP && POP.anchor === anchor) { closePop(); return; }
    closePop();
    const el = document.createElement('div');
    el.className = 'fe-pop'; el.setAttribute('role', 'dialog');
    document.body.appendChild(el);
    POP = { el, anchor, build };
    build(el);
    const r = anchor.getBoundingClientRect(), w = Math.min(380, window.innerWidth - 16);
    el.style.width = w + 'px';
    el.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
    el.style.top = Math.min(window.innerHeight - 60, r.bottom + 6) + 'px';
    anchor.setAttribute('aria-expanded', 'true');
  }
  function closePop() { if (!POP) return; POP.anchor.setAttribute('aria-expanded', 'false'); POP.el.remove(); POP = null; }
  document.addEventListener('pointerdown', (e) => { if (POP && !POP.el.contains(e.target) && !POP.anchor.contains(e.target)) closePop(); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && POP) closePop(); });

  /* ---------------- saved versions of a tool's figure (this device) ---------------- */
  // Each tool keeps one working copy; versions are named snapshots of it (e.g. one per paper) that can be opened again.
  RT.feVersions = (btn, key) => {
    const LK = 'rt:versions:' + key, CK = 'rt:versions-cur:' + key;
    const list = () => { try { return JSON.parse(localStorage.getItem(LK) || '[]'); } catch (e) { return []; } };
    const store = (l) => { try { localStorage.setItem(LK, JSON.stringify(l)); return true; } catch (e) { RT.toast(T('瀏覽器空間不足，無法儲存版本', 'Not enough browser storage to save the version'), 5000); return false; } };
    const cur = () => { try { return localStorage.getItem(CK) || ''; } catch (e) { return ''; } };
    const setCur = (id) => { try { if (id) localStorage.setItem(CK, id); else localStorage.removeItem(CK); } catch (e) { /* ignore */ } paintBtn(); };
    const snap = () => structuredClone(RT.currentState());
    const when = (t) => new Date(t).toLocaleString(RT.lang === 'en' ? 'en' : 'zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    function paintBtn() { const v = list().find((x) => x.id === cur()); btn.textContent = (v ? T('版本：', 'Version: ') + v.name : T('版本', 'Versions')) + ' ▾'; btn.title = T('把這張圖存成不同版本（例如每篇論文一份），之後隨時切換', 'Keep named versions of this figure (e.g. one per paper) and switch between them'); }
    function build(el) {
      const l = list(), c = cur();
      el.innerHTML = `<div class="fe-pop-h">${T('這張圖的版本', 'Versions of this figure')}</div>
        <div class="fe-pop-new"><input class="fe-vname" maxlength="60" placeholder="${T('版本名稱，例如：論文 A', 'Name, e.g. Paper A')}" aria-label="${T('版本名稱', 'Version name')}"><button type="button" class="small primary" data-v="new">${T('另存新版本', 'Save as new')}</button></div>
        ${l.length ? `<div class="fe-vlist">${l.map((v) => `<div class="fe-v${v.id === c ? ' on' : ''}" data-id="${v.id}"><button type="button" class="fe-v-open" data-v="open" title="${T('開啟這個版本（目前的內容可按 ↶ 找回）', 'Open this version (↶ brings back what was here)')}"><b>${esc(v.name)}</b><small>${when(v.at)}${v.id === c ? T(' · 目前', ' · current') : ''}</small></button>${v.id === c ? `<button type="button" class="small" data-v="save" title="${T('用目前的內容更新這個版本', 'Update this version with what is here now')}">${T('更新', 'Update')}</button>` : ''}<button type="button" class="icon" data-v="ren" aria-label="${T('重新命名', 'Rename')}">✎</button><button type="button" class="icon" data-v="del" aria-label="${T('刪除', 'Delete')}">✕</button></div>`).join('')}</div>` : `<p class="fe-tip">${T('還沒有儲存的版本。目前的內容會一直保留在這個瀏覽器裡；存成版本後可以切換。', 'No saved versions yet. What is here stays in this browser; save versions to switch between them.')}</p>`}
        <p class="fe-tip">${T('版本存在這台裝置的瀏覽器；要帶到別台電腦，用上方「專案」的儲存。', 'Versions live in this browser; to move them to another computer, use Project › Save.')}</p>`;
      const name = el.querySelector('.fe-vname');
      name.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.querySelector('[data-v="new"]').click(); });
      el.onclick = (e) => {
        const b = e.target.closest('[data-v]'); if (!b) return;
        const act = b.dataset.v, row = b.closest('[data-id]'), id = row && row.dataset.id, l2 = list(), v = l2.find((x) => x.id === id);
        if (act === 'new') {
          const nm = name.value.trim() || T('版本 ', 'Version ') + (l2.length + 1);
          const nv = { id: Date.now().toString(36), name: nm, at: Date.now(), state: snap() };
          if (store([nv, ...l2])) { setCur(nv.id); RT.toast(T('已存成新版本：', 'Saved as a new version: ') + nm); }
        } else if (act === 'open' && v) {
          RT.applyState(structuredClone(v.state)); setCur(v.id); RT.toast(T('已開啟版本：', 'Opened: ') + v.name + T('（按 ↶ 可回到剛才的內容）', ' (↶ brings back what was here)'));
          closePop(); return;
        } else if (act === 'save' && v) { v.state = snap(); v.at = Date.now(); if (store(l2)) RT.toast(T('已更新版本：', 'Updated: ') + v.name); }
        else if (act === 'ren' && v) { const nn = prompt(T('新的名稱', 'New name'), v.name); if (nn && nn.trim()) { v.name = nn.trim().slice(0, 60); store(l2); paintBtn(); } }
        else if (act === 'del' && v) { if (!confirm(T(`要刪除版本「${v.name}」嗎？`, `Delete the version “${v.name}”?`))) return; store(l2.filter((x) => x.id !== id)); if (id === cur()) setCur(''); }
        build(el);
      };
      setTimeout(() => name.focus(), 0);
    }
    if (btn.tagName === 'BUTTON') { btn.addEventListener('click', () => popover(btn, build)); btn.setAttribute('aria-haspopup', 'dialog'); }
    paintBtn();
    return { open: (anchor) => popover(anchor || btn, build), name: () => { const v = list().find((x) => x.id === cur()); return v ? v.name : ''; } };
  };

  /* ---------------- how the figure looks with colour-vision deficiency, or printed in black and white ---------------- */
  // Machado et al. (2009) severity-1 matrices; the preview only — exports are never changed
  const CVD = {
    deut: '0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0',
    prot: '0.152 1.053 -0.205 0 0  0.115 0.786 0.099 0 0  -0.004 -0.048 1.052 0 0  0 0 0 1 0',
    trit: '1.256 -0.077 -0.179 0 0  -0.078 0.931 0.148 0 0  0.005 0.691 0.304 0 0  0 0 0 1 0',
    gray: '0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0',
  };
  RT.feVision = (btn, preview) => {
    if (!document.getElementById('fe-cvd-defs')) {
      const d = document.createElement('div'); d.id = 'fe-cvd-defs'; d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      d.innerHTML = '<svg width="0" height="0" aria-hidden="true">' + Object.entries(CVD).map(([k, m]) => `<filter id="fe-cvd-${k}" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="${m}"/></filter>`).join('') + '</svg>';
      document.body.appendChild(d);
    }
    const NAMES = () => [['', T('一般', 'Normal')], ['deut', T('綠色弱（最常見）', 'Deuteranopia (most common)')], ['prot', T('紅色弱', 'Protanopia')], ['trit', T('藍黃色弱', 'Tritanopia')], ['gray', T('黑白列印', 'Black-and-white print')]];
    let mode = '';
    const paint = () => { btn.textContent = (mode ? T('色覺：', 'Colour: ') + NAMES().find((x) => x[0] === mode)[1] : T('色覺預覽', 'Colour check')) + ' ▾'; btn.setAttribute('aria-pressed', String(!!mode)); preview.style.filter = mode ? `url(#fe-cvd-${mode})` : ''; };
    btn.title = T('看看色覺差異的讀者或黑白列印時，這張圖分不分得清楚（只影響預覽，不影響匯出）', 'See whether the figure still reads for colour-blind readers or in black-and-white print (preview only, exports are unchanged)');
    const build = (el) => {
      el.innerHTML = `<div class="fe-pop-h">${T('色覺預覽（只影響預覽）', 'Colour check (preview only)')}</div>` + NAMES().map(([k, l]) => `<button type="button" class="fe-pop-item${k === mode ? ' on' : ''}" data-cvd="${k}">${esc(l)}</button>`).join('');
      el.onclick = (e) => { const b = e.target.closest('[data-cvd]'); if (!b) return; mode = b.dataset.cvd; paint(); closePop(); };
    };
    if (btn.tagName === 'BUTTON') btn.addEventListener('click', () => popover(btn, build));
    paint();
    return { open: (anchor) => popover(anchor || btn, build), mode: () => mode };
  };

  /* ---------------- the toolbar kit: + Note, Copy image, More, saved indicator, shortcuts, tips, empty state, settings search ---------------- */
  /**
   * o: { bar, anchor (insert before), key, preview, form, addNote(type), openSettings(), menuButtons (to fold on phones),
   *      tips: [[zh, en], …] }
   */
  RT.feKit = (o) => {
    const { bar, preview } = o;
    const kitHtml = `<button type="button" class="small" data-k="note" aria-haspopup="dialog">${T('＋ 註解', '+ Note')} ▾</button>
      <span class="fe-sep" aria-hidden="true"></span>
      <button type="button" class="small" data-k="copy" title="${T('複製圖片，直接貼到 Word／PowerPoint（Ctrl+Shift+C）', 'Copy the image to paste into Word / PowerPoint (Ctrl+Shift+C)')}">${T('複製圖片', 'Copy image')}</button>
      <button type="button" class="small" data-k="more" aria-haspopup="dialog">${T('更多', 'More')} ▾</button>
      <span class="spacer"></span>
      <span class="fe-saved" role="status" aria-live="polite" title="${T('內容會自動存在這台裝置的瀏覽器裡，關掉再開也還在；要帶到別台電腦，用「專案 › 儲存」。', 'Your work is saved automatically in this browser on this device, and is still here next time. To move it to another computer, use Project › Save.')}"></span>`;
    o.anchor.insertAdjacentHTML('beforebegin', kitHtml);
    const vers = RT.feVersions(document.createElement('span'), o.key);
    const vis = RT.feVision(document.createElement('span'), preview);
    const btn = (k) => bar.querySelector(`[data-k="${k}"]`);
    const copyImage = () => { const c = document.querySelector('#export .ex-copy'); if (c) c.click(); };
    const narrow = () => window.innerWidth < 700;
    // phones: the tool's quick menus fold into More
    const foldMenus = () => (o.menuButtons ? o.menuButtons() : []).forEach((b) => { b.hidden = narrow(); });
    foldMenus(); window.addEventListener('resize', foldMenus);
    btn('note').addEventListener('click', (e) => popover(e.currentTarget, (el) => {
      el.innerHTML = `<div class="fe-pop-h">${T('加到圖上（之後可拖曳）', 'Add to the figure (drag it afterwards)')}</div>` +
        [['text', T('文字框', 'Text box')], ['arrow', T('箭頭', 'Arrow')], ['brace', T('括號', 'Bracket')]].map(([k, l]) => `<button type="button" class="fe-pop-item" data-n="${k}">${l}</button>`).join('');
      el.onclick = (ev) => { const b = ev.target.closest('[data-n]'); if (!b) return; closePop(); o.addNote(b.dataset.n); };
    }));
    btn('copy').addEventListener('click', copyImage);
    const showKeys = () => {
      const KEYS = [['Ctrl+Z / Ctrl+Y', T('復原 / 重做', 'Undo / redo')], ['Ctrl+S', T('存成版本', 'Save a version')], ['Ctrl+Shift+C', T('複製圖片', 'Copy the image')], ['/', T('打開設定並搜尋欄位', 'Open settings and search them')], ['?', T('這張快捷鍵表', 'This list')], ['Esc', T('關閉面板', 'Close the panel')], [T('雙擊', 'Double-click'), T('直接修改圖上的文字', 'Edit text on the figure')], [T('方向鍵', 'Arrow keys'), T('微調選取的註解（Shift＝10）', 'Nudge the selected note (Shift = 10)')]];
      const d = document.createElement('dialog'); d.className = 'fe-keys';
      d.innerHTML = `<h2>${T('快捷鍵', 'Keyboard shortcuts')}</h2><table>${KEYS.map(([k, v]) => `<tr><th><kbd>${esc(k)}</kbd></th><td>${esc(v)}</td></tr>`).join('')}</table><div class="btns"><button type="button" class="small primary">${T('知道了', 'Got it')}</button></div>`;
      document.body.appendChild(d); d.querySelector('button').onclick = () => d.close(); d.addEventListener('close', () => d.remove()); d.showModal();
    };
    btn('more').addEventListener('click', (e) => popover(e.currentTarget, (el) => {
      const vn = vers.name(), menus = narrow() && o.menuButtons ? o.menuButtons() : [];
      el.innerHTML = (menus.length ? `<div class="fe-pop-h">${T('選單', 'Menus')}</div>` + menus.map((b, i) => `<button type="button" class="fe-pop-item" data-m="${i}">${esc(b.textContent.replace('▾', '').trim())}</button>`).join('') : '') +
        `<div class="fe-pop-h">${T('這張圖', 'This figure')}</div>
        <button type="button" class="fe-pop-item" data-a="versions">${T('版本', 'Versions')}${vn ? ` <small>· ${esc(vn)}</small>` : ''} <kbd>Ctrl+S</kbd></button>
        <button type="button" class="fe-pop-item" data-a="vision">${T('色覺預覽', 'Colour check')}${vis.mode() ? T('（使用中）', ' (on)') : ''}</button>
        <button type="button" class="fe-pop-item" data-a="tips">${T('使用提示', 'Tips')}</button>
        <button type="button" class="fe-pop-item" data-a="keys">${T('快捷鍵', 'Keyboard shortcuts')} <kbd>?</kbd></button>`;
      el.onclick = (ev) => {
        const b = ev.target.closest('button'); if (!b) return;
        const anchor = btn('more'); closePop();
        if (b.dataset.m) menus[Number(b.dataset.m)].click();
        else if (b.dataset.a === 'versions') vers.open(anchor);
        else if (b.dataset.a === 'vision') vis.open(anchor);
        else if (b.dataset.a === 'tips') showTips(true);
        else if (b.dataset.a === 'keys') showKeys();
      };
    }));
    // saved indicator
    const saved = bar.querySelector('.fe-saved');
    const ago = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 10 ? T('剛剛', 'just now') : s < 60 ? T(`${s} 秒前`, `${s} s ago`) : T(`${Math.round(s / 60)} 分鐘前`, `${Math.round(s / 60)} min ago`); };
    const paintSaved = () => { const vn = vers.name(); saved.textContent = (vn ? vn + ' · ' : '') + (RT.lastSaved ? T('已自動儲存 · ', 'Saved · ') + ago(RT.lastSaved) : T('自動儲存', 'Auto-saved')); };
    document.addEventListener('rt:saved', paintSaved); setInterval(paintSaved, 20000); paintSaved();
    // shortcuts
    const typing = (el) => el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); vers.open(btn('more')); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'c' && !typing(document.activeElement)) { e.preventDefault(); copyImage(); return; }
      if (typing(document.activeElement) || mod || e.altKey || document.querySelector('dialog[open]')) return;
      if (e.key === '?') { e.preventDefault(); showKeys(); }
      else if (e.key === '/' && o.form) { e.preventDefault(); o.openSettings(); setTimeout(() => { const q = o.form.querySelector('.fe-find input'); if (q) q.focus(); }, 60); }
    });
    // nothing to draw yet: offer the example or a blank start
    const ex = document.getElementById('btnExample');
    const emptyState = () => {
      if (preview.querySelector('svg') || preview.querySelector('.fe-empty')) return;
      const box = document.createElement('div'); box.className = 'fe-empty';
      box.innerHTML = `<p>${T('還沒有內容。', 'Nothing here yet.')}</p><div class="btns">${ex ? `<button type="button" class="primary" data-e="ex">${T('載入範例', 'Load the example')}</button>` : ''}<button type="button" data-e="new">${T('從頭開始：打開設定', 'Start from scratch: open settings')}</button></div>`;
      box.onclick = (ev) => { const b = ev.target.closest('[data-e]'); if (!b) return; if (b.dataset.e === 'ex') ex.click(); else o.openSettings(); };
      preview.appendChild(box);
    };
    new MutationObserver(() => setTimeout(emptyState, 0)).observe(preview, { childList: true }); emptyState();
    // search the settings column
    if (o.form) {
      const find = document.createElement('div'); find.className = 'fe-find';
      find.innerHTML = `<input type="search" autocomplete="off" placeholder="${T('搜尋設定，例如：字級、顏色、寬度（按 / ）', 'Search settings, e.g. font, colour, width (press /)')}" aria-label="${T('搜尋設定', 'Search settings')}"><div class="fe-find-list" hidden></div>`;
      o.form.prepend(find);
      const inp = find.querySelector('input'), list = find.querySelector('.fe-find-list');
      const nameOf = (el) => { const lab = el.closest('label'); let t = lab ? (lab.querySelector(':scope > span') || lab).textContent : (el.getAttribute('aria-label') || el.placeholder || ''); return t.replace(/\s+/g, ' ').trim(); };
      const secOf = (el) => { const c = el.closest('.card'); const h = c && (c.querySelector('h2') || c.querySelector('summary')); return h ? h.textContent.replace(/\s+/g, ' ').replace(/^\d+\s*/, '').trim() : ''; };
      let hits = [];
      inp.addEventListener('input', () => {
        const q = inp.value.trim().toLowerCase();
        if (!q) { list.hidden = true; return; }
        hits = [...o.form.querySelectorAll('input:not([type=hidden]):not([type=file]), select, textarea')].filter((el) => el !== inp && !el.closest('.fe-find'))
          .map((el) => ({ el, name: nameOf(el), sec: secOf(el) })).filter((x) => x.name && (x.name + ' ' + x.sec).toLowerCase().includes(q)).slice(0, 12);
        list.innerHTML = hits.length ? hits.map((x, i) => `<button type="button" data-i="${i}"><b>${esc(x.name.slice(0, 40))}</b><small>${esc(x.sec)}</small></button>`).join('') : `<p>${T('找不到這個設定。', 'No setting matches.')}</p>`;
        list.hidden = false;
      });
      const go = (x) => {
        let d = x.el.closest('details'); while (d) { d.open = true; d = d.parentElement && d.parentElement.closest('details'); }
        const sh = x.el.closest('[hidden]'); if (sh && !sh.closest('.fe-find')) RT.toast(T('這個設定在目前的版面用不到', 'This setting does not apply to the current layout'));
        x.el.scrollIntoView({ block: 'center' }); x.el.focus({ preventScroll: true });
        const f = x.el.closest('label') || x.el; f.classList.add('fe-flash'); setTimeout(() => f.classList.remove('fe-flash'), 1600);
        list.hidden = true;
      };
      list.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) go(hits[Number(b.dataset.i)]); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && hits[0]) { e.preventDefault(); go(hits[0]); } if (e.key === 'Escape') { inp.value = ''; list.hidden = true; } });
    }
    // first visit: three tips, then never again (More › Tips brings them back)
    const TK = 'rt:tips-seen:' + o.key;
    function showTips(force) {
      let seen = false; try { seen = localStorage.getItem(TK) === '1'; } catch (e) { /* ignore */ }
      if (seen && !force) return;
      const steps = o.tips || [];
      if (!steps.length) return;
      let i = 0;
      const card = document.createElement('div'); card.className = 'fe-tips'; card.setAttribute('role', 'status');
      const paint = () => {
        card.innerHTML = `<b>${T('小提示', 'Tip')} ${i + 1}/${steps.length}</b><p>${esc(T(steps[i][0], steps[i][1]))}</p><div class="btns"><button type="button" class="small" data-t="skip">${T('不用了', 'Skip')}</button><button type="button" class="small primary" data-t="next">${i + 1 < steps.length ? T('下一個', 'Next') : T('知道了', 'Got it')}</button></div>`;
      };
      const done = () => { card.remove(); try { localStorage.setItem(TK, '1'); } catch (e) { /* ignore */ } };
      card.onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; if (b.dataset.t === 'skip' || i + 1 >= steps.length) done(); else { i++; paint(); } };
      paint();
      bar.after(card);
    }
    setTimeout(() => showTips(false), 600);
  };

  /* ---------------- a small picture of the latest figure, for the home page ---------------- */
  const thumbTimers = {};
  RT.feThumb = (key, getSvg) => {
    clearTimeout(thumbTimers[key]);
    thumbTimers[key] = setTimeout(async () => {
      const svgEl = getSvg(); if (!svgEl) return;
      const vb = svgEl.viewBox && svgEl.viewBox.baseVal; if (!vb || !vb.width) return;
      const clone = svgEl.cloneNode(true); clone.querySelectorAll('.fe-ui, .edit-ui, .field-ui').forEach((x) => x.remove());
      try {
        const k = Math.min(1, 360 / vb.width), cv = await RT.svgToCanvas(new XMLSerializer().serializeToString(clone), vb.width, vb.height, k);
        localStorage.setItem('rt:thumb:' + key, JSON.stringify({ at: Date.now(), img: cv.toDataURL('image/jpeg', 0.8) }));
      } catch (e) { /* no room or not drawable: the home page simply shows no picture */ }
    }, 2500);
  };

  /* ---------------- a draft figure legend under the figure ---------------- */
  RT.feCaption = (host, make) => {
    const card = RT.h(`<div class="card fe-caption"><h2>${T('圖說草稿（Figure legend）', 'Draft figure legend')}</h2><p class="hint" style="margin-top:0">${T('依目前的內容自動產生，請依期刊格式修改。', 'Written from the figure as it is now; adapt it to the journal’s style.')}</p><textarea readonly rows="4" aria-label="${T('圖說草稿', 'Draft figure legend')}"></textarea><div class="btns" style="margin-top:6px"><button type="button" class="small">${T('複製', 'Copy')}</button></div></div>`);
    host.appendChild(card);
    const ta = card.querySelector('textarea');
    const refresh = () => { let t = ''; try { t = make() || ''; } catch (e) { t = ''; } card.hidden = !t; if (ta.value !== t) { ta.value = t; ta.rows = Math.min(10, Math.max(3, Math.ceil(t.length / 90))); } };
    card.querySelector('button').onclick = async () => { try { await navigator.clipboard.writeText(ta.value); RT.toast(T('已複製圖說', 'Legend copied')); } catch (e) { ta.select(); } };
    refresh();
    return refresh;
  };

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
      <span class="fe-kit-here"></span>
    </div>`);
    col.prepend(bar);
    // under the figure: a short hint, the messages, then every other card side by side
    const hint = RT.h(`<p class="hint fe-hint">${esc(cfg.hint || T('點選註解可開啟設定・雙擊文字直接修改・拖曳移動（方向鍵微調）', 'Click a note for its settings · double-click text to edit it · drag to move (arrow keys nudge)'))}</p>`);
    preview.after(hint);
    const bottom = document.createElement('div'); bottom.className = 'fe-bottom';
    const msgs = document.getElementById('msgs');
    (msgs && msgs.parentNode === col ? msgs : hint).after(bottom);
    [...col.children].filter((el) => el !== bar && el !== preview && el !== hint && el !== bottom && el !== msgs && !el.classList.contains('paper-zoom') && col.contains(el) && [...col.children].indexOf(el) > [...col.children].indexOf(bottom)).forEach((el) => bottom.appendChild(el));
    const capRefresh = cfg.caption ? RT.feCaption(bottom, cfg.caption) : null;
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
    RT.feKit({
      bar, anchor: bar.querySelector('.fe-kit-here'), key: cfg.key || location.pathname, preview, form,
      addNote: (t) => addNote(t), openSettings: () => setCanvas(false),
      menuButtons: () => [...bar.querySelectorAll('[data-x="menu"]')],
      tips: [
        ['點圖上的方框、標題或標籤，旁邊會出現它的設定，直接在那裡改。', 'Click a box, title or label on the figure and its settings appear beside it.'],
        ['雙擊文字可以直接修改；「＋ 註解」可以在圖上加文字框、箭頭、括號，拖曳就能移動。', 'Double-click text to edit it; + Note adds text boxes, arrows and brackets you can drag.'],
        ['常用設定在上方選單，完整設定按「設定」；「更多」裡有版本與色覺預覽，匯出在圖的下方。', 'Common settings are in the menus above, all of them under Settings; More holds versions and the colour check; export is below the figure.'],
      ],
    });
    bar.querySelector('.fe-kit-here').remove();

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
      const blk = orig.closest('.block'), bh = blk && blk.querySelector('.block-head b');
      if (bh) { const named = blk.querySelector('.block-head input'); return (bh.textContent.trim() + ' ' + (named && named.value ? named.value : '')).trim(); }
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
      const box = el.closest('.list-row, .block, .rob-det, tr, .nrow2, .panel-row');
      if (!box) return [el];
      const all = [...box.querySelectorAll('input:not([type=hidden]):not([type=file]):not([type=button]), select, textarea')].filter((x) => !x.closest('[hidden]'));
      if (all.length > 12) return [el];
      return all.includes(el) ? all : [el, ...all];
    }
    function buildField() {
      const el = FIELD.el, title = FIELD.title || (el.closest('tr') && el.value) || ownLabel(el) || sectionOf(el) || labelOf(el) || T('編輯', 'Edit');
      panel.setAttribute('aria-label', title);
      panel.innerHTML = head(title) + '<div class="fe-fields"></div>' + `<p class="fe-tip">${T('改這裡，圖和設定欄會一起變。', 'Changes here update the figure and the settings column.')}</p>`;
      const host = panel.querySelector('.fe-fields');
      relatedOrigs(el).forEach((o) => {
        const p = proxyFor(o), text = ownLabel(o) || o.getAttribute('aria-label') || o.placeholder || labelOf(o) || '';
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
      else if (x === 'text' || x === 'arrow' || x === 'brace') addNote(x);
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
        if (MODE === 'note' && !notes()[NSEL]) close();
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
      if (capRefresh) capRefresh();
      RT.feThumb(cfg.key || location.pathname, () => preview.querySelector('svg'));
      place();
    }
    const hitOf = (e) => { const r = e.target.closest && e.target.closest('[data-field]'); if (!r || !preview._hits) return null; const i = Number(r.dataset.field), h = preview._hits[i]; return h ? { i, h } : null; };
    preview.addEventListener('click', (e) => {
      const x = hitOf(e); if (!x) return;
      e.stopImmediatePropagation(); e.preventDefault();
      let el = null; try { el = x.h.find(); } catch (err) { /* ignore */ }
      if (el) openField(x.i, el, false);
    }, true);
    function hitAt(e) {
      const svg = preview.querySelector('svg'), g = svg && svg.querySelector('.field-ui'); if (!g || !preview._hits) return null;
      const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(g.getAttribute('transform') || ''), dx = m ? Number(m[1]) : 0, dy = m ? Number(m[2]) : 0;
      const p = figPoint(e), px = p[0] - dx, py = p[1] - dy;
      for (let i = preview._hits.length - 1; i >= 0; i--) { const h = preview._hits[i]; if (px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h) return { i, h }; }
      return null;
    }
    preview.addEventListener('dblclick', (e) => {
      if (e.target.closest && e.target.closest('.fe-ui')) return;
      const x = hitOf(e) || hitAt(e); if (!x) return;
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

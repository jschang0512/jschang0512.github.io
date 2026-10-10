/* Research Toolkit — shared helpers
 * - i18n (中文 / English), page chrome (language toggle, version footer)
 * - SVG figure building (text wrapping, boxes, arrows) + a parallel "scene" used for Word export
 * - Export: SVG / PDF (vector) / PNG / JPG / TIFF (correct DPI metadata) / DOCX (editable Word shapes)
 * Everything runs locally in the browser; nothing is uploaded.
 */
(function () {
  const RT = (window.RT = {});
  RT.VERSION = '-菘 v3.-';
  RT.DEV = { name: '張家菘', email: 'js.chang0512@gmail.com' };

  /* ---------- i18n ---------- */
  RT.lang = (() => {
    try { const v = localStorage.getItem('rt:lang'); if (v) return v; } catch (e) { /* ignore */ }
    return /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
  })();
  RT.t = (zh, en) => (RT.lang === 'en' ? en : zh);
  RT.applyI18n = (root = document) => {
    if (RT.lang !== 'en') return;
    root.querySelectorAll('[data-en]').forEach((el) => (el.innerHTML = el.dataset.en));
    root.querySelectorAll('[data-en-ph]').forEach((el) => (el.placeholder = el.dataset.enPh));
    root.querySelectorAll('[data-en-title]').forEach((el) => (el.title = el.dataset.enTitle));
  };
  RT.setLang = (l) => { try { localStorage.setItem('rt:lang', l); } catch (e) { /* ignore */ } location.reload(); };
  RT.initPage = () => {
    document.documentElement.lang = RT.lang === 'en' ? 'en' : 'zh-Hant';
    RT.applyI18n();
    const bar = document.querySelector('.topbar');
    if (bar && !bar.querySelector('.lang-toggle')) {
      const b = document.createElement('button');
      b.className = 'small lang-toggle';
      b.textContent = RT.lang === 'en' ? '中文' : 'EN';
      b.title = RT.lang === 'en' ? '切換成中文' : 'Switch to English';
      b.onclick = () => RT.setLang(RT.lang === 'en' ? 'zh' : 'en');
      bar.appendChild(b);
    }
    if (!document.querySelector('.site-foot')) {
      const f = document.createElement('footer');
      f.className = 'site-foot';
      f.innerHTML = `<div>${RT.esc(RT.VERSION)}</div>` +
        `<div class="dev-line">${RT.t('開發者', 'Developer')}：${RT.esc(RT.DEV.name)} · ${RT.t('問題與建議', 'Questions & feedback')}：<a href="mailto:${RT.DEV.email}">${RT.DEV.email}</a></div>`;
      document.body.appendChild(f);
    }
  };

  /* ---------- CDN libraries (lazy loaded only when needed) ---------- */
  RT.CDN = {
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    svg2pdf: 'https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js',
    jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfjsWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    pdfjsBase: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/',
    html2canvas: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    docxPreview: 'https://cdn.jsdelivr.net/npm/docx-preview@0.3.3/dist/docx-preview.min.js',
    utif: 'https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js',
  };
  const scriptCache = {};
  RT.loadScript = function (src) {
    if (!scriptCache[src]) {
      scriptCache[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => { delete scriptCache[src]; reject(new Error(RT.t('無法載入函式庫（請確認網路連線）：', 'Could not load library (check your internet connection): ') + src)); };
        document.head.appendChild(s);
      });
    }
    return scriptCache[src];
  };

  /* ---------- small utils ---------- */
  RT.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  RT.num = (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).replace(/[,\s]/g, '');
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  RT.fmtNum = (v, comma = true) => {
    const n = RT.num(v);
    if (n === null) return String(v ?? '').trim();
    return comma ? n.toLocaleString('en-US') : String(n);
  };
  /** "(n = 1,234)" in the chosen style */
  RT.nText = (v, o = {}) => {
    const s = RT.fmtNum(v, o.comma !== false);
    const _ = String.fromCharCode(160); // non-breaking space keeps '(n = 5)' on one line
    switch (o.style) {
      case 'tight': return `(n=${s})`;
      case 'plain': return `n${_}=${_}${s}`;
      case 'N': return `(N${_}=${_}${s})`;
      case 'nosp': return `(n${_}=${_}${s})`.replace(/ /g, '');
      default: return `(n${_}=${_}${s})`;
    }
  };
  RT.sum = (arr) => {
    let t = 0;
    for (const v of arr) { const n = RT.num(v); if (n === null) return null; t += n; }
    return t;
  };
  RT.debounce = (fn, ms = 120) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  RT.toast = (text, ms = 2600) => {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = text; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms);
  };
  RT.h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  /* ---------- persistence (per-viewer convenience only) ---------- */
  const deepMerge = (base, over) => {
    if (!over || typeof over !== 'object' || Array.isArray(over)) return over ?? base;
    const out = Array.isArray(base) ? [] : { ...base };
    for (const k of Object.keys(over)) {
      out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null ? deepMerge(base[k], over[k]) : over[k];
    }
    return out;
  };
  RT.merge = (def, obj) => deepMerge(structuredClone(def), obj);
  RT.load = (key, def) => {
    try {
      const raw = localStorage.getItem('rt:' + key);
      if (raw) return RT.merge(def, JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return structuredClone(def);
  };
  RT.save = (key, state) => { try { localStorage.setItem('rt:' + key, JSON.stringify(state)); } catch (e) { /* ignore */ } };
  RT.downloadJSON = (obj, name) => RT.download(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), name);
  RT.pickJSON = () => new Promise((resolve, reject) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => {
      try { resolve(JSON.parse(await inp.files[0].text())); } catch (e) { reject(e); }
    };
    inp.click();
  });

  /** Undo / redo history of a JSON-serialisable state. Ctrl+Z / Ctrl+Y outside text fields. */
  RT.history = (get, set) => {
    const st = { stack: [], i: -1, lock: false };
    const push = () => {
      if (st.lock) return;
      const s = JSON.stringify(get());
      if (st.stack[st.i] === s) return;
      st.stack = st.stack.slice(0, st.i + 1);
      st.stack.push(s);
      if (st.stack.length > 150) st.stack.shift();
      st.i = st.stack.length - 1;
    };
    const go = (d) => {
      const j = st.i + d;
      if (j < 0 || j >= st.stack.length) return;
      st.i = j; st.lock = true;
      try { set(JSON.parse(st.stack[j])); } finally { st.lock = false; }
    };
    document.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return; // native undo inside fields
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); go(-1); }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); go(1); }
    });
    return { push, undo: () => go(-1), redo: () => go(1) };
  };

  /* ---------- generic form binding (data-k="a.b.c") ---------- */
  RT.getPath = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);
  RT.setPath = (obj, path, v) => { const ks = path.split('.'); const last = ks.pop(); ks.reduce((o, k) => (o[k] ??= {}), obj)[last] = v; };
  RT.syncForm = (root, S) => {
    root.querySelectorAll('[data-k]').forEach((el) => {
      const v = RT.getPath(S, el.dataset.k);
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
    });
    RT.syncVisibility(root, S);
  };
  /** elements with data-show="path=value1|value2" (or "path" for truthy, "!path" for falsy) */
  RT.syncVisibility = (root, S) => {
    root.querySelectorAll('[data-show]').forEach((el) => {
      const spec = el.dataset.show;
      let ok;
      if (spec.includes('=')) { const [p, vs] = spec.split('='); ok = vs.split('|').includes(String(RT.getPath(S, p))); }
      else if (spec.startsWith('!')) ok = !RT.getPath(S, spec.slice(1));
      else ok = !!RT.getPath(S, spec);
      el.hidden = !ok;
    });
  };
  RT.bindForm = (root, getS, onChange) => {
    root.addEventListener('input', (e) => {
      const el = e.target, k = el.dataset.k;
      if (!k) return;
      let v;
      if (el.type === 'checkbox') v = el.checked;
      else if (el.type === 'number') { v = el.value === '' ? RT.getPath(getS(), k) : Number(el.value); if (!Number.isFinite(v)) return; }
      else v = el.value;
      RT.setPath(getS(), k, v);
      RT.syncVisibility(root, getS());
      onChange(k);
    });
  };

  /** Parse pasted lines "text<TAB|,|:|=>number" (e.g. copied from Excel) */
  RT.parsePairs = (txt) => String(txt || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(.*?)[\s]*(?:\t|[:：=,，|]|\s{2,}|\(n\s*=?)\s*n?\s*=?\s*([\d,]+)\s*\)?\s*$/i) || l.match(/^(.*\S)\s+([\d,]+)$/);
    return m ? { t: m[1].trim(), n: m[2].replace(/,/g, '') } : { t: l, n: '' };
  });
  /** Show a small modal with a textarea; resolves with the text or null. */
  RT.promptText = (title, hint, initial = '') => new Promise((resolve) => {
    const dlg = RT.h(`<div class="modal-back"><div class="modal card">
      <h3>${RT.esc(title)}</h3><p class="hint">${hint}</p>
      <textarea rows="8" style="font-family:ui-monospace,Consolas,monospace"></textarea>
      <div class="btns" style="justify-content:flex-end;margin-top:10px">
        <button class="m-cancel">${RT.t('取消', 'Cancel')}</button><button class="primary m-ok">${RT.t('套用', 'Apply')}</button></div></div></div>`);
    const ta = dlg.querySelector('textarea');
    ta.value = initial;
    const close = (v) => { dlg.remove(); resolve(v); };
    dlg.querySelector('.m-cancel').onclick = () => close(null);
    dlg.querySelector('.m-ok').onclick = () => close(ta.value);
    dlg.onclick = (e) => { if (e.target === dlg) close(null); };
    document.body.appendChild(dlg);
    ta.focus();
  });

  /* ---------- fonts ---------- */
  RT.FONT_LIST = [
    { v: 'Arial', css: 'Arial, Helvetica, sans-serif', kind: 'sans' },
    { v: 'Helvetica', css: 'Helvetica, Arial, sans-serif', kind: 'sans' },
    { v: 'Calibri', css: 'Calibri, Carlito, Arial, sans-serif', kind: 'sans' },
    { v: 'Verdana', css: 'Verdana, Geneva, sans-serif', kind: 'sans' },
    { v: 'Tahoma', css: 'Tahoma, Verdana, sans-serif', kind: 'sans' },
    { v: 'Segoe UI', css: "'Segoe UI', Arial, sans-serif", kind: 'sans' },
    { v: 'Times New Roman', css: "'Times New Roman', Times, serif", kind: 'serif' },
    { v: 'Cambria', css: 'Cambria, Georgia, serif', kind: 'serif' },
    { v: 'Georgia', css: 'Georgia, serif', kind: 'serif' },
    { v: 'Garamond', css: "Garamond, 'EB Garamond', serif", kind: 'serif' },
    { v: 'Microsoft JhengHei', label: '微軟正黑體 Microsoft JhengHei', css: "'Microsoft JhengHei', 'PingFang TC', 'Noto Sans TC', sans-serif", kind: 'sans', cjk: true },
    { v: 'PMingLiU', label: '新細明體 PMingLiU', css: "PMingLiU, 'Noto Serif TC', serif", kind: 'serif', cjk: true },
    { v: 'DFKai-SB', label: '標楷體 DFKai-SB', css: "DFKai-SB, BiauKai, KaiTi, serif", kind: 'serif', cjk: true },
    { v: 'Microsoft YaHei', label: '微软雅黑 Microsoft YaHei', css: "'Microsoft YaHei', sans-serif", kind: 'sans', cjk: true },
  ];
  RT.fontFamily = RT.FONT_LIST[0].css;
  RT.font = { name: 'Arial', ea: 'Microsoft JhengHei', kind: 'sans' };
  /** Select font by name (from list) or any custom installed font name */
  RT.setFont = (name, custom) => {
    let f = RT.FONT_LIST.find((x) => x.v === name);
    if (name === 'custom' && custom && custom.trim()) {
      const n = custom.trim().replace(/['"]/g, '');
      const serif = /serif|times|roman|ming|song|kai|garamond|georgia|cambria|明|宋|楷/i.test(n) && !/sans/i.test(n);
      f = { v: n, css: `'${n}', ${serif ? 'serif' : 'sans-serif'}`, kind: serif ? 'serif' : 'sans', cjk: /[　-鿿]|jheng|ming|kai|hei|song|yahei/i.test(n) };
    }
    f = f || RT.FONT_LIST[0];
    RT.fontFamily = f.css;
    RT.font = { name: f.v, ea: f.cjk ? f.v : 'Microsoft JhengHei', kind: f.kind };
  };
  RT.fontOptionsHTML = () =>
    RT.FONT_LIST.map((f) => `<option value="${RT.esc(f.v)}">${RT.esc(f.label || f.v)}</option>`).join('') +
    `<option value="custom">${RT.t('自訂字型名稱…', 'Custom font name…')}</option>`;

  /* ---------- shared style controls ---------- */
  RT.STYLE_DEF = {
    font: 'Arial', fontCustom: '', fontSize: 13, textColor: '#000000', lh: 1.3,
    boxFill: '#FFFFFF', boxStroke: '#000000', boxSW: 1.2, radius: 0, pad: 8,
    lineColor: '#000000', lineW: 1.2, headSize: 9, gapY: 34, gapX: 50,
  };
  const SF = {
    font: () => `<label class="field"><span>${RT.t('字型', 'Font')}</span><select data-k="st.font">${RT.fontOptionsHTML()}</select></label>
      <label class="field" data-show="st.font=custom"><span>${RT.t('字型名稱（需已安裝於電腦）', 'Font name (must be installed)')}</span><input data-k="st.fontCustom" placeholder="e.g. Source Sans Pro"></label>`,
    fontSize: () => num('st.fontSize', RT.t('字級 (px)', 'Font size (px)'), 6, 40, 0.5),
    lh: () => num('st.lh', RT.t('行距（倍）', 'Line spacing (×)'), 1, 2.5, 0.05),
    textColor: () => col('st.textColor', RT.t('文字顏色', 'Text colour')),
    boxFill: () => col('st.boxFill', RT.t('方框填色', 'Box fill')),
    boxStroke: () => col('st.boxStroke', RT.t('方框框線色', 'Box border')),
    boxSW: () => num('st.boxSW', RT.t('框線粗細 (px)', 'Border width (px)'), 0, 6, 0.1),
    radius: () => num('st.radius', RT.t('圓角 (px)', 'Corner radius (px)'), 0, 30, 1),
    pad: () => num('st.pad', RT.t('方框內距 (px)', 'Box padding (px)'), 0, 30, 1),
    lineColor: () => col('st.lineColor', RT.t('箭頭顏色', 'Arrow colour')),
    lineW: () => num('st.lineW', RT.t('箭頭線寬 (px)', 'Arrow width (px)'), 0.3, 6, 0.1),
    headSize: () => num('st.headSize', RT.t('箭頭大小 (px)', 'Arrowhead size (px)'), 3, 24, 0.5),
    gapY: () => num('st.gapY', RT.t('垂直間距 (px)', 'Vertical gap (px)'), 10, 120, 1),
    gapX: () => num('st.gapX', RT.t('水平間距 (px)', 'Horizontal gap (px)'), 10, 160, 1),
  };
  function num(k, label, min, max, step) { return `<label class="field"><span>${label}</span><input type="number" data-k="${k}" min="${min}" max="${max}" step="${step}"></label>`; }
  function col(k, label) { return `<label class="field"><span>${label}</span><input type="color" data-k="${k}" style="width:100%"></label>`; }
  RT.styleFieldsHTML = (keys = Object.keys(SF)) => {
    const font = keys.includes('font') ? `<div class="grid2">${SF.font()}</div>` : '';
    return font + `<div class="grid2">${keys.filter((k) => k !== 'font').map((k) => SF[k]()).join('')}</div>`;
  };
  RT.applyStyle = (st) => { RT.setFont(st.font, st.fontCustom); return st; };

  /* ---------- text measuring & wrapping ---------- */
  const mctx = document.createElement('canvas').getContext('2d');
  RT.textWidth = (t, size, bold, italic) => {
    mctx.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px ${RT.fontFamily}`;
    return mctx.measureText(t).width;
  };
  const CJK = '⺀-鿿豈-﫿＀-￯　-〿';
  // split on regular spaces only (NBSP stays inside a token), CJK chars break anywhere
  const TOK = new RegExp(`[${CJK}]|[^ \\t${CJK}]+|[ \\t]+`, 'g');
  RT.wrap = (text, maxW, size, bold) => {
    const lines = [];
    for (const para of String(text ?? '').split('\n')) {
      const toks = para.match(TOK) || [];
      let line = '';
      for (const tk of toks) {
        if (/^[ \t]+$/.test(tk)) { if (line) line += ' '; continue; }
        if (!line.trim()) line = tk;
        else if (RT.textWidth(line + tk, size, bold) <= maxW) line += tk;
        else { lines.push(line.trimEnd()); line = tk; }
        while (line.length > 1 && RT.textWidth(line, size, bold) > maxW) {
          let i = line.length - 1;
          while (i > 1 && RT.textWidth(line.slice(0, i), size, bold) > maxW) i--;
          lines.push(line.slice(0, i)); line = line.slice(i);
        }
      }
      lines.push(line.trimEnd());
    }
    return lines;
  };

  /* ---------- scene (for editable Word export) ---------- */
  RT.scene = null;
  const rec = (item) => { if (RT.scene) RT.scene.push(item); };
  RT.beginScene = () => { RT.scene = []; };
  RT.endScene = () => { const s = RT.scene || []; RT.scene = null; return s; };
  RT.sceneLen = () => (RT.scene ? RT.scene.length : 0);
  RT.shiftScene = (from, dx, dy) => {
    if (!RT.scene) return;
    for (let i = from; i < RT.scene.length; i++) {
      const it = RT.scene[i];
      if (it.pts) it.pts = it.pts.map((p) => [p[0] + dx, p[1] + dy]);
      else { it.x += dx; it.y += dy; }
    }
  };

  /* ---------- SVG building ---------- */
  const f = (n) => Math.round(n * 100) / 100;
  RT.f = f;
  /**
   * Lay out a box. items: [{text, bold, italic, indent, hang, align, size, gap, color}]
   * opts: {size, pad, padX, lh, align, fill, stroke, sw, radius, color, minH}
   */
  RT.box = (items, w, opts = {}) => {
    const o = Object.assign({ size: 13, pad: 8, lh: 1.3, align: 'center', fill: '#fff', stroke: '#000', sw: 1.2, radius: 0, color: '#000' }, opts);
    const padX = o.padX ?? o.pad + 2;
    const lines = [];
    const its = items.filter((x) => x != null);
    for (const it of its) {
      const size = it.size || o.size;
      const indent = it.indent || 0;
      const wrapped = RT.wrap(it.text, w - 2 * padX - indent - (it.hang || 0) * 0, size, it.bold);
      wrapped.forEach((t, i) => lines.push({ text: t, size, bold: it.bold, italic: it.italic, color: it.color, indent, align: it.align || o.align, gap: i === 0 ? it.gap || 0 : 0, hang: i > 0 ? it.hang || 0 : 0 }));
    }
    let th = 0;
    for (const l of lines) th += l.gap + l.size * o.lh;
    const h = Math.max(o.minH || 0, Math.ceil(th + 2 * o.pad));
    return { w, h, th, lines, o, padX, items: its };
  };
  RT.drawBox = (b, x, y, h = b.h) => {
    const o = b.o;
    const noRect = (o.fill === 'none' || !o.fill) && (o.stroke === 'none' || !o.stroke);
    let s = noRect ? '' : `<rect x="${f(x)}" y="${f(y)}" width="${f(b.w)}" height="${f(h)}" rx="${o.radius}" ry="${o.radius}" fill="${o.fill}" stroke="${o.stroke}" stroke-width="${o.sw}"/>`;
    let ty = y + (h - b.th) / 2;
    for (const l of b.lines) {
      ty += l.gap;
      const lh = l.size * o.lh;
      const base = ty + lh / 2 + l.size * 0.35;
      let tx, anchor;
      const ind = l.indent + l.hang;
      if (l.align === 'left') { tx = x + b.padX + ind; anchor = 'start'; }
      else if (l.align === 'right') { tx = x + b.w - b.padX; anchor = 'end'; }
      else { tx = x + b.w / 2 + ind / 2; anchor = 'middle'; }
      if (l.text) s += `<text x="${f(tx)}" y="${f(base)}" font-size="${l.size}" text-anchor="${anchor}" fill="${l.color || o.color}"${l.bold ? ' font-weight="bold"' : ''}${l.italic ? ' font-style="italic"' : ''}>${RT.esc(l.text)}</text>`;
      ty += lh;
    }
    rec({
      k: 'shape', x, y, w: b.w, h, fill: o.fill, stroke: o.stroke, sw: o.sw, radius: o.radius,
      padL: b.padX, padR: b.padX, padT: 0, padB: 0, anchor: 'ctr',
      paras: b.items.flatMap((it) => String(it.text ?? '').split('\n').map((t, i) => ({
        align: it.align || o.align, indent: it.indent || 0, hang: it.hang || 0, gap: i === 0 ? it.gap || 0 : 0, lh: (it.size || o.size) * o.lh,
        runs: [{ t, bold: it.bold, italic: it.italic, size: it.size || o.size, color: it.color || o.color }],
      }))),
    });
    return s;
  };
  /** Plain rectangle (no text) */
  RT.rect = (x, y, w, h, o = {}) => {
    rec({ k: 'shape', x, y, w, h, fill: o.fill || 'none', stroke: o.stroke || 'none', sw: o.sw || 0, radius: o.radius || 0, paras: [] });
    return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${o.radius ? ` rx="${o.radius}"` : ''} fill="${o.fill || 'none'}"${o.stroke && o.stroke !== 'none' ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1}"` : ''}/>`;
  };
  /** Closed polygon */
  RT.poly = (pts, o = {}) => {
    rec({ k: 'path', pts: pts.map((p) => [...p]), closed: true, fill: o.fill || 'none', stroke: o.stroke || 'none', sw: o.sw || 1 });
    return `<polygon points="${pts.map((p) => f(p[0]) + ',' + f(p[1])).join(' ')}" fill="${o.fill || 'none'}"${o.stroke && o.stroke !== 'none' ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1}" stroke-linejoin="round"` : ''}/>`;
  };
  const polyline = (pts, o) =>
    `<polyline points="${pts.map((p) => f(p[0]) + ',' + f(p[1])).join(' ')}" fill="none" stroke="${o.color || '#000'}" stroke-width="${o.sw || 1.2}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`;
  RT.line = (pts, o = {}) => {
    rec({ k: 'path', pts: pts.map((p) => [...p]), closed: false, stroke: o.color || '#000', sw: o.sw || 1.2, dash: o.dash, dashType: o.dashType });
    return polyline(pts, o);
  };
  /** Polyline with a filled arrowhead at the last point (drawn as polygon — portable to PDF). */
  RT.arrow = (pts, o = {}) => {
    const c = o.color || '#000', sw = o.sw || 1.2, hl = o.head || 9, hw = o.headW || hl * 0.47;
    const [x2, y2] = pts[pts.length - 1];
    const [x1, y1] = pts[pts.length - 2];
    const L = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
    const bx = x2 - ux * hl, by = y2 - uy * hl;
    const shaft = pts.slice(0, -1).concat([[bx + ux * 0.5, by + uy * 0.5]]);
    rec({ k: 'path', pts: pts.map((p) => [...p]), closed: false, stroke: c, sw, dash: o.dash, arrow: true, head: hl });
    return polyline(shaft, { color: c, sw, dash: o.dash }) +
      `<polygon points="${f(x2)},${f(y2)} ${f(bx - uy * hw)},${f(by + ux * hw)} ${f(bx + uy * hw)},${f(by - ux * hw)}" fill="${c}" stroke="none"/>`;
  };
  /**
   * Multi-line rich text without a box. lines: [{runs:[{t,bold,italic,size,color}], ind}]
   * x is the anchor (start/middle/end), y is the top of the first line. o: {lh, anchor}
   */
  RT.rich = (lines, x, y, o = {}) => {
    const lh = o.lh, anchor = o.anchor || 'start';
    let s = '', ty = y;
    let maxW = 0;
    for (const ln of lines) {
      const w = (ln.ind || 0) + ln.runs.reduce((a, r) => a + RT.textWidth(r.t, r.size, r.bold, r.italic), 0);
      maxW = Math.max(maxW, w);
      const base = ty + lh / 2 + (ln.runs[0]?.size || 12) * 0.35;
      s += `<text x="${f(x + (ln.ind || 0))}" y="${f(base)}" text-anchor="${anchor}">` +
        ln.runs.map((r) => `<tspan font-size="${r.size}" fill="${r.color || '#000'}"${r.bold ? ' font-weight="bold"' : ''}${r.italic ? ' font-style="italic"' : ''}>${RT.esc(r.t)}</tspan>`).join('') + '</text>';
      ty += lh;
    }
    const slack = maxW * 0.08 + 6;
    const bw = maxW + slack;
    const bx = anchor === 'middle' ? x - bw / 2 : anchor === 'end' ? x - maxW - slack : x;
    rec({
      k: 'shape', x: bx, y, w: bw, h: lines.length * lh, fill: 'none', stroke: 'none', sw: 0, padL: 0, padR: 0, padT: 0, padB: 0, anchor: 't',
      paras: lines.map((ln) => ({ align: anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left', indent: ln.ind || 0, hang: 0, gap: 0, lh, runs: ln.runs.map((r) => ({ ...r })) })),
    });
    return s;
  };
  /** Rounded rectangle with a vertical (bottom-to-top) label, e.g. PRISMA phase labels */
  /** Circle with optional centred text (e.g. risk-of-bias symbols) */
  RT.circle = (cx, cy, r, o = {}) => {
    const size = o.size || r;
    rec({ k: 'shape', geom: 'ellipse', x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, fill: o.fill || 'none', stroke: o.stroke || 'none', sw: o.sw || 0, padL: 0, padR: 0, padT: 0, padB: 0, anchor: 'ctr',
      paras: o.text ? [{ align: 'center', indent: 0, hang: 0, gap: 0, lh: size * 1.15, runs: [{ t: o.text, bold: o.bold !== false, size, color: o.color || '#000' }] }] : [] });
    return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${o.fill || 'none'}"${o.stroke && o.stroke !== 'none' ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1}"` : ''}/>` +
      (o.text ? `<text x="${f(cx)}" y="${f(cy + size * 0.36)}" text-anchor="middle" font-size="${size}"${o.bold !== false ? ' font-weight="bold"' : ''} fill="${o.color || '#000'}">${RT.esc(o.text)}</text>` : '');
  };
  RT.vlabel = (x, y, w, h, text, o = {}) => {
    const size = o.size || 13;
    rec({ k: 'shape', x, y, w, h, fill: o.fill, stroke: o.stroke, sw: o.sw || 1.2, radius: o.radius || 0, vert: 'vert270', padL: 0, padR: 0, padT: 0, padB: 0, anchor: 'ctr', paras: [{ align: 'center', indent: 0, hang: 0, gap: 0, lh: size * 1.2, runs: [{ t: text, bold: o.bold !== false, size, color: o.color || '#000' }] }] });
    return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${o.radius || 0}" fill="${o.fill}" stroke="${o.stroke}" stroke-width="${o.sw || 1.2}"/>` +
      `<text transform="translate(${f(x + w / 2 + size * 0.35)},${f(y + h / 2)}) rotate(-90)" text-anchor="middle" font-size="${size}"${o.bold !== false ? ' font-weight="bold"' : ''} fill="${o.color || '#000'}">${RT.esc(text)}</text>`;
  };
  RT.svgDoc = (w, h, body, bg = '#ffffff') =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}" font-family="${RT.esc(RT.fontFamily)}">` +
    (bg ? `<rect x="0" y="0" width="${Math.ceil(w)}" height="${Math.ceil(h)}" fill="${bg}"/>` : '') + body + `</svg>`;
  /** Wrap up a figure: {svg, w, h, scene, bg, font} */
  RT.figure = (w, h, body, bg = '#FFFFFF') => ({ svg: RT.svgDoc(w, h, body, bg), w: Math.ceil(w), h: Math.ceil(h), scene: RT.endScene(), bg, font: { ...RT.font } });

  /* ---------- editable Word (.docx) export ---------- */
  const hex = (c) => {
    c = String(c || '').trim();
    if (/^#?[\da-f]{6}$/i.test(c)) return c.replace('#', '').toUpperCase();
    if (/^#?[\da-f]{3}$/i.test(c)) return c.replace('#', '').split('').map((x) => x + x).join('').toUpperCase();
    return '000000';
  };
  const isNone = (c) => !c || c === 'none' || c === 'transparent';
  const xe = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

  RT.buildDocx = async (fig, { widthCm } = {}) => {
    await RT.loadScript(RT.CDN.jszip);
    const inches = widthCm > 0 ? widthCm / 2.54 : fig.w / 96;
    const k = (inches * 914400) / fig.w; // EMU per figure px
    const E = (v) => Math.round(v * k);
    const TW = (px) => Math.round((px * k) / 635); // twips
    const font = fig.font || RT.font;
    const rFonts = `<w:rFonts w:ascii="${xe(font.name)}" w:hAnsi="${xe(font.name)}" w:cs="${xe(font.name)}" w:eastAsia="${xe(font.ea)}"/>`;
    let id = 100;
    const fillX = (c) => (isNone(c) ? '<a:noFill/>' : `<a:solidFill><a:srgbClr val="${hex(c)}"/></a:solidFill>`);
    const arrowSz = fig.arrowSize || "sm";
    const lnX = (c, sw, dash, arrow, dashType) => (isNone(c) || !(sw > 0)
      ? '<a:ln><a:noFill/></a:ln>'
      : `<a:ln w="${Math.max(3175, E(sw))}">${fillX(c)}${dash ? `<a:prstDash val="${dashType === 'dot' ? 'sysDot' : 'dash'}"/>` : ''}<a:miter lim="800000"/>${arrow ? `<a:tailEnd type="triangle" w="${arrowSz}" len="${arrowSz}"/>` : ''}</a:ln>`);
    const runX = (r) => {
      const hp = Math.max(2, Math.round(((r.size * k) / 12700) * 2));
      return `<w:r><w:rPr>${rFonts}${r.bold ? '<w:b/><w:bCs/>' : ''}${r.italic ? '<w:i/><w:iCs/>' : ''}<w:color w:val="${hex(r.color || '#000')}"/><w:sz w:val="${hp}"/><w:szCs w:val="${hp}"/></w:rPr><w:t xml:space="preserve">${xe(r.t)}</w:t></w:r>`;
    };
    const paraX = (p) => {
      const jc = p.align === 'center' ? 'center' : p.align === 'right' ? 'right' : 'left';
      const ind = p.align === 'left' && (p.indent || p.hang) ? `<w:ind w:left="${TW((p.indent || 0) + (p.hang || 0))}" w:hanging="${TW(p.hang || 0)}"/>` : '';
      return `<w:p><w:pPr><w:spacing w:before="${TW(p.gap || 0)}" w:after="0" w:line="${Math.max(20, TW(p.lh))}" w:lineRule="exact"/>${ind}<w:jc w:val="${jc}"/></w:pPr>${p.runs.filter((r) => r.t !== '').map(runX).join('')}</w:p>`;
    };
    const shapeX = (it) => {
      const nid = ++id;
      const geom = it.geom === 'ellipse' ? '<a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>' : it.radius > 0
        ? `<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val ${Math.round(Math.min(50000, (it.radius / Math.max(1, Math.min(it.w, it.h))) * 100000))}"/></a:avLst></a:prstGeom>`
        : '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>';
      const hasText = it.paras && it.paras.some((p) => p.runs.some((r) => r.t));
      const tx = hasText ? `<wps:txbx><w:txbxContent>${it.paras.map(paraX).join('')}</w:txbxContent></wps:txbx>` : '';
      const body = `<wps:bodyPr rot="0" spcFirstLastPara="0" vertOverflow="overflow" horzOverflow="overflow" vert="${it.vert || 'horz'}" wrap="square" lIns="${E(it.padL || 0)}" tIns="${E(it.padT || 0)}" rIns="${E(Math.max(0, (it.padR || 0) * 0.5))}" bIns="${E(it.padB || 0)}" numCol="1" anchor="${it.anchor || 'ctr'}" anchorCtr="0" upright="1"><a:noAutofit/></wps:bodyPr>`;
      return `<wps:wsp><wps:cNvPr id="${nid}" name="${hasText ? 'Text Box' : 'Rectangle'} ${nid}"/><wps:cNvSpPr${hasText ? ' txBox="1"' : ''}/>` +
        `<wps:spPr><a:xfrm><a:off x="${E(it.x)}" y="${E(it.y)}"/><a:ext cx="${Math.max(1, E(it.w))}" cy="${Math.max(1, E(it.h))}"/></a:xfrm>${geom}${fillX(it.fill)}${lnX(it.stroke, it.sw)}</wps:spPr>${tx}${body}</wps:wsp>`;
    };
    const pathX = (it) => {
      const nid = ++id;
      const xs = it.pts.map((p) => p[0]), ys = it.pts.map((p) => p[1]);
      const x0 = Math.min(...xs), y0 = Math.min(...ys);
      const cx = Math.max(1, E(Math.max(...xs) - x0)), cy = Math.max(1, E(Math.max(...ys) - y0));
      const P = (p) => `<a:pt x="${E(p[0] - x0)}" y="${E(p[1] - y0)}"/>`;
      const d = `<a:moveTo>${P(it.pts[0])}</a:moveTo>` + it.pts.slice(1).map((p) => `<a:lnTo>${P(p)}</a:lnTo>`).join('') + (it.closed ? '<a:close/>' : '');
      return `<wps:wsp><wps:cNvPr id="${nid}" name="${it.arrow ? 'Arrow' : it.closed ? 'Shape' : 'Line'} ${nid}"/><wps:cNvSpPr/>` +
        `<wps:spPr><a:xfrm><a:off x="${E(x0)}" y="${E(y0)}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
        `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst><a:path w="${cx}" h="${cy}"${it.closed ? '' : ' fill="none"'}>${d}</a:path></a:pathLst></a:custGeom>` +
        `${it.closed ? fillX(it.fill) : '<a:noFill/>'}${lnX(it.stroke, it.sw, it.dash, it.arrow, it.dashType)}</wps:spPr><wps:bodyPr/></wps:wsp>`;
    };
    const W = E(fig.w), H = E(fig.h);
    const shapes = [];
    if (fig.bg && hex(fig.bg) !== 'FFFFFF') shapes.push(shapeX({ x: 0, y: 0, w: fig.w, h: fig.h, fill: fig.bg, stroke: 'none', paras: [] }));
    for (const it of fig.scene || []) shapes.push(it.k === 'path' ? pathX(it) : shapeX(it));
    const group = `<wpg:wgp><wpg:cNvGrpSpPr/><wpg:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${W}" cy="${H}"/><a:chOff x="0" y="0"/><a:chExt cx="${W}" cy="${H}"/></a:xfrm></wpg:grpSpPr>${shapes.join('')}</wpg:wgp>`;
    const drawing = `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${W}" cy="${H}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="1" name="Figure"/><wp:cNvGraphicFramePr/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup">${group}</a:graphicData></a:graphic></wp:inline></w:drawing>`;
    const margin = 1134; // 2 cm
    const pgW = Math.max(11906, Math.round(W / 635) + 2 * margin + 20), pgH = Math.max(16838, Math.round(H / 635) + 2 * margin + 400);
    const NS = 'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" mc:Ignorable="w14 wp14"';
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>` +
      `<w:p><w:r>${drawing}</w:r></w:p>` +
      `<w:sectPr><w:pgSz w:w="${pgW}" w:h="${pgH}"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>${rFonts}<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    zip.file('word/document.xml', doc);
    zip.file('word/styles.xml', styles);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  };


  /**
   * Editable Word table. spec: {title, note, headers:[cell], rows:[[cell]], widths:[n], landscape, sizePt, headerFill, borderColor}
   * cell: string | {text, fill, bold, color, align}
   */
  RT.buildDocxTable = async (spec) => {
    await RT.loadScript(RT.CDN.jszip);
    const font = RT.font;
    const rFonts = `<w:rFonts w:ascii="${xe(font.name)}" w:hAnsi="${xe(font.name)}" w:cs="${xe(font.name)}" w:eastAsia="${xe(font.ea)}"/>`;
    const sz = Math.round((spec.sizePt || 10) * 2);
    const margin = 1134, pgW = spec.landscape ? 16838 : 11906, pgH = spec.landscape ? 11906 : 16838, usable = pgW - 2 * margin;
    const ws = spec.widths || spec.headers.map(() => 1);
    const sum = ws.reduce((a, b) => a + b, 0);
    const tw = ws.map((w) => Math.round((usable * w) / sum));
    const run = (t, o = {}) => `<w:r><w:rPr>${rFonts}${o.bold ? '<w:b/><w:bCs/>' : ''}${o.italic ? '<w:i/>' : ''}${o.color ? `<w:color w:val="${hex(o.color)}"/>` : ''}<w:sz w:val="${o.sz || sz}"/><w:szCs w:val="${o.sz || sz}"/></w:rPr><w:t xml:space="preserve">${xe(t)}</w:t></w:r>`;
    const para = (t, o = {}) => `<w:p><w:pPr><w:spacing w:before="0" w:after="${o.after ?? 0}" w:line="252" w:lineRule="auto"/>${o.align ? `<w:jc w:val="${o.align}"/>` : ''}</w:pPr>${t ? run(t, o) : ''}</w:p>`;
    const cell = (c, w, head) => {
      const o = typeof c === 'object' && c !== null ? c : { text: c };
      const fill = o.fill || (head ? spec.headerFill || 'D9D9D9' : '');
      const ps = String(o.text ?? '').split('\n').map((t) => para(t, { bold: head || o.bold, color: o.color, align: o.align })).join('') || para('');
      return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${hex(fill)}"/>` : ''}<w:vAlign w:val="${o.valign || 'top'}"/></w:tcPr>${ps}</w:tc>`;
    };
    const bc = hex(spec.borderColor || '000000');
    const border = (n) => `<w:${n} w:val="single" w:sz="4" w:space="0" w:color="${bc}"/>`;
    const tbl = `<w:tbl><w:tblPr><w:tblW w:w="${usable}" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
      `<w:tblGrid>${tw.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>` +
      `<w:tr><w:trPr><w:tblHeader/></w:trPr>${spec.headers.map((h, i) => cell(h, tw[i], true)).join('')}</w:tr>` +
      spec.rows.map((r) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${r.map((c, i) => cell(c, tw[i], false)).join('')}</w:tr>`).join('') + '</w:tbl>';
    const title = spec.title ? para(spec.title, { bold: true, sz: sz + 2, after: 120 }) : '';
    const note = spec.note ? para('', { after: 0 }) + String(spec.note).split('\n').map((t) => para(t, { sz: sz - 2, italic: false })).join('') : '';
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${title}${tbl}${note}<w:sectPr><w:pgSz w:w="${pgW}" w:h="${pgH}"${spec.landscape ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>${rFonts}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    zip.file('word/document.xml', doc);
    zip.file('word/styles.xml', styles);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  };
  /** CSV download (UTF-8 with BOM so Excel opens Chinese correctly) */
  RT.downloadCSV = (rows, name) => {
    const esc = (v) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    RT.download(new Blob(['\ufeff' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), name);
  };

  /* ---------- binary helpers: CRC32, PNG/JPEG DPI, TIFF encoder ---------- */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

  /** Insert/replace the pHYs chunk (pixels per metre) right after IHDR. Returns Blob. */
  RT.pngSetDpi = (u8, dpi) => {
    const ppm = Math.round(dpi / 0.0254);
    const phys = new Uint8Array(21);
    const dv = new DataView(phys.buffer);
    dv.setUint32(0, 9);
    phys.set([0x70, 0x48, 0x59, 0x73], 4); // 'pHYs'
    dv.setUint32(8, ppm); dv.setUint32(12, ppm); phys[16] = 1;
    dv.setUint32(17, crc32(phys.subarray(4, 17)));
    const src = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const parts = [u8.subarray(0, 8)];
    let p = 8;
    while (p + 8 <= u8.length) {
      const len = src.getUint32(p);
      const type = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
      const end = p + 12 + len;
      if (type !== 'pHYs') parts.push(u8.subarray(p, end));
      if (type === 'IHDR') parts.push(phys);
      p = end;
    }
    return new Blob(parts, { type: 'image/png' });
  };
  /** Set JFIF density (dpi). Inserts an APP0 segment if missing. Returns Blob. */
  RT.jpegSetDpi = (u8, dpi) => {
    const d = Math.max(1, Math.min(65535, Math.round(dpi)));
    const isJfif = u8[2] === 0xff && u8[3] === 0xe0 && u8[6] === 0x4a && u8[7] === 0x46 && u8[8] === 0x49 && u8[9] === 0x46;
    if (isJfif) {
      const c = u8.slice();
      c[13] = 1; c[14] = d >> 8; c[15] = d & 255; c[16] = d >> 8; c[17] = d & 255;
      return new Blob([c], { type: 'image/jpeg' });
    }
    const app0 = new Uint8Array([0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1, d >> 8, d & 255, d >> 8, d & 255, 0, 0]);
    return new Blob([u8.subarray(0, 2), app0, u8.subarray(2)], { type: 'image/jpeg' });
  };
  RT.jpegHasExif = (u8) => {
    let p = 2;
    while (p + 4 < u8.length && u8[p] === 0xff) {
      const m = u8[p + 1];
      if (m === 0xda || m === 0xd9) break;
      const len = (u8[p + 2] << 8) | u8[p + 3];
      if (m === 0xe1 && u8[p + 4] === 0x45 && u8[p + 5] === 0x78) return true;
      p += 2 + len;
    }
    return false;
  };

  /* TIFF LZW (libtiff-compatible, MSB-first, early change) */
  const LZW_T = { code: new Uint16Array(1 << 20), gen: new Uint32Array(1 << 20), g: 0 };
  function lzwEncode(data) {
    const T = LZW_T;
    const out = new Uint8Array(Math.ceil(data.length * 1.5) + 64);
    let op = 0, acc = 0, nb = 0;
    const put = (c, w) => {
      acc = (acc << w) | c; nb += w;
      while (nb >= 8) { nb -= 8; out[op++] = (acc >>> nb) & 255; }
      acc &= (1 << nb) - 1;
    };
    let width = 9, next = 258;
    T.g++;
    put(256, 9);
    if (data.length) {
      let w = data[0];
      for (let i = 1; i < data.length; i++) {
        const c = data[i];
        const key = (w << 8) | c;
        if (T.gen[key] === T.g) { w = T.code[key]; continue; }
        put(w, width);
        T.code[key] = next; T.gen[key] = T.g; next++;
        if (next === 4094) { put(256, width); T.g++; next = 258; width = 9; }
        else if (next > (1 << width) - 1) width++;
        w = c;
      }
      put(w, width); next++;
      if (next === 4094) { put(256, width); width = 9; }
      else if (next > (1 << width) - 1) width++;
    }
    put(257, width);
    if (nb > 0) out[op++] = (acc << (8 - nb)) & 255;
    return out.slice(0, op);
  }

  /**
   * Encode a canvas as a baseline TIFF (RGB or 8-bit grayscale; uncompressed or LZW), X/YResolution = dpi.
   * Works strip-by-strip so large canvases stay memory friendly. Returns Blob.
   */
  RT.encodeTiff = async (canvas, dpi, compression = 'lzw', gray = false) => {
    const W = canvas.width, H = canvas.height, spp = gray ? 1 : 3;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rps = Math.max(1, Math.min(H, Math.floor((256 * 1024) / (W * spp)) || 1));
    const strips = [];
    for (let y = 0; y < H; y += rps) {
      const rows = Math.min(rps, H - y);
      const rgba = ctx.getImageData(0, y, W, rows).data;
      const px = new Uint8Array(W * rows * spp);
      for (let i = 0, j = 0; i < rgba.length; i += 4, j += spp) {
        let r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        const a = rgba[i + 3];
        if (a !== 255) { const kk = a / 255, w = 255 * (1 - kk); r = r * kk + w; g = g * kk + w; b = b * kk + w; }
        if (gray) px[j] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        else { px[j] = r; px[j + 1] = g; px[j + 2] = b; }
      }
      strips.push(compression === 'lzw' ? lzwEncode(px) : px);
      if (strips.length % 32 === 0) await new Promise((r) => setTimeout(r)); // keep UI responsive
    }
    const n = strips.length;
    let dataLen = 0;
    const offsets = [];
    for (const s of strips) { offsets.push(8 + dataLen); dataLen += s.length; }
    const pad = dataLen % 2;
    const tailStart = 8 + dataLen + pad;
    const nTags = 13;
    const tailLen = 22 + 8 * n + 2 + nTags * 12 + 4;
    const tail = new Uint8Array(tailLen);
    const dv = new DataView(tail.buffer);
    const bpsOff = tailStart, xresOff = tailStart + 6, yresOff = tailStart + 14, soOff = tailStart + 22, sbcOff = tailStart + 22 + 4 * n, ifdOff = tailStart + 22 + 8 * n;
    dv.setUint16(0, 8, true); dv.setUint16(2, 8, true); dv.setUint16(4, 8, true);
    let nu = dpi, den = 1;
    if (!Number.isInteger(dpi)) { nu = Math.round(dpi * 100); den = 100; }
    dv.setUint32(6, nu, true); dv.setUint32(10, den, true);
    dv.setUint32(14, nu, true); dv.setUint32(18, den, true);
    for (let i = 0; i < n; i++) { dv.setUint32(22 + 4 * i, offsets[i], true); dv.setUint32(22 + 4 * n + 4 * i, strips[i].length, true); }
    let p = 22 + 8 * n;
    dv.setUint16(p, nTags, true); p += 2;
    const tag = (tid, type, count, value) => {
      dv.setUint16(p, tid, true); dv.setUint16(p + 2, type, true); dv.setUint32(p + 4, count, true);
      if (type === 3 && count === 1) dv.setUint16(p + 8, value, true); else dv.setUint32(p + 8, value, true);
      p += 12;
    };
    tag(256, 4, 1, W);
    tag(257, 4, 1, H);
    tag(258, 3, spp, spp === 1 ? 8 : bpsOff);
    tag(259, 3, 1, compression === 'lzw' ? 5 : 1);
    tag(262, 3, 1, gray ? 1 : 2);
    tag(273, 4, n, n === 1 ? offsets[0] : soOff);
    tag(277, 3, 1, spp);
    tag(278, 4, 1, rps);
    tag(279, 4, n, n === 1 ? strips[0].length : sbcOff);
    tag(282, 5, 1, xresOff);
    tag(283, 5, 1, yresOff);
    tag(284, 3, 1, 1);
    tag(296, 3, 1, 2);
    dv.setUint32(p, 0, true);
    const head = new Uint8Array(8);
    const hv = new DataView(head.buffer);
    head[0] = 0x49; head[1] = 0x49; hv.setUint16(2, 42, true); hv.setUint32(4, ifdOff, true);
    const parts = [head, ...strips];
    if (pad) parts.push(new Uint8Array(1));
    parts.push(tail);
    return new Blob(parts, { type: 'image/tiff' });
  };

  /* ---------- canvas helpers ---------- */
  RT.MAX_CANVAS_SIDE = 16384;
  RT.MAX_CANVAS_AREA = 16384 * 16384;
  RT.checkCanvasSize = (w, h) => {
    if (w > RT.MAX_CANVAS_SIDE || h > RT.MAX_CANVAS_SIDE || w * h > RT.MAX_CANVAS_AREA)
      throw new Error(RT.t(`輸出尺寸 ${w}×${h} px 超過瀏覽器畫布上限，請降低 DPI 或輸出寬度。`, `Output size ${w}×${h} px exceeds the browser canvas limit. Lower the DPI or output width.`));
  };
  RT.makeCanvas = (w, h) => {
    RT.checkCanvasSize(w, h);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };
  RT.flattenWhite = (canvas) => {
    const c = RT.makeCanvas(canvas.width, canvas.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(canvas, 0, 0);
    return c;
  };
  RT.toGrayCanvas = (canvas) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const step = 1024;
    for (let y = 0; y < canvas.height; y += step) {
      const rows = Math.min(step, canvas.height - y);
      const img = ctx.getImageData(0, y, canvas.width, rows);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) { const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]); d[i] = d[i + 1] = d[i + 2] = g; }
      ctx.putImageData(img, 0, y);
    }
    return canvas;
  };
  const toBlob = (canvas, type, q) => new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error(RT.t('影像編碼失敗（可能是尺寸過大）', 'Image encoding failed (image may be too large)')))), type, q));

  /** Encode canvas → Blob with DPI metadata. fmt: png | jpg | tiff. opts: {quality, tiffCompression, gray} */
  RT.encodeCanvas = async (canvas, fmt, dpi, opts = {}) => {
    if (opts.gray && fmt !== 'tiff') canvas = RT.toGrayCanvas(fmt === 'jpg' ? RT.flattenWhite(canvas) : canvas);
    if (fmt === 'png') {
      const b = await toBlob(canvas, 'image/png');
      return RT.pngSetDpi(new Uint8Array(await b.arrayBuffer()), dpi);
    }
    if (fmt === 'jpg') {
      const b = await toBlob(RT.flattenWhite(canvas), 'image/jpeg', opts.quality ?? 0.95);
      return RT.jpegSetDpi(new Uint8Array(await b.arrayBuffer()), dpi);
    }
    if (fmt === 'tiff') return RT.encodeTiff(canvas, dpi, opts.tiffCompression || 'lzw', !!opts.gray);
    throw new Error('Unknown format ' + fmt);
  };

  /** Trim uniform (near-white / transparent) margins. Returns a new canvas. */
  RT.trimCanvas = (canvas, padPx = 0, tol = 8) => {
    const W = canvas.width, H = canvas.height;
    const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const blank = (i) => d[i + 3] < 10 || (d[i] > 255 - tol && d[i + 1] > 255 - tol && d[i + 2] > 255 - tol);
    let top = 0, bot = H - 1, left = 0, right = W - 1;
    const rowBlank = (y) => { for (let x = 0, i = y * W * 4; x < W; x++, i += 4) if (!blank(i)) return false; return true; };
    const colBlank = (x) => { for (let y = top, i = (top * W + x) * 4; y <= bot; y++, i += W * 4) if (!blank(i)) return false; return true; };
    while (top < H && rowBlank(top)) top++;
    if (top === H) return canvas;
    while (bot > top && rowBlank(bot)) bot--;
    while (left < W && colBlank(left)) left++;
    while (right > left && colBlank(right)) right--;
    const x0 = Math.max(0, left - padPx), y0 = Math.max(0, top - padPx);
    const x1 = Math.min(W - 1, right + padPx), y1 = Math.min(H - 1, bot + padPx);
    const c = RT.makeCanvas(x1 - x0 + 1, y1 - y0 + 1);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(canvas, -x0, -y0);
    return c;
  };

  RT.download = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  };
  RT.fmtBytes = (b) => (b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(2) + ' MB');

  /* ---------- SVG figure export ---------- */
  RT.svgToCanvas = (svg, w, h, scale) => new Promise((resolve, reject) => {
    const cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
    let canvas;
    try { canvas = RT.makeCanvas(cw, ch); } catch (e) { reject(e); return; }
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(RT.t('SVG 轉換失敗', 'SVG rendering failed'))); };
    img.src = url;
  });

  RT.figureGeometry = (fig, dpi, widthCm) => {
    const inches = widthCm > 0 ? widthCm / 2.54 : fig.w / 96;
    const scale = (inches * dpi) / fig.w;
    return { inches, scale, px: [Math.round(fig.w * scale), Math.round(fig.h * scale)], cm: [inches * 2.54, (inches * 2.54 * fig.h) / fig.w] };
  };

  RT.exportFigure = async (fig, { fmt, dpi, widthCm, name, quality, gray, docx }) => {
    const g = RT.figureGeometry(fig, dpi, widthCm);
    if (fmt === 'docx' && docx) { RT.download(await docx(), name + '.docx'); return; }
    if (fmt === 'docx') {
      RT.download(await RT.buildDocx(fig, { widthCm: g.inches * 2.54 }), name + '.docx');
      return;
    }
    if (fmt === 'svg') {
      const doc = new DOMParser().parseFromString(fig.svg, 'image/svg+xml').documentElement;
      if (widthCm > 0) { doc.setAttribute('width', g.cm[0].toFixed(2) + 'cm'); doc.setAttribute('height', g.cm[1].toFixed(2) + 'cm'); }
      const str = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(doc);
      RT.download(new Blob([str], { type: 'image/svg+xml' }), name + '.svg');
      return;
    }
    if (fmt === 'pdf') {
      await RT.loadScript(RT.CDN.jspdf);
      await RT.loadScript(RT.CDN.svg2pdf);
      const { jsPDF } = window.jspdf;
      const pw = g.inches * 72, ph = (g.inches * 72 * fig.h) / fig.w;
      const pdf = new jsPDF({ orientation: pw > ph ? 'landscape' : 'portrait', unit: 'pt', format: [pw, ph], compress: true });
      // PDF standard fonts: map to Times (serif) or Helvetica (sans)
      const fam = (fig.font && fig.font.kind === 'serif') ? 'Times' : 'Helvetica';
      const holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:-99999px;top:0;';
      holder.innerHTML = fig.svg.replace(/font-family="[^"]*"/, `font-family="${fam}"`).replace(/−/g, '-'); // standard PDF fonts lack U+2212
      document.body.appendChild(holder);
      try {
        const el = holder.querySelector('svg');
        if (typeof pdf.svg === 'function') await pdf.svg(el, { x: 0, y: 0, width: pw, height: ph });
        else await window.svg2pdf.svg2pdf(el, pdf, { x: 0, y: 0, width: pw, height: ph });
      } finally { holder.remove(); }
      RT.download(pdf.output('blob'), name + '.pdf');
      return;
    }
    const canvas = await RT.svgToCanvas(fig.svg, fig.w, fig.h, g.scale);
    const blob = await RT.encodeCanvas(canvas, fmt, dpi, { quality, gray });
    RT.download(blob, `${name}.${fmt === 'tiff' ? 'tif' : fmt}`);
  };

  /**
   * Render the export controls into `host`. getFig() → {svg, w, h, scene, font}
   */
  RT.exportPanel = (host, getFig, baseName, opts = {}) => {
    const saved = RT.load('export', { fmt: 'png', dpi: '300', dpiC: 300, widthCm: '', gray: false });
    host.innerHTML = `
      <h2>${RT.t('匯出', 'Export')}</h2>
      <div class="export">
        <label class="field"><span>${RT.t('檔名', 'File name')}</span><input class="ex-name" value="${RT.esc(baseName)}"></label>
        <label class="field"><span>${RT.t('格式', 'Format')}</span><select class="ex-fmt">
          <option value="docx">${opts.docxLabel || RT.t('Word（可編輯）', 'Word (editable)')}</option>
          <option value="png">PNG</option><option value="tiff">TIFF (LZW)</option><option value="jpg">JPG</option>
          <option value="pdf">${RT.t('PDF（向量）', 'PDF (vector)')}</option><option value="svg">${RT.t('SVG（向量）', 'SVG (vector)')}</option></select></label>
        <label class="field ex-dpi-wrap"><span>${RT.t('解析度 DPI', 'Resolution (DPI)')}</span><select class="ex-dpi">
          <option>150</option><option>300</option><option>500</option><option>600</option><option>1000</option><option>1200</option><option value="custom">${RT.t('自訂…', 'Custom…')}</option></select></label>
        <label class="field"><span>${RT.t('輸出寬度 (cm)', 'Output width (cm)')}</span><input class="ex-width" type="number" min="1" step="0.1" placeholder="${RT.t('原始', 'Native')}"></label>
        <label class="field ex-dpi-custom" hidden><span>${RT.t('自訂 DPI', 'Custom DPI')}</span><input class="ex-dpic" type="number" min="50" max="4800" step="1"></label>
        <div class="btns ex-presets" style="grid-column:1/-1;gap:6px">
          <span class="hint" style="margin:0">${RT.t('期刊寬度（Elsevier）：', 'Journal width (Elsevier):')}</span>
          <button class="small" data-w="9" title="Elsevier 90 mm">${RT.t('單欄 9 cm', 'Single 9 cm')}</button>
          <button class="small" data-w="14" title="Elsevier 140 mm">${RT.t('1.5 欄 14 cm', '1.5-col 14 cm')}</button>
          <button class="small" data-w="19" title="Elsevier 190 mm">${RT.t('雙欄 19 cm', 'Double 19 cm')}</button>
          <button class="small" data-w="">${RT.t('原始', 'Native')}</button>
          <label class="check ex-gray-wrap" style="margin:0 0 0 6px"><input type="checkbox" class="ex-gray"> ${RT.t('灰階', 'Grayscale')}</label>
        </div>
        <div class="export-info"></div>
        <div class="btns">
          <button class="primary ex-go">${RT.t('下載', 'Download')}</button>
          <button class="ex-copy" title="${RT.t('以 PNG 複製到剪貼簿，可直接貼到 Word / PowerPoint', 'Copy as PNG to paste into Word / PowerPoint')}">${RT.t('複製 PNG', 'Copy PNG')}</button>
        </div>
      </div>`;
    const $ = (s) => host.querySelector(s);
    $('.ex-fmt').value = saved.fmt; $('.ex-dpi').value = saved.dpi; $('.ex-dpic').value = saved.dpiC; $('.ex-width').value = saved.widthCm; $('.ex-gray').checked = !!saved.gray;
    const read = () => {
      const dpiSel = $('.ex-dpi').value;
      const dpi = dpiSel === 'custom' ? Math.max(50, Math.min(4800, Number($('.ex-dpic').value) || 300)) : Number(dpiSel);
      return { fmt: $('.ex-fmt').value, dpi, widthCm: Number($('.ex-width').value) || 0, gray: $('.ex-gray').checked, name: ($('.ex-name').value || baseName).replace(/[\\/:*?"<>|]+/g, '_') };
    };
    const info = () => {
      const fmt = $('.ex-fmt').value;
      const raster = ['png', 'tiff', 'jpg'].includes(fmt);
      $('.ex-dpi-custom').hidden = !raster || $('.ex-dpi').value !== 'custom';
      $('.ex-dpi-wrap').style.visibility = raster ? '' : 'hidden';
      $('.ex-gray-wrap').hidden = !raster;
      const fig = getFig(); if (!fig) return;
      const o = read();
      const g = RT.figureGeometry(fig, o.dpi, o.widthCm);
      const size = `${g.cm[0].toFixed(1)} × ${g.cm[1].toFixed(1)} cm`;
      let txt = fmt === 'docx'
        ? opts.docxInfo || RT.t(`Word 圖形，每個方框、文字與箭頭都可在 Word 中編輯，尺寸 ${size}`, `Native Word shapes — every box, text and arrow is editable in Word. Size ${size}`)
        : !raster
          ? RT.t(`向量格式，列印尺寸 ${size}（可無限放大）`, `Vector format, print size ${size} (scales without loss)`)
          : RT.t(`輸出 ${g.px[0].toLocaleString()} × ${g.px[1].toLocaleString()} px，列印尺寸 ${size} @ ${o.dpi} dpi`, `Output ${g.px[0].toLocaleString()} × ${g.px[1].toLocaleString()} px, print size ${size} @ ${o.dpi} dpi`);
      // jsPDF standard fonts only cover WinAnsi (Latin-1 + a few punctuation marks)
      const text = fig.svg.replace(/<[^>]+>/g, '').replace(/−/g, '-');
      if (fmt === 'pdf' && /[^\x00-\xFF–—‘’“”•…€]/.test(text))
        txt += RT.t('　⚠ 圖中含中文或特殊符號（如 ≥、∞），PDF 可能無法正確顯示，請改用 Word、SVG 或 PNG/TIFF。', '  ⚠ The figure contains CJK text or symbols (e.g. ≥, ∞) that standard PDF fonts cannot show — use Word, SVG or PNG/TIFF instead.');
      if (fmt === 'pdf' && fig.font && !['Arial', 'Helvetica', 'Times New Roman'].includes(fig.font.name))
        txt += RT.t(`　（PDF 會以 ${fig.font.kind === 'serif' ? 'Times' : 'Helvetica'} 取代 ${fig.font.name}）`, `  (PDF substitutes ${fig.font.kind === 'serif' ? 'Times' : 'Helvetica'} for ${fig.font.name})`);
      $('.export-info').textContent = txt;
      RT.save('export', { fmt, dpi: $('.ex-dpi').value, dpiC: $('.ex-dpic').value, widthCm: $('.ex-width').value, gray: $('.ex-gray').checked });
    };
    host.addEventListener('input', info);
    host.addEventListener('change', info);
    $('.ex-presets').addEventListener('click', (e) => {
      const b = e.target.closest('[data-w]');
      if (!b) return;
      $('.ex-width').value = b.dataset.w; info();
    });
    $('.ex-go').onclick = async () => {
      const btn = $('.ex-go'); btn.disabled = true; const t = btn.textContent; btn.textContent = RT.t('處理中…', 'Working…');
      try { await RT.exportFigure(getFig(), { ...read(), docx: opts.docx }); }
      catch (e) { console.error(e); RT.toast(String(e.message || e), 6000); }
      finally { btn.disabled = false; btn.textContent = t; }
    };
    $('.ex-copy').onclick = async () => {
      try {
        const o = read(); const fig = getFig();
        const g = RT.figureGeometry(fig, o.dpi, o.widthCm);
        const canvas = await RT.svgToCanvas(fig.svg, fig.w, fig.h, g.scale);
        const blob = await RT.encodeCanvas(canvas, 'png', o.dpi, { gray: o.gray });
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        RT.toast(RT.t('已複製 PNG 到剪貼簿', 'PNG copied to clipboard'));
      } catch (e) { RT.toast(RT.t('無法複製到剪貼簿：', 'Could not copy to clipboard: ') + (e.message || e), 6000); }
    };
    return { refresh: info };
  };

  /* ---------- references block ---------- */
  RT.LICENSES = {
    prisma: RT.t('PRISMA 2020 流程圖範本以 CC BY 4.0 授權，可改作，但須適當引用原始出處（Page et al., BMJ 2021）；圖中可開啟「來源引用行」。', 'PRISMA 2020 flow diagram templates are licensed CC BY 4.0 — adaptation is allowed provided the original is properly cited (Page et al., BMJ 2021); the figure can include a source line.'),
    rob: RT.t('RoB 2 與 ROBINS-I 為原作者著作，以 CC BY-NC-ND 4.0 授權（riskofbias.info）。本工具只記錄使用者的判斷並繪圖，未收錄或改作官方 signalling questions 與指引內容；請以官方文件進行評估並引用。', 'RoB 2 and ROBINS-I are © their authors, licensed CC BY-NC-ND 4.0 (riskofbias.info). This tool only records the user’s judgements and draws plots; it does not reproduce or adapt the official signalling questions or guidance — assess with and cite the official documents.'),
  };
  /** Terms of use / licence notice shown under the references on every page */
  RT.noticeHTML = (extra = []) => {
    const items = [
      RT.t('用途：協助製作研究圖表與整理資料。研究設計、數字、時間窗與偏誤判斷的正確性，由使用者負責確認；本工具不取代報告指引與官方評估工具。', 'Purpose: helps produce research figures and organise data. Users are responsible for the correctness of designs, numbers, time windows and risk-of-bias judgements; the tool does not replace reporting guidelines or official assessment tools.'),
      RT.t('範例資料與範本中的數字、日期、研究名稱皆為虛構示意，請替換為你研究的實際內容。', 'Example data and all numbers, dates and study names in templates are fictional illustrations — replace them with your own.'),
      RT.t('隱私：所有處理都在你的瀏覽器中完成，檔案不會上傳；輸入內容只存在此瀏覽器（localStorage），清除瀏覽器資料即刪除。', 'Privacy: everything runs in your browser and files are never uploaded; inputs are kept only in this browser (localStorage) and are removed when you clear browser data.'),
      ...extra,
      RT.t('第三方程式庫：pdf.js、docx-preview（Apache-2.0）；jsPDF、svg2pdf.js、html2canvas、UTIF.js（MIT）；JSZip（MIT 或 GPL-3.0，擇一）。使用時自 CDN 載入。', 'Third-party libraries: pdf.js, docx-preview (Apache-2.0); jsPDF, svg2pdf.js, html2canvas, UTIF.js (MIT); JSZip (MIT or GPL-3.0). Loaded from CDNs when needed.'),
      RT.t(`版本：Research Toolkit ${RT.VERSION}`, `Version: Research Toolkit ${RT.VERSION}`),
    ];
    return `<details class="refs" style="margin-top:8px"><summary>${RT.t('使用須知與授權', 'Terms of use & licences')}</summary><ul style="margin:6px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:5px">${items.map((t) => `<li>${t}</li>`).join('')}</ul></details>`;
  };
  RT.refsHTML = (items, noticeExtra = []) => `<details class="refs"><summary>${RT.t('參考資料', 'References')}</summary><ol>${items.map((r) => `<li>${r}</li>`).join('')}</ol></details>` + RT.noticeHTML(noticeExtra);
  RT.REFS = {
    prisma: 'Page MJ, McKenzie JE, Bossuyt PM, et al. The PRISMA 2020 statement: an updated guideline for reporting systematic reviews. <i>BMJ</i> 2021;372:n71. <a href="https://doi.org/10.1136/bmj.n71" target="_blank" rel="noopener">doi:10.1136/bmj.n71</a>',
    prismaFlow: 'PRISMA 2020 flow diagram templates. <a href="https://www.prisma-statement.org/prisma-2020-flow-diagram" target="_blank" rel="noopener">prisma-statement.org</a>',
    strobe: 'von Elm E, Altman DG, Egger M, et al. The Strengthening the Reporting of Observational Studies in Epidemiology (STROBE) statement: guidelines for reporting observational studies. <i>Lancet</i> 2007;370:1453–7. <a href="https://doi.org/10.1016/S0140-6736(07)61602-X" target="_blank" rel="noopener">doi:10.1016/S0140-6736(07)61602-X</a>',
    record: 'Benchimol EI, Smeeth L, Guttmann A, et al. The REporting of studies Conducted using Observational Routinely-collected health Data (RECORD) statement. <i>PLoS Med</i> 2015;12:e1001885. <a href="https://doi.org/10.1371/journal.pmed.1001885" target="_blank" rel="noopener">doi:10.1371/journal.pmed.1001885</a>',
    schneeweiss: 'Schneeweiss S, Rassen JA, Brown JS, et al. Graphical depiction of longitudinal study designs in health care databases. <i>Ann Intern Med</i> 2019;170:398–406. <a href="https://doi.org/10.7326/M18-3079" target="_blank" rel="noopener">doi:10.7326/M18-3079</a>; templates at <a href="https://www.repeatinitiative.org/projects.html" target="_blank" rel="noopener">repeatinitiative.org</a>',
    acnu: 'Lund JL, Richardson DB, Stürmer T. The active comparator, new user study design in pharmacoepidemiology: historical foundations and contemporary application. <i>Curr Epidemiol Rep</i> 2015;2:221–8. <a href="https://doi.org/10.1007/s40471-015-0053-5" target="_blank" rel="noopener">doi:10.1007/s40471-015-0053-5</a>',
    tte: 'Hernán MA, Robins JM. Using big data to emulate a target trial when a randomized trial is not available. <i>Am J Epidemiol</i> 2016;183:758–64. <a href="https://doi.org/10.1093/aje/kwv254" target="_blank" rel="noopener">doi:10.1093/aje/kwv254</a>',
    sccs: 'Petersen I, Douglas I, Whitaker H. Self controlled case series methods: an alternative to standard epidemiological study designs. <i>BMJ</i> 2016;354:i4515. <a href="https://doi.org/10.1136/bmj.i4515" target="_blank" rel="noopener">doi:10.1136/bmj.i4515</a>',
    cco: 'Maclure M. The case-crossover design: a method for studying transient effects on the risk of acute events. <i>Am J Epidemiol</i> 1991;133:144–53. <a href="https://doi.org/10.1093/oxfordjournals.aje.a115853" target="_blank" rel="noopener">doi:10.1093/oxfordjournals.aje.a115853</a>',
    okabe: 'Okabe M, Ito K. Color Universal Design (CUD): how to make figures and presentations that are friendly to colorblind people. 2008. <a href="https://jfly.uni-koeln.de/color/" target="_blank" rel="noopener">jfly.uni-koeln.de/color</a>',
    tteJama: 'Hernán MA, Wang W, Leaf DE. Target trial emulation: a framework for causal inference from observational data. <i>JAMA</i> 2022;328:2446–7. <a href="https://doi.org/10.1001/jama.2022.21383" target="_blank" rel="noopener">doi:10.1001/jama.2022.21383</a>',
    rob2: 'Sterne JAC, Savović J, Page MJ, et al. RoB 2: a revised tool for assessing risk of bias in randomised trials. <i>BMJ</i> 2019;366:l4898. <a href="https://doi.org/10.1136/bmj.l4898" target="_blank" rel="noopener">doi:10.1136/bmj.l4898</a>',
    robinsi: 'Sterne JA, Hernán MA, Reeves BC, et al. ROBINS-I: a tool for assessing risk of bias in non-randomised studies of interventions. <i>BMJ</i> 2016;355:i4919. <a href="https://doi.org/10.1136/bmj.i4919" target="_blank" rel="noopener">doi:10.1136/bmj.i4919</a>',
    robinsiV2: 'ROBINS-I V2 Development Group. The Risk Of Bias In Non-randomized Studies – of Interventions, Version 2 (ROBINS-I V2) assessment tool (for follow-up studies). Version of 20 November 2025 (draft; archived version 22 November 2024). <a href="https://www.riskofbias.info/welcome/robins-i-v2" target="_blank" rel="noopener">riskofbias.info/welcome/robins-i-v2</a>',
    rob2V: 'RoB 2 Development Group. Revised Cochrane risk-of-bias tool for randomized trials (RoB 2), version of 22 August 2019; RoB 2 for cluster-randomized trials and for crossover trials, versions of 18 March 2021. <a href="https://www.riskofbias.info/welcome/rob-2-0-tool" target="_blank" rel="noopener">riskofbias.info/welcome/rob-2-0-tool</a>',
    riskofbias: 'Official tools, guidance and signalling questions (RoB 2, ROBINS-I V2): <a href="https://www.riskofbias.info" target="_blank" rel="noopener">riskofbias.info</a>',
    robvis: 'McGuinness LA, Higgins JPT. Risk-of-bias VISualization (robvis): an R package and Shiny web app for visualizing risk-of-bias assessments. <i>Res Synth Methods</i> 2021;12:55–61. <a href="https://doi.org/10.1002/jrsm.1411" target="_blank" rel="noopener">doi:10.1002/jrsm.1411</a>',
    tiff: 'Adobe Systems. TIFF Revision 6.0 (1992) — baseline RGB/grayscale, LZW compression, XResolution/YResolution tags.',
    png: 'W3C. Portable Network Graphics (PNG) Specification — pHYs chunk (physical pixel dimensions).',
    jfif: 'JPEG File Interchange Format (JFIF) 1.02 — APP0 density fields (ITU-T T.871).',
    artwork: 'Elsevier. Artwork sizing — 300 dpi for halftone images, 500 dpi for combination art, 1000 dpi for line art; widths 90 mm (single column), 140 mm (1.5 column), 190 mm (double column). <a href="https://www.elsevier.com/about/policies-and-standards/author/artwork-and-media-instructions/artwork-sizing" target="_blank" rel="noopener">elsevier.com</a> (requirements differ between journals — always check the target journal).',
    libs: 'Libraries: <a href="https://mozilla.github.io/pdf.js/" target="_blank" rel="noopener">pdf.js</a>, <a href="https://github.com/VolodymyrBaydalka/docxjs" target="_blank" rel="noopener">docx-preview</a>, <a href="https://html2canvas.hertzen.com/" target="_blank" rel="noopener">html2canvas</a>, <a href="https://stuk.github.io/jszip/" target="_blank" rel="noopener">JSZip</a>, <a href="https://github.com/parallax/jsPDF" target="_blank" rel="noopener">jsPDF</a>, <a href="https://github.com/yWorks/svg2pdf.js" target="_blank" rel="noopener">svg2pdf.js</a>, <a href="https://github.com/photopea/UTIF.js" target="_blank" rel="noopener">UTIF.js</a>. Word shapes follow ECMA-376 Office Open XML (DrawingML / WordprocessingML).',
  };

  // auto-init page chrome (script is loaded at the end of <body>)
  RT.initPage();
})();

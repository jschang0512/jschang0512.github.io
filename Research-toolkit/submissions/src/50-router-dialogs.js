  /* ---------------- router ---------------- */
  function route() {
    const h = (location.hash || '#/').slice(1).split('?')[0];
    const [, a = '', b = '', c = ''] = h.split('/');
    return { a, b, c };
  }
  function render(keepScroll) {
    if (!USER) return;
    const { a, b, c } = route(), main = $('main'), wide = isWide();
    let html = '', split = false, section = a;
    if (a === 'project' || a === 'projects') {
      section = 'projects';
      const p = a === 'project' && byId('projects', b);
      if (wide) { split = true; html = `<div class="pane-list">${listProjects(p && p.id)}</div><div class="pane-detail">${p ? detailProject(p) : emptyPane(T('選一個專案查看', 'Pick a project'))}</div>`; }
      else html = p ? detailProject(p) : listProjects();
    } else if (a === 'paper' || a === 'papers') {
      section = 'papers';
      const p = a === 'paper' && byId('papers', b);
      if (wide) { split = true; html = `<div class="pane-list">${listPapers(p && p.id)}</div><div class="pane-detail">${p ? detailPaper(p, c) : emptyPane(T('選一篇論文查看', 'Pick a paper'))}</div>`; }
      else html = p ? detailPaper(p, c) : listPapers();
    } else if (a === 'journal' || a === 'journals') {
      section = 'papers';
      const name = a === 'journal' ? decodeURIComponent(b) : '';
      if (wide) { split = true; html = `<div class="pane-list">${listJournals(name)}</div><div class="pane-detail">${name ? detailJournal(name) : emptyPane(T('選一家期刊查看', 'Pick a journal'))}</div>`; }
      else html = name ? detailJournal(name) : listJournals();
    } else if (a === 'deadlines') { section = 'todos'; html = pageDeadlines(); }
    else if (a === 'reviewing') { section = 'papers'; html = pageReviewing(); }
    else if (a === 'answers') { section = 'papers'; html = pageAnswers(); }
    else if (a === 'search') { section = 'search'; html = pageSearch(); }
    else if (a === 'todos') html = pageTodos();
    else if (a === 'stats') { section = ''; html = pageStats(); }
    else if (a === 'me') html = pageMe();
    else { section = ''; html = pageHome(); }
    const y = window.scrollY;
    main.className = 'main' + (split ? ' split' : '');
    main.innerHTML = html;
    restoreDrafts(main);
    cacheSoon();
    renderNav(section);
    document.title = tt('appName');
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
    if (a === 'answers') paintAnswers();
    if (a === 'search') { paintSearch(); const gq = $('g-q'); if (gq && !keepScroll) gq.focus(); }
    if (a === 'me') bindMe();
  }
  const emptyPane = (t) => `<div class="empty" style="margin-top:22px">${esc(t)}</div>`;
  window.addEventListener('hashchange', () => render(false));
  let lastWide = isWide();
  window.addEventListener('resize', () => { if (isWide() !== lastWide) { lastWide = isWide(); render(true); } });
  // after a change saved through save()/remove() the local copy is already right; reload() is for bulk writes
  async function refresh() { render(true); }
  async function reload() { if (await loadAll()) render(true); }

  /* ---------------- generic form dialog ---------------- */
  // fields: [{name, label, type: text|textarea|date|select|number|checkbox|email|url, options, required, max, full, help, placeholder}]
  function formDialog({ title, fields, values = {}, saveLabel, onSave, onDelete, deleteLabel, afterOpen }) {
    const dlg = document.createElement('dialog');
    const field = (f) => {
      const v = values[f.name] ?? f.value ?? '', req = f.required ? ' required' : '', id = 'fd-' + f.name;
      let input;
      if (f.type === 'textarea') input = `<textarea id="${id}" name="${f.name}"${req}${f.max ? ` maxlength="${f.max}"` : ''} rows="${f.rows || 3}"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}>${esc(v)}</textarea>`;
      else if (f.type === 'select') input = `<select id="${id}" name="${f.name}"${req}>${f.options.map(([k, l]) => `<option value="${esc(k)}"${String(k) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
      else if (f.type === 'links') return `<div class="f full" data-links="${f.name}"><span>${esc(f.label)}</span><div class="lk-rows"></div><button type="button" class="link" data-add-link>＋ ${T('新增連結', 'Add a link')}</button>${f.help ? `<div class="help">${esc(f.help)}</div>` : ''}</div>`;
      else if (f.type === 'checkbox') return `<label class="f ${f.full ? 'full' : ''}" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="${f.name}" style="width:auto;min-height:0"${v ? ' checked' : ''}> ${esc(f.label)}</label>`;
      else input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}"${req}${f.max ? ` maxlength="${f.max}"` : ''} value="${esc(v)}"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}${f.type === 'number' ? ' inputmode="numeric"' : ''}${f.suggest ? ` list="dl-${f.name}" autocomplete="off"` : ''}>` + (f.suggest ? `<datalist id="dl-${f.name}">${f.suggest.map((x) => `<option value="${esc(x)}">`).join('')}</datalist>` : '');
      return `<label class="f ${f.full ? 'full' : ''}" for="${id}"><span>${esc(f.label)}</span>${input}${f.help ? `<div class="help">${esc(f.help)}</div>` : ''}</label>`;
    };
    dlg.innerHTML = `<form method="dialog"><div class="dlg-head">${esc(title)}</div><div class="dlg-body"><div class="form-grid">${fields.map(field).join('')}</div></div>` +
      `<div class="dlg-foot">${onDelete ? `<button type="button" class="btn danger" data-del>${ic('trash')}${esc(deleteLabel || T('刪除', 'Delete'))}</button>` : ''}<span class="spacer"></span><button class="btn" value="cancel" formnovalidate>${T('取消', 'Cancel')}</button><button class="btn primary" value="save">${esc(saveLabel || T('儲存', 'Save'))}</button></div></form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector('form');
    fields.filter((f) => f.type === 'links').forEach((f) => { const box = form.querySelector(`[data-links="${f.name}"]`); (values[f.name] || []).forEach((l) => addLinkRow(box, l)); box.querySelector('[data-add-link]').onclick = () => addLinkRow(box, {}, true); });
    form.addEventListener('submit', async (e) => {
      if (!e.submitter || e.submitter.value !== 'save') return;
      e.preventDefault();
      if (!form.reportValidity()) return;
      const row = {};
      fields.filter((f) => f.type === 'links').forEach((f) => { row[f.name] = Array.from(form.querySelectorAll(`[data-links="${f.name}"] .lk-row`)).map((r) => ({ kind: r.querySelector('select').value, url: r.querySelector('input').value.trim() })).filter((l) => l.url); });
      fields.forEach((f) => { if (f.type === 'links') return; const el = form.elements[f.name]; if (!el) return; row[f.name] = f.type === 'checkbox' ? el.checked : (el.value.trim() === '' ? null : (f.type === 'number' ? Number(el.value) : el.value.trim())); });
      e.submitter.disabled = true;
      const ok = await onSave(row);
      e.submitter.disabled = false;
      if (ok !== false) dlg.close();
    });
    if (onDelete) dlg.querySelector('[data-del]').onclick = async () => { if (await onDelete()) dlg.close(); };
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
    if (afterOpen) afterOpen(dlg, form);
    return dlg;
  }
  const LINK_KIND = () => ({ manuscript: T('稿件', 'Manuscript'), response: T('回覆信', 'Response letter'), cover: 'Cover letter', supplement: T('補充資料', 'Supplement'), figures: T('圖表', 'Figures'), other: T('其他', 'Other') });
  function addLinkRow(box, l, focus) {
    const row = document.createElement('div'); row.className = 'lk-row';
    row.innerHTML = `<select aria-label="${T('類型', 'Kind')}">${Object.entries(LINK_KIND()).map(([k, v]) => `<option value="${k}"${k === (l.kind || 'manuscript') ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select><input type="url" maxlength="1000" placeholder="https://…" value="${esc(l.url || '')}" aria-label="URL"><button type="button" class="btn ghost icon" aria-label="${T('移除', 'Remove')}">✕</button>`;
    row.querySelector('button').onclick = () => row.remove();
    box.querySelector('.lk-rows').appendChild(row);
    if (focus) row.querySelector('input').focus();
  }


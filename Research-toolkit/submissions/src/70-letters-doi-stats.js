  /* ---------------- response letter ---------------- */
  function letterText(round) {
    const p = byId('papers', round.paper_id), rs = roundsOf(p.id), cs = commentsOf(round.id);
    const groups = {}; cs.forEach((c) => (groups[c.reviewer] = groups[c.reviewer] || []).push(c));
    const names = Object.keys(groups).sort(reviewerOrder);
    const lines = ['Response to Reviewers', '', `Manuscript: ${p.title}`, `Journal: ${round.journal} (round ${rs.indexOf(round) + 1})`, ''];
    names.forEach((n) => {
      lines.push(n, '');
      groups[n].sort((a, b) => a.seq - b.seq).forEach((c) => {
        lines.push(`Comment ${reviewerNo(n)}.${c.seq}: ${c.comment}`);
        lines.push(`Response: ${c.response ? c.response : '[response pending]'}`);
        if (c.changes) lines.push(`Changes: ${c.changes}`);
        lines.push('');
      });
    });
    return lines.join('\n');
  }
  function letterDialog(roundId) {
    const round = byId('rounds', roundId), text = letterText(round), open = openCount(roundId);
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `<form method="dialog"><div class="dlg-head">${T('回覆信（Response to Reviewers）', 'Response to reviewers')}</div><div class="dlg-body">` +
      (open ? `<p class="msg" style="margin:0 0 10px">${T(`還有 ${open} 條意見沒回覆完，會先標成 [response pending]。`, `${open} comment(s) are not answered yet and show as [response pending].`)}</p>` : '') +
      `<textarea class="inp letter" readonly>${esc(text)}</textarea></div><div class="dlg-foot"><button type="button" class="btn" data-copy>${ic('copy')}${T('複製文字', 'Copy text')}</button><button type="button" class="btn" data-docx>${ic('doc')}${T('匯出 Word', 'Export Word')}</button><span class="spacer"></span><button class="btn primary" value="close">${T('完成', 'Done')}</button></div></form>`;
    document.body.appendChild(dlg);
    dlg.querySelector('[data-copy]').onclick = () => navigator.clipboard.writeText(text).then(() => toast(T('已複製', 'Copied')), () => toast(T('無法複製', 'Could not copy')));
    dlg.querySelector('[data-docx]').onclick = async () => {
      try { const blob = await letterDocx(round); const p = byId('papers', round.paper_id); download(blob, `response_to_reviewers_${(p.short_title || 'paper').replace(/[^\w\-]+/g, '_').slice(0, 40)}_round${roundsOf(p.id).indexOf(round) + 1}.docx`); }
      catch (e) { console.error(e); toast(T('匯出失敗：', 'Export failed: ') + e.message, 6000); }
    };
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }
  // In the Android app a WebView cannot save downloads: the file is written to the app's cache and handed to the share sheet
  const NATIVE = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  async function download(blob, name) {
    if (NATIVE && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem && window.Capacitor.Plugins.Share) {
      try {
        const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
        const { Filesystem, Share } = window.Capacitor.Plugins;
        const w = await Filesystem.writeFile({ path: name, data, directory: 'CACHE' });
        await Share.share({ title: name, url: w.uri, dialogTitle: T('儲存或傳送檔案', 'Save or send the file') });
      } catch (e) { if (!/cancel/i.test(String(e && e.message))) toast(T('無法輸出檔案：', 'Could not export the file: ') + (e.message || e), 6000); }
      return;
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  // the browser version keeps its shell cached; the Android app loads the live page so its native bridge stays in place
  if ('serviceWorker' in navigator && !NATIVE && (location.protocol === 'https:' || location.hostname === 'localhost')) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  const IS_ANDROID = /android/i.test(navigator.userAgent || '');
  const APK_URL = 'tracker.apk';
  let jszipPromise = null;
  function loadJSZip() {
    if (window.JSZip) return Promise.resolve();
    return jszipPromise || (jszipPromise = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'; s.onload = res; s.onerror = () => rej(new Error('JSZip')); document.head.appendChild(s); }));
  }
  // A plain, editable .docx: title, manuscript line, then for each reviewer a heading and Comment / Response pairs
  async function letterDocx(round) {
    await loadJSZip();
    const p = byId('papers', round.paper_id), rs = roundsOf(p.id), cs = commentsOf(round.id);
    const x = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    const run = (t, o = {}) => String(t).split('\n').map((line, i) => `<w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}</w:rPr>${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${x(line)}</w:t></w:r>`).join('');
    const para = (runs, o = {}) => `<w:p><w:pPr><w:spacing w:before="${o.before || 0}" w:after="${o.after ?? 120}"/>${o.ind ? `<w:ind w:left="${o.ind}"/>` : ''}</w:pPr>${runs}</w:p>`;
    const groups = {}; cs.forEach((c) => (groups[c.reviewer] = groups[c.reviewer] || []).push(c));
    let body = para(run('Response to Reviewers', { b: true, sz: 32 }), { after: 200 });
    body += para(run('Manuscript: ', { b: true }) + run(p.title)) + para(run('Journal: ', { b: true }) + run(`${round.journal} (round ${rs.indexOf(round) + 1})`), { after: 240 });
    Object.keys(groups).sort(reviewerOrder).forEach((n) => {
      body += para(run(n, { b: true, sz: 26 }), { before: 240, after: 120 });
      groups[n].sort((a, b) => a.seq - b.seq).forEach((c) => {
        body += para(run(`Comment ${reviewerNo(n)}.${c.seq}: `, { b: true }) + run(c.comment), { after: 80 });
        body += para(run('Response: ', { b: true, color: '1F4E9E' }) + (c.response ? run(c.response) : run('[response pending]', { i: true, color: '9C2B1F' })), { after: c.changes ? 60 : 240, ind: 360 });
        if (c.changes) body += para(run('Changes: ', { b: true }) + run(c.changes), { after: 240, ind: 360 });
      });
    });
    return makeDocx(body);
  }
  const DOCX = {
    x: (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''),
    run: (t, o = {}) => String(t).split('\n').map((line, i) => `<w:r><w:rPr>${o.b ? '<w:b/>' : ''}${o.i ? '<w:i/>' : ''}${o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : ''}${o.color ? `<w:color w:val="${o.color}"/>` : ''}</w:rPr>${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${DOCX.x(line)}</w:t></w:r>`).join(''),
    para: (runs, o = {}) => `<w:p><w:pPr><w:spacing w:before="${o.before || 0}" w:after="${o.after ?? 120}"/>${o.ind ? `<w:ind w:left="${o.ind}"/>` : ''}</w:pPr>${runs}</w:p>`,
  };
  async function makeDocx(body) {
    await loadJSZip();
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Microsoft JhengHei"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
    const zip = new window.JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    zip.file('word/document.xml', doc);
    zip.file('word/styles.xml', styles);
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }

  /* ---------------- DOI → Crossref ---------------- */
  // Only the DOI leaves the browser: Crossref is the public registry of scholarly metadata.
  const cleanDoi = (v) => String(v || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').trim();
  async function crossref(doi) {
    const r = await fetch('https://api.crossref.org/works/' + encodeURIComponent(doi), { headers: { Accept: 'application/json' } });
    if (r.status === 404) throw new Error(T('Crossref 找不到這個 DOI。請確認有沒有打錯，或文章還沒正式出版。', 'Crossref has no record of this DOI. Check it, or the article may not be out yet.'));
    if (!r.ok) throw new Error(T('Crossref 暫時無法連線，請稍後再試。', 'Crossref is not reachable right now. Try again later.'));
    const m = (await r.json()).message || {};
    const strip = (t) => String(t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const dp = (m['published-print'] || m['published-online'] || m.issued || {})['date-parts'];
    const authors = (m.author || []).filter((a) => a.family || a.name).map((a) => ({ name: a.name || [a.given, a.family].filter(Boolean).join(' '), affiliation: (a.affiliation || []).map((x) => x.name).filter(Boolean).join('; '), orcid: a.ORCID ? String(a.ORCID).replace(/^https?:\/\/orcid\.org\//i, '') : '' }));
    return { title: strip((m.title || [])[0]), journal: strip((m['container-title'] || [])[0]), year: dp && dp[0] && dp[0][0] ? String(dp[0][0]) : '', authors };
  }
  function doiLookup(dlg, form, setAuthors) {
    const input = form.elements.doi; if (!input) return;
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn sm'; btn.textContent = T('查詢', 'Look up');
    const wrap = document.createElement('div'); wrap.className = 'row'; wrap.style.flexWrap = 'nowrap';
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input); wrap.appendChild(btn);
    const panel = document.createElement('div'); panel.className = 'doi-panel'; wrap.parentNode.appendChild(panel);
    btn.onclick = async () => {
      const doi = cleanDoi(input.value);
      if (!/^10\.\d{3,9}\/\S+$/.test(doi)) { panel.innerHTML = `<p class="msg">${T('DOI 的格式應該像 10.1080/07853890.2025.2557509', 'A DOI looks like 10.1080/07853890.2025.2557509')}</p>`; return; }
      input.value = doi; btn.disabled = true; panel.innerHTML = `<p class="muted small">${T('查詢中…', 'Looking up…')}</p>`;
      let c; try { c = await crossref(doi); } catch (e) { panel.innerHTML = `<p class="msg">${esc(e.message)}</p>`; btn.disabled = false; return; } finally { btn.disabled = false; }
      const authorsLine = c.authors.map((a) => a.name).join(', ');
      const rows = [['title', T('標題', 'Title'), c.title], ['target_journal', T('期刊', 'Journal'), c.journal], ['year', T('年份', 'Year'), c.year], ['authors', T('作者列', 'Authors'), authorsLine]].filter((r) => r[2]);
      panel.innerHTML = `<div class="card" style="margin:4px 0 12px"><p class="small" style="margin-bottom:8px"><b>${T('從 Crossref 找到', 'Found on Crossref')}</b> · ${T('勾選要更新的欄位', 'tick what to update')}</p>` +
        rows.map(([k, label, v]) => { const cur = (form.elements[k] && form.elements[k].value.trim()) || ''; const same = cur === v; return `<label class="f" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px"><input type="checkbox" data-k="${k}" style="width:auto;min-height:0;margin-top:4px"${same ? ' disabled' : ' checked'}><span style="color:var(--ink)"><b>${label}</b> ${esc(v)}<br><small class="muted">${same ? T('和目前相同', 'same as now') : cur ? T('目前：', 'Now: ') + esc(cur.length > 120 ? cur.slice(0, 120) + '…' : cur) : T('目前空白', 'empty now')}</small></span></label>`; }).join('') +
        (c.authors.length ? `<label class="f" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" data-authors style="width:auto;min-height:0;margin-top:4px"><span style="color:var(--ink)">${T(`同時把 ${c.authors.length} 位作者加進共同作者通訊錄和這篇的作者名單`, `Also add the ${c.authors.length} authors to your co-authors and this paper's author list`)}<br><small class="muted">${T('已經在通訊錄的同名作者不會重複建立；單位與 ORCID 來自 Crossref。', 'People already in your list are reused; affiliation and ORCID come from Crossref.')}</small></span></label>` : '') +
        `<button type="button" class="btn sm primary" data-apply>${T('套用勾選的項目', 'Apply ticked items')}</button></div>`;
      panel.querySelector('[data-apply]').onclick = () => {
        panel.querySelectorAll('input[data-k]:checked').forEach((cb) => { const k = cb.dataset.k, v = rows.find((r) => r[0] === k)[2]; if (form.elements[k]) form.elements[k].value = v; });
        const a = panel.querySelector('[data-authors]'); setAuthors(a && a.checked ? c.authors : null);
        panel.innerHTML = `<p class="msg ok">${T('已填入，按「儲存」後生效。', 'Filled in. Press Save to keep it.')}</p>`;
      };
    };
  }
  // add Crossref authors to the directory (reusing people with the same name) and to the paper, in order, after any already there
  async function importAuthors(paperId, list) {
    const norm = (n) => n.trim().toLowerCase().replace(/\s+/g, ' ');
    const have = authorsOf(paperId).map((a) => a.person_id);
    let pos = Math.max(0, ...authorsOf(paperId).map((a) => a.position));
    for (const a of list) {
      let person = D.people.find((x) => norm(x.name) === norm(a.name));
      if (!person) { person = await save('people', { name: a.name.slice(0, 200), affiliation: a.affiliation ? a.affiliation.slice(0, 1000) : null, orcid: a.orcid || null }); if (!person) return; D.people.push(person); }
      if (have.includes(person.id)) continue;
      const row = await save('authors', { paper_id: paperId, person_id: person.id, position: ++pos }); if (!row) return;
      have.push(person.id);
    }
  }

  /* ---------------- cover letter ---------------- */
  const ARTICLE_TYPES = ['Original Article', 'Brief Report', 'Research Letter', 'Systematic Review and Meta-analysis', 'Review', 'Short Communication'];
  const DEFAULT_COVER = [
    '{{date}}', '',
    '{{editor_name}}', '{{editor_title}}', '{{journal}}', '',
    '{{salutation}}', '',
    'We are submitting a manuscript entitled “{{title}}” to be considered for publication in {{journal}}.', '',
    '{{findings}}', '',
    '{{significance}}', '',
    'We believe that this work is scientifically valid, and all authors have sufficiently contributed to data collection, analysis and manuscript preparation. The authors declare no conflict of interest in association with this work.', '',
    'This manuscript is not currently under consideration for publication elsewhere. All authors have read and approved this manuscript. Thank you for your consideration, and we look forward to hearing from you soon.', '',
    'Sincerely Yours,', '',
    '{{corresponding}}', '{{affiliation}}', '{{contact}}', 'E-mail: {{email}}',
  ].join('\n');
  const COVER_FIELDS = '{{date}} {{editor_name}} {{editor_title}} {{journal}} {{salutation}} {{title}} {{type}} {{a_type}} {{findings}} {{significance}} {{corresponding}} {{affiliation}} {{contact}} {{email}}';
  // "Nov. 18, 2026"
  const letterDate = (d) => { const m = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']; return `${m[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
  const coverTemplate = () => (SETTINGS && SETTINGS.cover_template) || DEFAULT_COVER;
  function coverText(p, v) {
    const corr = authorsOf(p.id).map((a) => ({ a, person: byId('people', a.person_id) })).find((x) => x.a.corresponding && x.person);
    const type = (v.type || 'Original Article').trim();
    const editorName = (v.editor_name || '').trim();
    const fill = { date: letterDate(new Date()), editor_name: editorName, editor_title: editorName ? ((v.editor_title || '').trim() || 'Editor-in-Chief') : '',
      salutation: (v.editor || '').trim() || 'Dear Editor:', title: p.title, type, a_type: (/^[aeiou]/i.test(type) ? 'an ' : 'a ') + type, journal: (v.journal || '').trim() || '[journal]', findings: (v.findings || '').trim(), significance: (v.significance || '').trim(),
      corresponding: corr ? corr.person.name + (corr.person.degree ? ', ' + corr.person.degree : '') : '', affiliation: corr ? String(corr.person.affiliation || '').split(';')[0].trim() : '',
      contact: corr && corr.person.contact ? corr.person.contact.trim() : '', email: corr && corr.person.email ? corr.person.email : '' };
    // a line whose fields are all empty is left out, so an unknown fax or e-mail never leaves "E-mail:" behind
    const out = coverTemplate().split('\n').map((line) => {
      const keys = [...line.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).filter((k) => k in fill);
      if (keys.length && keys.every((k) => !fill[k])) return null;
      return line.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in fill ? fill[k] : m));
    }).filter((l) => l !== null).join('\n');
    return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
  function coverDialog(p) {
    const lr = lastRound(p.id);
    const v = Object.assign({ journal: (['reject', 'desk_reject'].includes(lr && lr.decision) ? '' : lr && lr.journal) || p.target_journal || '', type: 'Original Article', editor_name: '', editor_title: '', editor: '', findings: '', significance: '' }, p.cover || {});
    if (!v.journal) v.journal = p.target_journal || '';
    const dlg = document.createElement('dialog'); dlg.style.width = 'min(44rem, calc(100vw - 24px))';
    dlg.innerHTML = `<form method="dialog"><div class="dlg-head">Cover letter</div><div class="dlg-body"><div class="form-grid">
      <label class="f"><span>${T('期刊', 'Journal')}</span><input name="journal" maxlength="300" value="${esc(v.journal)}" list="dl-cv-j"><datalist id="dl-cv-j">${allJournalNames().map((x) => `<option value="${esc(x)}">`).join('')}</datalist></label>
      <label class="f"><span>${T('文章類型', 'Article type')}</span><input name="type" maxlength="100" value="${esc(v.type)}" list="dl-cv-t"><datalist id="dl-cv-t">${ARTICLE_TYPES.map((x) => `<option value="${x}">`).join('')}</datalist></label>
      <label class="f"><span>${T('收件編輯（選填）', 'Editor’s name (optional)')}</span><input name="editor_name" maxlength="200" value="${esc(v.editor_name)}" placeholder="Nina Ditsch, MD, PhD"></label>
      <label class="f"><span>${T('職稱（空白就用 Editor-in-Chief）', 'Title (blank = Editor-in-Chief)')}</span><input name="editor_title" maxlength="200" value="${esc(v.editor_title)}" placeholder="Editor-in-Chief"></label>
      <label class="f full"><span>${T('稱呼（空白就用 Dear Editor:）', 'Salutation (blank = Dear Editor:)')}</span><input name="editor" maxlength="200" value="${esc(v.editor)}" placeholder="Dear Editor:"></label>
      <label class="f full"><span>${T('主要發現（英文）', 'Main findings')}</span><textarea name="findings" rows="3" maxlength="3000">${esc(v.findings)}</textarea></label>
      <label class="f full"><span>${T('資料來源與重要性（英文）', 'Data source and why it matters')}</span><textarea name="significance" rows="3" maxlength="3000">${esc(v.significance)}</textarea></label>
      <label class="f full"><span>${T('信件內容（可以直接修改）', 'Letter (you can edit it here)')}</span><textarea name="out" class="letter" style="min-height:16rem"></textarea></label>
    </div>${authorsOf(p.id).some((a) => a.corresponding) ? '' : `<p class="muted small">${T('在「資料 › 作者與 CRediT」勾選通訊作者，署名（姓名、學位、單位、地址電話、E-mail）會自動帶入。', 'Mark the corresponding author under Details › Authors to fill in the signature (name, degree, affiliation, address and phone, e-mail).')}</p>`}</div>
      <div class="dlg-foot"><button type="button" class="btn" data-copy>${ic('copy')}${T('複製', 'Copy')}</button><button type="button" class="btn" data-docx>${ic('doc')}${T('匯出 Word', 'Export Word')}</button><span class="spacer"></span><button class="btn" value="cancel" formnovalidate>${T('關閉', 'Close')}</button><button class="btn primary" value="save">${T('儲存內容', 'Save inputs')}</button></div></form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector('form'), out = form.elements.out;
    let edited = false;
    const vals = () => ({ journal: form.elements.journal.value, type: form.elements.type.value, editor_name: form.elements.editor_name.value, editor_title: form.elements.editor_title.value, editor: form.elements.editor.value, findings: form.elements.findings.value, significance: form.elements.significance.value });
    const update = () => { if (!edited) out.value = coverText(p, vals()); };
    update();
    ['journal', 'type', 'editor_name', 'editor_title', 'editor', 'findings', 'significance'].forEach((n) => form.elements[n].addEventListener('input', update));
    out.addEventListener('input', () => { edited = true; });
    dlg.querySelector('[data-copy]').onclick = () => navigator.clipboard.writeText(out.value).then(() => toast(T('已複製', 'Copied')), () => toast(T('無法複製', 'Could not copy')));
    dlg.querySelector('[data-docx]').onclick = async () => {
      try { const body = out.value.split('\n').map((line) => DOCX.para(DOCX.run(line), { after: line ? 120 : 0 })).join(''); download(await makeDocx(body), `cover_letter_${(p.short_title || 'paper').replace(/[^\w\-]+/g, '_').slice(0, 40)}.docx`); }
      catch (e) { toast(T('匯出失敗：', 'Export failed: ') + e.message, 6000); }
    };
    form.addEventListener('submit', async (e) => {
      if (!e.submitter || e.submitter.value !== 'save') return;
      e.preventDefault();
      if (await save('papers', { cover: vals() }, p.id)) { p.cover = vals(); toast(T('已儲存，下次打開會記得', 'Saved for next time')); }
    });
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  /* ---------------- yearly numbers ---------------- */
  function yearStats() {
    const years = {}, Y = (y) => (years[y] = years[y] || { newPapers: 0, submissions: 0, accepted: 0, published: 0, rejected: 0, desk: 0, firstDays: [], newProjects: 0, milestones: 0 });
    const yr = (d) => (d ? +String(d).slice(0, 4) : null);
    D.papers.forEach((p) => { const rs = roundsOf(p.id); if (rs.length) Y(yr(rs[0].submitted_on)).newPapers++; if (p.status === 'published' && /^\d{4}$/.test(p.year || '')) Y(+p.year).published++; });
    const firstOf = {};
    D.rounds.forEach((r) => { const k = r.paper_id + '|' + normJ(r.journal); if (!firstOf[k]) firstOf[k] = r; });
    Object.values(firstOf).forEach((r) => { const y = Y(yr(r.submitted_on)); y.submissions++; if (r.decision_on && r.decision !== 'pending') { const d = days(parseDate(r.submitted_on), parseDate(r.decision_on)); if (d >= 0) y.firstDays.push(d); } });
    D.rounds.forEach((r) => { const y = yr(r.decision_on || r.submitted_on); if (r.decision === 'accept' || r.decision === 'pre_proof') Y(y).accepted++; if (r.decision === 'reject') Y(y).rejected++; if (r.decision === 'desk_reject') { Y(y).rejected++; Y(y).desk++; } });
    D.projects.forEach((p) => { Y(yr(p.start_date || p.created_at)).newProjects++; });
    D.milestones.forEach((m) => { if (m.done_on) Y(yr(m.done_on)).milestones++; });
    const med = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
    return Object.keys(years).filter((k) => k !== 'null').map(Number).sort((a, b) => b - a).map((y) => ({ year: y, ...years[y], median: med(years[y].firstDays) }));
  }
  const STAT_COLS = () => [['newPapers', T('新投稿論文', 'New papers submitted')], ['submissions', T('投稿次數（含轉投）', 'Submissions (incl. new journals)')], ['accepted', T('接受', 'Accepted')], ['published', T('發表', 'Published')], ['rejected', T('被拒', 'Rejected')], ['desk', 'Desk reject'], ['median', T('第一次結果中位數（天）', 'First decision, median (days)')], ['newProjects', T('新開的專案', 'New projects')], ['milestones', T('完成的里程碑', 'Milestones done')]];
  function pageStats() {
    const rows = yearStats(), cur = rows[0];
    return ph(T('年度統計', 'Year by year'), { back: '#/', actions: rows.length ? `<button class="btn sm" data-act="stats-xlsx">${ic('doc')}${T('下載 Excel', 'Download Excel')}</button>` : '' }) +
      `<p class="muted small" style="margin-bottom:12px">${T('數字全部來自你自己的紀錄：投稿依第一輪的投稿日、接受和被拒依收到結果的日期、發表依論文的發表年份計算。', 'All numbers come from your own records: submissions by the first submission date, decisions by the date received, publications by the paper’s year.')}</p>` +
      (cur ? `<h2 class="sec-title">${cur.year}</h2><div class="metrics">${STAT_COLS().slice(0, 8).map(([k, l]) => `<div class="metric"><span>${l}</span><b>${cur[k] === null ? '—' : cur[k]}</b></div>`).join('')}</div>` +
        `<h2 class="sec-title">${T('各年度', 'All years')}</h2><div class="tbl-wrap"><table class="codes"><thead><tr><th>${T('年', 'Year')}</th>${STAT_COLS().map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr><td><b>${r.year}</b></td>${STAT_COLS().map(([k]) => `<td>${r[k] === null ? '—' : r[k]}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
        : `<div class="empty">${T('記錄投稿後，這裡會依年份統計。', 'Once you record submissions, yearly numbers appear here.')}</div>`);
  }
  async function statsXlsx() {
    try { await loadXlsx(); } catch (e) { toast(T('無法載入 Excel 元件，請檢查網路', 'Could not load the Excel library; check your connection'), 5000); return; }
    const rows = yearStats().map((r) => { const o = { [T('年', 'Year')]: r.year }; STAT_COLS().forEach(([k, l]) => { o[l] = r[k] === null ? '' : r[k]; }); return o; });
    const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.json_to_sheet(rows), T('年度統計', 'Year by year'));
    download(new Blob([window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `submission_stats_${stamp()}.xlsx`);
  }

  /* ---------------- citation details (the site owner's go to the CV through Pages CMS) ---------------- */
  function citeDialog(p) {
    const lr = lastRound(p.id), journal = lr ? lr.journal : (p.target_journal || '');
    const doi = p.doi ? (/^https?:/i.test(p.doi) ? p.doi : 'https://doi.org/' + p.doi.replace(/^doi:\s*/i, '')) : '';
    const st = { accepted: T('已接受', 'Accepted'), pre_proof: T('已接受（Pre-proof）', 'Accepted (pre-proof)'), published: T('已發表', 'Published') }[p.status] || T('審查中', 'Under review');
    const fields = [[T('標題', 'Title'), p.title], [T('期刊', 'Journal'), journal], [T('作者序', 'Authorship'), p.my_role], [T('狀態', 'Status'), st], [T('年份', 'Year'), p.year], [T('作者列', 'Authors'), p.authors], [T('連結', 'Link'), doi]];
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `<form method="dialog"><div class="dlg-head">${ADMIN ? T('更新到 CV', 'Update CV') : T('書目資料', 'Citation details')}</div><div class="dlg-body"><p class="muted small" style="margin-bottom:8px">${ADMIN ? T('在 Pages CMS 打開「網站內容 › 學術著作」，新增或修改這篇，把各欄複製貼上後儲存。', 'In Pages CMS, open Site content › Publications, add or edit this paper, paste each field and save.') : T('每一欄都可以複製，貼到你的履歷或文獻管理軟體。', 'Copy each field into your CV or reference manager.')}</p>` +
      `<dl class="kv">${fields.map(([k, v], i) => `<dt>${k}</dt><dd class="row" style="justify-content:space-between;flex-wrap:nowrap;align-items:flex-start"><span>${v ? esc(v) : `<span class="muted">${T('（空白）', '(empty)')}</span>`}</span>${v ? `<button type="button" class="btn ghost sm" data-copy="${i}" aria-label="${T('複製', 'Copy')} ${k}">${ic('copy')}</button>` : ''}</dd>`).join('')}</dl></div>` +
      `<div class="dlg-foot">${ADMIN ? `<a class="btn" href="${CMS_URL}" target="_blank" rel="noopener">Pages CMS</a>` : ''}<span class="spacer"></span><button class="btn primary" value="close">${T('完成', 'Done')}</button></div></form>`;
    document.body.appendChild(dlg);
    dlg.querySelectorAll('[data-copy]').forEach((b) => (b.onclick = () => navigator.clipboard.writeText(fields[+b.dataset.copy][1]).then(() => toast(T('已複製', 'Copied')), () => toast(T('無法複製', 'Could not copy')))));
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }


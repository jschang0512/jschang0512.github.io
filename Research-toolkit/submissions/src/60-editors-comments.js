  /* ---------------- editors ---------------- */
  const opt = (map) => Object.entries(map);
  function editProject(p) {
    formDialog({
      title: p ? T('編輯專案', 'Edit project') : T('新增專案', 'New project'), values: p || { stage: 'planning' },
      fields: [
        { name: 'title', label: T('專案名稱', 'Project name'), type: 'textarea', rows: 2, required: true, max: 300, full: true },
        { name: 'short_title', label: T('簡稱（選填，清單上顯示這個）', 'Short name (optional, shown in lists)'), max: 120 },
        { name: 'stage', label: T('階段', 'Stage'), type: 'select', options: opt(STAGE()) },
        { name: 'role', label: T('你的角色', 'Your role'), max: 200, placeholder: T('例如：主要分析者', 'e.g. Lead analyst') },
        { name: 'collaborators', label: T('合作者', 'Collaborators'), max: 2000 },
        { name: 'start_date', label: T('開始日', 'Start date'), type: 'date' },
        { name: 'target_date', label: T('預計完成', 'Target date'), type: 'date' },
        { name: 'notes', label: T('筆記', 'Notes'), type: 'textarea', rows: 4, max: 20000, full: true, placeholder: T('資料期間、納入排除、分析計畫…', 'Data period, eligibility, analysis plan…') },
      ],
      onSave: async (row) => { const s = await save('projects', row, p && p.id); if (!s) return false; toast(T('已儲存', 'Saved')); await refresh(); if (!p) location.hash = '#/project/' + s.id; },
      onDelete: p && (async () => {
        const n = papersOf(p.id).length;
        if (!confirm(T(`要刪除專案「${p.short_title || p.title}」和它的里程碑嗎？${n ? `底下 ${n} 篇論文會保留，只是不再屬於這個專案。` : ''}刪除後無法復原。`, `Delete the project “${p.short_title || p.title}” and its milestones?${n ? ` Its ${n} paper(s) stay, without a project.` : ''} This cannot be undone.`))) return false;
        if (!(await remove('projects', p.id))) return false;
        toast(T('已刪除', 'Deleted')); location.hash = '#/projects'; await refresh(); return true;
      }),
    });
  }
  function editMilestone(projectId, m) {
    formDialog({
      title: m ? T('編輯里程碑', 'Edit milestone') : T('新增里程碑', 'New milestone'), values: m || { kind: 'irb' },
      fields: [
        { name: 'title', label: T('名稱', 'Name'), required: true, max: 300, full: true, placeholder: T('例如：IRB 核准', 'e.g. IRB approved') },
        { name: 'kind', label: T('類型', 'Kind'), type: 'select', options: opt(MS_KIND()) },
        { name: 'ref', label: T('編號（選填）', 'Reference (optional)'), max: 200, placeholder: T('例如：IRB 案號', 'e.g. IRB number') },
        { name: 'due', label: T('目標日', 'Due'), type: 'date' },
        { name: 'done_on', label: T('完成日', 'Done on'), type: 'date' },
        { name: 'expires_on', label: T('有效到（選填）', 'Valid until (optional)'), type: 'date', full: true, help: T('例如 IRB 核准的有效期限；到期前 60 天會出現在總覽。', 'For example the IRB approval end date; it shows on Home 60 days before.') },
        { name: 'notes', label: T('備註', 'Notes'), type: 'textarea', max: 5000, full: true },
      ],
      onSave: async (row) => { if (!m) row.project_id = projectId; if (!(await save('milestones', row, m && m.id))) return false; toast(T('已儲存', 'Saved')); await refresh(); },
      onDelete: m && (async () => { if (!confirm(T(`要刪除「${m.title}」嗎？`, `Delete “${m.title}”?`))) return false; if (!(await remove('milestones', m.id))) return false; toast(T('已刪除', 'Deleted')); await refresh(); return true; }),
    });
  }
  function editPaper(p, projectId) {
    let pendingAuthors = null;
    formDialog({
      title: p ? T('編輯論文', 'Edit paper') : T('新增論文', 'New paper'), values: p || { status: 'planning', project_id: projectId || '' },
      fields: [
        { name: 'title', label: T('標題', 'Title'), type: 'textarea', rows: 2, required: true, max: 500, full: true },
        { name: 'short_title', label: T('簡稱（選填，清單上顯示這個）', 'Short name (optional, shown in lists)'), max: 120 },
        { name: 'status', label: T('狀態', 'Status'), type: 'select', options: opt(STATUS()) },
        { name: 'project_id', label: T('屬於哪個專案', 'Project'), type: 'select', options: [['', T('（不屬於任何專案）', '(none)')], ...D.projects.map((x) => [x.id, x.short_title || x.title])], full: true },
        { name: 'target_journal', label: T('目標期刊', 'Target journal'), max: 300, suggest: allJournalNames() },
        { name: 'deadline', label: T('自訂截止日（選填）', 'Own deadline (optional)'), type: 'date' },
        { name: 'authors', label: T('作者列（選填，逗號分隔）', 'Authors (optional, comma separated)'), type: 'textarea', rows: 2, max: 2000, full: true },
        { name: 'my_role', label: T('你的作者序', 'Your authorship'), max: 100, placeholder: T('例如：第一作者', 'e.g. First author') },
        { name: 'year', label: T('發表年份', 'Year'), max: 10 },
        { name: 'doi', label: 'DOI', max: 300, full: true, placeholder: '10.xxxx/...' },
        { name: 'notes', label: T('備註', 'Notes'), type: 'textarea', max: 10000, full: true },
      ],
      afterOpen: (dlg, form) => doiLookup(dlg, form, (list) => { pendingAuthors = list; }),
      onSave: async (row) => { const s = await save('papers', row, p && p.id); if (!s) return false; if (pendingAuthors) await importAuthors(s.id, pendingAuthors); toast(T('已儲存', 'Saved')); await refresh(); if (!p) location.hash = '#/paper/' + s.id; },
      onDelete: p && (async () => {
        if (!confirm(T(`要刪除「${paperName(p)}」和它的所有投稿紀錄、審稿意見嗎？刪除後無法復原。`, `Delete “${paperName(p)}” with all its rounds and reviewer comments? This cannot be undone.`))) return false;
        if (!(await remove('papers', p.id))) return false;
        toast(T('已刪除', 'Deleted')); location.hash = '#/papers'; await refresh(); return true;
      }),
    });
  }
  // one tap to the next stage, where no decision letter marks it
  const NEXT_STAGE = {
    planning: ['drafting', () => T('→ 開始撰寫', '→ Start writing')],
    submitted: ['admin_check', () => T('→ 行政審查', '→ Administrative check')],
    admin_check: ['under_review', () => T('→ 已送外審（審查中）', '→ Sent to reviewers')],
    accepted: ['pre_proof', () => T('→ Pre-proof', '→ Pre-proof')],
    pre_proof: ['published', () => T('→ 已正式發表', '→ Published')],
  };
  // a new round starts in the administrative check; editing a pending round leaves the stage alone
  const statusFromRound = (r, isNew) => ({ pending: isNew ? 'admin_check' : null, admin_return: 'revision', major: 'revision', minor: 'revision', accept: 'accepted', pre_proof: 'pre_proof', reject: 'rejected', desk_reject: 'rejected', withdrawn: 'withdrawn' }[r.decision] || null);
  function revisionShortcuts(dlg, form) {
    const box = form.elements.revision_due.parentNode, row = document.createElement('div'); row.className = 'quick-days';
    row.innerHTML = [30, 60, 90].map((n) => `<button type="button" class="btn sm ghost" data-days="${n}">${T(`+${n} 天`, `+${n} d`)}</button>`).join('');
    row.onclick = (e) => { const b = e.target.closest('[data-days]'); if (!b) return; const base = parseDate(form.elements.decision_on.value) || today(); form.elements.revision_due.value = localISO(new Date(base.getFullYear(), base.getMonth(), base.getDate() + +b.dataset.days)); };
    box.insertBefore(row, box.querySelector('.help'));
  }
  function editRound(paperId, r) {
    const p = byId('papers', r ? r.paper_id : paperId), rs = roundsOf(p.id), lr = rs[rs.length - 1];
    const def = r || { journal: lr ? (['reject', 'desk_reject'].includes(lr.decision) ? '' : lr.journal) : (p.target_journal || ''), submitted_on: localISO(new Date()), decision: 'pending' };
    formDialog({
      afterOpen: revisionShortcuts,
      title: r ? T(`編輯第 ${rs.indexOf(r) + 1} 輪`, `Edit round ${rs.indexOf(r) + 1}`) : lr ? T('下一輪（修改後再送或轉投）', 'Next round (resubmission or new journal)') : T('記錄投稿', 'Record submission'), values: def,
      fields: [
        { name: 'journal', label: T('期刊', 'Journal'), required: true, max: 300, suggest: allJournalNames() },
        { name: 'submitted_on', label: T('投稿日', 'Submitted'), type: 'date', required: true },
        { name: 'decision', label: T('結果', 'Decision'), type: 'select', options: opt(DECISION()) },
        { name: 'decision_on', label: T('收到結果', 'Decision received'), type: 'date' },
        { name: 'revision_due', label: T('修改稿交回期限（Major／Minor／退回時）', 'Revision due (major, minor or returned)'), type: 'date', help: T('期刊給的期限，會出現在行事曆和總覽。', 'The journal’s deadline; it shows on the calendar and Home.') },
        { name: 'response_on', label: T('送出回覆', 'Response sent'), type: 'date', help: T('修改後重新送審的日期', 'When the revision went back') },
        { name: 'notes', label: T('備註（審查結果原文放在「審稿往來 › 原文」）', 'Notes (the decision letter goes under Reviews › Original)'), type: 'textarea', max: 10000, full: true },
        { name: 'links', label: T('檔案連結（選填）', 'File links (optional)'), type: 'links', help: T('貼上雲端硬碟的分享連結，例如這一輪送出的稿件和回覆信。', 'Paste share links from your cloud storage, e.g. the manuscript and response sent this round.') },
      ],
      onSave: async (row) => {
        if (!r) row.paper_id = p.id;
        const s = await save('rounds', row, r && r.id); if (!s) return false;
        const all = roundsOf(p.id), isLast = all.length && all[all.length - 1].id === s.id, st = isLast ? statusFromRound(s, !r || r.decision !== 'pending') : null;
        if (st && st !== p.status && !((p.status === 'pre_proof' && st === 'accepted') || (p.status === 'published' && ['accepted', 'pre_proof'].includes(st)))) { await save('papers', { status: st }, p.id); toast(T(`已儲存，狀態改成「${STATUS()[st]}」`, `Saved; status is now “${STATUS()[st]}”`)); }
        else toast(T('已儲存', 'Saved'));
        render(true);
      },
      onDelete: r && (async () => {
        const n = commentsOf(r.id).length;
        if (!confirm(T(`要刪除這一輪（${r.journal}）${n ? `和 ${n} 條審稿意見` : ''}嗎？`, `Delete this round (${r.journal})${n ? ` and its ${n} comments` : ''}?`))) return false;
        if (!(await remove('rounds', r.id))) return false; toast(T('已刪除', 'Deleted')); await refresh(); return true;
      }),
    });
  }
  function editDeadline(d) {
    formDialog({
      title: d ? T('編輯截止日', 'Edit deadline') : T('新增截止日', 'New deadline'), values: d || { kind: 'abstract' },
      fields: [
        { name: 'title', label: T('名稱', 'Name'), required: true, max: 300, full: true, placeholder: T('例如：ISPOR 2027 摘要', 'e.g. ISPOR 2027 abstract') },
        { name: 'kind', label: T('類型', 'Kind'), type: 'select', options: opt(DL_KIND()) },
        { name: 'due', label: T('截止日', 'Due'), type: 'date', required: true },
        { name: 'url', label: T('網址（選填）', 'Link (optional)'), type: 'url', max: 1000, full: true },
        { name: 'notes', label: T('備註', 'Notes'), type: 'textarea', max: 5000, full: true },
        { name: 'done', label: T('已完成', 'Done'), type: 'checkbox', full: true },
      ],
      onSave: async (row) => { if (!(await save('deadlines', row, d && d.id))) return false; toast(T('已儲存', 'Saved')); await refresh(); },
      onDelete: d && (async () => { if (!confirm(T(`要刪除「${d.title}」嗎？`, `Delete “${d.title}”?`))) return false; if (!(await remove('deadlines', d.id))) return false; toast(T('已刪除', 'Deleted')); await refresh(); return true; }),
    });
  }
  const REVIEWERS = ['Editor', 'Reviewer 1', 'Reviewer 2', 'Reviewer 3', 'Reviewer 4', 'Reviewer 5'];
  function reviewerOptions(cur) { const list = REVIEWERS.slice(); if (cur && !list.includes(cur)) list.push(cur); return list.map((x) => [x, x]); }
  const nextSeq = (roundId, reviewer) => Math.max(0, ...commentsOf(roundId).filter((c) => c.reviewer === reviewer).map((c) => c.seq)) + 1;
  function editComment(roundId, c) {
    const used = commentsOf(roundId).map((x) => x.reviewer);
    const def = c || { reviewer: used[used.length - 1] || 'Reviewer 1', status: 'todo' };
    if (!c) def.seq = nextSeq(roundId, def.reviewer);
    formDialog({
      title: c ? T('編輯審稿意見', 'Edit comment') : T('新增審稿意見', 'Add comment'), values: def,
      fields: [
        { name: 'reviewer', label: T('誰的意見', 'From'), type: 'select', options: reviewerOptions(def.reviewer) },
        { name: 'seq', label: T('編號', 'Number'), type: 'number' },
        { name: 'comment', label: T('意見內容', 'Comment'), type: 'textarea', rows: 5, required: true, max: 20000, full: true },
        { name: 'response', label: T('你的回覆', 'Your response'), type: 'textarea', rows: 4, max: 20000, full: true },
        { name: 'changes', label: T('修改位置（選填）', 'Where it changed (optional)'), max: 2000, full: true, placeholder: T('例如：p.5, L120–128; Table S4', 'e.g. p.5, L120–128; Table S4') },
        { name: 'status', label: T('狀態', 'Status'), type: 'select', options: opt(C_STATUS()) },
      ],
      onSave: async (row) => {
        if (!row.seq || row.seq < 1) row.seq = nextSeq(roundId, row.reviewer);
        if (!c) row.round_id = roundId;
        if (row.response && row.status === 'todo') row.status = 'draft';
        if (!(await save('comments', row, c && c.id))) return false; toast(T('已儲存', 'Saved')); await refresh();
      },
      onDelete: c && (async () => { if (!confirm(T('要刪除這條意見嗎？', 'Delete this comment?'))) return false; if (!(await remove('comments', c.id))) return false; toast(T('已刪除', 'Deleted')); await refresh(); return true; }),
    });
  }
  // Split pasted reviewer text into comments: at "1." / "2)" / "Comment 3:" markers when there are at least two, else at blank lines
  function splitComments(text) {
    const s = String(text || '').replace(/\r\n?/g, '\n').trim();
    if (!s) return [];
    const re = /^[ \t]*(?:\(?(?:comment|point|q)?\s*#?\s*(\d{1,3})\s*[.)：:、]|\(\s*(\d{1,3})\s*\))[ \t]+/gim;
    const marks = []; let m;
    while ((m = re.exec(s))) marks.push({ i: m.index, end: m.index + m[0].length });
    if (marks.length >= 2) {
      const out = [];
      // text before the first number is kept unless it is only a heading such as “Major comments”
      const pre = s.slice(0, marks[0].i).trim();
      if (pre && (pre.length >= 60 || /[.?!。？！]/.test(pre))) out.push(pre);
      marks.forEach((k, j) => { const t = s.slice(k.end, j + 1 < marks.length ? marks[j + 1].i : s.length).trim(); if (t) out.push(t); });
      return out;
    }
    return s.split(/\n\s*\n+/).map((x) => x.trim()).filter(Boolean);
  }
  // a whole decision letter: sections start at a short heading line such as "Reviewer #1", "Reviewer 2:", "Editor comments"
  function splitLetter(text, fallback) {
    // the sign-off (Sincerely, … and everything after it) is not a comment
    const s = String(text || '').replace(/\r\n?/g, '\n').replace(/\n[ \t]*(?:yours\s+)?(?:sincerely|best regards|kind regards|warm regards|regards|best wishes|with best wishes|yours truly)\b[\s\S]*$/i, '');
    const re = /^[ \t]*(?:comments?\s+(?:from|of|by)\s+)?(?:the\s+)?(?:(?:reviewer|referee)\s*#?\s*(\d{1,2})|(?:(?:associate|academic|handling|section|deputy)\s+)?(editor))\b[^\n]{0,40}$/gim;
    const marks = []; let m;
    while ((m = re.exec(s))) marks.push({ i: m.index, end: m.index + m[0].length, name: m[1] ? 'Reviewer ' + +m[1] : 'Editor' });
    if (!marks.length) return [{ reviewer: fallback, parts: splitComments(s) }];
    const out = [];
    marks.forEach((k, j) => {
      const parts = splitComments(s.slice(k.end, j + 1 < marks.length ? marks[j + 1].i : s.length));
      const same = out.find((x) => x.reviewer === k.name);
      if (same) same.parts.push(...parts); else if (parts.length) out.push({ reviewer: k.name, parts });
    });
    return out;
  }
  // second step: every piece is editable before it is saved — change who it is from, edit, cut, merge, remove or add
  function splitEditor(roundId, items, keep) {
    const dlg = document.createElement('dialog'); dlg.className = 'wide';
    dlg.innerHTML = `<form method="dialog"><div class="dlg-head">${T('檢查切分', 'Check the split')}</div><div class="dlg-body"><p class="muted small" style="margin-bottom:10px">${T('每一條都可以改內容、改成別人的意見；在文字中點一下再按「✂ 從這裡切開」可以拆成兩條，「↑ 併入上一條」可以合併。', 'Edit any piece or change who it is from. Click in the text and use “✂ Split here” to cut it in two, or “↑ Merge up” to join it to the one above.')}</p><div class="sp-list"></div><button type="button" class="btn sm" data-add>${ic('plus')}${T('新增一條', 'Add one')}</button></div><div class="dlg-foot"><button class="btn" value="cancel" formnovalidate>${T('取消', 'Cancel')}</button><span class="spacer"></span><button class="btn primary" value="save" data-ok></button></div></form>`;
    document.body.appendChild(dlg);
    const list = dlg.querySelector('.sp-list'), ok = dlg.querySelector('[data-ok]');
    const names = [...new Set([...REVIEWERS, ...items.map((x) => x.reviewer)])];
    const itemHTML = (x) => `<div class="sp-item"><div class="sp-head"><span class="no"></span><select aria-label="${T('誰的意見', 'From')}">${names.map((n) => `<option${n === x.reviewer ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select><span class="spacer"></span><button type="button" class="btn sm ghost" data-cut aria-label="${T('從這裡切開', 'Split here')}">✂<span class="lbl"> ${T('從這裡切開', 'Split here')}</span></button><button type="button" class="btn sm ghost" data-merge aria-label="${T('併入上一條', 'Merge up')}">↑<span class="lbl"> ${T('併入上一條', 'Merge up')}</span></button><button type="button" class="btn sm ghost icon" data-del aria-label="${T('刪除這一條', 'Remove')}">✕</button></div><textarea class="inp" rows="3" maxlength="20000">${esc(x.text)}</textarea></div>`;
    const fit = (ta) => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 320) + 'px'; };
    const renumber = () => {
      const seq = {}; const els = [...list.children];
      els.forEach((el, i) => { const who = el.querySelector('select').value; seq[who] = seq[who] || nextSeq(roundId, who); el.querySelector('.no').textContent = `${reviewerNo(who)}.${seq[who]++}`; el.querySelector('[data-merge]').disabled = i === 0; });
      const n = els.filter((el) => el.querySelector('textarea').value.trim()).length;
      ok.textContent = T(`加入 ${n} 條`, `Add ${n}`); ok.disabled = !n;
    };
    list.innerHTML = items.map(itemHTML).join('');
    list.querySelectorAll('textarea').forEach(fit);
    list.addEventListener('input', (e) => { if (e.target.tagName === 'TEXTAREA') { fit(e.target); renumber(); } });
    list.addEventListener('change', renumber);
    list.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return; const el = b.closest('.sp-item'), ta = el.querySelector('textarea');
      if (b.hasAttribute('data-del')) el.remove();
      else if (b.hasAttribute('data-merge')) { const prev = el.previousElementSibling; if (!prev) return; const pt = prev.querySelector('textarea'); pt.value = pt.value.trimEnd() + '\n' + ta.value.trim(); fit(pt); el.remove(); }
      else if (b.hasAttribute('data-cut')) {
        const at = ta.selectionStart || 0, a = ta.value.slice(0, at).trim(), rest = ta.value.slice(at).trim();
        if (!a || !rest) { toast(T('先在文字中要切開的地方點一下', 'Click in the text where it should be cut')); ta.focus(); return; }
        ta.value = a; fit(ta);
        el.insertAdjacentHTML('afterend', itemHTML({ reviewer: el.querySelector('select').value, text: rest })); fit(el.nextElementSibling.querySelector('textarea'));
      }
      renumber();
    });
    dlg.querySelector('[data-add]').onclick = () => { const last = list.lastElementChild; list.insertAdjacentHTML('beforeend', itemHTML({ reviewer: last ? last.querySelector('select').value : 'Reviewer 1', text: '' })); renumber(); list.lastElementChild.querySelector('textarea').focus(); };
    renumber();
    dlg.querySelector('form').addEventListener('submit', async (e) => {
      if (!e.submitter || e.submitter.value !== 'save') return;
      e.preventDefault();
      const seq = {}, rows = [];
      [...list.children].forEach((el) => { const t = el.querySelector('textarea').value.trim(), who = el.querySelector('select').value; if (!t) return; seq[who] = seq[who] || nextSeq(roundId, who); rows.push({ round_id: roundId, reviewer: who, seq: seq[who]++, comment: t.slice(0, 20000), status: 'todo' }); });
      if (!rows.length) return;
      ok.disabled = true;
      const r = await sb.from(TABLE.comments).insert(rows);
      if (r.error) { ok.disabled = false; toast(T('儲存失敗：', 'Could not save: ') + r.error.message, 6000); return; }
      // pasted comments are also kept in the round's original text, once
      const rd = byId('rounds', roundId);
      if (keep && rd && !(rd.letter_text || '').includes(keep.text)) {
        const add = keep.secs.length === 1 && keep.secs[0].reviewer === keep.reviewer && !/^\s*(reviewer|referee|editor)/i.test(keep.text) ? keep.reviewer + '\n' + keep.text : keep.text;
        await save('rounds', { letter_text: ((rd.letter_text ? rd.letter_text.trimEnd() + '\n\n' : '') + add).slice(0, 200000) }, roundId);
      }
      REVIEW_VIEW = 'list'; try { localStorage.setItem('tracker-review-view', 'list'); } catch (e2) { /* ignore */ }
      dlg.close();
      toast(T(`已加入 ${rows.length} 條意見`, `${rows.length} comment${rows.length > 1 ? 's' : ''} added`)); await reload();
    });
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }
  function pasteComments(roundId, preset) {
    const used = commentsOf(roundId).map((x) => x.reviewer);
    const dlg = formDialog({
      title: preset != null ? T('從原文產生清單', 'Checklist from the letter') : T('貼上審稿意見', 'Paste reviewer comments'), values: { text: preset || '', reviewer: used.length ? REVIEWERS[Math.min(REVIEWERS.length - 1, REVIEWERS.indexOf(used[used.length - 1]) + 1)] || 'Reviewer 1' : 'Reviewer 1' },
      saveLabel: T('下一步：檢查切分', 'Next: check the split'),
      fields: [
        { name: 'reviewer', label: T('誰的意見（沒有 Reviewer／Editor 標題時）', 'From (when there are no Reviewer / Editor headings)'), type: 'select', options: reviewerOptions() },
        { name: 'text', label: T('整段意見', 'All the comments'), type: 'textarea', rows: 10, required: true, max: 200000, full: true, help: T('有「Reviewer 1」「Editor」標題就分給對應的人，再依「1.」「2.」「Comment 3:」或空行切成一條一條。', 'Headings such as “Reviewer 1” or “Editor” decide who it is from; each part is split at “1.”, “2.”, “Comment 3:” or blank lines.') },
      ],
      onSave: async (row) => {
        const secs = splitLetter(row.text, row.reviewer);
        const items = []; secs.forEach((x) => x.parts.forEach((t) => items.push({ reviewer: x.reviewer, text: t })));
        if (!items.length) { toast(T('沒有找到內容', 'Nothing to add')); return false; }
        splitEditor(roundId, items, preset == null ? { text: row.text.trim(), reviewer: row.reviewer, secs } : null);

      },
    });
    // live count of how the text will be split
    const ta = dlg.querySelector('textarea[name=text]'), help = ta.parentNode.querySelector('.help'), base = help.textContent;
    const who = dlg.querySelector('select[name=reviewer]');
    const count = () => { const secs = splitLetter(ta.value, who.value).filter((x) => x.parts.length); help.textContent = secs.length ? T(`會加入：${secs.map((x) => `${x.reviewer} ${x.parts.length} 條`).join('、')}。`, `Adds ${secs.map((x) => `${x.parts.length} from ${x.reviewer}`).join(', ')}. `) : base; };
    ta.addEventListener('input', count); who.addEventListener('change', count); count();
  }


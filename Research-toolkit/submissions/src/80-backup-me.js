  /* ---------------- backup: export and restore ---------------- */
  // columns that belong in a backup, per table (owner is never exported; the database fills it in on restore)
  const COLS = {
    projects: ['id', 'title', 'short_title', 'stage', 'role', 'collaborators', 'start_date', 'target_date', 'notes', 'created_at', 'updated_at'],
    milestones: ['id', 'project_id', 'title', 'kind', 'due', 'done_on', 'expires_on', 'ref', 'notes', 'created_at'],
    papers: ['id', 'project_id', 'title', 'short_title', 'authors', 'my_role', 'status', 'target_journal', 'deadline', 'doi', 'year', 'notes', 'checklist', 'cover', 'created_at', 'updated_at'],
    rounds: ['id', 'paper_id', 'journal', 'submitted_on', 'decision', 'decision_on', 'revision_due', 'response_on', 'notes', 'links', 'letter_text', 'created_at'],
    comments: ['id', 'round_id', 'reviewer', 'seq', 'comment', 'response', 'changes', 'status', 'created_at', 'updated_at'],
    deadlines: ['id', 'title', 'kind', 'due', 'url', 'done', 'notes', 'created_at'],
    todos: ['id', 'title', 'notes', 'due', 'done_at', 'starred', 'repeat', 'next_id', 'project_id', 'paper_id', 'created_at'],
    journals: ['id', 'name', 'word_limit', 'abstract_limit', 'apc', 'url', 'guideline', 'notes', 'created_at'],
    people: ['id', 'name', 'degree', 'affiliation', 'orcid', 'email', 'contact', 'created_at'],
    authors: ['id', 'paper_id', 'person_id', 'position', 'corresponding', 'roles', 'created_at'],
    peer: ['id', 'journal', 'manuscript', 'ms_id', 'status', 'invited_on', 'due', 'submitted_on', 'round', 'recommendation', 'notes', 'created_at'],
  };
  const pick = (row, cols) => { const o = {}; cols.forEach((c) => { if (row[c] !== undefined) o[c] = row[c]; }); return o; };
  const stamp = () => localISO(new Date()).replace(/-/g, '');
  function exportJson() {
    const data = {}; Object.keys(COLS).forEach((k) => { data[k] = D[k].map((r) => pick(r, COLS[k])); });
    data.settings = SETTINGS ? { checklist_template: SETTINGS.checklist_template, cover_template: SETTINGS.cover_template } : null;
    download(new Blob([JSON.stringify({ app: 'submission-tracker', version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: 'application/json' }), `submission_tracker_${stamp()}.json`);
    toast(T('已下載 JSON 備份', 'JSON backup downloaded'));
  }
  let xlsxPromise = null;
  const loadXlsx = () => (window.XLSX ? Promise.resolve() : xlsxPromise || (xlsxPromise = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = res; s.onerror = () => rej(new Error('SheetJS')); document.head.appendChild(s); })));
  async function exportXlsx() {
    try { await loadXlsx(); } catch (e) { toast(T('無法載入 Excel 元件，請檢查網路', 'Could not load the Excel library; check your connection'), 5000); return; }
    const pName = (id) => { const p = byId('papers', id); return p ? paperName(p) : ''; };
    const jName = (id) => { const p = byId('projects', id); return p ? (p.short_title || p.title) : ''; };
    const roundNo = (r) => roundsOf(r.paper_id).indexOf(r) + 1;
    const sheets = [
      [T('專案', 'Projects'), D.projects.map((p) => ({ [T('名稱', 'Name')]: p.title, [T('簡稱', 'Short name')]: p.short_title, [T('階段', 'Stage')]: STAGE()[p.stage], [T('角色', 'Role')]: p.role, [T('合作者', 'Collaborators')]: p.collaborators, [T('開始', 'Start')]: p.start_date, [T('預計完成', 'Target')]: p.target_date, [T('筆記', 'Notes')]: p.notes }))],
      [T('里程碑', 'Milestones'), D.milestones.map((m) => ({ [T('專案', 'Project')]: jName(m.project_id), [T('名稱', 'Name')]: m.title, [T('類型', 'Kind')]: MS_KIND()[m.kind], [T('目標日', 'Due')]: m.due, [T('完成日', 'Done')]: m.done_on, [T('有效到', 'Valid until')]: m.expires_on, [T('編號', 'Reference')]: m.ref, [T('備註', 'Notes')]: m.notes }))],
      [T('論文', 'Papers'), D.papers.map((p) => ({ [T('標題', 'Title')]: p.title, [T('簡稱', 'Short name')]: p.short_title, [T('狀態', 'Status')]: STATUS()[p.status], [T('專案', 'Project')]: jName(p.project_id), [T('目標期刊', 'Target journal')]: p.target_journal, [T('作者列', 'Authors')]: p.authors, [T('作者序', 'Authorship')]: p.my_role, [T('年份', 'Year')]: p.year, DOI: p.doi, [T('備註', 'Notes')]: p.notes }))],
      [T('投稿輪次', 'Rounds'), D.rounds.map((r) => ({ [T('論文', 'Paper')]: pName(r.paper_id), [T('第幾輪', 'Round')]: roundNo(r), [T('期刊', 'Journal')]: r.journal, [T('投稿日', 'Submitted')]: r.submitted_on, [T('結果', 'Decision')]: DECISION()[r.decision], [T('收到結果', 'Decision on')]: r.decision_on, [T('修改期限', 'Revision due')]: r.revision_due, [T('送出回覆', 'Response sent')]: r.response_on, [T('備註', 'Notes')]: r.notes }))],
      [T('審稿意見', 'Reviewer comments'), D.comments.map((c) => { const r = byId('rounds', c.round_id) || {}; return { [T('論文', 'Paper')]: pName(r.paper_id), [T('輪次', 'Round')]: r.id ? roundNo(r) : '', [T('期刊', 'Journal')]: r.journal, [T('誰', 'From')]: c.reviewer, [T('編號', 'No.')]: c.seq, [T('意見', 'Comment')]: c.comment, [T('回覆', 'Response')]: c.response, [T('修改位置', 'Changes')]: c.changes, [T('狀態', 'Status')]: C_STATUS()[c.status] }; })],
      [T('待辦', 'To-dos'), D.todos.map((t) => ({ [T('名稱', 'Name')]: t.title, [T('日期', 'Date')]: t.due, [T('重複', 'Repeat')]: REPEAT()[t.repeat], [T('重要', 'Important')]: t.starred ? '★' : '', [T('專案', 'Project')]: jName(t.project_id), [T('論文', 'Paper')]: pName(t.paper_id), [T('完成時間', 'Done at')]: t.done_at ? t.done_at.slice(0, 16).replace('T', ' ') : '', [T('備註', 'Notes')]: t.notes }))],
      [T('我審的稿', 'Reviewing'), D.peer.map((r) => ({ [T('期刊', 'Journal')]: r.journal, [T('稿件', 'Manuscript')]: r.manuscript, [T('稿件編號', 'ID')]: r.ms_id, [T('輪次', 'Round')]: r.round, [T('狀態', 'Status')]: PR_STATUS()[r.status], [T('受邀', 'Invited')]: r.invited_on, [T('期限', 'Due')]: r.due, [T('交出', 'Submitted')]: r.submitted_on, [T('建議', 'Recommendation')]: r.recommendation ? PR_REC()[r.recommendation] : '', [T('備註', 'Notes')]: r.notes }))],
      [T('截止日', 'Deadlines'), D.deadlines.map((d) => ({ [T('名稱', 'Name')]: d.title, [T('類型', 'Kind')]: DL_KIND()[d.kind], [T('截止日', 'Due')]: d.due, [T('網址', 'Link')]: d.url, [T('完成', 'Done')]: d.done ? '✓' : '', [T('備註', 'Notes')]: d.notes }))],
      [T('期刊', 'Journals'), D.journals.map((j) => ({ [T('名稱', 'Name')]: j.name, [T('全文字數上限', 'Word limit')]: j.word_limit, [T('摘要字數上限', 'Abstract limit')]: j.abstract_limit, [T('報告指引', 'Guideline')]: j.guideline, APC: j.apc, [T('投稿網址', 'Site')]: j.url, [T('備註', 'Notes')]: j.notes }))],
      [T('共同作者', 'Co-authors'), D.people.map((x) => ({ [T('姓名', 'Name')]: x.name, [T('學位', 'Degree')]: x.degree, [T('單位', 'Affiliation')]: x.affiliation, ORCID: x.orcid, Email: x.email, [T('地址與電話', 'Address and phone')]: x.contact }))],
      [T('作者名單', 'Authorship'), D.authors.slice().sort((a, b) => (a.paper_id > b.paper_id ? 1 : a.paper_id < b.paper_id ? -1 : a.position - b.position)).map((a) => ({ [T('論文', 'Paper')]: pName(a.paper_id), [T('順序', 'Order')]: a.position, [T('姓名', 'Name')]: (byId('people', a.person_id) || {}).name, [T('通訊作者', 'Corresponding')]: a.corresponding ? '✓' : '', CRediT: (a.roles || []).map((k) => (CREDIT.find((c) => c[0] === k) || [k, k])[1]).join('; ') }))],
    ];
    const wb = window.XLSX.utils.book_new();
    sheets.forEach(([name, rows]) => { const ws = window.XLSX.utils.json_to_sheet(rows.length ? rows : [{}]); window.XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); });
    const out = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `submission_tracker_${stamp()}.xlsx`);
    toast(T('已下載 Excel', 'Excel downloaded'));
  }
  function importJson() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const file = inp.files && inp.files[0]; if (!file) return;
      let obj; try { obj = JSON.parse(await file.text()); } catch (e) { toast(T('這不是有效的 JSON 檔', 'This is not a valid JSON file'), 5000); return; }
      if (!obj || obj.app !== 'submission-tracker' || !obj.data) { toast(T('這不是這個系統匯出的備份檔', 'This is not a backup from this tracker'), 5000); return; }
      const d = obj.data, count = (k) => (Array.isArray(d[k]) ? d[k].length : 0);
      const summary = T(`備份日期 ${String(obj.exportedAt || '').slice(0, 10)}：專案 ${count('projects')}、論文 ${count('papers')}、投稿輪次 ${count('rounds')}、審稿意見 ${count('comments')}、截止日 ${count('deadlines')}、待辦 ${count('todos')}、期刊 ${count('journals')}、共同作者 ${count('people')}、我審的稿 ${count('peer')}。`, `Backup from ${String(obj.exportedAt || '').slice(0, 10)}: ${count('projects')} projects, ${count('papers')} papers, ${count('rounds')} rounds, ${count('comments')} comments, ${count('deadlines')} deadlines, ${count('todos')} to-dos, ${count('journals')} journals, ${count('people')} co-authors.`);
      formDialog({
        title: T('從備份還原', 'Restore from backup'), saveLabel: T('開始還原', 'Restore'), values: { mode: 'add' },
        fields: [
          { name: 'mode', label: summary, type: 'select', full: true, options: [['add', T('加入：保留現在的資料，把備份的內容加進來', 'Add: keep what is here and add the backup')], ['replace', T('取代：先刪除現在所有資料，再還原備份', 'Replace: delete everything here, then restore the backup')]] },
          { name: 'confirm', label: T('選「取代」時，請輸入「取代」確認', 'For Replace, type REPLACE to confirm'), max: 20, full: true },
        ],
        onSave: async (row) => {
          if (row.mode === 'replace' && (row.confirm || '').trim() !== T('取代', 'REPLACE')) { toast(T('要取代的話，請在下面輸入「取代」', 'Type REPLACE to replace'), 4000); return false; }
          await restore(d, row.mode === 'replace');
        },
      });
    };
    inp.click();
  }
  async function restore(d, replace) {
    toast(T('還原中…', 'Restoring…'), 60000);
    const fail = (e) => { toast(T('還原中斷：', 'Restore stopped: ') + (e.message || e), 8000); return false; };
    try {
      if (replace) {
        for (const k of ['todos', 'authors', 'comments', 'rounds', 'papers', 'milestones', 'projects', 'deadlines', 'journals', 'people', 'peer']) {
          const r = await sb.from(TABLE[k]).delete().eq('owner', USER.id); if (r.error) throw r.error;
        }
      }
      // fresh ids keep a restore from ever colliding with what is already here
      const map = {}; const nid = (old) => (old ? (map[old] = map[old] || crypto.randomUUID()) : null);
      const existingJournals = replace ? [] : D.journals.map((j) => normJ(j.name));
      const plan = [
        ['people', (r) => ({ ...r, id: nid(r.id) })],
        ['journals', (r) => (existingJournals.includes(normJ(r.name)) ? null : { ...r, id: nid(r.id) })],
        ['projects', (r) => ({ ...r, id: nid(r.id) })],
        ['milestones', (r) => ({ ...r, id: nid(r.id), project_id: map[r.project_id] })],
        ['papers', (r) => ({ ...r, id: nid(r.id), project_id: r.project_id ? map[r.project_id] || null : null })],
        ['authors', (r) => (map[r.paper_id] && map[r.person_id] ? { ...r, id: nid(r.id), paper_id: map[r.paper_id], person_id: map[r.person_id] } : null)],
        ['rounds', (r) => (map[r.paper_id] ? { ...r, id: nid(r.id), paper_id: map[r.paper_id] } : null)],
        ['comments', (r) => (map[r.round_id] ? { ...r, id: nid(r.id), round_id: map[r.round_id] } : null)],
        ['deadlines', (r) => ({ ...r, id: nid(r.id) })],
        ['peer', (r) => ({ ...r, id: nid(r.id) })],
        ['todos', (r) => ({ ...r, id: nid(r.id), next_id: r.next_id ? nid(r.next_id) : null, project_id: r.project_id ? map[r.project_id] || null : null, paper_id: r.paper_id ? map[r.paper_id] || null : null })],
      ];
      let total = 0;
      for (const [k, fix] of plan) {
        const rows = (Array.isArray(d[k]) ? d[k] : []).map((r) => pick(r, COLS[k])).map(fix).filter(Boolean);
        for (let i = 0; i < rows.length; i += 200) { const r = await sb.from(TABLE[k]).insert(rows.slice(i, i + 200)); if (r.error) throw r.error; }
        total += rows.length;
      }
      if (d.settings && (replace || !SETTINGS)) { const r = await sb.from('research_settings').upsert({ owner: USER.id, checklist_template: d.settings.checklist_template || null, cover_template: d.settings.cover_template || null }); if (r.error) throw r.error; }
      await reload();
      toast(T(`還原完成，共 ${total} 筆`, `Restored ${total} records`), 4000);
    } catch (e) { console.error(e); await reload(); return fail(e); }
  }

  /* ---------------- "Me" page bindings ---------------- */
  function bindMe() {
    $('f-cover').addEventListener('submit', async (e) => {
      e.preventDefault();
      const tpl = e.target.tpl.value.trim();
      const r = await sb.from('research_settings').upsert({ owner: USER.id, checklist_template: SETTINGS ? SETTINGS.checklist_template : null, cover_template: tpl || null, updated_at: new Date().toISOString() }).select().single();
      if (r.error) { toast(T('儲存失敗：', 'Could not save: ') + r.error.message, 6000); return; }
      SETTINGS = r.data; toast(T('範本已儲存', 'Template saved'));
    });
    $('f-template').addEventListener('submit', async (e) => {
      e.preventDefault();
      const items = e.target.items.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 60);
      if (!items.length) { toast(T('清單至少要有一項', 'Keep at least one item')); return; }
      const r = await sb.from('research_settings').upsert({ owner: USER.id, checklist_template: items, cover_template: SETTINGS ? SETTINGS.cover_template : null, updated_at: new Date().toISOString() }).select().single();
      if (r.error) { toast(T('儲存失敗：', 'Could not save: ') + r.error.message, 6000); return; }
      SETTINGS = r.data; toast(T('範本已儲存', 'Template saved'));
    });
    $('f-pw').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      if (f.password.value.length < 8) { toast(T('密碼至少 8 個字元', 'Use at least 8 characters')); return; }
      if (f.password.value !== f.password2.value) { toast(T('兩次輸入的密碼不一樣', 'The passwords do not match')); return; }
      const { error } = await sb.auth.updateUser({ password: f.password.value });
      if (error) { toast(friendly(error), 5000); return; }
      f.reset(); toast(T('密碼已變更', 'Password changed'));
    });
    if (!ADMIN) return;
    loadCodes();
    $('f-code').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target, uses = parseInt(f.uses.value, 10), dd = parseInt(f.days.value, 10);
      const { data, error } = await sb.rpc('create_invite_code', { p_label: f.label.value, p_max_uses: uses > 0 ? uses : null, p_expires_days: dd > 0 ? dd : null });
      if (error) { toast(friendly(error), 5000); return; }
      $('newcode').innerHTML = `<div class="newcode"><b>${esc(data)}</b><button type="button" class="btn sm" id="copy-code">${ic('copy')}${T('複製', 'Copy')}</button><small>${T('這組邀請碼只會顯示這一次，請現在複製給對方。', 'This code is shown only once. Copy it now.')}</small></div>`;
      $('copy-code').onclick = () => navigator.clipboard.writeText(data).then(() => toast(T('已複製', 'Copied')));
      f.label.value = '';
      loadCodes();
    });
  }
  async function loadCodes() {
    const { data, error } = await sb.from('invite_codes').select('id,hint,label,max_uses,uses,expires_at,disabled,grants_admin,created_at').order('created_at', { ascending: false });
    const host = $('codes'); if (!host) return;
    if (error) { host.innerHTML = `<tr><td colspan="5">${esc(error.message)}</td></tr>`; return; }
    const now = Date.now();
    host.innerHTML = data.length ? data.map((c) => {
      const expired = c.expires_at && Date.parse(c.expires_at) < now, full = c.max_uses != null && c.uses >= c.max_uses, off = c.disabled || expired || full;
      const state = c.disabled ? T('已停用', 'Off') : expired ? T('已過期', 'Expired') : full ? T('已用完', 'Used up') : '';
      return `<tr class="${off ? 'off' : ''}"><td><code>${esc(c.hint)}-····</code>${c.grants_admin ? ` <span class="chip">${T('管理員', 'Admin')}</span>` : ''}</td><td>${esc(c.label || '')}</td><td>${c.uses}${c.max_uses != null ? ' / ' + c.max_uses : ''}</td><td>${c.expires_at ? ymd(c.expires_at.slice(0, 10)) : T('不限', 'Never')}${state ? ' · ' + state : ''}</td>` +
        `<td style="text-align:right">${expired || full ? '' : `<button class="btn sm" data-act="toggle-code" data-id="${c.id}" data-off="${c.disabled ? '0' : '1'}">${c.disabled ? T('重新啟用', 'Turn on') : T('停用', 'Turn off')}</button>`}</td></tr>`;
    }).join('') : `<tr><td colspan="5" class="muted">${T('還沒有邀請碼。', 'No codes yet.')}</td></tr>`;
  }


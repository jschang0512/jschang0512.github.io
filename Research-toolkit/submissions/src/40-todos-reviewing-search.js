  /* ---------------- to-dos ---------------- */
  const REPEAT = () => ({ none: T('不重複', 'Once'), daily: T('每天', 'Daily'), weekly: T('每週', 'Weekly'), monthly: T('每月', 'Monthly') });
  const todosSeg = (which) => `<div class="seg" role="tablist" style="margin-bottom:12px"><a role="tab" href="#/todos" aria-selected="${which === 'todos'}">${T('待辦', 'To-dos')}</a><a role="tab" href="#/deadlines" aria-selected="${which === 'deadlines'}">${T('截止日', 'Deadlines')}</a></div>`;
  function dueLabel(d) {
    if (!d) return T('沒有日期', 'No date');
    const left = days(today(), parseDate(d));
    if (left === 0) return `<span class="warn">${T('今天', 'Today')}</span>`;
    if (left === 1) return T('明天', 'Tomorrow');
    if (left < 0) return `<span class="late">${T(`已過 ${-left} 天`, `${-left} d overdue`)}</span>`;
    return md(d);
  }
  function todoRow(t, opts = {}) {
    const meta = [];
    if (!t.done_at) meta.push(dueLabel(t.due)); else meta.push(T(`完成於 ${md(localISO(new Date(t.done_at)))}`, `Done ${md(localISO(new Date(t.done_at)))}`));
    if (t.repeat && t.repeat !== 'none') meta.push(`${ic('repeat')}${esc(REPEAT()[t.repeat])}`);
    const pr = !opts.inProject && t.project_id && byId('projects', t.project_id), pa = !opts.inPaper && t.paper_id && byId('papers', t.paper_id);
    if (pr) meta.push(esc(pr.short_title || pr.title)); if (pa) meta.push(esc(paperName(pa)));
    if (t.notes) meta.push(T('有備註', 'notes'));
    return `<div class="todo${t.done_at ? ' done' : ''}" id="todo-${t.id}"><button type="button" class="tick" data-act="todo-done" data-id="${t.id}" aria-label="${t.done_at ? T('改回未完成', 'Mark not done') : T('完成', 'Done')}" aria-pressed="${!!t.done_at}">${t.done_at ? ic('check') : ''}</button>` +
      `<button type="button" class="todo-main" data-act="edit-todo" data-id="${t.id}"><b>${esc(t.title)}</b><small>${meta.join(' · ')}</small></button>` +
      `<button type="button" class="star${t.starred ? ' on' : ''}" data-act="todo-star" data-id="${t.id}" aria-label="${T('重要', 'Important')}" aria-pressed="${t.starred}">${t.starred ? '★' : '☆'}</button></div>`;
  }
  const byStarDue = (a, b) => (b.starred - a.starred) || ((parseDate(a.due) || Infinity) - (parseDate(b.due) || Infinity)) || (a.created_at > b.created_at ? 1 : -1);
  function pageTodos() {
    const t = today(), open = D.todos.filter((x) => !x.done_at), done = D.todos.filter((x) => x.done_at).sort((a, b) => (a.done_at < b.done_at ? 1 : -1));
    const g = { late: [], now: [], later: [], none: [] };
    open.forEach((x) => { if (!x.due) g.none.push(x); else { const l = days(t, parseDate(x.due)); g[l < 0 ? 'late' : l === 0 ? 'now' : 'later'].push(x); } });
    const block = (label, arr) => (arr.length ? `<h2 class="sec-title">${label} <small>${arr.length}</small></h2><div class="todos">${arr.sort(byStarDue).map((x) => todoRow(x)).join('')}</div>` : '');
    return ph(T('待辦', 'To-dos')) + todosSeg('todos') +
      `<form class="quick" id="f-todo" autocomplete="off"><input class="inp" name="title" maxlength="300" placeholder="${T('＋ 新增待辦…', '+ Add a to-do…')}" aria-label="${T('新增待辦', 'New to-do')}"><input class="inp" type="date" name="due" aria-label="${T('日期（選填）', 'Date (optional)')}"><button class="btn primary" type="submit">${T('加入', 'Add')}</button></form>` +
      (open.length ? block(T('已過期', 'Overdue'), g.late) + block(T('今天', 'Today'), g.now) + block(T('之後', 'Coming up'), g.later) + block(T('沒有日期', 'No date'), g.none)
        : `<div class="empty" style="margin-top:12px">${T('不管是不是跟研究有關，想到要做的事就丟進來。可以設日期、標星號、每天／每週／每月重複。', 'Anything you need to do, research or not. Add a date, star it, or make it repeat daily, weekly or monthly.')}</div>`) +
      (done.length ? `<details class="fold"><summary>${T('已完成', 'Done')} (${done.length})</summary><div class="todos">${done.slice(0, 60).map((x) => todoRow(x)).join('')}</div>${done.length > 60 ? `<p class="muted small">${T('只顯示最近 60 項；全部可以從「我的 › 資料備份」下載。', 'Showing the latest 60; download everything from Me › Backup.')}</p>` : ''}</details>` : '');
  }
  function todoBlock(link) {
    const list = D.todos.filter((x) => !x.done_at && (link.project ? x.project_id === link.project : x.paper_id === link.paper)).sort(byStarDue);
    return `<h2 class="sec-title">${T('待辦', 'To-dos')}<button class="btn sm right" data-act="new-todo" ${link.project ? `data-project="${link.project}"` : `data-paper="${link.paper}"`}>${ic('plus')}${T('待辦', 'To-do')}</button></h2>` +
      (list.length ? `<div class="todos">${list.map((x) => todoRow(x, { inProject: !!link.project, inPaper: !!link.paper })).join('')}</div>` : `<p class="muted small">${T('沒有未完成的待辦。', 'No open to-dos.')}</p>`);
  }
  function editTodo(t, link = {}) {
    formDialog({
      title: t ? T('編輯待辦', 'Edit to-do') : T('新增待辦', 'New to-do'),
      values: t || { repeat: 'none', project_id: link.project || '', paper_id: link.paper || '' },
      fields: [
        { name: 'title', label: T('要做什麼', 'What'), required: true, max: 300, full: true },
        { name: 'due', label: T('日期（選填）', 'Date (optional)'), type: 'date' },
        { name: 'repeat', label: T('重複', 'Repeat'), type: 'select', options: opt(REPEAT()), help: T('重複的待辦完成後，會自動產生下一次。', 'When a repeating to-do is done, the next one is created.') },
        { name: 'starred', label: T('重要（排在最前面）', 'Important (listed first)'), type: 'checkbox', full: true },
        { name: 'project_id', label: T('專案（選填）', 'Project (optional)'), type: 'select', options: [['', T('（不屬於任何專案）', '(none)')], ...D.projects.map((x) => [x.id, x.short_title || x.title])] },
        { name: 'paper_id', label: T('論文（選填）', 'Paper (optional)'), type: 'select', options: [['', T('（不屬於任何論文）', '(none)')], ...D.papers.map((x) => [x.id, paperName(x)])] },
        { name: 'notes', label: T('備註', 'Notes'), type: 'textarea', max: 5000, full: true },
      ],
      onSave: async (row) => {
        if (row.repeat !== 'none' && !row.due) row.due = localISO(today());
        if (!(await save('todos', row, t && t.id))) return false;
        toast(T('已儲存', 'Saved')); await refresh();
      },
      onDelete: t && (async () => { if (!confirm(T(`要刪除「${t.title}」嗎？`, `Delete “${t.title}”?`))) return false; if (!(await remove('todos', t.id))) return false; toast(T('已刪除', 'Deleted')); await refresh(); return true; }),
    });
  }
  // next date for a repeating to-do: one step from its date, and never in the past
  function nextDue(due, repeat) {
    const step = (d) => { const x = new Date(d); if (repeat === 'daily') x.setDate(x.getDate() + 1); else if (repeat === 'weekly') x.setDate(x.getDate() + 7); else { const day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + 1); x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); } return x; };
    let n = step(parseDate(due) || today()); const t = today();
    while (n < t) n = step(n);
    return localISO(n);
  }
  async function toggleTodo(t) {
    if (t.done_at) {
      // undoing a repeating to-do also takes back the next one it created, if that is still open
      if (t.next_id) { const nx = byId('todos', t.next_id); if (nx && !nx.done_at) await remove('todos', nx.id); }
      if (await save('todos', { done_at: null, next_id: null }, t.id)) await refresh();
      return;
    }
    let nextId = null;
    if (t.repeat !== 'none') {
      const nx = await save('todos', { title: t.title, notes: t.notes, starred: t.starred, repeat: t.repeat, project_id: t.project_id, paper_id: t.paper_id, due: nextDue(t.due, t.repeat) });
      if (!nx) return; nextId = nx.id;
      toast(T(`完成！下一次：${md(nx.due)}`, `Done. Next: ${md(nx.due)}`));
    }
    if (await save('todos', { done_at: new Date().toISOString(), next_id: nextId }, t.id)) await refresh();
  }

  function pageDeadlines() {
    const t = today();
    const up = D.deadlines.filter((d) => !d.done && days(t, parseDate(d.due)) >= -1), past = D.deadlines.filter((d) => d.done || days(t, parseDate(d.due)) < -1).reverse();
    const row = (d) => { const left = days(t, parseDate(d.due)); const cls = d.done ? '' : left < 0 ? 'late' : left <= 7 ? 'soon' : '';
      return `<a class="ag" href="#" data-act="edit-deadline" data-id="${d.id}"><span class="when ${cls}">${d.done ? T('已完成', 'Done') : left === 0 ? T('今天', 'Today') : left < 0 ? T('已過期', 'Past') : T(`剩 ${left} 天`, `In ${left} d`)}<small>${ymd(d.due)}</small></span><span class="what"><b>${esc(d.title)}</b><small>${esc(DL_KIND()[d.kind])}${d.url ? ' · ' + esc(d.url.replace(/^https?:\/\//, '').slice(0, 40)) : ''}</small></span><span class="chev">${ic('chev')}</span></a>`; };
    return ph(T('截止日', 'Deadlines'), { actions: `<button class="btn primary sm" data-act="new-deadline">${ic('plus')}${T('截止日', 'Deadline')}</button>` }) + todosSeg('deadlines') +
      (up.length ? `<div class="agenda">${up.map(row).join('')}</div>` : `<div class="empty">${T('研討會摘要、計畫申請等截止日記在這裡，60 天內會出現在總覽。', 'Conference abstracts, grants and other deadlines go here; they show on Home within 60 days.')}</div>`) +
      (past.length ? `<details class="fold"><summary>${T('完成或過期', 'Done or past')} (${past.length})</summary><div class="agenda">${past.map(row).join('')}</div></details>` : '');
  }

  /* ---------------- reviews I do for journals ---------------- */
  const PR_STATUS = () => ({ invited: T('受邀', 'Invited'), accepted: T('審稿中', 'Reviewing'), submitted: T('已交出', 'Submitted'), declined: T('婉拒', 'Declined') });
  const PR_CHIP = { invited: 'warn', accepted: 'violet', submitted: 'ok', declined: 'dim' };
  const PR_REC = () => ({ accept: 'Accept', minor: 'Minor revision', major: 'Major revision', reject: 'Reject' });
  function peerRow(r) {
    const t = today(), open = ['invited', 'accepted'].includes(r.status), left = r.due ? days(t, parseDate(r.due)) : null;
    const when = open ? (left === null ? T('沒有期限', 'No date') : left < 0 ? T(`已過 ${-left} 天`, `${-left} d late`) : left === 0 ? T('今天', 'Today') : T(`剩 ${left} 天`, `In ${left} d`)) : r.status === 'submitted' ? ymd(r.submitted_on) : T('婉拒', 'Declined');
    const cls = open && left !== null ? (left < 0 ? 'late' : left <= 3 ? 'soon' : '') : '';
    const sub = [r.manuscript, r.ms_id, r.round > 1 ? T(`第 ${r.round} 輪`, `Round ${r.round}`) : '', r.recommendation ? PR_REC()[r.recommendation] : ''].filter(Boolean).map(esc).join(' · ');
    return `<a class="ag" href="#" data-act="edit-peer" data-id="${r.id}"><span class="when ${cls}"${open ? '' : ' style="color:var(--muted)"'}>${when}${open && r.due ? `<small>${md(r.due)}</small>` : ''}</span><span class="what"><b>${esc(r.journal)}</b><small>${open ? `<span class="chip ${PR_CHIP[r.status]}">${esc(PR_STATUS()[r.status])}</span> ` : ''}${sub || '&nbsp;'}</small></span><span class="chev">${ic('chev')}</span></a>`;
  }
  // "Peer reviewer for" lines for a CV: completed reviews, by journal, overall and per year
  function peerCv() {
    const done = D.peer.filter((r) => r.status === 'submitted');
    const tally = (arr) => { const m = {}; arr.forEach((r) => { m[r.journal] = (m[r.journal] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); };
    const line = (arr) => tally(arr).map(([j, n]) => (n > 1 ? `${j} (${n})` : j)).join('; ');
    const years = [...new Set(done.map((r) => (r.submitted_on || r.created_at || '').slice(0, 4)).filter(Boolean))].sort().reverse();
    return { n: done.length, all: done.length ? 'Peer reviewer for: ' + line(done) + '.' : '', years: years.map((y) => { const a = done.filter((r) => (r.submitted_on || r.created_at || '').startsWith(y)); return `${y}: ${a.length} review${a.length > 1 ? 's' : ''} — ${line(a)}`; }) };
  }
  function pageReviewing() {
    const open = D.peer.filter((r) => ['invited', 'accepted'].includes(r.status)).sort((a, b) => (parseDate(a.due) || Infinity) - (parseDate(b.due) || Infinity));
    const done = D.peer.filter((r) => r.status === 'submitted').sort((a, b) => ((a.submitted_on || '') < (b.submitted_on || '') ? 1 : -1));
    const declined = D.peer.filter((r) => r.status === 'declined');
    const cv = peerCv();
    return ph(T('我審的稿', 'Reviewing for journals'), { actions: `<button class="btn primary sm" data-act="new-peer">${ic('plus')}${T('審稿邀請', 'Invitation')}</button>` }) + papersSeg('reviewing') +
      (D.peer.length ? '' : `<div class="empty" style="margin-top:12px">${T('期刊請你審稿時記一筆：哪本期刊、期限、交出日期。期限會出現在行事曆，年底可以複製一段「Peer reviewer for …」放進 CV。', 'Log each invitation to review: journal, due date, when you sent it. Due dates go on the calendar, and you can copy a “Peer reviewer for …” line for your CV.')}</div>`) +
      (open.length ? `<h2 class="sec-title">${T('進行中', 'In progress')} <small>${open.length}</small></h2><div class="agenda">${open.map(peerRow).join('')}</div>` : '') +
      (cv.n ? `<h2 class="sec-title">${T('放進 CV', 'For your CV')} <small>${T(`已完成 ${cv.n} 次審稿`, `${cv.n} completed reviews`)}</small></h2><div class="card"><p class="cv-line" id="peer-cv">${esc(cv.all)}</p><ul class="cv-years">${cv.years.map((y) => `<li>${esc(y)}</li>`).join('')}</ul><div class="row" style="margin-top:8px"><button class="btn sm" data-act="copy-peer-cv">${ic('copy')}${T('複製', 'Copy')}</button></div></div>` : '') +
      (done.length ? `<h2 class="sec-title">${T('已交出', 'Submitted')} <small>${done.length}</small></h2><div class="agenda">${done.map(peerRow).join('')}</div>` : '') +
      (declined.length ? `<details class="fold"><summary>${T('婉拒', 'Declined')} (${declined.length})</summary><div class="agenda">${declined.map(peerRow).join('')}</div></details>` : '');
  }
  function editPeer(r) {
    formDialog({
      title: r ? T('編輯審稿紀錄', 'Edit review') : T('新增審稿邀請', 'New invitation to review'),
      values: r || { status: 'invited', round: 1, invited_on: localISO(today()) },
      fields: [
        { name: 'journal', label: T('期刊', 'Journal'), required: true, max: 300, suggest: allJournalNames() },
        { name: 'status', label: T('狀態', 'Status'), type: 'select', options: opt(PR_STATUS()) },
        { name: 'manuscript', label: T('稿件標題（選填）', 'Manuscript title (optional)'), max: 500, full: true },
        { name: 'ms_id', label: T('稿件編號（選填）', 'Manuscript ID (optional)'), max: 100 },
        { name: 'round', label: T('第幾輪', 'Round'), type: 'number' },
        { name: 'invited_on', label: T('受邀日', 'Invited'), type: 'date' },
        { name: 'due', label: T('審稿期限', 'Due'), type: 'date' },
        { name: 'submitted_on', label: T('交出日', 'Submitted'), type: 'date' },
        { name: 'recommendation', label: T('你的建議（選填）', 'Your recommendation (optional)'), type: 'select', options: [['', '—'], ...opt(PR_REC())] },
        { name: 'notes', label: T('備註', 'Notes'), type: 'textarea', max: 10000, full: true },
      ],
      onSave: async (row) => {
        if (!row.round || row.round < 1) row.round = 1;
        if (row.status === 'submitted' && !row.submitted_on) row.submitted_on = localISO(today());
        if (!(await save('peer', row, r && r.id))) return false; toast(T('已儲存', 'Saved')); await refresh();
      },
      onDelete: r && (async () => { if (!confirm(T(`要刪除這筆 ${r.journal} 的審稿紀錄嗎？`, `Delete this review for ${r.journal}?`))) return false; if (!(await remove('peer', r.id))) return false; toast(T('已刪除', 'Deleted')); await refresh(); return true; }),
    });
  }

  /* ---------------- answers: every response written so far, searchable and reusable ---------------- */
  const STOP = new Set('the and for that with this are was were from have has not but please authors author should would could also more than into which their there these those about your study table figure manuscript paper data results result analysis'.split(' '));
  const words = (t) => [...new Set(String(t || '').toLowerCase().match(/[a-z][a-z\-]{3,}|[\u4e00-\u9fff]{2,}/g) || [])].filter((w) => !STOP.has(w));
  function answerPool(exceptId) {
    return D.comments.filter((c) => c.response && c.response.trim() && c.id !== exceptId).map((c) => { const r = byId('rounds', c.round_id) || {}, p = r.paper_id && byId('papers', r.paper_id); return { c, r, p, hay: (c.comment + ' ' + c.response + ' ' + (c.changes || '')).toLowerCase() }; });
  }
  function findAnswers(q, like, exceptId) {
    const pool = answerPool(exceptId), terms = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length) return pool.filter((x) => terms.every((w) => x.hay.includes(w)));
    if (like) { const base = words(like); return pool.map((x) => ({ ...x, score: words(x.c.comment).filter((w) => base.includes(w)).length })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 8); }
    return pool.slice().reverse();
  }
  const mark = (text, q) => { let h = esc(text); String(q || '').split(/\s+/).filter((w) => w.length > 1).forEach((w) => { h = h.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>'); }); return h; };
  function answerCard(x, q, reuseFor) {
    const where = [x.p ? paperName(x.p) : '', x.r.journal, `${x.c.reviewer} ${x.c.seq}`].filter(Boolean).map(esc).join(' · ');
    return `<div class="ans"><div class="ans-q">${mark(x.c.comment, q)}</div><div class="ans-a">${mark(x.c.response, q)}</div><div class="ans-foot"><small>${where}</small>` +
      (reuseFor ? `<button type="button" class="btn sm primary" data-reuse="${x.c.id}">${T('帶入', 'Use this')}</button>` : `<button type="button" class="btn sm" data-act="copy-answer" data-id="${x.c.id}">${ic('copy')}${T('複製回覆', 'Copy')}</button>${x.p ? `<a class="btn sm ghost" href="#/paper/${x.p.id}/reviews?round=${x.r.id}">${T('看原文', 'Open')}</a>` : ''}`) + '</div></div>';
  }
  let ANS_Q = '';
  function pageAnswers() {
    const n = answerPool().length;
    return ph(T('回覆庫', 'Answer library')) + papersSeg('answers') +
      `<div class="ans-search"><input class="inp" type="search" id="ans-q" data-act="ans-q" value="${esc(ANS_Q)}" placeholder="${T('搜尋意見或回覆，例如 E-value、missing data、敏感度分析', 'Search comments and replies, e.g. E-value, missing data')}" aria-label="${T('搜尋回覆', 'Search replies')}"><p class="muted small" id="ans-n"></p></div><div id="ans-list">${n ? '' : `<div class="empty">${T('寫過的審稿回覆都會收在這裡，之後遇到類似的意見可以搜尋、複製，或在回覆時直接帶入。', 'Every reply you write to reviewers collects here, so you can search, copy or reuse it when a similar comment comes up.')}</div>`}</div>`;
  }
  function paintAnswers() {
    const box = $('ans-list'); if (!box || !answerPool().length) return;
    const list = findAnswers(ANS_Q);
    $('ans-n').textContent = ANS_Q ? T(`找到 ${list.length} 則`, `${list.length} found`) : T(`共 ${list.length} 則回覆`, `${list.length} replies`);
    box.innerHTML = list.length ? list.slice(0, 100).map((x) => answerCard(x, ANS_Q)).join('') : `<div class="empty">${T('沒有符合的回覆。', 'No matching replies.')}</div>`;
  }
  // pick an earlier reply and put it in this comment's response box
  function reuseDialog(c) {
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `<form method="dialog"><div class="dlg-head">${T('從回覆庫帶入', 'Reuse an earlier reply')}</div><div class="dlg-body"><div class="ans-ref">${esc(c.comment)}</div><input class="inp" type="search" placeholder="${T('搜尋，或直接看下面相似的意見', 'Search, or pick from similar comments below')}" aria-label="${T('搜尋回覆', 'Search replies')}"><p class="muted small" data-n style="margin:6px 2px"></p><div data-list></div></div><div class="dlg-foot"><span class="spacer"></span><button class="btn" value="cancel">${T('取消', 'Cancel')}</button></div></form>`;
    document.body.appendChild(dlg);
    const inp = dlg.querySelector('input'), list = dlg.querySelector('[data-list]'), n = dlg.querySelector('[data-n]');
    const paint = () => { const q = inp.value.trim(), xs = findAnswers(q, q ? '' : c.comment, c.id); n.textContent = q ? T(`找到 ${xs.length} 則`, `${xs.length} found`) : xs.length ? T('和這條意見相似的舊回覆：', 'Earlier replies to similar comments:') : T('沒有找到相似的，試試搜尋。', 'Nothing similar; try searching.'); list.innerHTML = xs.slice(0, 40).map((x) => answerCard(x, q, true)).join(''); };
    inp.addEventListener('input', paint);
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-reuse]'); if (!b) return;
      const src = byId('comments', b.dataset.reuse), ta = $('resp-' + c.id); if (!src || !ta) return;
      ta.value = ta.value.trim() ? ta.value.trimEnd() + '\n\n' + src.response : src.response;
      ta.dispatchEvent(new Event('input', { bubbles: true })); dlg.close(); ta.focus(); toast(T('已帶入，可以再修改', 'Added; edit as needed'));
    });
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal(); paint(); inp.focus();
  }

  /* ---------------- search everything ---------------- */
  let SEARCH_Q = '';
  function snip(text, q) {
    const t = String(text || '').replace(/\s+/g, ' '), i = t.toLowerCase().indexOf(q);
    if (i < 0) return t.slice(0, 90) + (t.length > 90 ? '…' : '');
    const a = Math.max(0, i - 30); return (a ? '…' : '') + t.slice(a, a + 100) + (a + 100 < t.length ? '…' : '');
  }
  function searchAll(q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean), first = terms[0] || '';
    const hit = (...fields) => { const h = fields.filter(Boolean).join(' ').toLowerCase(); return terms.every((w) => h.includes(w)); };
    const g = [];
    const add = (label, rows) => { if (rows.length) g.push([label, rows]); };
    add(T('專案', 'Projects'), D.projects.filter((p) => hit(p.title, p.short_title, p.collaborators, p.role, p.notes)).map((p) => ({ href: '#/project/' + p.id, title: p.short_title || p.title, sub: STAGE()[p.stage] + (p.notes && hit(p.notes) ? ' · ' + snip(p.notes, first) : '') })));
    add(T('論文', 'Papers'), D.papers.filter((p) => hit(p.title, p.short_title, p.authors, p.target_journal, p.doi, p.notes, ...roundsOf(p.id).map((r) => r.journal))).map((p) => { const lr = lastRound(p.id); return { href: '#/paper/' + p.id, title: paperName(p), sub: [STATUS()[p.status], lr ? lr.journal : p.target_journal].filter(Boolean).join(' · ') }; }));
    add(T('審稿意見與回覆', 'Reviewer comments and replies'), D.comments.filter((c) => hit(c.comment, c.response, c.changes)).map((c) => { const r = byId('rounds', c.round_id) || {}, p = r.paper_id && byId('papers', r.paper_id); return { href: p ? '#/paper/' + p.id + '/reviews?round=' + r.id : '#/papers', title: snip(c.comment, first), sub: [p ? paperName(p) : '', c.reviewer + ' ' + c.seq, c.response ? T('回覆：', 'Reply: ') + snip(c.response, first) : T('還沒回覆', 'Not answered')].filter(Boolean).join(' · '), open: c.id }; }));
    add(T('審查結果原文', 'Decision letters'), D.rounds.filter((r) => r.letter_text && hit(r.letter_text)).map((r) => { const p = byId('papers', r.paper_id); return { href: '#/paper/' + r.paper_id + '/reviews?round=' + r.id, title: (p ? paperName(p) : '') + ' · ' + r.journal, sub: snip(r.letter_text, first), letter: true }; }));
    add(T('待辦', 'To-dos'), D.todos.filter((x) => hit(x.title, x.notes)).map((x) => ({ href: '#/todos', title: x.title, sub: x.done_at ? T('已完成', 'Done') : x.due ? ymd(x.due) : T('沒有日期', 'No date') })));
    add(T('截止日', 'Deadlines'), D.deadlines.filter((d) => hit(d.title, d.notes, d.url)).map((d) => ({ href: '#/deadlines', title: d.title, sub: ymd(d.due) + ' · ' + DL_KIND()[d.kind] })));
    add(T('期刊', 'Journals'), allJournalNames().filter((n) => hit(n)).map((n) => ({ href: '#/journal/' + encodeURIComponent(n), title: n, sub: '' })));
    add(T('我審的稿', 'Reviewing'), D.peer.filter((r) => hit(r.journal, r.manuscript, r.ms_id, r.notes)).map((r) => ({ href: '#/reviewing', title: r.journal, sub: [PR_STATUS()[r.status], r.manuscript].filter(Boolean).join(' · ') })));
    add(T('共同作者', 'Co-authors'), D.people.filter((x) => hit(x.name, x.affiliation, x.email, x.orcid)).map((x) => ({ href: '#/me', title: x.name, sub: x.affiliation || '' })));
    return g;
  }
  function pageSearch() {
    return ph(T('搜尋', 'Search')) + `<div class="ans-search"><input class="inp" type="search" id="g-q" data-act="g-q" value="${esc(SEARCH_Q)}" placeholder="${T('專案、論文、期刊、審稿意見、回覆、待辦…', 'Projects, papers, journals, comments, replies, to-dos…')}" aria-label="${T('搜尋全部', 'Search everything')}" autocomplete="off"><p class="muted small" id="g-n"></p></div><div id="g-list"></div>`;
  }
  function paintSearch() {
    const box = $('g-list'); if (!box) return;
    const q = SEARCH_Q.trim();
    if (!q) { $('g-n').textContent = T('打幾個字就會開始找。', 'Start typing to search.'); box.innerHTML = ''; return; }
    const g = searchAll(q), n = g.reduce((a, x) => a + x[1].length, 0);
    $('g-n').textContent = n ? T('找到 ' + n + ' 筆', n + ' found') : '';
    box.innerHTML = n ? g.map(([label, rows]) => '<h2 class="sec-title">' + esc(label) + ' <small>' + rows.length + '</small></h2><div class="agenda">' + rows.slice(0, 30).map((r) => '<a class="ag sr" href="' + r.href + '"' + (r.open ? ' data-open-cm="' + r.open + '"' : '') + (r.letter ? ' data-letter="1"' : '') + '><span class="what"><b>' + mark(r.title, q) + '</b>' + (r.sub ? '<small>' + mark(r.sub, q) + '</small>' : '') + '</span><span class="chev">' + ic('chev') + '</span></a>').join('') + '</div>').join('')
      : '<div class="empty">' + T('找不到符合的內容。', 'Nothing matches.') + '</div>';
  }

  function pageMe() {
    return ph(T('我的', 'Me')) +
      `<div class="card"><h3>${T('帳號', 'Account')}</h3><p style="font-weight:700;margin-bottom:12px">${esc(USER.email)}</p>
        <form id="f-pw" class="form-grid" novalidate>
          <label class="f"><span>${tt('newPassword')}</span><input type="password" name="password" autocomplete="new-password" minlength="8"></label>
          <label class="f"><span>${tt('confirmPassword')}</span><input type="password" name="password2" autocomplete="new-password" minlength="8"></label>
          <div class="full"><button class="btn sm" type="submit">${T('變更密碼', 'Change password')}</button></div>
        </form></div>` +
      `<div class="card"><h3>${T('語言與外觀', 'Language and look')}</h3><div class="seg" style="max-width:16rem" role="tablist" aria-label="${T('語言', 'Language')}"><button type="button" data-act="lang" data-lang="zh" aria-selected="${LANG === 'zh'}">中文</button><button type="button" data-act="lang" data-lang="en" aria-selected="${LANG === 'en'}">English</button></div>
        <div class="seg" style="max-width:22rem;margin-top:10px" role="tablist" aria-label="${T('深淺色', 'Light or dark')}">${[['auto', T('跟隨系統', 'System')], ['light', T('淺色', 'Light')], ['dark', T('深色', 'Dark')]].map(([k, l]) => `<button type="button" data-act="theme" data-theme="${k}" aria-selected="${THEME === k}">${l}</button>`).join('')}</div>
        <p class="muted small" style="margin-top:10px">${NATIVE ? T('深淺色可以在上面切換。', 'Switch light or dark above.') : T('Android 可以安裝 App（「其他」裡的「下載 Android App」）；iPhone 用 Safari 的「分享 › 加入主畫面」。', 'On Android, install the app (Android app, under More); on iPhone use Safari’s Share › Add to Home Screen.')}</p></div>` +
      `<div class="card"><div class="row" style="justify-content:space-between;margin-bottom:8px"><h3 style="margin:0">${T('共同作者', 'Co-authors')}</h3><button class="btn sm" data-act="new-person">${ic('plus')}${T('新增', 'Add')}</button></div>` +
        (D.people.length ? `<div class="list">${D.people.map((x) => `<button type="button" class="ms" data-act="edit-person" data-id="${x.id}" style="grid-template-columns:minmax(0,1fr) auto"><span><h4>${esc(x.name)}</h4><span class="meta">${esc([x.affiliation, x.orcid].filter(Boolean).join(' · '))}</span></span><span class="chev">${ic('chev')}</span></button>`).join('')}</div>`
          : `<p class="muted small">${T('加一次以後，每篇論文都能直接選，產生作者列和 CRediT 貢獻聲明。', 'Add people once and pick them on any paper for author lines and CRediT statements.')}</p>`) + '</div>' +
      `<div class="card"><h3>${T('投稿檢查清單範本', 'Checklist template')}</h3><p class="muted small" style="margin-bottom:8px">${T('一行一項。之後每篇論文「開始檢查」時會用這份清單。', 'One item per line. Every paper’s checklist starts from this list.')}</p>
        <form id="f-template"><textarea class="inp" name="items" rows="10">${esc(template().join('\n'))}</textarea><div class="row" style="margin-top:8px"><button class="btn sm primary" type="submit">${T('儲存範本', 'Save template')}</button><button class="btn sm ghost" type="button" data-act="reset-template">${T('還原預設', 'Restore default')}</button></div></form></div>` +
      `<div class="card"><h3>${T('Cover letter 範本', 'Cover letter template')}</h3><p class="muted small" style="margin-bottom:8px">${T('可用的欄位：', 'Fields: ')}${COVER_FIELDS}。${T('某一行的欄位全是空的，那一行會自動省略。', 'A line whose fields are all empty is left out.')}</p>
        <form id="f-cover"><textarea class="inp" name="tpl" rows="12" style="font-family:var(--mono);font-size:12.5px">${esc(coverTemplate())}</textarea><div class="row" style="margin-top:8px"><button class="btn sm primary" type="submit">${T('儲存範本', 'Save template')}</button><button class="btn sm ghost" type="button" data-act="reset-cover">${T('還原預設', 'Restore default')}</button></div></form></div>` +
      `<div class="card"><h3>${T('資料備份', 'Backup')}</h3><p class="muted small" style="margin-bottom:10px">${T('下載你所有的專案、論文、投稿輪次、審稿意見、截止日、期刊和共同作者。Excel 方便閱讀；JSON 可以用來還原。', 'Download every project, paper, round, reviewer comment, deadline, journal and co-author. Excel is for reading; JSON can restore.')}</p>
        <div class="d-actions" style="margin-top:0"><button class="btn sm" data-act="export-xlsx">${ic('doc')}${T('下載 Excel', 'Download Excel')}</button><button class="btn sm" data-act="export-json">${ic('doc')}${T('下載 JSON', 'Download JSON')}</button><button class="btn sm" data-act="import-json">${T('從 JSON 還原…', 'Restore from JSON…')}</button></div></div>` +
      (ADMIN ? `<div class="card" id="admin"><h3>${T('邀請碼', 'Invite codes')}</h3><p class="muted small" style="margin-bottom:10px">${T('只有管理員看得到。邀請碼只在產生時顯示一次。', 'Only admins see this. A code is shown once, when it is made.')}</p>
        <form id="f-code" class="form-grid" novalidate>
          <label class="f full"><span>${T('給誰（選填）', 'For (optional)')}</span><input name="label" maxlength="200" placeholder="${T('例如：實驗室成員', 'e.g. Lab members')}"></label>
          <label class="f"><span>${T('可使用次數', 'Uses')}</span><input name="uses" type="number" min="1" max="1000" value="1" inputmode="numeric"></label>
          <label class="f"><span>${T('有效天數', 'Valid for (days)')}</span><input name="days" type="number" min="1" max="3650" value="30" inputmode="numeric"></label>
          <div class="full"><button class="btn primary sm" type="submit">${T('產生邀請碼', 'Make a code')}</button></div>
        </form><div id="newcode"></div><div class="tbl-wrap" style="margin-top:12px"><table class="codes"><thead><tr><th>${T('代碼', 'Code')}</th><th>${T('給誰', 'For')}</th><th>${T('已使用', 'Used')}</th><th>${T('到期', 'Expires')}</th><th></th></tr></thead><tbody id="codes"><tr><td colspan="5" class="muted">…</td></tr></tbody></table></div></div>` : '') +
      `<div class="card"><h3>${T('其他', 'More')}</h3><div class="d-actions" style="margin-top:0"><a class="btn sm" href="../index.html">← Research Toolkit</a>${NATIVE ? '' : `<a class="btn sm" href="${APK_URL}" download>${T('下載 Android App', 'Android app')}</a>`}<button class="btn sm" data-act="logout">${T('登出', 'Sign out')}</button></div>
        <p class="muted small" style="margin:12px 0 8px">${T('刪除帳號會一併刪除你存的所有專案、論文、審稿意見和截止日，無法復原。', 'Deleting your account removes every project, paper, reviewer comment and deadline you saved. This cannot be undone.')}</p>
        <button class="btn sm danger" data-act="delete-account">${ic('trash')}${T('刪除我的帳號', 'Delete my account')}</button></div>`;
  }


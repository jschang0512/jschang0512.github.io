/* 投稿與專案追蹤 · Submission & project tracker
 * Own Supabase project ("Research Toolkit"). Row-level security returns each person's rows to that person only;
 * sign-up needs an invite code, checked by a trigger on auth.users. Routes live in the URL hash. */
(function () {
  'use strict';
  const SUPABASE_URL = 'https://bskmkmhikmdhjyvzzocb.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_WKcTPORXCW40EcLsgI9UOA_tff77jVi';
  const CMS_URL = 'https://app.pagescms.org/jschang0512/jschang0512.github.io/';
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  /* ---------------- language (shared with the rest of the Research Toolkit) ---------------- */
  let LANG = (() => { try { const v = localStorage.getItem('rt:lang'); if (v === 'zh' || v === 'en') return v; } catch (e) { /* ignore */ } return /^zh/i.test(navigator.language || '') ? 'zh' : 'en'; })();
  const T = (zh, en) => (LANG === 'en' ? en : zh);
  const S = {
    appName: ['投稿與專案追蹤', 'Submission & Project Tracker'],
    appSub: ['研究專案、每一輪投稿、和 reviewer 的來往，都在同一個地方。', 'Projects, every submission round and your exchanges with reviewers, in one place.'],
    signIn: ['登入', 'Sign in'], createAccount: ['註冊', 'Create account'], password: ['密碼', 'Password'],
    newPassword: ['密碼（至少 8 個字元）', 'Password (at least 8 characters)'], confirmPassword: ['再輸入一次密碼', 'Confirm password'],
    inviteCode: ['邀請碼', 'Invite code'], forgot: ['忘記密碼？', 'Forgot password?'],
    chooseNewPassword: ['設定新的密碼。', 'Choose a new password.'], savePassword: ['儲存新密碼', 'Save password'],
    privacy: ['註冊需要邀請碼。你的紀錄只有你自己看得到，不會拿去做其他用途；你隨時可以刪除帳號和所有資料。', 'An invite code is needed to sign up. Your records are visible only to you and are not used for anything else; you can delete your account and all of it at any time.'],
  };
  const tt = (k) => T(S[k][0], S[k][1]);

  const STATUS = () => ({ drafting: T('撰寫中', 'In preparation'), submitted: T('已投稿', 'Submitted'), under_review: T('審查中', 'Under review'), revision: T('修改中', 'Revising'), accepted: T('已接受', 'Accepted'), published: T('已發表', 'Published'), rejected: T('被拒', 'Rejected'), withdrawn: T('撤回', 'Withdrawn') });
  const STATUS_CHIP = { drafting: 'warn', submitted: '', under_review: '', revision: 'warn', accepted: 'ok', published: 'ok', rejected: 'dim', withdrawn: 'dim' };
  const DECISION = () => ({ pending: T('等待結果', 'Awaiting decision'), desk_reject: 'Desk reject', major: 'Major revision', minor: 'Minor revision', accept: T('接受', 'Accept'), reject: T('拒絕', 'Reject'), withdrawn: T('撤回', 'Withdrawn') });
  const STAGES = ['planning', 'irb', 'data', 'analysis', 'writing', 'done'];
  const STAGE = () => ({ planning: T('規劃', 'Planning'), irb: 'IRB', data: T('資料申請', 'Data access'), analysis: T('分析', 'Analysis'), writing: T('撰寫', 'Writing'), done: T('完成', 'Done'), paused: T('暫停', 'Paused') });
  const MS_KIND = () => ({ irb: 'IRB', data: T('資料申請', 'Data access'), analysis: T('分析', 'Analysis'), writing: T('撰寫', 'Writing'), other: T('其他', 'Other') });
  const DL_KIND = () => ({ abstract: T('研討會摘要', 'Conference abstract'), conference: T('研討會報名', 'Conference registration'), grant: T('計畫申請', 'Grant'), other: T('其他', 'Other') });
  const C_STATUS = () => ({ todo: T('待處理', 'To do'), draft: T('草稿', 'Draft'), done: T('已回覆', 'Answered'), declined: T('不採納', 'Declined') });
  const C_CHIP = { todo: 'warn', draft: '', done: 'ok', declined: 'dim' };
  const WAIT_DAYS = 60, REVISION_DAYS = 30, SOON_DAYS = 60;

  /* ---------------- helpers ---------------- */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const parseDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const days = (a, b) => Math.round((b - a) / 864e5);
  const md = (s) => { const d = parseDate(s); return d ? `${d.getMonth() + 1}/${d.getDate()}` : ''; };
  const ymd = (s) => { const d = parseDate(s); return d ? `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}` : ''; };
  function toast(t, ms) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms || 2600); }
  const ICON = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    todo: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 12.5l3 3 5-6.5"/>',
    repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 6l6 6-6 6"/>',
    check: '<path d="M5 12l5 5 9-10"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  };
  const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

  /* ---------------- data ---------------- */
  let USER = null, ADMIN = false;
  let D = { projects: [], milestones: [], papers: [], rounds: [], comments: [], deadlines: [], journals: [], people: [], authors: [], todos: [] };
  let SETTINGS = null;
  const TABLE = { projects: 'research_projects', milestones: 'research_milestones', papers: 'research_papers', rounds: 'research_rounds', comments: 'research_comments', deadlines: 'research_deadlines', journals: 'research_journals', people: 'research_people', authors: 'research_paper_authors', todos: 'research_todos' };
  const ORDER = { projects: ['updated_at', false], milestones: ['created_at', true], papers: ['updated_at', false], rounds: ['submitted_on', true], comments: ['seq', true], deadlines: ['due', true], journals: ['name', true], people: ['name', true], authors: ['position', true], todos: ['created_at', true] };
  async function loadAll() {
    const keys = Object.keys(TABLE);
    const res = await Promise.all(keys.map((k) => sb.from(TABLE[k]).select('*').order(ORDER[k][0], { ascending: ORDER[k][1] })).concat([sb.from('research_settings').select('*')]));
    const bad = res.find((r) => r.error);
    if (bad) { toast(T('讀取失敗：', 'Could not load: ') + bad.error.message, 6000); return false; }
    keys.forEach((k, i) => { D[k] = res[i].data; });
    SETTINGS = (res[keys.length].data || [])[0] || null;
    return true;
  }
  async function save(kind, row, id) {
    const q = id ? sb.from(TABLE[kind]).update(row).eq('id', id) : sb.from(TABLE[kind]).insert(row);
    const r = await q.select().single();
    if (r.error) { toast(T('儲存失敗：', 'Could not save: ') + r.error.message, 6000); return null; }
    return r.data;
  }
  async function remove(kind, id) {
    const r = await sb.from(TABLE[kind]).delete().eq('id', id);
    if (r.error) { toast(T('刪除失敗：', 'Could not delete: ') + r.error.message, 6000); return false; }
    return true;
  }
  const byId = (kind, id) => D[kind].find((x) => x.id === id);
  const roundsOf = (paperId) => D.rounds.filter((r) => r.paper_id === paperId);
  const lastRound = (paperId) => { const rs = roundsOf(paperId); return rs[rs.length - 1] || null; };
  const commentsOf = (roundId) => D.comments.filter((c) => c.round_id === roundId);
  const papersOf = (projectId) => D.papers.filter((p) => p.project_id === projectId);
  const msOf = (projectId) => D.milestones.filter((m) => m.project_id === projectId);
  const paperName = (p) => p.short_title || p.title;
  function waitInfo(p) {
    const lr = lastRound(p.id), t = today();
    if (!lr) return null;
    if (lr.decision === 'pending') { const since = parseDate(lr.response_on) || parseDate(lr.submitted_on); return { kind: 'review', days: days(since, t), journal: lr.journal, responded: !!lr.response_on, round: lr }; }
    if ((lr.decision === 'major' || lr.decision === 'minor') && !lr.response_on) return { kind: 'revise', days: lr.decision_on ? days(parseDate(lr.decision_on), t) : null, journal: lr.journal, round: lr };
    return null;
  }
  function openCount(roundId) { return commentsOf(roundId).filter((c) => c.status === 'todo' || c.status === 'draft').length; }
  // the round whose reviewer comments are being worked on: the latest one with a revision decision, else the latest
  function workingRound(paperId) {
    const rs = roundsOf(paperId);
    for (let i = rs.length - 1; i >= 0; i--) if (['major', 'minor'].includes(rs[i].decision)) return rs[i];
    return rs[rs.length - 1] || null;
  }

  /* ---------------- "up next" ---------------- */
  function agenda() {
    const t = today(), items = [];
    const push = (date, o) => items.push({ date, left: date ? days(t, date) : 0, ...o });
    D.deadlines.forEach((d) => { const due = parseDate(d.due), left = days(t, due); if (!d.done && left >= -1 && left <= SOON_DAYS) push(due, { title: d.title, sub: DL_KIND()[d.kind], href: '#/deadlines' }); });
    D.milestones.forEach((m) => {
      const pr = byId('projects', m.project_id); if (!pr) return;
      if (!m.done_on && m.due) { const due = parseDate(m.due), left = days(t, due); if (left >= -30 && left <= SOON_DAYS) push(due, { title: m.title, sub: pr.short_title || pr.title, href: '#/project/' + pr.id }); }
      if (m.expires_on) { const ex = parseDate(m.expires_on), left = days(t, ex); if (left >= -30 && left <= SOON_DAYS) push(ex, { title: T(`${m.title} 到期`, `${m.title} expires`), sub: T(`${pr.short_title || pr.title} · 記得送期中審查或展延`, `${pr.short_title || pr.title} · renew before it lapses`), href: '#/project/' + pr.id, expiry: true }); }
    });
    D.papers.forEach((p) => {
      if (p.deadline && !['accepted', 'published', 'rejected', 'withdrawn'].includes(p.status)) { const due = parseDate(p.deadline), left = days(t, due); if (left >= -30 && left <= SOON_DAYS) push(due, { title: paperName(p), sub: T('自訂截止日', 'Own deadline'), href: '#/paper/' + p.id }); }
      const w = waitInfo(p);
      if (w && w.kind === 'review' && w.days >= WAIT_DAYS) push(null, { nudge: true, title: paperName(p), sub: T(`${w.journal} 已審查 ${w.days} 天，可以寫信詢問進度`, `${w.journal} has had it ${w.days} days; consider asking about progress`), href: '#/paper/' + p.id });
      if (w && w.kind === 'revise') {
        const open = openCount(w.round.id);
        if (open) push(null, { nudge: true, title: paperName(p), sub: T(`還有 ${open} 條審稿意見待回覆`, `${open} reviewer comment${open > 1 ? 's' : ''} still to answer`), href: `#/paper/${p.id}/reviews` });
        else if (w.days !== null && w.days >= REVISION_DAYS) push(null, { nudge: true, title: paperName(p), sub: T(`修改意見已收到 ${w.days} 天，還沒送出回覆`, `Reviews arrived ${w.days} days ago; response not sent yet`), href: '#/paper/' + p.id });
      }
    });
    D.todos.forEach((td) => { if (td.done_at || !td.due) return; const due = parseDate(td.due); if (days(t, due) <= 0) push(due, { title: (td.starred ? '★ ' : '') + td.title, sub: T('待辦', 'To-do'), href: '#/todos' }); });
    items.sort((a, b) => (a.nudge === b.nudge ? (a.date || 0) - (b.date || 0) : a.nudge ? -1 : 1));
    return items;
  }
  function agendaHTML(items) {
    if (!items.length) return `<div class="empty">${T('目前沒有要處理的事。', 'Nothing needs doing right now.')}</div>`;
    return '<div class="agenda">' + items.map((it) => {
      const cls = it.nudge ? 'soon' : it.left < 0 ? 'late' : it.left <= 7 || it.expiry ? 'soon' : '';
      const when = it.nudge ? T('提醒', 'Reminder') : it.left === 0 ? T('今天', 'Today') : it.left < 0 ? T(`已過 ${-it.left} 天`, `${-it.left} d ago`) : it.left === 1 ? T('明天', 'Tomorrow') : T(`剩 ${it.left} 天`, `In ${it.left} d`);
      return `<a class="ag" href="${it.href}"><span class="when ${cls}">${when}${it.date ? `<small>${md(localISO(it.date))}</small>` : ''}</span><span class="what"><b>${esc(it.title)}</b><small>${esc(it.sub || '')}</small></span><span class="chev">${ic('chev')}</span></a>`;
    }).join('') + '</div>';
  }

  /* ---------------- shell ---------------- */
  const NAV = () => [
    ['', 'home', T('總覽', 'Home')], ['projects', 'folder', T('專案', 'Projects')], ['papers', 'file', T('論文', 'Papers')],
    ['todos', 'todo', T('待辦', 'To-dos')], ['me', 'user', T('我的', 'Me')],
  ];
  function renderNav(section) {
    const nudges = agenda().filter((a) => a.nudge || a.left <= 7).length;
    const html = (cls) => NAV().map(([k, i, label]) => `<a href="#/${k}" class="${section === k ? 'on' : ''}"${section === k ? ' aria-current="page"' : ''}>${ic(i)}<span>${label}</span>${cls && k === '' && nudges ? `<span class="badge">${nudges}</span>` : ''}</a>`).join('');
    $('nav-side').innerHTML = html(true);
    $('nav-bottom').innerHTML = html(false);
    $('brand-name').textContent = tt('appName');
    $('side-who').textContent = USER ? USER.email : '';
  }
  const ph = (title, opts = {}) => `<header class="ph">${opts.back ? `<a class="btn ghost icon back${opts.backMobileOnly ? ' mobile-only' : ''}" href="${opts.back}" aria-label="${T('返回', 'Back')}">${ic('back')}</a>` : ''}<h1>${esc(title)}</h1>${opts.actions || ''}</header>`;
  const isWide = () => window.matchMedia('(min-width: 900px)').matches;

  /* ---------------- pages ---------------- */
  function pageHome() {
    const active = D.projects.filter((p) => !['done', 'paused'].includes(p.stage)).length;
    const inReview = D.papers.filter((p) => ['submitted', 'under_review'].includes(p.status)).length;
    const revising = D.papers.filter((p) => p.status === 'revision').length;
    const done = D.papers.filter((p) => ['accepted', 'published'].includes(p.status)).length;
    const nothing = !D.projects.length && !D.papers.length && !D.deadlines.length;
    return ph(T('總覽', 'Home')) +
      (nothing ? `<div class="empty" style="margin-top:4px"><b>${T('從第一個專案或論文開始', 'Start with your first project or paper')}</b><br>${T('專案用來記錄 IRB、資料申請與分析進度；論文用來記錄每一輪投稿和審稿意見。', 'Projects hold IRB, data access and analysis; papers hold every submission round and reviewer comment.')}<div class="row" style="justify-content:center"><button class="btn primary" data-act="new-project">${ic('plus')}${T('新增專案', 'New project')}</button><button class="btn" data-act="new-paper">${ic('plus')}${T('新增論文', 'New paper')}</button></div></div>` : '') +
      `<div class="metrics">
        <a class="metric" href="#/projects"><span>${T('進行中的專案', 'Active projects')}</span><b>${active}</b></a>
        <a class="metric" href="#/papers"><span>${T('審查中', 'Under review')}</span><b>${inReview}</b></a>
        <a class="metric" href="#/papers"><span>${T('修改中', 'Revising')}</span><b>${revising}</b></a>
        <a class="metric" href="#/papers"><span>${T('已接受・已發表', 'Accepted & published')}</span><b>${done}</b></a>
      </div>` +
      `<h2 class="sec-title">${T('接下來', 'Up next')} <small>${T('60 天內的截止日、IRB 到期、等太久的審查、待回覆的意見', 'Deadlines and IRB expiry in 60 days, long reviews, comments to answer')}</small></h2>` + agendaHTML(agenda()) +
      `<a class="ag" href="#/stats" style="margin-top:18px;grid-template-columns:minmax(0,1fr) auto"><span class="what"><b>${T('年度統計', 'Year by year')}</b><small>${T('每年投稿、接受、發表與審查天數', 'Submissions, acceptances, publications and review times per year')}</small></span><span class="chev">${ic('chev')}</span></a>`;
  }

  function projectCard(p, on) {
    const idx = STAGES.indexOf(p.stage), ms = msOf(p.id).filter((m) => !m.done_on && m.due).sort((a, b) => parseDate(a.due) - parseDate(b.due))[0];
    const n = papersOf(p.id).length;
    return `<a class="item${on ? ' on' : ''}" href="#/project/${p.id}"><div class="item-head"><h3>${esc(p.short_title || p.title)}</h3><span class="chip ${p.stage === 'paused' ? 'dim' : p.stage === 'done' ? 'ok' : 'violet'}">${esc(STAGE()[p.stage])}</span></div>` +
      (p.stage !== 'paused' ? `<div class="steps">${STAGES.map((s, i) => `<i class="${i < idx ? 'done' : i === idx ? 'now' : ''}"></i>`).join('')}</div>` : '') +
      `<div class="meta">${ms ? `${T('下一步', 'Next')}：<b>${esc(ms.title)}</b> ${md(ms.due)}` : ''}${ms && n ? ' · ' : ''}${n ? T(`${n} 篇論文`, `${n} paper${n > 1 ? 's' : ''}`) : ''}</div></a>`;
  }
  function listProjects(currentId) {
    const act = D.projects.filter((p) => !['done', 'paused'].includes(p.stage)), rest = D.projects.filter((p) => ['done', 'paused'].includes(p.stage));
    return ph(T('專案', 'Projects'), { actions: `<button class="btn primary sm" data-act="new-project">${ic('plus')}${T('專案', 'Project')}</button>` }) +
      (D.projects.length ? `<div class="list">${act.map((p) => projectCard(p, p.id === currentId)).join('') || `<div class="empty">${T('沒有進行中的專案。', 'No active projects.')}</div>`}</div>` +
        (rest.length ? `<details class="fold"${rest.some((p) => p.id === currentId) ? ' open' : ''}><summary>${T('已完成・暫停', 'Done & paused')} (${rest.length})</summary><div class="list">${rest.map((p) => projectCard(p, p.id === currentId)).join('')}</div></details>` : '')
        : `<div class="empty">${T('專案記錄一個研究從規劃、IRB、資料申請到分析和撰寫的過程，底下可以放好幾篇論文。', 'A project follows a study from planning, IRB and data access to analysis and writing, and can hold several papers.')}<br><button class="btn primary" data-act="new-project">${ic('plus')}${T('新增專案', 'New project')}</button></div>`);
  }
  function msRow(m) {
    const t = today(), done = !!m.done_on, bits = [];
    if (done) bits.push(T(`完成 ${ymd(m.done_on)}`, `Done ${ymd(m.done_on)}`));
    else if (m.due) { const left = days(t, parseDate(m.due)); bits.push(`<span class="${left < 0 ? 'late' : left <= 14 ? 'warn' : ''}">${T(`目標 ${ymd(m.due)}`, `Due ${ymd(m.due)}`)}${left < 0 ? T(`（已過 ${-left} 天）`, ` (${-left} d late)`) : ''}</span>`); }
    if (m.expires_on) { const left = days(t, parseDate(m.expires_on)); bits.push(`<span class="${left < 0 ? 'late' : left <= SOON_DAYS ? 'warn' : ''}">${T(`有效到 ${ymd(m.expires_on)}`, `Valid to ${ymd(m.expires_on)}`)}${left >= 0 && left <= SOON_DAYS ? T(`（剩 ${left} 天）`, ` (${left} d left)`) : left < 0 ? T('（已過期）', ' (expired)') : ''}</span>`); }
    if (m.ref) bits.push(esc(m.ref));
    return `<button type="button" class="ms${done ? ' done' : ''}" data-act="edit-ms" data-id="${m.id}"><span class="tick">${done ? ic('check') : ''}</span><span><h4>${esc(m.title)} <span class="chip dim">${esc(MS_KIND()[m.kind])}</span></h4><span class="meta">${bits.join(' · ')}</span></span><span class="chev">${ic('chev')}</span></button>`;
  }
  function detailProject(p) {
    const idx = STAGES.indexOf(p.stage);
    // open ones first by due date (undated last), then finished ones, most recent first
    const key = (m) => { const t = m.done_on ? parseDate(m.done_on) : parseDate(m.due); return t ? t.getTime() : (m.done_on ? 0 : Infinity); };
    const ms = msOf(p.id).slice().sort((a, b) => (!!a.done_on - !!b.done_on) || (a.done_on ? key(b) - key(a) : key(a) - key(b)));
    const papers = papersOf(p.id);
    const kv = [[T('角色', 'Role'), p.role], [T('合作者', 'Collaborators'), p.collaborators], [T('開始', 'Started'), ymd(p.start_date)], [T('預計完成', 'Target'), ymd(p.target_date)]].filter((x) => x[1]);
    return ph(p.short_title || p.title, { back: '#/projects', backMobileOnly: true, actions: `<button class="btn sm" data-act="edit-project" data-id="${p.id}">${ic('edit')}${T('編輯', 'Edit')}</button>` }) +
      `<div class="d-head">${p.short_title ? `<h2>${esc(p.title)}</h2>` : ''}<div class="meta"><span class="chip ${p.stage === 'paused' ? 'dim' : p.stage === 'done' ? 'ok' : 'violet'}">${esc(STAGE()[p.stage])}</span></div></div>` +
      `<div class="stepper" role="group" aria-label="${T('階段', 'Stage')}">${STAGES.map((s, i) => `<button type="button" class="${p.stage === 'paused' ? '' : i < idx ? 'done' : i === idx ? 'now' : ''}" data-act="set-stage" data-id="${p.id}" data-stage="${s}" aria-pressed="${p.stage === s}"><i></i>${esc(STAGE()[s])}</button>`).join('')}</div>` +
      (kv.length ? `<dl class="kv" style="margin-top:12px">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '') +
      `<h2 class="sec-title">${T('里程碑', 'Milestones')} <small>${T('IRB、資料申請、分析…', 'IRB, data access, analysis…')}</small><button class="btn sm right" data-act="new-ms" data-id="${p.id}">${ic('plus')}${T('里程碑', 'Milestone')}</button></h2>` +
      (ms.length ? `<div class="list">${ms.map(msRow).join('')}</div>` : `<div class="empty">${T('例如：IRB 送審、IRB 核准（填有效期限，到期前 60 天會提醒）、健保資料申請、主要分析完成。', 'For example: IRB submitted, IRB approved (add the expiry date for a 60-day reminder), data access granted, main analysis done.')}</div>`) +
      `<h2 class="sec-title">${T('這個專案的論文', 'Papers in this project')}<button class="btn sm right" data-act="new-paper" data-project="${p.id}">${ic('plus')}${T('論文', 'Paper')}</button></h2>` +
      (papers.length ? `<div class="list">${papers.map((x) => paperCard(x, false, true)).join('')}</div>` : `<div class="empty">${T('還沒有論文。', 'No papers yet.')}</div>`) +
      todoBlock({ project: p.id }) +
      (p.notes ? `<h2 class="sec-title">${T('筆記', 'Notes')}</h2><div class="notes">${esc(p.notes)}</div>` : '');
  }

  function paperCard(p, on, inProject) {
    const lr = lastRound(p.id), w = waitInfo(p), meta = [];
    if (lr) meta.push(`<b>${esc(lr.journal)}</b>`); else if (p.target_journal) meta.push(`${T('目標', 'Target')}：<b>${esc(p.target_journal)}</b>`);
    if (w && w.kind === 'review') meta.push(T(`已等 ${w.days} 天`, `${w.days} d waiting`));
    const wr = workingRound(p.id);
    if (wr && ['major', 'minor'].includes(wr.decision)) { const cs = commentsOf(wr.id); if (cs.length) meta.push(T(`意見 ${cs.length - openCount(wr.id)}/${cs.length} 已處理`, `${cs.length - openCount(wr.id)}/${cs.length} comments done`)); }
    const pr = p.project_id && byId('projects', p.project_id);
    if (pr && !inProject) meta.push(esc(pr.short_title || pr.title));
    return `<a class="item${on ? ' on' : ''}" href="#/paper/${p.id}"><div class="item-head"><h3>${esc(paperName(p))}</h3><span class="chip ${STATUS_CHIP[p.status]}">${esc(STATUS()[p.status])}</span></div>${meta.length ? `<div class="meta">${meta.join(' · ')}</div>` : ''}</a>`;
  }
  function listPapers(currentId) {
    const g = { active: [], draft: [], done: [], closed: [] };
    D.papers.forEach((p) => g[['submitted', 'under_review', 'revision'].includes(p.status) ? 'active' : p.status === 'drafting' ? 'draft' : ['accepted', 'published'].includes(p.status) ? 'done' : 'closed'].push(p));
    const block = (label, arr) => (arr.length ? `<h2 class="sec-title">${label} <small>${arr.length}</small></h2><div class="list">${arr.map((p) => paperCard(p, p.id === currentId)).join('')}</div>` : '');
    return ph(T('論文', 'Papers'), { actions: `<button class="btn primary sm" data-act="new-paper">${ic('plus')}${T('論文', 'Paper')}</button>` }) + papersSeg('papers') +
      (D.papers.length ? block(T('進行中', 'In review'), g.active) + block(T('撰寫中', 'In preparation'), g.draft) + block(T('已接受・已發表', 'Accepted & published'), g.done) +
        (g.closed.length ? `<details class="fold"${g.closed.some((p) => p.id === currentId) ? ' open' : ''}><summary>${T('已結束（被拒・撤回）', 'Closed (rejected, withdrawn)')} (${g.closed.length})</summary><div class="list">${g.closed.map((p) => paperCard(p, p.id === currentId)).join('')}</div></details>` : '')
        : `<div class="empty">${T('每篇論文記錄投稿的每一輪、審稿結果、你的回覆，以及和 reviewer 的來往。', 'Each paper keeps every submission round, decision and response, and your exchanges with reviewers.')}<br><button class="btn primary" data-act="new-paper">${ic('plus')}${T('新增論文', 'New paper')}</button></div>`);
  }

  function detailPaper(p, tab) {
    tab = ['timeline', 'prep', 'reviews', 'info'].includes(tab) ? tab : 'timeline';
    const pr = p.project_id && byId('projects', p.project_id), w = waitInfo(p), lr = lastRound(p.id);
    const meta = [`<span class="chip ${STATUS_CHIP[p.status]}">${esc(STATUS()[p.status])}</span>`];
    if (lr) meta.push(esc(lr.journal)); if (w && w.kind === 'review') meta.push(T(`已等 ${w.days} 天`, `${w.days} days waiting`));
    if (pr) meta.push(`<a href="#/project/${pr.id}">${esc(pr.short_title || pr.title)}</a>`);
    const tabs = [['timeline', T('時間軸', 'Timeline')], ['prep', T('投稿準備', 'Checklist')], ['reviews', T('審稿往來', 'Reviews')], ['info', T('資料', 'Details')]];
    let body = '';
    if (tab === 'timeline') body = tabTimeline(p);
    else if (tab === 'prep') body = tabPrep(p);
    else if (tab === 'reviews') body = tabReviews(p);
    else body = tabInfo(p);
    return ph(paperName(p), { back: '#/papers', backMobileOnly: true }) +
      `<div class="d-head">${p.short_title ? `<h2>${esc(p.title)}</h2>` : ''}<div class="meta row">${meta.join(' · ')}</div></div>` +
      `<nav class="tabs">${tabs.map(([k, l]) => `<a href="#/paper/${p.id}/${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</nav>` + body;
  }
  function tabTimeline(p) {
    const rs = roundsOf(p.id), lr = rs[rs.length - 1];
    const actions = `<div class="d-actions"><button class="btn primary sm" data-act="new-round" data-id="${p.id}">${ic('plus')}${rs.length ? T('下一輪／轉投', 'Next round / new journal') : T('記錄投稿', 'Record submission')}</button>${lr && lr.decision === 'pending' ? `<button class="btn sm" data-act="edit-round" data-id="${lr.id}">${T('更新結果', 'Record decision')}</button>` : ''}</div>`;
    if (!rs.length) return actions + `<div class="empty">${T('還沒投稿。投稿後在這裡記錄每一輪的期刊、結果和回覆。', 'Not submitted yet. Record each round here once it goes out.')}</div>`;
    return actions + rs.slice().reverse().map((r) => {
      const i = rs.indexOf(r) + 1, cs = commentsOf(r.id);
      const trail = [`${ymd(r.submitted_on)} ${T('投稿', 'submitted')}`];
      if (r.decision !== 'pending') trail.push(`${r.decision_on ? md(r.decision_on) + ' ' : ''}${esc(DECISION()[r.decision])}`);
      else trail.push(`<span class="chip">${esc(DECISION().pending)}</span>`);
      if (r.response_on) trail.push(`${md(r.response_on)} ${T('回覆', 'responded')}`);
      return `<div class="round"><div class="round-head"><b>${T(`第 ${i} 輪`, `Round ${i}`)}</b><span class="muted">${esc(r.journal)}</span><button class="btn ghost sm" data-act="edit-round" data-id="${r.id}">${ic('edit')}${T('編輯', 'Edit')}</button></div>` +
        `<div class="trail">${trail.join('<span class="arrow">→</span>')}</div>` +
        (cs.length ? `<div class="trail"><a href="#/paper/${p.id}/reviews?round=${r.id}">${T(`審稿意見 ${cs.length} 條，已處理 ${cs.length - openCount(r.id)} 條`, `${cs.length} reviewer comments, ${cs.length - openCount(r.id)} done`)}</a></div>` : '') +
        (Array.isArray(r.links) && r.links.length ? `<div class="trail">${r.links.map((l) => `<a class="chip" href="${esc(/^https?:\/\//i.test(l.url) ? l.url : 'https://' + l.url)}" target="_blank" rel="noopener">${esc(LINK_KIND()[l.kind] || l.kind)} ↗</a>`).join('')}</div>` : '') +
        (r.notes ? `<div class="note">${esc(r.notes)}</div>` : '') + '</div>';
    }).join('');
  }
  let REVIEW_ROUND = {};
  function tabReviews(p) {
    const rs = roundsOf(p.id);
    if (!rs.length) return `<div class="empty">${T('先記錄一次投稿，收到審稿意見後就能在這裡逐條記錄和回覆。', 'Record a submission first; when reviews come back, log and answer them here comment by comment.')}<br><button class="btn primary" data-act="new-round" data-id="${p.id}">${ic('plus')}${T('記錄投稿', 'Record submission')}</button></div>`;
    const q = new URLSearchParams((location.hash.split('?')[1] || ''));
    const rid = (q.get('round') && rs.some((r) => r.id === q.get('round'))) ? q.get('round') : (REVIEW_ROUND[p.id] && rs.some((r) => r.id === REVIEW_ROUND[p.id]) ? REVIEW_ROUND[p.id] : workingRound(p.id).id);
    REVIEW_ROUND[p.id] = rid;
    const r = byId('rounds', rid), cs = commentsOf(rid);
    const groups = {}; cs.forEach((c) => { (groups[c.reviewer] = groups[c.reviewer] || []).push(c); });
    const names = Object.keys(groups).sort(reviewerOrder);
    const sel = `<select class="inp" data-act="pick-round" data-id="${p.id}" aria-label="${T('哪一輪', 'Round')}">${rs.map((x, i) => `<option value="${x.id}"${x.id === rid ? ' selected' : ''}>${T(`第 ${i + 1} 輪`, `Round ${i + 1}`)} · ${esc(x.journal)} · ${esc(DECISION()[x.decision])}</option>`).join('')}</select>`;
    const bar = `<div class="rv-bar"><div class="grow">${sel}</div></div><div class="d-actions" style="margin-top:0"><button class="btn primary sm" data-act="paste-comments" data-id="${rid}">${ic('plus')}${T('貼上審稿意見', 'Paste comments')}</button><button class="btn sm" data-act="new-comment" data-id="${rid}">${T('新增一條', 'Add one')}</button>${cs.length ? `<button class="btn sm" data-act="letter" data-id="${rid}">${ic('doc')}${T('產生回覆信', 'Response letter')}</button>` : ''}</div>`;
    if (!cs.length) return bar + `<div class="empty" style="margin-top:12px">${T('把 reviewer 的意見整段貼上，會依「1.」「2.」或空行自動切成一條一條，再逐條寫回覆。', 'Paste a reviewer’s comments in one go; they are split at “1.”, “2.” or blank lines, then you answer them one by one.')}</div>`;
    const prog = `<div class="rv-progress">${names.map((n) => { const arr = groups[n], open = arr.filter((c) => ['todo', 'draft'].includes(c.status)).length; return `<span class="chip ${open ? 'warn' : 'ok'}">${esc(n)} ${arr.length - open}/${arr.length}</span>`; }).join('')}</div>`;
    return bar + `<div style="margin-top:12px">${prog}</div>` + names.map((n) => `<div class="rv-group"><h4>${esc(n)}</h4>${groups[n].sort((a, b) => a.seq - b.seq).map((c) => commentCard(c, n)).join('')}</div>`).join('');
  }
  const reviewerOrder = (a, b) => { const k = (s) => (/^editor/i.test(s) ? -1 : (parseInt((s.match(/\d+/) || [999])[0], 10))); return k(a) - k(b) || a.localeCompare(b); };
  const reviewerNo = (name) => (/^editor/i.test(name) ? 'E' : ((name.match(/\d+/) || [''])[0] || name.slice(0, 1).toUpperCase()));
  function commentCard(c, name) {
    const long = c.comment.length > 360;
    return `<div class="cm ${c.status === 'done' ? 'done' : ''}" id="cm-${c.id}"><div class="cm-head"><span class="no">${esc(reviewerNo(name))}.${c.seq}</span><button class="btn ghost sm" data-act="edit-comment" data-id="${c.id}" aria-label="${T('編輯意見', 'Edit comment')}">${ic('edit')}</button>` +
      `<select data-act="comment-status" data-id="${c.id}" aria-label="${T('狀態', 'Status')}">${Object.entries(C_STATUS()).map(([k, l]) => `<option value="${k}"${k === c.status ? ' selected' : ''}>${l}</option>`).join('')}</select></div>` +
      `<div class="cm-text${long ? ' clamp' : ''}">${esc(c.comment)}</div>${long ? `<button class="link" data-act="expand" data-id="${c.id}">${T('顯示全文', 'Show all')}</button>` : ''}` +
      `<label for="resp-${c.id}"><span>${T('你的回覆', 'Your response')}</span><span class="saved" id="saved-${c.id}">${T('已儲存', 'Saved')}</span></label><textarea class="inp" id="resp-${c.id}" data-act="response" data-id="${c.id}" rows="3" maxlength="20000" placeholder="${T('寫下你的回覆，例如：已補充 30 與 60 天的敏感度分析…', 'Your reply, e.g. We added sensitivity analyses with 30 and 60 days…')}">${esc(c.response || '')}</textarea>` +
      `<label for="chg-${c.id}" style="margin-top:8px"><span>${T('修改位置（選填，會放進回覆信）', 'Where it changed (optional, goes into the letter)')}</span></label><input class="inp" id="chg-${c.id}" data-act="changes" data-id="${c.id}" maxlength="2000" value="${esc(c.changes || '')}" placeholder="${T('例如：p.5, L120–128; Table S4', 'e.g. p.5, L120–128; Table S4')}"></div>`;
  }
  function tabInfo(p) {
    const pr = p.project_id && byId('projects', p.project_id);
    const rows = [[T('標題', 'Title'), p.title], [T('專案', 'Project'), pr ? (pr.short_title || pr.title) : ''], [T('目標期刊', 'Target journal'), p.target_journal], [T('作者列', 'Authors'), p.authors], [T('作者序', 'Authorship'), p.my_role], [T('年份', 'Year'), p.year], ['DOI', p.doi], [T('自訂截止日', 'Own deadline'), ymd(p.deadline)], [T('備註', 'Notes'), p.notes]].filter((x) => x[1]);
    return `<div class="d-actions"><button class="btn sm" data-act="edit-paper" data-id="${p.id}">${ic('edit')}${T('編輯', 'Edit')}</button><button class="btn sm" data-act="cite" data-id="${p.id}">${ADMIN ? T('更新到 CV', 'Update CV') : T('書目資料', 'Citation details')}</button></div>` +
      `<dl class="kv" style="margin-top:10px">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` + todoBlock({ paper: p.id }) + authorsSection(p);
  }

  /* ---------------- co-authors and CRediT ---------------- */
  const CREDIT = [
    ['conceptualization', 'Conceptualization', '構想'], ['data_curation', 'Data curation', '資料管理'], ['formal_analysis', 'Formal analysis', '統計分析'],
    ['funding_acquisition', 'Funding acquisition', '取得經費'], ['investigation', 'Investigation', '調查研究'], ['methodology', 'Methodology', '研究方法'],
    ['project_administration', 'Project administration', '專案管理'], ['resources', 'Resources', '研究資源'], ['software', 'Software', '軟體'],
    ['supervision', 'Supervision', '指導'], ['validation', 'Validation', '驗證'], ['visualization', 'Visualization', '視覺化'],
    ['writing_original', 'Writing – original draft', '撰寫初稿'], ['writing_review', 'Writing – review & editing', '審閱與修訂'],
  ];
  const creditLabel = (k) => { const c = CREDIT.find((x) => x[0] === k); return c ? (LANG === 'en' ? c[1] : `${c[1]} ${c[2]}`) : k; };
  const authorsOf = (paperId) => D.authors.filter((a) => a.paper_id === paperId).sort((a, b) => a.position - b.position);
  function authorsSection(p) {
    const list = authorsOf(p.id);
    return `<h2 class="sec-title">${T('作者與 CRediT', 'Authors and CRediT')}<button class="btn sm right" data-act="add-author" data-id="${p.id}">${ic('plus')}${T('作者', 'Author')}</button></h2>` +
      (list.length ? `<div class="list">${list.map((a, i) => {
        const person = byId('people', a.person_id) || { name: '?' };
        return `<div class="item"><div class="item-head"><h3>${i + 1}. ${esc(person.name)}${a.corresponding ? ' <span class="chip">' + T('通訊作者', 'Corresponding') + '</span>' : ''}</h3>` +
          `<button class="btn ghost sm icon" data-act="author-up" data-id="${a.id}" aria-label="${T('往前', 'Move up')}"${i === 0 ? ' disabled' : ''}>↑</button><button class="btn ghost sm icon" data-act="author-down" data-id="${a.id}" aria-label="${T('往後', 'Move down')}"${i === list.length - 1 ? ' disabled' : ''}>↓</button><button class="btn ghost sm" data-act="edit-author" data-id="${a.id}">${ic('edit')}</button></div>` +
          `<div class="meta">${esc(person.affiliation || '')}</div>${(a.roles || []).length ? `<div class="meta">${(a.roles || []).map(creditLabel).map(esc).join('、')}</div>` : `<div class="meta">${T('還沒勾選 CRediT 角色', 'No CRediT roles yet')}</div>`}</div>`;
      }).join('')}</div><div class="d-actions"><button class="btn sm primary" data-act="author-text" data-id="${p.id}">${ic('doc')}${T('產生作者列與貢獻聲明', 'Author list and contributions')}</button></div>`
        : `<div class="empty">${T('從共同作者通訊錄加入作者、排順序、勾選 CRediT 角色，就能一鍵產生作者與單位列和 Author contributions。', 'Add authors from your co-author list, order them and tick CRediT roles to get the author/affiliation lines and the contributions statement.')}</div>`);
  }
  function authorTexts(p) {
    const list = authorsOf(p.id).map((a) => ({ a, person: byId('people', a.person_id) })).filter((x) => x.person);
    const affs = [];
    const sup = (n) => String(n).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]).join('');
    const names = list.map(({ a, person }) => {
      const nums = String(person.affiliation || '').split(/\s*;\s*|\n/).map((s) => s.trim()).filter(Boolean).map((aff) => { let i = affs.indexOf(aff); if (i < 0) { affs.push(aff); i = affs.length - 1; } return i + 1; });
      return person.name + (nums.length ? nums.map(sup).join('˒') : '') + (a.corresponding ? '*' : '');
    });
    const corr = list.filter((x) => x.a.corresponding).map((x) => `${x.person.name}${x.person.email ? ` (${x.person.email})` : ''}`);
    const authorLine = names.join(', ') + '\n\n' + affs.map((x, i) => `${sup(i + 1)} ${x}`).join('\n') + (corr.length ? `\n\n* Corresponding author: ${corr.join('; ')}` : '') +
      (list.some((x) => x.person.orcid) ? '\n\nORCID: ' + list.filter((x) => x.person.orcid).map((x) => `${x.person.name} ${x.person.orcid}`).join('; ') : '');
    const parts = CREDIT.map(([k, en]) => { const who = list.filter((x) => (x.a.roles || []).includes(k)).map((x) => x.person.name); return who.length ? `${en}: ${who.join(', ')}.` : ''; }).filter(Boolean);
    return { authorLine, credit: parts.length ? 'Author contributions (CRediT): ' + parts.join(' ') : '', plain: list.map((x) => x.person.name).join(', ') };
  }
  function authorTextDialog(p) {
    const t = authorTexts(p);
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `<form method="dialog"><div class="dlg-head">${T('作者列與貢獻聲明', 'Author list and contributions')}</div><div class="dlg-body">` +
      `<label class="f"><span>${T('作者與單位', 'Authors and affiliations')}</span><textarea class="inp" readonly rows="7">${esc(t.authorLine)}</textarea></label><div class="row" style="margin:-4px 0 12px"><button type="button" class="btn sm" data-copy="authorLine">${ic('copy')}${T('複製', 'Copy')}</button></div>` +
      `<label class="f"><span>Author contributions</span><textarea class="inp" readonly rows="6">${esc(t.credit || T('還沒有人勾選 CRediT 角色。', 'Nobody has CRediT roles yet.'))}</textarea></label><div class="row" style="margin:-4px 0 12px"><button type="button" class="btn sm" data-copy="credit"${t.credit ? '' : ' disabled'}>${ic('copy')}${T('複製', 'Copy')}</button></div>` +
      `<p class="muted small">${T('單位用分號隔開時，會分成不同的上標編號。', 'Affiliations separated by semicolons get separate numbers.')}</p></div>` +
      `<div class="dlg-foot"><button type="button" class="btn" data-sync>${T('用這個順序更新論文的作者列', 'Use this order for the paper’s author line')}</button><span class="spacer"></span><button class="btn primary" value="close">${T('完成', 'Done')}</button></div></form>`;
    document.body.appendChild(dlg);
    dlg.querySelectorAll('[data-copy]').forEach((b) => (b.onclick = () => navigator.clipboard.writeText(t[b.dataset.copy]).then(() => toast(T('已複製', 'Copied')), () => toast(T('無法複製', 'Could not copy')))));
    dlg.querySelector('[data-sync]').onclick = async () => { if (await save('papers', { authors: t.plain }, p.id)) { toast(T('作者列已更新', 'Author line updated')); await refresh(); } };
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }
  function editPerson(person, then) {
    formDialog({
      title: person ? T('編輯共同作者', 'Edit co-author') : T('新增共同作者', 'New co-author'), values: person || {},
      fields: [
        { name: 'name', label: T('姓名（論文上的寫法）', 'Name (as printed)'), required: true, max: 200, full: true, placeholder: 'Chia-Sung Chang' },
        { name: 'affiliation', label: T('單位（多個單位用分號隔開）', 'Affiliations (separate with semicolons)'), type: 'textarea', rows: 2, max: 1000, full: true },
        { name: 'degree', label: T('學位（選填）', 'Degree (optional)'), max: 60, placeholder: 'Ph.D.' },
        { name: 'orcid', label: 'ORCID', max: 60, placeholder: '0000-0000-0000-0000' },
        { name: 'email', label: 'Email', type: 'email', max: 300, full: true },
        { name: 'contact', label: T('署名的地址與電話（選填，當通訊作者時放在 cover letter）', 'Address and phone for signatures (optional, used when corresponding)'), type: 'textarea', rows: 3, max: 1000, full: true, placeholder: 'No.250 Wu-Hsing Street, Taipei 11031, Taiwan.\nTel: +886-2-…\nFax: +886-2-…' },
      ],
      onSave: async (row) => { const s = await save('people', row, person && person.id); if (!s) return false; toast(T('已儲存', 'Saved')); await refresh(); if (then) then(s); },
      onDelete: person && (async () => {
        const n = D.authors.filter((a) => a.person_id === person.id).length;
        if (!confirm(T(`要從通訊錄刪除「${person.name}」嗎？${n ? `他會從 ${n} 篇論文的作者名單中移除。` : ''}`, `Remove “${person.name}” from your co-authors?${n ? ` They leave the author list of ${n} paper(s).` : ''}`))) return false;
        if (!(await remove('people', person.id))) return false; toast(T('已刪除', 'Deleted')); await refresh(); return true;
      }),
    });
  }
  function addAuthor(paperId) {
    const taken = authorsOf(paperId).map((a) => a.person_id), free = D.people.filter((x) => !taken.includes(x.id));
    if (!free.length) { editPerson(null, (s) => insertAuthor(paperId, s.id)); return; }
    formDialog({
      title: T('加入作者', 'Add author'), saveLabel: T('加入', 'Add'),
      fields: [{ name: 'person_id', label: T('從共同作者選', 'Pick a co-author'), type: 'select', options: free.map((x) => [x.id, x.name + (x.affiliation ? ' · ' + x.affiliation.split(';')[0] : '')]), full: true, help: T('不在名單上？先按「取消」，再到「我的 › 共同作者」新增；或按下方「新增共同作者」。', 'Not listed? Use “New co-author” below.') }],
      onSave: async (row) => { await insertAuthor(paperId, row.person_id); },
    });
    setTimeout(() => { const foot = document.querySelector('dialog[open] .dlg-foot'); if (!foot) return; const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = T('新增共同作者', 'New co-author'); b.onclick = () => { foot.closest('dialog').close(); editPerson(null, (s) => insertAuthor(paperId, s.id)); }; foot.prepend(b); }, 0);
  }
  async function insertAuthor(paperId, personId) {
    if (authorsOf(paperId).some((a) => a.person_id === personId)) { toast(T('這位已經在作者名單裡了', 'Already an author on this paper')); return; }
    const pos = Math.max(0, ...authorsOf(paperId).map((a) => a.position)) + 1;
    if (await save('authors', { paper_id: paperId, person_id: personId, position: pos })) { toast(T('已加入', 'Added')); await refresh(); }
  }
  function editAuthor(a) {
    const person = byId('people', a.person_id) || {};
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `<form method="dialog"><div class="dlg-head">${esc(person.name || '')}</div><div class="dlg-body">` +
      `<label class="f" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="corresponding" style="width:auto;min-height:0"${a.corresponding ? ' checked' : ''}> ${T('通訊作者', 'Corresponding author')}</label>` +
      `<p class="muted small" style="margin:4px 0 8px">CRediT</p><div class="form-grid">${CREDIT.map(([k, en, zh]) => `<label class="f" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:6px"><input type="checkbox" name="role" value="${k}" style="width:auto;min-height:0;margin-top:4px"${(a.roles || []).includes(k) ? ' checked' : ''}> <span style="color:var(--ink)">${esc(en)}${LANG === 'en' ? '' : `<br><small class="muted">${esc(zh)}</small>`}</span></label>`).join('')}</div>` +
      `<button type="button" class="link" data-person>${T('編輯這位作者的單位、ORCID、email', 'Edit this author’s affiliation, ORCID, email')}</button></div>` +
      `<div class="dlg-foot"><button type="button" class="btn danger" data-del>${ic('trash')}${T('從這篇移除', 'Remove from paper')}</button><span class="spacer"></span><button class="btn" value="cancel" formnovalidate>${T('取消', 'Cancel')}</button><button class="btn primary" value="save">${T('儲存', 'Save')}</button></div></form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector('form');
    form.addEventListener('submit', async (e) => {
      if (!e.submitter || e.submitter.value !== 'save') return;
      e.preventDefault();
      const roles = Array.from(form.querySelectorAll('input[name=role]:checked')).map((x) => x.value);
      if (await save('authors', { corresponding: form.elements.corresponding.checked, roles }, a.id)) { dlg.close(); toast(T('已儲存', 'Saved')); await refresh(); }
    });
    dlg.querySelector('[data-del]').onclick = async () => { if (await remove('authors', a.id)) { dlg.close(); toast(T('已移除', 'Removed')); await refresh(); } };
    dlg.querySelector('[data-person]').onclick = () => { dlg.close(); editPerson(person); };
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }
  async function moveAuthor(id, dir) {
    const a = byId('authors', id), list = authorsOf(a.paper_id), i = list.indexOf(a), j = i + dir;
    if (j < 0 || j >= list.length) return;
    const order = list.slice(); [order[i], order[j]] = [order[j], order[i]];
    const res = await Promise.all(order.map((x, k) => (x.position === k + 1 ? null : sb.from(TABLE.authors).update({ position: k + 1 }).eq('id', x.id))).filter(Boolean));
    const bad = res.find((r) => r.error); if (bad) toast(bad.error.message, 5000);
    await refresh();
  }

  /* ---------------- submission checklist ---------------- */
  const DEFAULT_CHECKLIST = () => [
    T('全文字數', 'Main text word count'), T('摘要字數', 'Abstract word count'), T('報告指引（STROBE / RECORD / PRISMA）', 'Reporting guideline (STROBE / RECORD / PRISMA)'),
    'Cover letter', T('圖 300 dpi 以上', 'Figures at 300 dpi or more'), T('參考文獻格式', 'Reference style'), T('利益衝突聲明', 'Conflict of interest statement'),
    T('資料可得性聲明', 'Data availability statement'), T('作者貢獻（CRediT）', 'Author contributions (CRediT)'), T('倫理審查編號', 'Ethics approval number'),
  ];
  const template = () => (SETTINGS && Array.isArray(SETTINGS.checklist_template) && SETTINGS.checklist_template.length ? SETTINGS.checklist_template : DEFAULT_CHECKLIST());
  const normJ = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const journalByName = (name) => D.journals.find((j) => normJ(j.name) === normJ(name));
  // a hint next to an item, from what the system already knows
  function itemHint(text, p) {
    const j = journalByName(p.checklist && p.checklist.journal || p.target_journal);
    if (/摘要|abstract/i.test(text) && j && j.abstract_limit) return T(`上限 ${j.abstract_limit} 字`, `limit ${j.abstract_limit} words`);
    if (/全文|word count|main text/i.test(text) && j && j.word_limit) return T(`上限 ${j.word_limit} 字`, `limit ${j.word_limit} words`);
    if (/指引|guideline/i.test(text) && j && j.guideline) return esc(j.guideline);
    if (/倫理|ethic|IRB/i.test(text) && p.project_id) { const m = D.milestones.filter((x) => x.project_id === p.project_id && x.kind === 'irb' && x.ref); if (m.length) return esc(m.map((x) => x.ref).join(', ')); }
    if (/CRediT|作者貢獻|contribution/i.test(text) && authorsOf(p.id).length) return `<button class="link" data-act="author-text" data-id="${p.id}">${T('產生', 'Generate')}</button>`;
    return '';
  }
  function tabPrep(p) {
    const cl = p.checklist && Array.isArray(p.checklist.items) ? p.checklist : null;
    const journal = (cl && cl.journal) || p.target_journal || '';
    const j = journalByName(journal);
    const head = `<div class="card" style="margin-bottom:12px"><div class="row" style="justify-content:space-between"><div><b>${journal ? esc(journal) : T('還沒設定目標期刊', 'No target journal yet')}</b>` +
      (j ? `<div class="muted small">${[j.word_limit ? T(`全文 ${j.word_limit} 字`, `${j.word_limit} words`) : '', j.abstract_limit ? T(`摘要 ${j.abstract_limit} 字`, `abstract ${j.abstract_limit}`) : '', j.guideline || '', j.url ? `<a href="${esc(j.url)}" target="_blank" rel="noopener">${T('投稿網址', 'Submission site')}</a>` : ''].filter(Boolean).join(' · ')}</div>` : (journal ? `<div class="muted small"><a href="#/journal/${encodeURIComponent(journal)}">${T('填這家期刊的字數限制', 'Add this journal’s limits')}</a></div>` : '')) +
      `</div><button class="btn sm" data-act="edit-paper" data-id="${p.id}">${T('改目標期刊', 'Change journal')}</button></div></div>`;
    if (!cl) return head + `<div class="empty">${T('投稿前逐項檢查：字數、報告指引、cover letter、各種聲明。清單可以在「我的」改成你習慣的版本。', 'Go through the checklist before you submit: word counts, guideline, cover letter, statements. Edit the list under “Me”.')}<br><span class="row" style="justify-content:center"><button class="btn primary" data-act="start-check" data-id="${p.id}">${T('開始檢查', 'Start checklist')}</button><button class="btn" data-act="cover" data-id="${p.id}">Cover letter</button></span></div>`;
    const done = cl.items.filter((x) => x.done).length;
    return head + `<div class="row" style="justify-content:space-between;margin-bottom:8px"><b>${T(`已完成 ${done}/${cl.items.length}`, `${done}/${cl.items.length} done`)}</b><span class="row"><button class="btn sm" data-act="cover" data-id="${p.id}">Cover letter</button><button class="btn sm" data-act="start-check" data-id="${p.id}">${T('開始新一輪', 'Start over')}</button>${done === cl.items.length ? `<button class="btn sm primary" data-act="new-round" data-id="${p.id}">${ic('plus')}${T('記錄投稿', 'Record submission')}</button>` : ''}</span></div>` +
      `<div class="list">${cl.items.map((it, i) => `<label class="ms${it.done ? ' done' : ''}" style="cursor:pointer"><input type="checkbox" data-act="check-item" data-id="${p.id}" data-i="${i}" ${it.done ? 'checked' : ''} style="position:absolute;opacity:0;width:1px;height:1px"><span class="tick">${it.done ? ic('check') : ''}</span><span><h4>${esc(it.text)}</h4><span class="meta">${itemHint(it.text, p)}</span></span><span></span></label>`).join('')}</div>`;
  }
  async function startChecklist(p) {
    if (p.checklist && p.checklist.items && p.checklist.items.some((x) => x.done) && !confirm(T('要重新開始檢查嗎？目前打的勾會清掉。', 'Start over? Current ticks are cleared.'))) return;
    const items = template().map((t) => ({ text: String(t), done: false }));
    if (await save('papers', { checklist: { items, journal: p.target_journal || null, started: localISO(new Date()) } }, p.id)) await refresh();
  }
  async function toggleItem(p, i, on) {
    const cl = JSON.parse(JSON.stringify(p.checklist)); cl.items[i].done = on;
    if (await save('papers', { checklist: cl }, p.id)) { p.checklist = cl; render(true); }
  }

  /* ---------------- journals: your own notes, and numbers from your own submissions ---------------- */
  const papersSeg = (which) => `<div class="seg" role="tablist" style="margin-bottom:6px"><a role="tab" class="seg-a" href="#/papers" aria-selected="${which === 'papers'}">${T('論文', 'Papers')}</a><a role="tab" class="seg-a" href="#/journals" aria-selected="${which === 'journals'}">${T('期刊', 'Journals')}</a></div>`;
  function journalStats(name) {
    const rs = D.rounds.filter((r) => normJ(r.journal) === normJ(name));
    const papers = [...new Set(rs.map((r) => r.paper_id))];
    const firstDays = papers.map((pid) => { const r = rs.filter((x) => x.paper_id === pid)[0]; return r && r.decision_on ? days(parseDate(r.submitted_on), parseDate(r.decision_on)) : null; }).filter((x) => x !== null && x >= 0);
    const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
    return { rounds: rs, papers: papers.length, firstMedian: median(firstDays), firstN: firstDays.length, desk: papers.filter((pid) => rs.some((r) => r.paper_id === pid && r.decision === 'desk_reject')).length, accepted: papers.filter((pid) => rs.some((r) => r.paper_id === pid && r.decision === 'accept')).length, rejected: papers.filter((pid) => rs.some((r) => r.paper_id === pid && r.decision === 'reject')).length, roundsPer: papers.length ? (rs.length / papers.length) : 0 };
  }
  function allJournalNames() {
    const names = new Map();
    D.journals.forEach((j) => names.set(normJ(j.name), j.name));
    D.rounds.forEach((r) => { if (!names.has(normJ(r.journal))) names.set(normJ(r.journal), r.journal); });
    D.papers.forEach((p) => { if (p.target_journal && !names.has(normJ(p.target_journal))) names.set(normJ(p.target_journal), p.target_journal); });
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }
  function listJournals(current) {
    const names = allJournalNames();
    return ph(T('期刊', 'Journals'), { actions: `<button class="btn primary sm" data-act="new-journal">${ic('plus')}${T('期刊', 'Journal')}</button>` }) + papersSeg('journals') +
      (names.length ? `<div class="list" style="margin-top:12px">${names.map((n) => { const s = journalStats(n), j = journalByName(n);
        const meta = [s.papers ? T(`投稿 ${s.papers} 次`, `${s.papers} submission${s.papers > 1 ? 's' : ''}`) : T('還沒投過', 'Not submitted yet'), s.firstMedian !== null ? T(`第一次結果約 ${s.firstMedian} 天`, `first decision ~${s.firstMedian} d`) : '', j && j.word_limit ? T(`全文 ${j.word_limit} 字`, `${j.word_limit} words`) : ''].filter(Boolean);
        return `<a class="item${normJ(n) === normJ(current) ? ' on' : ''}" href="#/journal/${encodeURIComponent(n)}"><div class="item-head"><h3>${esc(n)}</h3>${s.accepted ? `<span class="chip ok">${T('接受', 'Accepted')} ${s.accepted}</span>` : ''}</div><div class="meta">${meta.join(' · ')}</div></a>`; }).join('')}</div>`
        : `<div class="empty" style="margin-top:12px">${T('投過的期刊會自動出現在這裡，並從你的紀錄算出平均審查天數、desk reject 次數等。', 'Journals you submit to appear here with numbers from your own records: days to first decision, desk rejections and more.')}</div>`);
  }
  function detailJournal(name) {
    const j = journalByName(name), s = journalStats(name), t = today();
    const stat = (label, v) => `<div class="metric"><span>${label}</span><b>${v}</b></div>`;
    const hist = s.rounds.slice().sort((a, b) => parseDate(b.submitted_on) - parseDate(a.submitted_on)).map((r) => { const p = byId('papers', r.paper_id);
      return `<a class="ag" href="#/paper/${r.paper_id}"><span class="when" style="color:var(--muted)">${ymd(r.submitted_on)}</span><span class="what"><b>${esc(p ? paperName(p) : '?')}</b><small>${esc(DECISION()[r.decision])}${r.decision_on ? ' · ' + T(`${days(parseDate(r.submitted_on), parseDate(r.decision_on))} 天`, `${days(parseDate(r.submitted_on), parseDate(r.decision_on))} d`) : r.decision === 'pending' ? ' · ' + T(`已等 ${days(parseDate(r.submitted_on), t)} 天`, `${days(parseDate(r.submitted_on), t)} d so far`) : ''}</small></span><span class="chev">${ic('chev')}</span></a>`; }).join('');
    const kv = j ? [[T('全文字數上限', 'Word limit'), j.word_limit], [T('摘要字數上限', 'Abstract limit'), j.abstract_limit], [T('報告指引', 'Guideline'), j.guideline], ['APC', j.apc], [T('投稿網址', 'Submission site'), j.url ? `<a href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.url.replace(/^https?:\/\//, ''))}</a>` : ''], [T('備註', 'Notes'), j.notes ? esc(j.notes) : '']].filter((x) => x[1]) : [];
    return ph(name, { back: '#/journals', backMobileOnly: true, actions: `<button class="btn sm" data-act="edit-journal" data-name="${esc(name)}">${ic('edit')}${j ? T('編輯', 'Edit') : T('填資料', 'Add details')}</button>` }) +
      `<p class="muted small" style="margin-bottom:10px">${T('以下數字只來自你自己的投稿紀錄。', 'These numbers come only from your own records.')}</p>` +
      `<div class="metrics">${stat(T('投稿次數', 'Submissions'), s.papers)}${stat(T('第一次結果（中位數）', 'First decision (median)'), s.firstMedian !== null ? T(`${s.firstMedian} 天`, `${s.firstMedian} d`) : '—')}${stat('Desk reject', s.papers ? `${s.desk}/${s.papers}` : '—')}${stat(T('接受', 'Accepted'), s.papers ? `${s.accepted}/${s.papers}` : '—')}</div>` +
      (s.papers ? `<p class="muted small" style="margin-top:8px">${T(`平均每篇審 ${s.roundsPer.toFixed(1)} 輪`, `${s.roundsPer.toFixed(1)} rounds per paper on average`)}</p>` : '') +
      (kv.length ? `<h2 class="sec-title">${T('期刊資料', 'Details')}</h2><dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${typeof v === 'number' ? v : v}</dd>`).join('')}</dl>` : `<div class="empty" style="margin-top:14px">${T('填上字數限制和投稿網址，「投稿準備」的檢查清單就會直接顯示。', 'Add word limits and the submission site; the checklist will show them.')}</div>`) +
      (hist ? `<h2 class="sec-title">${T('你的投稿歷史', 'Your history')}</h2><div class="agenda">${hist}</div>` : '');
  }
  function editJournal(name) {
    const j = name ? journalByName(name) : null;
    formDialog({
      title: j ? T('編輯期刊', 'Edit journal') : T('期刊資料', 'Journal details'), values: j || { name: name || '' },
      fields: [
        { name: 'name', label: T('期刊名稱', 'Journal name'), required: true, max: 300, full: true },
        { name: 'word_limit', label: T('全文字數上限', 'Word limit'), type: 'number' },
        { name: 'abstract_limit', label: T('摘要字數上限', 'Abstract word limit'), type: 'number' },
        { name: 'guideline', label: T('要求的報告指引', 'Required guideline'), max: 300, placeholder: 'STROBE, RECORD' },
        { name: 'apc', label: 'APC', max: 200, placeholder: 'USD 2,900' },
        { name: 'url', label: T('投稿網址', 'Submission site'), type: 'url', max: 1000, full: true },
        { name: 'notes', label: T('備註', 'Notes'), type: 'textarea', max: 5000, full: true },
      ],
      onSave: async (row) => {
        const other = journalByName(row.name);
        if (other && (!j || other.id !== j.id)) { toast(T('已經有這家期刊了', 'This journal is already listed')); return false; }
        const s = await save('journals', row, j && j.id); if (!s) return false;
        toast(T('已儲存', 'Saved')); await refresh(); location.hash = '#/journal/' + encodeURIComponent(s.name);
      },
      onDelete: j && (async () => { if (!confirm(T(`要刪除「${j.name}」的期刊資料嗎？投稿紀錄不會受影響。`, `Delete the details for “${j.name}”? Submission records stay.`))) return false; if (!(await remove('journals', j.id))) return false; toast(T('已刪除', 'Deleted')); await refresh(); location.hash = '#/journals'; return true; }),
    });
  }

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
    if (t.repeat !== 'none') meta.push(`${ic('repeat')}${esc(REPEAT()[t.repeat])}`);
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

  function pageMe() {
    return ph(T('我的', 'Me')) +
      `<div class="card"><h3>${T('帳號', 'Account')}</h3><p style="font-weight:700;margin-bottom:12px">${esc(USER.email)}</p>
        <form id="f-pw" class="form-grid" novalidate>
          <label class="f"><span>${tt('newPassword')}</span><input type="password" name="password" autocomplete="new-password" minlength="8"></label>
          <label class="f"><span>${tt('confirmPassword')}</span><input type="password" name="password2" autocomplete="new-password" minlength="8"></label>
          <div class="full"><button class="btn sm" type="submit">${T('變更密碼', 'Change password')}</button></div>
        </form></div>` +
      `<div class="card"><h3>${T('語言與外觀', 'Language')}</h3><div class="seg" style="max-width:16rem" role="tablist"><button type="button" data-act="lang" data-lang="zh" aria-selected="${LANG === 'zh'}">中文</button><button type="button" data-act="lang" data-lang="en" aria-selected="${LANG === 'en'}">English</button></div>
        <p class="muted small" style="margin-top:10px">${T('手機上可以從瀏覽器選單「加到主畫面」，之後像 App 一樣打開。深色模式跟著系統設定。', 'On a phone, use “Add to Home Screen” in the browser menu to open it like an app. Dark mode follows your system.')}</p></div>` +
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
      `<div class="card"><h3>${T('其他', 'More')}</h3><div class="d-actions" style="margin-top:0"><a class="btn sm" href="../index.html">← Research Toolkit</a><button class="btn sm" data-act="logout">${T('登出', 'Sign out')}</button></div>
        <p class="muted small" style="margin:12px 0 8px">${T('刪除帳號會一併刪除你存的所有專案、論文、審稿意見和截止日，無法復原。', 'Deleting your account removes every project, paper, reviewer comment and deadline you saved. This cannot be undone.')}</p>
        <button class="btn sm danger" data-act="delete-account">${ic('trash')}${T('刪除我的帳號', 'Delete my account')}</button></div>`;
  }

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
    else if (a === 'todos') html = pageTodos();
    else if (a === 'stats') { section = ''; html = pageStats(); }
    else if (a === 'me') html = pageMe();
    else { section = ''; html = pageHome(); }
    const y = window.scrollY;
    main.className = 'main' + (split ? ' split' : '');
    main.innerHTML = html;
    renderNav(section);
    document.title = tt('appName');
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
    if (a === 'me') bindMe();
  }
  const emptyPane = (t) => `<div class="empty" style="margin-top:22px">${esc(t)}</div>`;
  window.addEventListener('hashchange', () => render(false));
  let lastWide = isWide();
  window.addEventListener('resize', () => { if (isWide() !== lastWide) { lastWide = isWide(); render(true); } });
  async function refresh() { if (await loadAll()) render(true); }

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
      title: p ? T('編輯論文', 'Edit paper') : T('新增論文', 'New paper'), values: p || { status: 'drafting', project_id: projectId || '' },
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
  const statusFromRound = (r) => ({ pending: 'under_review', major: 'revision', minor: 'revision', accept: 'accepted', reject: 'rejected', desk_reject: 'rejected', withdrawn: 'withdrawn' }[r.decision] || null);
  function editRound(paperId, r) {
    const p = byId('papers', r ? r.paper_id : paperId), rs = roundsOf(p.id), lr = rs[rs.length - 1];
    const def = r || { journal: lr ? (['reject', 'desk_reject'].includes(lr.decision) ? '' : lr.journal) : (p.target_journal || ''), submitted_on: localISO(new Date()), decision: 'pending' };
    formDialog({
      title: r ? T(`編輯第 ${rs.indexOf(r) + 1} 輪`, `Edit round ${rs.indexOf(r) + 1}`) : lr ? T('下一輪（修改後再送或轉投）', 'Next round (resubmission or new journal)') : T('記錄投稿', 'Record submission'), values: def,
      fields: [
        { name: 'journal', label: T('期刊', 'Journal'), required: true, max: 300, suggest: allJournalNames() },
        { name: 'submitted_on', label: T('投稿日', 'Submitted'), type: 'date', required: true },
        { name: 'decision', label: T('結果', 'Decision'), type: 'select', options: opt(DECISION()) },
        { name: 'decision_on', label: T('收到結果', 'Decision received'), type: 'date' },
        { name: 'response_on', label: T('送出回覆', 'Response sent'), type: 'date', help: T('修改後重新送審的日期', 'When the revision went back') },
        { name: 'notes', label: T('編輯的信、其他紀錄', 'Editor’s letter, other notes'), type: 'textarea', max: 10000, full: true },
        { name: 'links', label: T('檔案連結（選填）', 'File links (optional)'), type: 'links', help: T('貼上雲端硬碟的分享連結，例如這一輪送出的稿件和回覆信。', 'Paste share links from your cloud storage, e.g. the manuscript and response sent this round.') },
      ],
      onSave: async (row) => {
        if (!r) row.paper_id = p.id;
        const s = await save('rounds', row, r && r.id); if (!s) return false;
        await loadAll();
        const all = roundsOf(p.id), isLast = all.length && all[all.length - 1].id === s.id, st = isLast ? statusFromRound(s) : null;
        if (st && st !== p.status && !(p.status === 'published' && st === 'accepted')) { await save('papers', { status: st }, p.id); await loadAll(); toast(T(`已儲存，狀態改成「${STATUS()[st]}」`, `Saved; status is now “${STATUS()[st]}”`)); }
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
  function pasteComments(roundId) {
    const used = commentsOf(roundId).map((x) => x.reviewer);
    const dlg = formDialog({
      title: T('貼上審稿意見', 'Paste reviewer comments'), values: { reviewer: used.length ? REVIEWERS[Math.min(REVIEWERS.length - 1, REVIEWERS.indexOf(used[used.length - 1]) + 1)] || 'Reviewer 1' : 'Reviewer 1' },
      saveLabel: T('加入', 'Add'),
      fields: [
        { name: 'reviewer', label: T('誰的意見', 'From'), type: 'select', options: reviewerOptions() },
        { name: 'text', label: T('整段意見', 'All the comments'), type: 'textarea', rows: 10, required: true, max: 200000, full: true, help: T('會依「1.」「2.」「Comment 3:」或空行切成一條一條。', 'Split at “1.”, “2.”, “Comment 3:” or blank lines.') },
      ],
      onSave: async (row) => {
        const parts = splitComments(row.text);
        if (!parts.length) { toast(T('沒有找到內容', 'Nothing to add')); return false; }
        let seq = nextSeq(roundId, row.reviewer);
        const rows = parts.map((t) => ({ round_id: roundId, reviewer: row.reviewer, seq: seq++, comment: t.slice(0, 20000), status: 'todo' }));
        const r = await sb.from(TABLE.comments).insert(rows);
        if (r.error) { toast(T('儲存失敗：', 'Could not save: ') + r.error.message, 6000); return false; }
        toast(T(`已加入 ${rows.length} 條意見`, `${rows.length} comment${rows.length > 1 ? 's' : ''} added`)); await refresh();
      },
    });
    // live count of how the text will be split
    const ta = dlg.querySelector('textarea[name=text]'), help = ta.parentNode.querySelector('.help'), base = help.textContent;
    ta.addEventListener('input', () => { const n = splitComments(ta.value).length; help.textContent = n ? T(`會加入 ${n} 條。`, `${n} comment${n > 1 ? 's' : ''} will be added. `) + base : base; });
  }

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
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
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
    D.rounds.forEach((r) => { const y = yr(r.decision_on || r.submitted_on); if (r.decision === 'accept') Y(y).accepted++; if (r.decision === 'reject') Y(y).rejected++; if (r.decision === 'desk_reject') { Y(y).rejected++; Y(y).desk++; } });
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
    const st = { accepted: T('已接受', 'Accepted'), published: T('已發表', 'Published') }[p.status] || T('審查中', 'Under review');
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

  /* ---------------- backup: export and restore ---------------- */
  // columns that belong in a backup, per table (owner is never exported; the database fills it in on restore)
  const COLS = {
    projects: ['id', 'title', 'short_title', 'stage', 'role', 'collaborators', 'start_date', 'target_date', 'notes', 'created_at', 'updated_at'],
    milestones: ['id', 'project_id', 'title', 'kind', 'due', 'done_on', 'expires_on', 'ref', 'notes', 'created_at'],
    papers: ['id', 'project_id', 'title', 'short_title', 'authors', 'my_role', 'status', 'target_journal', 'deadline', 'doi', 'year', 'notes', 'checklist', 'cover', 'created_at', 'updated_at'],
    rounds: ['id', 'paper_id', 'journal', 'submitted_on', 'decision', 'decision_on', 'response_on', 'notes', 'links', 'created_at'],
    comments: ['id', 'round_id', 'reviewer', 'seq', 'comment', 'response', 'changes', 'status', 'created_at', 'updated_at'],
    deadlines: ['id', 'title', 'kind', 'due', 'url', 'done', 'notes', 'created_at'],
    todos: ['id', 'title', 'notes', 'due', 'done_at', 'starred', 'repeat', 'next_id', 'project_id', 'paper_id', 'created_at'],
    journals: ['id', 'name', 'word_limit', 'abstract_limit', 'apc', 'url', 'guideline', 'notes', 'created_at'],
    people: ['id', 'name', 'degree', 'affiliation', 'orcid', 'email', 'contact', 'created_at'],
    authors: ['id', 'paper_id', 'person_id', 'position', 'corresponding', 'roles', 'created_at'],
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
      [T('投稿輪次', 'Rounds'), D.rounds.map((r) => ({ [T('論文', 'Paper')]: pName(r.paper_id), [T('第幾輪', 'Round')]: roundNo(r), [T('期刊', 'Journal')]: r.journal, [T('投稿日', 'Submitted')]: r.submitted_on, [T('結果', 'Decision')]: DECISION()[r.decision], [T('收到結果', 'Decision on')]: r.decision_on, [T('送出回覆', 'Response sent')]: r.response_on, [T('備註', 'Notes')]: r.notes }))],
      [T('審稿意見', 'Reviewer comments'), D.comments.map((c) => { const r = byId('rounds', c.round_id) || {}; return { [T('論文', 'Paper')]: pName(r.paper_id), [T('輪次', 'Round')]: r.id ? roundNo(r) : '', [T('期刊', 'Journal')]: r.journal, [T('誰', 'From')]: c.reviewer, [T('編號', 'No.')]: c.seq, [T('意見', 'Comment')]: c.comment, [T('回覆', 'Response')]: c.response, [T('修改位置', 'Changes')]: c.changes, [T('狀態', 'Status')]: C_STATUS()[c.status] }; })],
      [T('待辦', 'To-dos'), D.todos.map((t) => ({ [T('名稱', 'Name')]: t.title, [T('日期', 'Date')]: t.due, [T('重複', 'Repeat')]: REPEAT()[t.repeat], [T('重要', 'Important')]: t.starred ? '★' : '', [T('專案', 'Project')]: jName(t.project_id), [T('論文', 'Paper')]: pName(t.paper_id), [T('完成時間', 'Done at')]: t.done_at ? t.done_at.slice(0, 16).replace('T', ' ') : '', [T('備註', 'Notes')]: t.notes }))],
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
      const summary = T(`備份日期 ${String(obj.exportedAt || '').slice(0, 10)}：專案 ${count('projects')}、論文 ${count('papers')}、投稿輪次 ${count('rounds')}、審稿意見 ${count('comments')}、截止日 ${count('deadlines')}、待辦 ${count('todos')}、期刊 ${count('journals')}、共同作者 ${count('people')}。`, `Backup from ${String(obj.exportedAt || '').slice(0, 10)}: ${count('projects')} projects, ${count('papers')} papers, ${count('rounds')} rounds, ${count('comments')} comments, ${count('deadlines')} deadlines, ${count('todos')} to-dos, ${count('journals')} journals, ${count('people')} co-authors.`);
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
        for (const k of ['todos', 'authors', 'comments', 'rounds', 'papers', 'milestones', 'projects', 'deadlines', 'journals', 'people']) {
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
        ['todos', (r) => ({ ...r, id: nid(r.id), next_id: r.next_id ? nid(r.next_id) : null, project_id: r.project_id ? map[r.project_id] || null : null, paper_id: r.paper_id ? map[r.paper_id] || null : null })],
      ];
      let total = 0;
      for (const [k, fix] of plan) {
        const rows = (Array.isArray(d[k]) ? d[k] : []).map((r) => pick(r, COLS[k])).map(fix).filter(Boolean);
        for (let i = 0; i < rows.length; i += 200) { const r = await sb.from(TABLE[k]).insert(rows.slice(i, i + 200)); if (r.error) throw r.error; }
        total += rows.length;
      }
      if (d.settings && (replace || !SETTINGS)) { const r = await sb.from('research_settings').upsert({ owner: USER.id, checklist_template: d.settings.checklist_template || null, cover_template: d.settings.cover_template || null }); if (r.error) throw r.error; }
      await refresh();
      toast(T(`還原完成，共 ${total} 筆`, `Restored ${total} records`), 4000);
    } catch (e) { console.error(e); await refresh(); return fail(e); }
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

  /* ---------------- events ---------------- */
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b || !USER) return;
    const act = b.dataset.act, id = b.dataset.id;
    if (['select', 'textarea'].includes(b.tagName.toLowerCase())) return;
    if (b.tagName === 'A' && act) e.preventDefault();
    switch (act) {
      case 'new-project': return editProject();
      case 'edit-project': return editProject(byId('projects', id));
      case 'new-ms': return editMilestone(id);
      case 'edit-ms': { const m = byId('milestones', id); return editMilestone(m.project_id, m); }
      case 'set-stage': { const p = byId('projects', id); if (p.stage === b.dataset.stage) return; if (await save('projects', { stage: b.dataset.stage }, id)) { toast(T(`階段改成「${STAGE()[b.dataset.stage]}」`, `Stage set to “${STAGE()[b.dataset.stage]}”`)); refresh(); } return; }
      case 'new-paper': return editPaper(null, b.dataset.project);
      case 'edit-paper': return editPaper(byId('papers', id));
      case 'new-round': return editRound(id);
      case 'edit-round': return editRound(null, byId('rounds', id));
      case 'new-deadline': return editDeadline();
      case 'new-todo': return editTodo(null, { project: b.dataset.project, paper: b.dataset.paper });
      case 'edit-todo': return editTodo(byId('todos', id));
      case 'todo-done': { b.disabled = true; await toggleTodo(byId('todos', id)); return; }
      case 'todo-star': { const t = byId('todos', id); if (await save('todos', { starred: !t.starred }, id)) await refresh(); return; }
      case 'edit-deadline': return editDeadline(byId('deadlines', id));
      case 'new-comment': return editComment(id);
      case 'edit-comment': { const c = byId('comments', id); return editComment(c.round_id, c); }
      case 'paste-comments': return pasteComments(id);
      case 'letter': return letterDialog(id);
      case 'cite': return citeDialog(byId('papers', id));
      case 'add-author': return addAuthor(id);
      case 'edit-author': return editAuthor(byId('authors', id));
      case 'author-up': return moveAuthor(id, -1);
      case 'author-down': return moveAuthor(id, 1);
      case 'author-text': { const dlg = b.closest('dialog'); if (dlg) dlg.close(); return authorTextDialog(byId('papers', id)); }
      case 'new-person': return editPerson(null);
      case 'edit-person': return editPerson(byId('people', id));
      case 'start-check': return startChecklist(byId('papers', id));
      case 'new-journal': return editJournal(null);
      case 'edit-journal': return editJournal(b.dataset.name);
      case 'reset-template': { const r = await sb.from('research_settings').upsert({ owner: USER.id, checklist_template: null, cover_template: SETTINGS ? SETTINGS.cover_template : null, updated_at: new Date().toISOString() }).select().single(); if (!r.error) { SETTINGS = r.data; render(true); toast(T('已還原預設清單', 'Default list restored')); } return; }
      case 'export-xlsx': return exportXlsx();
      case 'cover': return coverDialog(byId('papers', id));
      case 'stats-xlsx': return statsXlsx();
      case 'reset-cover': { const r = await sb.from('research_settings').upsert({ owner: USER.id, checklist_template: SETTINGS ? SETTINGS.checklist_template : null, cover_template: null, updated_at: new Date().toISOString() }).select().single(); if (!r.error) { SETTINGS = r.data; render(true); toast(T('已還原預設範本', 'Default template restored')); } return; }
      case 'export-json': return exportJson();
      case 'import-json': return importJson();
      case 'expand': { const el = document.querySelector(`#cm-${id} .cm-text`); el.classList.remove('clamp'); b.remove(); return; }
      case 'lang': LANG = b.dataset.lang; try { localStorage.setItem('rt:lang', LANG); } catch (err) { /* ignore */ } document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-Hant'; render(true); return;
      case 'logout': await sb.auth.signOut(); location.hash = ''; location.reload(); return;
      case 'delete-account': {
        const word = T('刪除', 'DELETE');
        const typed = prompt(T(`這會永久刪除你的帳號和所有紀錄，無法復原。\n確定的話請輸入「${word}」。`, `This permanently deletes your account and every record in it. It cannot be undone.\nType ${word} to confirm.`));
        if (typed === null || typed.trim() !== word) return;
        const { error } = await sb.rpc('delete_my_account');
        if (error) { toast(friendly(error), 6000); return; }
        await sb.auth.signOut(); alert(T('帳號和所有紀錄已刪除。', 'Your account and all records were deleted.')); location.hash = ''; location.reload(); return;
      }
      case 'toggle-code': { const { error } = await sb.rpc('set_invite_disabled', { p_id: id, p_disabled: b.dataset.off === '1' }); if (error) toast(friendly(error), 5000); else loadCodes(); return; }
      default:
    }
  });
  // quick add on the to-do page
  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'f-todo') return;
    e.preventDefault();
    const f = e.target, title = f.title.value.trim();
    if (!title) { f.title.focus(); return; }
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    const s = await save('todos', { title, due: f.due.value || null });
    btn.disabled = false;
    if (s) { await refresh(); const inp = $('f-todo') && $('f-todo').title; if (inp) inp.focus(); }
  });
  document.addEventListener('change', async (e) => {
    const el = e.target, act = el.dataset && el.dataset.act; if (!act || !USER) return;
    if (act === 'check-item') { toggleItem(byId('papers', el.dataset.id), +el.dataset.i, el.checked); return; }
    if (act === 'pick-round') { REVIEW_ROUND[el.dataset.id] = el.value; history.replaceState(null, '', `#/paper/${el.dataset.id}/reviews`); render(true); }
    if (act === 'comment-status') {
      const c = byId('comments', el.dataset.id);
      if (await save('comments', { status: el.value }, c.id)) { c.status = el.value; el.closest('.cm').classList.toggle('done', el.value === 'done'); updateProgress(c.round_id); }
    }
  });
  // responses save themselves a moment after typing stops; a written answer moves "to do" to "draft"
  const respTimers = {};
  document.addEventListener('input', (e) => {
    const el = e.target; if (!el.dataset || !['response', 'changes'].includes(el.dataset.act)) return;
    const key = el.dataset.id + el.dataset.act;
    clearTimeout(respTimers[key]);
    respTimers[key] = setTimeout(() => saveResponse(el), 800);
  });
  document.addEventListener('focusout', (e) => { const el = e.target; if (el.dataset && ['response', 'changes'].includes(el.dataset.act) && respTimers[el.dataset.id + el.dataset.act]) { clearTimeout(respTimers[el.dataset.id + el.dataset.act]); saveResponse(el); } });
  async function saveResponse(el) {
    const id = el.dataset.id, field = el.dataset.act, c = byId('comments', id); if (!c) return;
    delete respTimers[id + field];
    const v = el.value.trim() || null;
    if ((c[field] || null) === v) return;
    const row = { [field]: v };
    if (field === 'response' && v && c.status === 'todo') row.status = 'draft';
    const s = await save('comments', row, id); if (!s) return;
    Object.assign(c, s);
    const card = $('cm-' + id), sel = card && card.querySelector('select');
    if (sel) sel.value = c.status;
    const ok = $('saved-' + id); if (ok) { ok.classList.add('show'); setTimeout(() => ok.classList.remove('show'), 1600); }
    updateProgress(c.round_id);
  }
  function updateProgress(roundId) {
    const host = document.querySelector('.rv-progress'); if (!host) return;
    const cs = commentsOf(roundId), groups = {}; cs.forEach((c) => (groups[c.reviewer] = groups[c.reviewer] || []).push(c));
    host.innerHTML = Object.keys(groups).sort(reviewerOrder).map((n) => { const arr = groups[n], open = arr.filter((c) => ['todo', 'draft'].includes(c.status)).length; return `<span class="chip ${open ? 'warn' : 'ok'}">${esc(n)} ${arr.length - open}/${arr.length}</span>`; }).join('');
    renderNav(route().a === 'paper' ? 'papers' : route().a);
  }

  /* ---------------- sign in / up ---------------- */
  function authMsg(text, ok) { const m = $('auth-msg'); m.hidden = !text; m.textContent = text || ''; m.className = 'msg' + (ok ? ' ok' : ''); }
  function showAuthForm(which) {
    ['in', 'up', 'reset'].forEach((k) => { $('f-' + k).hidden = k !== which; });
    $('tab-in').setAttribute('aria-selected', String(which === 'in'));
    $('tab-up').setAttribute('aria-selected', String(which === 'up'));
    $('auth-tabs').hidden = which === 'reset';
    authMsg('');
  }
  function paintAuth() {
    document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-Hant';
    $('auth-title').textContent = tt('appName'); $('auth-sub').textContent = tt('appSub');
    $('tab-in').textContent = tt('signIn'); $('tab-up').textContent = tt('createAccount');
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = tt(el.dataset.t); });
    $('auth-lang').textContent = LANG === 'en' ? '中文' : 'English';
  }
  function friendly(err) {
    const m = String((err && err.message) || err || '');
    if (/invalid login credentials/i.test(m)) return T('Email 或密碼不對。', 'Wrong email or password.');
    if (/already registered|already been registered|user already exists/i.test(m)) return T('這個 Email 已經註冊過了，請直接登入。', 'This email already has an account. Sign in instead.');
    if (/database error saving new user|invalid invite code/i.test(m)) return T('邀請碼無效、已過期或已用完。', 'The invite code is invalid, expired or used up.');
    if (/email not confirmed/i.test(m)) return T('請先到信箱點確認連結，再回來登入。', 'Confirm your email first, then sign in.');
    if (/rate limit|too many/i.test(m)) return T('嘗試太多次了，請稍後再試。', 'Too many attempts. Try again later.');
    if (/same.*password|different from the old/i.test(m)) return T('新密碼不能和舊密碼一樣。', 'Choose a password different from the old one.');
    if (/password/i.test(m) && /(short|weak|characters)/i.test(m)) return T('密碼太短或太簡單。', 'The password is too short or too weak.');
    if (/not allowed/i.test(m)) return T('你沒有權限做這件事。', 'You are not allowed to do that.');
    return m || T('發生錯誤，請再試一次。', 'Something went wrong. Please try again.');
  }
  $('tab-in').onclick = () => showAuthForm('in');
  $('tab-up').onclick = () => showAuthForm('up');
  $('auth-lang').onclick = () => { LANG = LANG === 'en' ? 'zh' : 'en'; try { localStorage.setItem('rt:lang', LANG); } catch (e) { /* ignore */ } paintAuth(); };
  $('f-in').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('[type=submit]');
    if (!f.email.value.trim() || !f.password.value) { authMsg(T('請填 Email 和密碼。', 'Enter your email and password.')); return; }
    btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    btn.disabled = false;
    if (error) authMsg(friendly(error));
  });
  $('f-up').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector('[type=submit]'), code = f.code.value.trim();
    if (!/^\S+@\S+\.\S+$/.test(f.email.value.trim())) { authMsg(T('Email 格式不對。', 'That email doesn’t look right.')); return; }
    if (f.password.value.length < 8) { authMsg(T('密碼至少要 8 個字元。', 'Use at least 8 characters for the password.')); return; }
    if (f.password.value !== f.password2.value) { authMsg(T('兩次輸入的密碼不一樣。', 'The two passwords do not match.')); return; }
    if (!code) { authMsg(T('請填邀請碼。', 'Enter your invite code.')); return; }
    btn.disabled = true;
    const chk = await sb.rpc('check_invite_code', { p_code: code });
    if (chk.error || !chk.data) { btn.disabled = false; authMsg(T('邀請碼無效、已過期或已用完。', 'The invite code is invalid, expired or used up.')); return; }
    const { data, error } = await sb.auth.signUp({ email: f.email.value.trim(), password: f.password.value, options: { data: { invite_code: code }, emailRedirectTo: location.origin + location.pathname } });
    btn.disabled = false;
    if (error) { authMsg(friendly(error)); return; }
    if (!data.session) authMsg(T('帳號建立了。請到信箱點確認連結，再回來登入。', 'Account created. Confirm your email, then sign in.'), true);
  });
  $('btn-forgot').onclick = async () => {
    const email = $('f-in').email.value.trim();
    if (!email) { authMsg(T('先在上面填入你的 Email。', 'Enter your email above first.')); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    authMsg(error ? friendly(error) : T('如果這個 Email 有帳號，重設密碼的信已經寄出。', 'If this email has an account, a reset link is on its way.'), !error);
  };
  $('f-reset').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.password.value.length < 8) { authMsg(T('密碼至少要 8 個字元。', 'Use at least 8 characters.')); return; }
    if (f.password.value !== f.password2.value) { authMsg(T('兩次輸入的密碼不一樣。', 'The two passwords do not match.')); return; }
    const { error } = await sb.auth.updateUser({ password: f.password.value });
    if (error) { authMsg(friendly(error)); return; }
    toast(T('新密碼已儲存', 'New password saved'));
    recovering = false; start();
  });

  /* ---------------- start ---------------- */
  let recovering = false;
  function showAuth(which) { USER = null; $('boot').hidden = true; $('shell').hidden = true; $('auth').hidden = false; paintAuth(); showAuthForm(which || 'in'); }
  sb.auth.onAuthStateChange((ev) => {
    if (ev === 'PASSWORD_RECOVERY') { recovering = true; showAuth('reset'); }
    else if (ev === 'SIGNED_IN' && !recovering && !USER) start();
    else if (ev === 'SIGNED_OUT' && USER) location.reload();
  });
  async function start() {
    const { data } = await sb.auth.getSession();
    const s = data && data.session;
    if (s && /type=recovery/.test(location.hash)) { recovering = true; history.replaceState(null, '', location.pathname); showAuth('reset'); return; }
    if (recovering) return;
    if (!s) { showAuth('in'); return; }
    USER = s.user;
    if (/access_token=|type=signup/.test(location.hash)) history.replaceState(null, '', location.pathname);
    const a = await sb.rpc('is_admin'); ADMIN = !a.error && a.data === true;
    await loadAll();
    $('boot').hidden = true; $('auth').hidden = true; $('shell').hidden = false;
    document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-Hant';
    render(false);
  }
  start().catch((e) => { console.error(e); showAuth('in'); authMsg(T('載入失敗，請重新整理。', 'Could not load. Please refresh.')); });
})();

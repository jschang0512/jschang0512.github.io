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

  /* ---------------- light / dark: follow the system unless chosen ---------------- */
  let THEME = (() => { try { const v = localStorage.getItem('tracker-theme'); return v === 'light' || v === 'dark' ? v : 'auto'; } catch (e) { return 'auto'; } })();
  const sysDark = () => !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  const isDark = () => (THEME === 'auto' ? sysDark() : THEME === 'dark');
  function applyTheme(t) {
    THEME = t;
    try { if (t === 'auto') localStorage.removeItem('tracker-theme'); else localStorage.setItem('tracker-theme', t); } catch (e) { /* ignore */ }
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', isDark() ? '#1b2333' : '#2347b8');
  }
  applyTheme(THEME);
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (THEME === 'auto') applyTheme('auto'); });

  const STATUS = () => ({ planning: T('規劃中', 'Planning'), drafting: T('撰寫中', 'In preparation'), submitted: T('已投稿', 'Submitted'), admin_check: T('行政審查', 'Administrative check'), under_review: T('審查中', 'Under review'), revision: T('修改中', 'Revising'), accepted: T('已接受', 'Accepted'), pre_proof: 'Pre-proof', published: T('已發表', 'Published'), rejected: T('被拒', 'Rejected'), withdrawn: T('撤回', 'Withdrawn') });
  const STATUS_CHIP = { planning: 'violet', drafting: 'warn', submitted: '', admin_check: '', pre_proof: 'ok', under_review: '', revision: 'warn', accepted: 'ok', published: 'ok', rejected: 'dim', withdrawn: 'dim' };
  const DECISION = () => ({ pending: T('等待結果', 'Awaiting decision'), admin_return: T('行政審查退回', 'Returned at technical check'), desk_reject: 'Desk reject', major: 'Major revision', minor: 'Minor revision', accept: T('接受', 'Accept'), pre_proof: 'Pre-proof', reject: T('拒絕', 'Reject'), withdrawn: T('撤回', 'Withdrawn') });
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
  function toast(t, ms, action) {
    const el = $('toast'); el.textContent = t;
    if (action) { const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-act'; b.textContent = action.label; b.onclick = () => { el.classList.remove('show'); action.fn(); }; el.appendChild(b); }
    el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms || (action ? 8000 : 2600));
  }
  const ICON = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    todo: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 12.5l3 3 5-6.5"/>',
    repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 6l6 6-6 6"/>',
    check: '<path d="M5 12l5 5 9-10"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  };
  const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

  /* ---------------- data ---------------- */
  let USER = null, ADMIN = false;
  let D = { projects: [], milestones: [], papers: [], rounds: [], comments: [], deadlines: [], journals: [], people: [], authors: [], todos: [], peer: [] };
  let SETTINGS = null;
  const TABLE = { projects: 'research_projects', milestones: 'research_milestones', papers: 'research_papers', rounds: 'research_rounds', comments: 'research_comments', deadlines: 'research_deadlines', journals: 'research_journals', people: 'research_people', authors: 'research_paper_authors', todos: 'research_todos', peer: 'research_peer_reviews' };
  const ORDER = { projects: ['updated_at', false], milestones: ['created_at', true], papers: ['updated_at', false], rounds: ['submitted_on', true], comments: ['seq', true], deadlines: ['due', true], journals: ['name', true], people: ['name', true], authors: ['position', true], todos: ['created_at', true], peer: ['created_at', false] };
  let LAST_LOAD = 0;
  async function loadAll(silent) {
    const keys = Object.keys(TABLE);
    let res;
    try { res = await Promise.all(keys.map((k) => sb.from(TABLE[k]).select('*').order(ORDER[k][0], { ascending: ORDER[k][1] })).concat([sb.from('research_settings').select('*')])); }
    catch (e) { res = [{ error: e }]; }
    const bad = res.find((r) => r.error);
    if (bad) { if (!silent) toast(isNetErr(bad.error) ? T('沒有網路連線，先顯示上次的資料。', 'No connection; showing what was here last time.') : T('讀取失敗：', 'Could not load: ') + bad.error.message, 6000); return false; }
    keys.forEach((k, i) => { D[k] = res[i].data; });
    SETTINGS = (res[keys.length].data || [])[0] || null;
    LAST_LOAD = Date.now(); writeCache();
    return true;
  }
  const isNetErr = (e) => !navigator.onLine || /failed to fetch|network|load failed|timeout/i.test(String((e && e.message) || e));
  const failMsg = (e, what) => (isNetErr(e) ? T('沒有網路連線，這次' + what + '沒有完成。', 'No connection; this ' + (what === '儲存' ? 'save' : 'delete') + ' did not go through.') : T(what + '失敗：', (what === '儲存' ? 'Could not save: ' : 'Could not delete: ')) + ((e && e.message) || e));
  // keep each table in the order the database returns it
  function sortKind(k) { const c = ORDER[k][0], asc = ORDER[k][1]; D[k].sort((a, b) => { const x = a[c] == null ? '' : a[c], y = b[c] == null ? '' : b[c]; return (x > y ? 1 : x < y ? -1 : 0) * (asc ? 1 : -1); }); }
  async function save(kind, row, id) {
    const q = id ? sb.from(TABLE[kind]).update(row).eq('id', id) : sb.from(TABLE[kind]).insert(row);
    let r; try { r = await q.select().single(); } catch (e) { r = { error: e }; }
    if (r.error) {
      toast(failMsg(r.error, T('儲存', '儲存')), 0, { label: T('重試', 'Retry'), fn: async () => { if (await save(kind, row, id)) { toast(T('已儲存', 'Saved')); render(true); } } });
      return null;
    }
    // the saved row replaces the local copy: no need to download everything again
    const i = D[kind].findIndex((x) => x.id === r.data.id);
    if (i >= 0) D[kind][i] = r.data; else D[kind].push(r.data);
    sortKind(kind);
    return r.data;
  }
  async function remove(kind, id) {
    let r; try { r = await sb.from(TABLE[kind]).delete().eq('id', id); } catch (e) { r = { error: e }; }
    if (r.error) { toast(failMsg(r.error, '刪除'), 6000); return false; }
    dropLocal(kind, id);
    return true;
  }
  // what the database's foreign keys do on delete, done to the local copy
  function dropLocal(kind, id) {
    D[kind] = D[kind].filter((x) => x.id !== id);
    if (kind === 'papers') {
      const rids = D.rounds.filter((x) => x.paper_id === id).map((x) => x.id);
      rids.forEach((rid) => dropLocal('rounds', rid));
      D.authors = D.authors.filter((x) => x.paper_id !== id);
      D.todos.forEach((x) => { if (x.paper_id === id) x.paper_id = null; });
    } else if (kind === 'rounds') D.comments = D.comments.filter((x) => x.round_id !== id);
    else if (kind === 'projects') {
      D.milestones = D.milestones.filter((x) => x.project_id !== id);
      D.papers.forEach((x) => { if (x.project_id === id) x.project_id = null; });
      D.todos.forEach((x) => { if (x.project_id === id) x.project_id = null; });
    } else if (kind === 'people') D.authors = D.authors.filter((x) => x.person_id !== id);
  }

  /* ---------------- this device: last data seen, and unsaved typing ---------------- */
  // the last copy of your records opens the app instantly; it is cleared on sign-out
  const CACHE_KEY = () => 'tracker-cache:' + (USER ? USER.id : '');
  let cacheTimer = null;
  function cacheSoon() { clearTimeout(cacheTimer); cacheTimer = setTimeout(writeCache, 800); }
  function writeCache() {
    if (!USER) return;
    try { localStorage.setItem(CACHE_KEY(), JSON.stringify({ v: 1, t: Date.now(), admin: ADMIN, D, SETTINGS })); }
    catch (e) { try { localStorage.removeItem(CACHE_KEY()); } catch (e2) { /* storage unavailable */ } }
  }
  function readCache() {
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY()) || 'null');
      if (!c || c.v !== 1 || !c.D) return false;
      Object.keys(D).forEach((k) => { D[k] = Array.isArray(c.D[k]) ? c.D[k] : []; });
      SETTINGS = c.SETTINGS || null; ADMIN = !!c.admin;
      return true;
    } catch (e) { return false; }
  }
  function clearDeviceData() {
    try { Object.keys(localStorage).filter((k) => k.indexOf('tracker-cache:') === 0 || k.indexOf('tracker-draft:') === 0).forEach((k) => localStorage.removeItem(k)); } catch (e) { /* ignore */ }
  }
  // what you type in a reply, a "where it changed" box or a decision letter is kept here until it is saved
  const DRAFT_FIELDS = ['response', 'changes', 'letter-text'];
  const draftKey = (field, id) => 'tracker-draft:' + field + ':' + id;
  function putDraft(field, id, v) { try { localStorage.setItem(draftKey(field, id), v); } catch (e) { /* ignore */ } }
  function dropDraft(field, id) { try { localStorage.removeItem(draftKey(field, id)); } catch (e) { /* ignore */ } }
  function getDraft(field, id) { try { return localStorage.getItem(draftKey(field, id)); } catch (e) { return null; } }
  function restoreDrafts(root) {
    root.querySelectorAll('[data-act="response"],[data-act="changes"],[data-act="letter-text"]').forEach((el) => {
      const d = getDraft(el.dataset.act, el.dataset.id);
      if (d == null || d === el.value) return;
      el.value = d; el.classList.add('has-draft');
      if (navigator.onLine) (el.dataset.act === 'letter-text' ? saveLetter : saveResponse)(el);
    });
  }
  // after a connection comes back, every draft left on this device is saved
  async function flushDrafts() {
    let keys = []; try { keys = Object.keys(localStorage).filter((k) => k.indexOf('tracker-draft:') === 0); } catch (e) { return; }
    let n = 0;
    for (const k of keys) {
      const parts = k.split(':'), field = parts[1], id = parts.slice(2).join(':'), v = getDraft(field, id);
      if (field === 'letter-text') { const r = byId('rounds', id); if (!r) { dropDraft(field, id); continue; } if ((r.letter_text || null) === (v.trim() ? v : null)) { dropDraft(field, id); continue; } if (await save('rounds', { letter_text: v.trim() ? v : null }, id)) { dropDraft(field, id); n++; } }
      else { const c = byId('comments', id); if (!c) { dropDraft(field, id); continue; } const val = v.trim() || null; if ((c[field] || null) === val) { dropDraft(field, id); continue; } const row = { [field]: val }; if (field === 'response' && val && c.status === 'todo') row.status = 'draft'; if (await save('comments', row, id)) { dropDraft(field, id); n++; } }
    }
    if (n) { toast(T('離線時寫的內容已經存好了', 'What you wrote offline has been saved')); safeRender(); }
  }
  // re-render without yanking the page from under someone who is typing or has a dialog open
  let renderWaiting = false;
  function safeRender() {
    const a = document.activeElement, typing = a && $('main').contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    if (document.querySelector('dialog[open]') || typing) {
      if (renderWaiting) return; renderWaiting = true;
      const go = () => { renderWaiting = false; document.removeEventListener('focusout', later); if (!document.querySelector('dialog[open]')) render(true); };
      const later = () => setTimeout(() => { const b = document.activeElement; if (!(b && $('main').contains(b) && /^(INPUT|TEXTAREA|SELECT)$/.test(b.tagName))) go(); }, 50);
      document.addEventListener('focusout', later);
      return;
    }
    render(true);
  }
  // coming back to the app after a while, or getting a connection back, fetches the latest
  async function backgroundSync() { if (!USER) return; if (await loadAll(true)) { await flushDrafts(); safeRender(); } }
  function setOffline(on) {
    let b = $('net-banner');
    if (!b) { b = document.createElement('div'); b.id = 'net-banner'; b.className = 'net-banner'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
    b.textContent = T('目前離線：可以瀏覽和打字，連上網路後會自動儲存回覆；其他變更要等連線後再做。', 'Offline: you can read and type; replies are saved when the connection is back, other changes need a connection.');
    b.hidden = !on;
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && USER && Date.now() - LAST_LOAD > 5 * 60e3) backgroundSync(); });
  window.addEventListener('online', () => { setOffline(false); backgroundSync(); });
  window.addEventListener('offline', () => setOffline(true));
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
    if (['admin_return', 'major', 'minor'].includes(lr.decision) && !lr.response_on) return { kind: 'revise', days: lr.decision_on ? days(parseDate(lr.decision_on), t) : null, journal: lr.journal, round: lr };
    return null;
  }
  const REVISE = ['admin_return', 'major', 'minor'];
  // days left to send a revision back, when the journal gave a date
  function revisionLeft(p) { const lr = lastRound(p.id); return lr && REVISE.includes(lr.decision) && !lr.response_on && lr.revision_due ? { left: days(today(), parseDate(lr.revision_due)), due: lr.revision_due, round: lr } : null; }
  function openCount(roundId) { return commentsOf(roundId).filter((c) => c.status === 'todo' || c.status === 'draft').length; }
  // the round whose reviewer comments are being worked on: the latest one with a revision decision, else the latest
  function workingRound(paperId) {
    const rs = roundsOf(paperId);
    for (let i = rs.length - 1; i >= 0; i--) if (['admin_return', 'major', 'minor'].includes(rs[i].decision)) return rs[i];
    return rs[rs.length - 1] || null;
  }


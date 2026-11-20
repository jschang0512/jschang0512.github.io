  /* ---------------- events ---------------- */
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || !USER || e.ctrlKey || e.metaKey || e.altKey) return;
    const a = document.activeElement; if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable) || document.querySelector('dialog[open]')) return;
    e.preventDefault(); const sq = $('side-q'); if (sq && sq.offsetParent) sq.focus(); else location.hash = '#/search';
  });
  document.addEventListener('click', async (e) => {
    const sr = e.target.closest('a.sr');
    if (sr) { if (sr.dataset.openCm) { OPEN_CM.add(sr.dataset.openCm); REVIEW_VIEW = 'list'; } if (sr.dataset.letter) REVIEW_VIEW = 'text'; }
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
      case 'home-fold': { const k = b.dataset.sec; if (HOME_FOLD.has(k)) HOME_FOLD.delete(k); else HOME_FOLD.add(k); try { localStorage.setItem('tracker-home-closed', JSON.stringify([...HOME_FOLD])); } catch (e2) { /* ignore */ } render(true); return; }
      case 'new-peer': return editPeer();
      case 'edit-peer': e.preventDefault(); return editPeer(byId('peer', id));
      case 'copy-peer-cv': { const cv = peerCv(); try { await navigator.clipboard.writeText([cv.all, '', ...cv.years].join('\n')); toast(T('已複製', 'Copied')); } catch (e2) { toast(T('無法複製', 'Could not copy')); } return; }
      case 'copy-answer': { const c = byId('comments', id); try { await navigator.clipboard.writeText(c.response || ''); toast(T('已複製回覆', 'Reply copied')); } catch (e2) { toast(T('無法複製', 'Could not copy')); } return; }
      case 'reuse-answer': return reuseDialog(byId('comments', id));
      case 'set-status': { const st = b.dataset.status; if (await save('papers', { status: st }, id)) { toast(T(`狀態改成「${STATUS()[st]}」`, `Status: ${STATUS()[st]}`)); await refresh(); } return; }
      case 'cal-move': { const n = new Date(CAL.y, CAL.m + +b.dataset.d, 1); CAL = { y: n.getFullYear(), m: n.getMonth(), sel: CAL.sel }; render(true); return; }
      case 'cal-today': CAL = null; render(true); return;
      case 'cal-week': CAL.sel = ''; render(true); return;
      case 'cal-day': { const d = parseDate(b.dataset.date), iso = b.dataset.date; CAL = { y: d.getFullYear(), m: d.getMonth(), sel: CAL.sel === iso ? '' : iso }; render(true); return; }
      case 'new-todo': return editTodo(null, { project: b.dataset.project, paper: b.dataset.paper });
      case 'edit-todo': return editTodo(byId('todos', id));
      case 'todo-done': { b.disabled = true; await toggleTodo(byId('todos', id)); return; }
      case 'todo-star': { const t = byId('todos', id); if (await save('todos', { starred: !t.starred }, id)) await refresh(); return; }
      case 'edit-deadline': return editDeadline(byId('deadlines', id));
      case 'new-comment': return editComment(id);
      case 'edit-comment': { const c = byId('comments', id); return editComment(c.round_id, c); }
      case 'paste-comments': return pasteComments(id);
      case 'rv-view': REVIEW_VIEW = b.dataset.view; try { localStorage.setItem('tracker-review-view', REVIEW_VIEW); } catch (e2) { /* ignore */ } render(true); return;
      case 'split-letter': { const ta = $('lt-' + id); if (ta) await saveLetter(ta); const r = byId('rounds', id); if (!r.letter_text) { toast(T('先把原文貼上', 'Paste the letter first')); if (ta) ta.focus(); return; } return pasteComments(id, r.letter_text); }
      case 'copy-letter': { const r = byId('rounds', id); try { await navigator.clipboard.writeText(r.letter_text || ''); toast(T('已複製', 'Copied')); } catch (e2) { toast(T('無法複製', 'Could not copy')); } return; }
      case 'cm-open': { if (OPEN_CM.has(id)) OPEN_CM.delete(id); else OPEN_CM.add(id); render(true); if (OPEN_CM.has(id)) { const t = $('resp-' + id); if (t && !t.value) t.focus({ preventScroll: true }); } return; }
      case 'cm-tick': { const c = byId('comments', id), was = ['done', 'declined'].includes(c.status); b.disabled = true; if (await save('comments', { status: was ? (c.response ? 'draft' : 'todo') : 'done' }, id)) { render(true); renderNav('papers'); } else b.disabled = false; return; }
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
      case 'theme': applyTheme(b.dataset.theme); render(true); return;
      case 'lang': LANG = b.dataset.lang; try { localStorage.setItem('rt:lang', LANG); } catch (err) { /* ignore */ } document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-Hant'; render(true); return;
      case 'logout': clearDeviceData(); await sb.auth.signOut(); location.hash = ''; location.reload(); return;
      case 'delete-account': {
        const word = T('刪除', 'DELETE');
        const typed = prompt(T(`這會永久刪除你的帳號和所有紀錄，無法復原。\n確定的話請輸入「${word}」。`, `This permanently deletes your account and every record in it. It cannot be undone.\nType ${word} to confirm.`));
        if (typed === null || typed.trim() !== word) return;
        const { error } = await sb.rpc('delete_my_account');
        if (error) { toast(friendly(error), 6000); return; }
        clearDeviceData(); await sb.auth.signOut(); alert(T('帳號和所有紀錄已刪除。', 'Your account and all records were deleted.')); location.hash = ''; location.reload(); return;
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
      if (await save('comments', { status: el.value }, c.id)) { c.status = el.value; render(true); renderNav('papers'); }
    }
  });
  // responses save themselves a moment after typing stops; a written answer moves "to do" to "draft"
  const respTimers = {};
  document.addEventListener('input', (e) => {
    if (e.target.dataset && DRAFT_FIELDS.includes(e.target.dataset.act)) putDraft(e.target.dataset.act, e.target.dataset.id, e.target.value);
    const el = e.target; if (el.dataset && el.dataset.act === 'ans-q') { ANS_Q = el.value; paintAnswers(); return; }
    if (el.id === 'side-q') { SEARCH_Q = el.value; if (route().a !== 'search') { location.hash = '#/search'; } else paintSearch(); const g = $('g-q'); if (g && g.value !== SEARCH_Q) g.value = SEARCH_Q; return; }
    if (el.dataset && el.dataset.act === 'g-q') { SEARCH_Q = el.value; paintSearch(); const sq = $('side-q'); if (sq) sq.value = SEARCH_Q; return; }
    if (el.dataset && el.dataset.act === 'letter-text') { clearTimeout(respTimers['lt' + el.dataset.id]); respTimers['lt' + el.dataset.id] = setTimeout(() => saveLetter(el), 900); return; }
    if (!el.dataset || !['response', 'changes'].includes(el.dataset.act)) return;
    const key = el.dataset.id + el.dataset.act;
    clearTimeout(respTimers[key]);
    respTimers[key] = setTimeout(() => saveResponse(el), 800);
  });
  document.addEventListener('focusout', (e) => { const el = e.target; if (el.dataset && el.dataset.act === 'letter-text' && respTimers['lt' + el.dataset.id]) { saveLetter(el); return; } if (el.dataset && ['response', 'changes'].includes(el.dataset.act) && respTimers[el.dataset.id + el.dataset.act]) { clearTimeout(respTimers[el.dataset.id + el.dataset.act]); saveResponse(el); } });
  async function saveLetter(el) {
    const id = el.dataset.id, r = byId('rounds', id); clearTimeout(respTimers['lt' + id]); delete respTimers['lt' + id];
    if (!r) return; const v = el.value.trim() ? el.value : null;
    if ((r.letter_text || null) === v) { dropDraft('letter-text', id); el.classList.remove('has-draft'); return; }
    const s = await save('rounds', { letter_text: v }, id); if (!s) return;
    dropDraft('letter-text', id); el.classList.remove('has-draft');
    const ok = $('saved-lt-' + id); if (ok) { ok.classList.add('show'); setTimeout(() => ok.classList.remove('show'), 1600); }
  }
  async function saveResponse(el) {
    const id = el.dataset.id, field = el.dataset.act, c = byId('comments', id); if (!c) return;
    delete respTimers[id + field];
    const v = el.value.trim() || null;
    if ((c[field] || null) === v) { dropDraft(field, id); el.classList.remove('has-draft'); return; }
    const row = { [field]: v };
    if (field === 'response' && v && c.status === 'todo') row.status = 'draft';
    const s = await save('comments', row, id); if (!s) return;
    dropDraft(field, id); el.classList.remove('has-draft');
    Object.assign(c, s);
    const card = $('cm-' + id), sel = card && card.querySelector('select');
    if (sel) sel.value = c.status;
    const main = card && card.querySelector('.rvi-main');
    if (main && row.status) { const old = main.querySelector('.chip'); if (old) old.remove(); main.insertAdjacentHTML('beforeend', `<span class="chip ${C_CHIP[c.status]}">${esc(C_STATUS()[c.status])}</span>`); }
    const ok = $('saved-' + id); if (ok) { ok.classList.add('show'); setTimeout(() => ok.classList.remove('show'), 1600); }
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
    const apk = $('auth-apk'); if (apk) { apk.hidden = NATIVE || !IS_ANDROID; apk.textContent = T('下載 Android App', 'Get the Android app'); }
    document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-Hant';
    $('auth-title').textContent = tt('appName'); $('auth-sub').textContent = tt('appSub');
    $('tab-in').textContent = tt('signIn'); $('tab-up').textContent = tt('createAccount');
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = tt(el.dataset.t); });
    $('auth-lang').textContent = LANG === 'en' ? '中文' : 'English';
    $('auth-theme').textContent = isDark() ? T('淺色', 'Light') : T('深色', 'Dark');
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
  $('auth-theme').onclick = () => { applyTheme(isDark() ? 'light' : 'dark'); paintAuth(); };
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
    else if (ev === 'SIGNED_OUT' && USER) { clearDeviceData(); location.reload(); }
  });
  async function start() {
    const { data } = await sb.auth.getSession();
    const s = data && data.session;
    if (s && /type=recovery/.test(location.hash)) { recovering = true; history.replaceState(null, '', location.pathname); showAuth('reset'); return; }
    if (recovering) return;
    if (!s) { showAuth('in'); return; }
    USER = s.user;
    if (/access_token=|type=signup/.test(location.hash)) history.replaceState(null, '', location.pathname);
    const show = () => { $('boot').hidden = true; $('auth').hidden = true; $('shell').hidden = false; document.documentElement.lang = LANG === 'en' ? 'en' : 'zh-Hant'; };
    const cached = readCache();
    if (cached) { show(); render(false); }
    if (!navigator.onLine) setOffline(true);
    const [a, ok] = await Promise.all([sb.rpc('is_admin').then((x) => x, () => ({ error: true })), loadAll(cached)]);
    if (!a.error) ADMIN = a.data === true;
    if (cached) { if (ok) { await flushDrafts(); safeRender(); } }
    else { show(); render(false); }
  }
  start().catch((e) => { console.error(e); showAuth('in'); authMsg(T('載入失敗，請重新整理。', 'Could not load. Please refresh.')); });
})();

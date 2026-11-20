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
      if (p.deadline && !['accepted', 'pre_proof', 'published', 'rejected', 'withdrawn'].includes(p.status)) { const due = parseDate(p.deadline), left = days(t, due); if (left >= -30 && left <= SOON_DAYS) push(due, { title: paperName(p), sub: T('自訂截止日', 'Own deadline'), href: '#/paper/' + p.id }); }
      const rv = revisionLeft(p);
      if (rv && rv.left >= -30 && rv.left <= SOON_DAYS) push(parseDate(rv.due), { title: paperName(p), sub: T(`修改稿交回期限 · ${rv.round.journal}`, `Revision due · ${rv.round.journal}`), href: `#/paper/${p.id}/reviews` });
      const w = waitInfo(p);
      if (w && w.kind === 'review' && w.days >= WAIT_DAYS) push(null, { nudge: true, title: paperName(p), sub: T(`${w.journal} 已審查 ${w.days} 天，可以寫信詢問進度`, `${w.journal} has had it ${w.days} days; consider asking about progress`), href: '#/paper/' + p.id });
      if (w && w.kind === 'revise') {
        const open = openCount(w.round.id);
        if (open) push(null, { nudge: true, title: paperName(p), sub: T(`還有 ${open} 條審稿意見待回覆`, `${open} reviewer comment${open > 1 ? 's' : ''} still to answer`), href: `#/paper/${p.id}/reviews` });
        else if (w.days !== null && w.days >= REVISION_DAYS) push(null, { nudge: true, title: paperName(p), sub: T(`修改意見已收到 ${w.days} 天，還沒送出回覆`, `Reviews arrived ${w.days} days ago; response not sent yet`), href: '#/paper/' + p.id });
      }
    });
    D.peer.forEach((r) => { if (!['invited', 'accepted'].includes(r.status) || !r.due) return; const due = parseDate(r.due), left = days(t, due); if (left >= -30 && left <= SOON_DAYS) push(due, { title: T(`審稿：${r.journal}`, `Review for ${r.journal}`), sub: [r.status === 'invited' ? T('還沒回覆邀請', 'Invitation not answered yet') : '', r.manuscript || r.ms_id || ''].filter(Boolean).join(' · '), href: '#/reviewing' }); });
    D.todos.forEach((td) => { if (td.done_at || !td.due) return; const due = parseDate(td.due); if (days(t, due) <= 0) push(due, { todo: true, title: (td.starred ? '★ ' : '') + td.title, sub: T('待辦', 'To-do'), href: '#/todos' }); });
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
    const sq = $('side-q'); if (sq) { sq.placeholder = T('搜尋全部（/）', 'Search everything (/)'); sq.setAttribute('aria-label', T('搜尋全部', 'Search everything')); if (section !== 'search' && document.activeElement !== sq) sq.value = ''; }
  }
  const ph = (title, opts = {}) => `<header class="ph">${opts.back ? `<a class="btn ghost icon back${opts.backMobileOnly ? ' mobile-only' : ''}" href="${opts.back}" aria-label="${T('返回', 'Back')}">${ic('back')}</a>` : ''}<h1>${esc(title)}</h1>${opts.actions || ''}</header>`;
  const isWide = () => window.matchMedia('(min-width: 900px)').matches;

  /* ---------------- pages ---------------- */
  /* ---------------- progress of everything not closed yet ---------------- */
  const PAPER_STEPS = ['planning', 'drafting', 'submitted', 'admin_check', 'under_review', 'revision', 'accepted', 'pre_proof', 'published'];
  const PAPER_STEP_LABEL = () => [T('規劃', 'Plan'), T('撰寫', 'Draft'), T('投稿', 'Submit'), T('行政', 'Admin'), T('審查', 'Review'), T('修改', 'Revise'), T('接受', 'Accept'), 'Pre-proof', T('發表', 'Publish')];
  function bar(n, at, labels, paused) {
    return `<div class="pbar${paused ? ' paused' : ''}" role="img" aria-label="${esc(labels[at] || '')} ${at + 1}/${n}">${Array.from({ length: n }, (_, i) => `<i class="${i < at ? 'done' : i === at ? 'now' : ''}"></i>`).join('')}</div>`;
  }
  function progressHTML() {
    const projects = D.projects.filter((p) => p.stage !== 'done').sort((a, b) => (a.stage === 'paused') - (b.stage === 'paused') || STAGES.indexOf(b.stage) - STAGES.indexOf(a.stage));
    const papers = D.papers.filter((p) => !['published', 'rejected', 'withdrawn'].includes(p.status)).sort((a, b) => PAPER_STEPS.indexOf(b.status) - PAPER_STEPS.indexOf(a.status));
    if (!projects.length && !papers.length) return '';
    const projRow = (p) => {
      const paused = p.stage === 'paused', at = paused ? 0 : STAGES.indexOf(p.stage);
      const next = msOf(p.id).filter((m) => !m.done_on && m.due).sort((a, b) => parseDate(a.due) - parseDate(b.due))[0];
      const msAll = msOf(p.id), msDone = msAll.filter((m) => m.done_on).length;
      return `<a class="prog" href="#/project/${p.id}"><div class="prog-head"><b>${esc(p.short_title || p.title)}</b><span class="chip ${paused ? 'dim' : 'violet'}">${esc(STAGE()[p.stage])}${paused ? '' : ` ${at + 1}/${STAGES.length}`}</span></div>` +
        bar(STAGES.length, at, STAGES.map((x) => STAGE()[x]), paused) +
        `<small>${[msAll.length ? T(`里程碑 ${msDone}/${msAll.length}`, `Milestones ${msDone}/${msAll.length}`) : '', next ? T(`下一步：${esc(next.title)} ${md(next.due)}`, `Next: ${esc(next.title)} ${md(next.due)}`) : ''].filter(Boolean).join(' · ') || '&nbsp;'}</small></a>`;
    };
    const paperRow = (p) => {
      const at = Math.max(0, PAPER_STEPS.indexOf(p.status === 'submitted' ? 'submitted' : p.status)), lr = lastRound(p.id), w = waitInfo(p);
      const wr = workingRound(p.id), open = wr && ['admin_return', 'major', 'minor'].includes(wr.decision) ? openCount(wr.id) : 0;
      const sub = [lr ? esc(lr.journal) : (p.target_journal ? esc(p.target_journal) : ''), w && w.kind === 'review' ? T(`已等 ${w.days} 天`, `${w.days} d waiting`) : '', open ? T(`${open} 條意見待回覆`, `${open} comments to answer`) : '', (() => { const rv = revisionLeft(p); return rv ? (rv.left >= 0 ? T(`剩 ${rv.left} 天交回`, `${rv.left} d to send back`) : T(`交回期限已過 ${-rv.left} 天`, `revision ${-rv.left} d overdue`)) : ''; })()].filter(Boolean).join(' · ');
      return `<a class="prog" href="#/paper/${p.id}"><div class="prog-head"><b>${esc(paperName(p))}</b><span class="chip ${STATUS_CHIP[p.status]}">${esc(STATUS()[p.status])} ${at + 1}/${PAPER_STEPS.length}</span></div>` +
        bar(PAPER_STEPS.length, at, PAPER_STEP_LABEL()) + `<small>${sub || '&nbsp;'}</small></a>`;
    };
    if (folded('prog')) return foldedSec('prog', T('未結案的進度', 'Work in progress'));
    return `<h2 class="sec-title">${foldBtn('prog', T('未結案的進度', 'Work in progress'))} <small>${T('專案依階段、論文從撰寫到發表', 'Projects by stage, papers from draft to publication')}</small></h2>` +
      (projects.length ? `<div class="prog-group"><h3>${T('專案', 'Projects')}</h3><div class="progs">${projects.map(projRow).join('')}</div></div>` : '') +
      (papers.length ? `<div class="prog-group"><h3>${T('論文', 'Papers')}<span class="prog-legend">${PAPER_STEP_LABEL().join(' › ')}</span></h3><div class="progs">${papers.map(paperRow).join('')}</div></div>` : '');
  }

  /* ---------------- Home: to-dos and a month calendar ---------------- */
  const HOME_FOLD = (() => { try { return new Set(JSON.parse(localStorage.getItem('tracker-home-closed') || '[]')); } catch (e) { return new Set(); } })();
  const folded = (k) => HOME_FOLD.has(k);
  const foldBtn = (k, title) => '<button type="button" class="hs-tog" data-act="home-fold" data-sec="' + k + '" aria-expanded="' + !folded(k) + '">' + ic('chev') + '<span>' + title + '</span></button>';
  const foldedSec = (k, title) => '<section class="home-card is-folded"><h2 class="sec-title">' + foldBtn(k, title) + '</h2></section>';
  function homeTodos() {
    if (folded('todo')) return foldedSec('todo', T('待辦', 'To-dos'));
    const t = today(), open = D.todos.filter((x) => !x.done_at);
    const soon = open.filter((x) => x.starred || (x.due && days(t, parseDate(x.due)) <= 3)).sort(byStarDue);
    const shown = soon.slice(0, 8), more = open.length - shown.length;
    return `<section class="home-card"><h2 class="sec-title">${foldBtn('todo', T('待辦', 'To-dos'))} <small>${T('過期、今天、三天內與加星號的', 'Overdue, today, next 3 days and starred')}</small><a class="btn sm ghost right" href="#/todos">${T('全部', 'All')}${ic('chev')}</a></h2>` +
      `<form class="quick" id="f-todo" autocomplete="off"><input class="inp" name="title" maxlength="300" placeholder="${T('＋ 新增待辦…', '+ Add a to-do…')}" aria-label="${T('新增待辦', 'New to-do')}"><input class="inp" type="date" name="due" aria-label="${T('日期（選填）', 'Date (optional)')}"><button class="btn primary" type="submit">${T('加入', 'Add')}</button></form>` +
      (shown.length ? `<div class="todos">${shown.map((x) => todoRow(x)).join('')}</div>` : `<p class="muted small" style="margin:10px 2px 0">${T('最近三天沒有待辦。', 'Nothing due in the next three days.')}</p>`) +
      (more > 0 ? `<p class="muted small" style="margin:8px 2px 0"><a href="#/todos">${T(`還有 ${more} 項待辦 ›`, `${more} more to-do${more > 1 ? 's' : ''} ›`)}</a></p>` : '') + '</section>';
  }

  // everything with a date: deadlines, milestones, IRB expiry, own paper deadlines, open to-dos
  const EV_KIND = () => ({ dl: T('截止日', 'Deadline'), ms: T('里程碑', 'Milestone'), irb: T('到期', 'Expiry'), paper: T('論文', 'Paper'), peer: T('審稿', 'Reviewing'), todo: T('待辦', 'To-do') });
  function calEvents() {
    const ev = {}, add = (date, o) => { if (!date) return; (ev[date] = ev[date] || []).push(o); };
    D.deadlines.forEach((d) => { if (!d.done) add(d.due, { kind: 'dl', title: d.title, sub: DL_KIND()[d.kind], href: '#/deadlines' }); });
    D.milestones.forEach((m) => {
      const pr = byId('projects', m.project_id); if (!pr) return;
      const pn = pr.short_title || pr.title;
      if (!m.done_on && m.due) add(m.due, { kind: 'ms', title: m.title, sub: pn, href: '#/project/' + pr.id });
      if (m.expires_on) add(m.expires_on, { kind: 'irb', title: T(`${m.title} 到期`, `${m.title} expires`), sub: pn, href: '#/project/' + pr.id });
    });
    D.papers.forEach((p) => { if (p.deadline && !['accepted', 'pre_proof', 'published', 'rejected', 'withdrawn'].includes(p.status)) add(p.deadline, { kind: 'paper', title: paperName(p), sub: T('自訂截止日', 'Own deadline'), href: '#/paper/' + p.id }); });
    D.papers.forEach((p) => { const rv = revisionLeft(p); if (rv) add(rv.due, { kind: 'paper', title: T(`交回修改稿：${paperName(p)}`, `Revision due: ${paperName(p)}`), sub: rv.round.journal, href: `#/paper/${p.id}/reviews` }); });
    D.peer.forEach((r) => { if (['invited', 'accepted'].includes(r.status) && r.due) add(r.due, { kind: 'peer', title: T(`審稿：${r.journal}`, `Review for ${r.journal}`), sub: r.manuscript || r.ms_id || '', href: '#/reviewing' }); });
    D.todos.forEach((x) => { if (!x.done_at && x.due) add(x.due.slice(0, 10), { kind: 'todo', title: (x.starred ? '★ ' : '') + x.title, sub: x.repeat && x.repeat !== 'none' ? REPEAT()[x.repeat] : '', href: '#/todos' }); });
    return ev;
  }
  let CAL = null; // { y, m, sel } — the month on show and the picked day ('' = the next seven days)
  function calendarHTML() {
    if (folded('cal')) return foldedSec('cal', T('行事曆', 'Calendar'));
    const t = today(), tISO = localISO(t);
    if (!CAL) CAL = { y: t.getFullYear(), m: t.getMonth(), sel: '' };
    const ev = calEvents(), first = new Date(CAL.y, CAL.m, 1), start = new Date(CAL.y, CAL.m, 1 - first.getDay());
    const weeks = Math.ceil((first.getDay() + new Date(CAL.y, CAL.m + 1, 0).getDate()) / 7);
    const wd = LANG === 'en' ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['日', '一', '二', '三', '四', '五', '六'];
    let cells = '';
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), iso = localISO(d), list = ev[iso] || [];
      const kinds = [...new Set(list.map((e) => e.kind))].slice(0, 3);
      const cls = ['cal-d', d.getMonth() !== CAL.m ? 'out' : '', iso === tISO ? 'today' : '', iso === CAL.sel ? 'sel' : '', iso < tISO ? 'past' : ''].filter(Boolean).join(' ');
      const label = T(`${d.getMonth() + 1} 月 ${d.getDate()} 日`, d.toDateString()) + (list.length ? T(`，${list.length} 件事`, `, ${list.length} item${list.length > 1 ? 's' : ''}`) : '');
      cells += `<button type="button" class="${cls}" data-act="cal-day" data-date="${iso}" aria-label="${esc(label)}"${iso === CAL.sel ? ' aria-pressed="true"' : ''}><span>${d.getDate()}</span><i>${kinds.map((k) => `<b class="k-${k}"></b>`).join('')}</i></button>`;
    }
    const row = (e) => `<a class="cal-ev" href="${e.href}"><b class="k-${e.kind}"></b><span><strong>${esc(e.title)}</strong><small>${esc(EV_KIND()[e.kind])}${e.sub ? ' · ' + esc(e.sub) : ''}</small></span></a>`;
    const dayName = (iso) => { const d = parseDate(iso), l = days(t, d); const w = wd[d.getDay()]; const rel = l === 0 ? T('今天', 'Today') : l === 1 ? T('明天', 'Tomorrow') : l === 2 ? T('後天', 'In 2 days') : ''; return `${md(iso)}（${LANG === 'en' ? d.toLocaleDateString('en', { weekday: 'short' }) : w}）${rel ? ' ' + rel : ''}`; };
    let below;
    if (CAL.sel) {
      const list = ev[CAL.sel] || [];
      below = `<div class="cal-list"><h3>${dayName(CAL.sel)}<button type="button" class="link" data-act="cal-week">${T('看接下來 7 天', 'Next 7 days')}</button></h3>${list.length ? list.map(row).join('') : `<p class="muted small">${T('這天沒有安排。', 'Nothing on this day.')}</p>`}</div>`;
    } else {
      const ds = Array.from({ length: 7 }, (_, i) => localISO(new Date(t.getFullYear(), t.getMonth(), t.getDate() + i))).filter((iso) => ev[iso]);
      below = `<div class="cal-list"><h3>${T('接下來 7 天', 'Next 7 days')}</h3>${ds.length ? ds.map((iso) => `<div class="cal-day"><h4>${dayName(iso)}</h4>${ev[iso].map(row).join('')}</div>`).join('') : `<p class="muted small">${T('接下來 7 天沒有安排。', 'Nothing in the next 7 days.')}</p>`}</div>`;
    }
    const title = LANG === 'en' ? first.toLocaleDateString('en', { month: 'long', year: 'numeric' }) : `${CAL.y} 年 ${CAL.m + 1} 月`;
    const onThisMonth = CAL.y === t.getFullYear() && CAL.m === t.getMonth();
    return `<section class="home-card"><h2 class="sec-title">${foldBtn('cal', T('行事曆', 'Calendar'))}<span class="cal-nav right"><button type="button" class="btn sm ghost icon" data-act="cal-move" data-d="-1" aria-label="${T('上個月', 'Previous month')}">${ic('back')}</button><span class="cal-title" aria-live="polite">${title}</span><button type="button" class="btn sm ghost icon" data-act="cal-move" data-d="1" aria-label="${T('下個月', 'Next month')}">${ic('chev')}</button>${onThisMonth && !CAL.sel ? '' : `<button type="button" class="btn sm" data-act="cal-today">${T('今天', 'Today')}</button>`}</span></h2>` +
      `<div class="cal"><div class="cal-wd" aria-hidden="true">${wd.map((x) => `<span>${x}</span>`).join('')}</div><div class="cal-grid">${cells}</div></div>` +
      `<p class="cal-legend">${Object.entries(EV_KIND()).map(([k, l]) => `<span><b class="k-${k}"></b>${l}</span>`).join('')}</p>` + below + '</section>';
  }

  function pageHome() {
    const active = D.projects.filter((p) => !['done', 'paused'].includes(p.stage)).length;
    const inReview = D.papers.filter((p) => ['submitted', 'admin_check', 'under_review'].includes(p.status)).length;
    const revising = D.papers.filter((p) => p.status === 'revision').length;
    const done = D.papers.filter((p) => ['accepted', 'pre_proof', 'published'].includes(p.status)).length;
    const nothing = !D.projects.length && !D.papers.length && !D.deadlines.length;
    return ph(T('總覽', 'Home'), { actions: `<a class="btn ghost icon" href="#/search" aria-label="${T('搜尋全部', 'Search everything')}">${ic('search')}</a>` }) +
      (nothing ? `<div class="empty" style="margin-top:4px"><b>${T('從第一個專案或論文開始', 'Start with your first project or paper')}</b><br>${T('專案用來記錄 IRB、資料申請與分析進度；論文用來記錄每一輪投稿和審稿意見。', 'Projects hold IRB, data access and analysis; papers hold every submission round and reviewer comment.')}<div class="row" style="justify-content:center"><button class="btn primary" data-act="new-project">${ic('plus')}${T('新增專案', 'New project')}</button><button class="btn" data-act="new-paper">${ic('plus')}${T('新增論文', 'New paper')}</button></div></div>` : '') +
      `<div class="metrics">
        <a class="metric" href="#/projects"><span>${T('進行中的專案', 'Active projects')}</span><b>${active}</b></a>
        <a class="metric" href="#/papers"><span>${T('審查中', 'Under review')}</span><b>${inReview}</b></a>
        <a class="metric" href="#/papers"><span>${T('修改中', 'Revising')}</span><b>${revising}</b></a>
        <a class="metric" href="#/papers"><span>${T('已接受・已發表', 'Accepted & published')}</span><b>${done}</b></a>
      </div>` +
      `<div class="home-grid">${homeTodos()}${calendarHTML()}</div>` +
      (folded('next') ? foldedSec('next', T('接下來', 'Up next')) : `<h2 class="sec-title">${foldBtn('next', T('接下來', 'Up next'))} <small>${T('60 天內的截止日、IRB 到期、等太久的審查、待回覆的意見', 'Deadlines and IRB expiry in 60 days, long reviews, comments to answer')}</small></h2>` + agendaHTML(agenda().filter((x) => !x.todo))) + progressHTML() +
      `<a class="ag" href="#/stats" style="margin-top:18px;grid-template-columns:minmax(0,1fr) auto"><span class="what"><b>${T('年度統計', 'Year by year')}</b><small>${T('每年投稿、接受、發表與審查天數', 'Submissions, acceptances, publications and review times per year')}</small></span><span class="chev">${ic('chev')}</span></a>`;
  }


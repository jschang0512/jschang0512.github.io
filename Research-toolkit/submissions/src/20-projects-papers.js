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
    if (wr && ['admin_return', 'major', 'minor'].includes(wr.decision)) { const cs = commentsOf(wr.id); if (cs.length) meta.push(T(`意見 ${cs.length - openCount(wr.id)}/${cs.length} 已處理`, `${cs.length - openCount(wr.id)}/${cs.length} comments done`)); }
    const pr = p.project_id && byId('projects', p.project_id);
    if (pr && !inProject) meta.push(esc(pr.short_title || pr.title));
    return `<a class="item${on ? ' on' : ''}" href="#/paper/${p.id}"><div class="item-head"><h3>${esc(paperName(p))}</h3><span class="chip ${STATUS_CHIP[p.status]}">${esc(STATUS()[p.status])}</span></div>${meta.length ? `<div class="meta">${meta.join(' · ')}</div>` : ''}</a>`;
  }
  function listPapers(currentId) {
    const g = { active: [], draft: [], done: [], closed: [] };
    D.papers.forEach((p) => g[['submitted', 'admin_check', 'under_review', 'revision'].includes(p.status) ? 'active' : ['planning', 'drafting'].includes(p.status) ? 'draft' : ['accepted', 'pre_proof', 'published'].includes(p.status) ? 'done' : 'closed'].push(p));
    const block = (label, arr) => (arr.length ? `<h2 class="sec-title">${label} <small>${arr.length}</small></h2><div class="list">${arr.map((p) => paperCard(p, p.id === currentId)).join('')}</div>` : '');
    return ph(T('論文', 'Papers'), { actions: `<button class="btn primary sm" data-act="new-paper">${ic('plus')}${T('論文', 'Paper')}</button>` }) + papersSeg('papers') +
      (D.papers.length ? block(T('進行中', 'In review'), g.active) + block(T('規劃・撰寫中', 'Planned & in preparation'), g.draft) + block(T('已接受・已發表', 'Accepted & published'), g.done) +
        (g.closed.length ? `<details class="fold"${g.closed.some((p) => p.id === currentId) ? ' open' : ''}><summary>${T('已結束（被拒・撤回）', 'Closed (rejected, withdrawn)')} (${g.closed.length})</summary><div class="list">${g.closed.map((p) => paperCard(p, p.id === currentId)).join('')}</div></details>` : '')
        : `<div class="empty">${T('每篇論文記錄投稿的每一輪、審稿結果、你的回覆，以及和 reviewer 的來往。', 'Each paper keeps every submission round, decision and response, and your exchanges with reviewers.')}<br><button class="btn primary" data-act="new-paper">${ic('plus')}${T('新增論文', 'New paper')}</button></div>`);
  }

  function detailPaper(p, tab) {
    tab = ['timeline', 'prep', 'reviews', 'info'].includes(tab) ? tab : 'timeline';
    const pr = p.project_id && byId('projects', p.project_id), w = waitInfo(p), lr = lastRound(p.id);
    const meta = [`<span class="chip ${STATUS_CHIP[p.status]}">${esc(STATUS()[p.status])}</span>`];
    if (lr) meta.push(esc(lr.journal)); if (w && w.kind === 'review') meta.push(T(`已等 ${w.days} 天`, `${w.days} days waiting`));
    const rvl = revisionLeft(p); if (rvl) meta.push(`<span class="${rvl.left < 0 ? 'late' : rvl.left <= 14 ? 'warn' : ''}">${rvl.left >= 0 ? T(`修改稿 ${md(rvl.due)} 前交回（剩 ${rvl.left} 天）`, `Revision due ${md(rvl.due)} (${rvl.left} d)`) : T(`修改稿期限已過 ${-rvl.left} 天`, `Revision ${-rvl.left} d overdue`)}</span>`);
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
    const actions = `<div class="d-actions"><button class="btn primary sm" data-act="new-round" data-id="${p.id}">${ic('plus')}${rs.length ? T('下一輪／轉投', 'Next round / new journal') : T('記錄投稿', 'Record submission')}</button>${lr && lr.decision === 'pending' ? `<button class="btn sm" data-act="edit-round" data-id="${lr.id}">${T('更新結果', 'Record decision')}</button>` : ''}${NEXT_STAGE[p.status] ? `<button class="btn sm" data-act="set-status" data-id="${p.id}" data-status="${NEXT_STAGE[p.status][0]}">${NEXT_STAGE[p.status][1]()}</button>` : ''}</div>`;
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
  // the reviews tab shows either the decision letter as received, or the comments as a checklist
  let REVIEW_VIEW = (() => { try { return localStorage.getItem('tracker-review-view'); } catch (e) { return null; } })();
  const OPEN_CM = new Set();
  function tabReviews(p) {
    const rs = roundsOf(p.id);
    if (!rs.length) return `<div class="empty">${T('先記錄一次投稿，收到審稿意見後就能在這裡逐條記錄和回覆。', 'Record a submission first; when reviews come back, log and answer them here comment by comment.')}<br><button class="btn primary" data-act="new-round" data-id="${p.id}">${ic('plus')}${T('記錄投稿', 'Record submission')}</button></div>`;
    const q = new URLSearchParams((location.hash.split('?')[1] || ''));
    const rid = (q.get('round') && rs.some((r) => r.id === q.get('round'))) ? q.get('round') : (REVIEW_ROUND[p.id] && rs.some((r) => r.id === REVIEW_ROUND[p.id]) ? REVIEW_ROUND[p.id] : workingRound(p.id).id);
    REVIEW_ROUND[p.id] = rid;
    const r = byId('rounds', rid), cs = commentsOf(rid);
    const isDone = (c) => ['done', 'declined'].includes(c.status), nDone = cs.filter(isDone).length;
    const view = ['text', 'list'].includes(REVIEW_VIEW) ? REVIEW_VIEW : (cs.length ? 'list' : 'text');
    const sel = `<select class="inp" data-act="pick-round" data-id="${p.id}" aria-label="${T('哪一輪', 'Round')}">${rs.map((x, i) => `<option value="${x.id}"${x.id === rid ? ' selected' : ''}>${T(`第 ${i + 1} 輪`, `Round ${i + 1}`)} · ${esc(x.journal)} · ${esc(DECISION()[x.decision])}</option>`).join('')}</select>`;
    const seg = `<div class="seg rv-seg" role="tablist" aria-label="${T('呈現方式', 'View')}">${[['text', T('原文', 'Original')], ['list', T('清單', 'List')]].map(([k, l]) => `<button type="button" role="tab" data-act="rv-view" data-view="${k}" aria-selected="${view === k}">${l}${k === 'list' && cs.length ? ` <small>${nDone}/${cs.length}</small>` : ''}</button>`).join('')}</div>`;
    const bar = `<div class="rv-bar"><div class="grow">${sel}</div>${seg}</div>`;
    if (view === 'text') {
      return bar + `<div class="rv-letter"><label for="lt-${rid}"><span>${T('審查結果原文：編輯的信和所有審稿意見，整封貼上', 'Decision letter as received: the editor’s letter and every reviewer’s comments')}</span><span class="saved" id="saved-lt-${rid}">${T('已儲存', 'Saved')}</span></label>` +
        `<textarea class="inp" id="lt-${rid}" data-act="letter-text" data-id="${rid}" rows="16" maxlength="200000" placeholder="${T('Dear Dr. …\n\nReviewer #1:\n1. …\n2. …\n\nReviewer #2:\n…', 'Dear Dr. …\n\nReviewer #1:\n1. …\n2. …\n\nReviewer #2:\n…')}">${esc(r.letter_text || '')}</textarea>` +
        `<div class="d-actions"><button class="btn primary sm" data-act="split-letter" data-id="${rid}">${T('從原文產生清單', 'Make a checklist from it')}</button>${r.letter_text ? `<button class="btn sm" data-act="copy-letter" data-id="${rid}">${ic('copy')}${T('複製原文', 'Copy')}</button>` : ''}</div>` +
        `<p class="muted small">${T('會依「Reviewer 1」「Editor」這類標題分給對應的人，再依「1.」「2.」或空行切成一條一條。', 'Sections headed “Reviewer 1”, “Editor” and so on go to that person, then each is split at “1.”, “2.” or blank lines.')}${cs.length ? T(`這一輪已經有 ${cs.length} 條，新產生的會接在後面。`, ` This round already has ${cs.length}; new ones are added after them.`) : ''}</p></div>`;
    }
    const actions = `<div class="d-actions" style="margin-top:0"><button class="btn sm" data-act="paste-comments" data-id="${rid}">${ic('plus')}${T('貼上審稿意見', 'Paste comments')}</button><button class="btn sm" data-act="new-comment" data-id="${rid}">${T('新增一條', 'Add one')}</button>${cs.length ? `<button class="btn sm" data-act="letter" data-id="${rid}">${ic('doc')}${T('產生回覆信', 'Response letter')}</button>` : ''}</div>`;
    if (!cs.length) return bar + actions + `<div class="empty" style="margin-top:12px">${T('到「原文」把收到的信整封貼上，再按「從原文產生清單」；或直接貼上某位 reviewer 的意見。', 'Paste the whole letter under “Original” and make a checklist from it, or paste one reviewer’s comments here.')}</div>`;
    const groups = {}; cs.forEach((c) => { (groups[c.reviewer] = groups[c.reviewer] || []).push(c); });
    const names = Object.keys(groups).sort(reviewerOrder);
    return bar + actions + names.map((n) => { const arr = groups[n].sort((a, b) => a.seq - b.seq), d = arr.filter(isDone).length; return `<div class="rv-group"><h4>${esc(n)} <span class="chip ${d === arr.length ? 'ok' : 'warn'}">${d}/${arr.length}</span></h4><div class="rvl">${arr.map((c) => commentRow(c, n)).join('')}</div></div>`; }).join('');
  }
  function commentRow(c, name) {
    const done = c.status === 'done', dec = c.status === 'declined', open = OPEN_CM.has(c.id);
    const chip = c.status === 'todo' ? '' : `<span class="chip ${C_CHIP[c.status]}">${esc(C_STATUS()[c.status])}</span>`;
    return `<div class="rvi${done || dec ? ' done' : ''}${open ? ' open' : ''}" id="cm-${c.id}">` +
      `<button type="button" class="tick" data-act="cm-tick" data-id="${c.id}" aria-pressed="${done || dec}" aria-label="${done || dec ? T('改回待處理', 'Mark not answered') : T('標成已回覆', 'Mark answered')}">${done ? ic('check') : dec ? '–' : ''}</button>` +
      `<button type="button" class="rvi-main" data-act="cm-open" data-id="${c.id}" aria-expanded="${open}"><span class="no">${esc(reviewerNo(name))}.${c.seq}</span><span class="rvi-t">${esc(c.comment)}</span>${chip}</button>` +
      (open ? `<div class="rvi-body"><div class="cm-text">${esc(c.comment)}</div>` +
        `<label for="resp-${c.id}"><span>${T('你的回覆', 'Your response')}</span><span class="saved" id="saved-${c.id}">${T('已儲存', 'Saved')}</span></label><textarea class="inp" id="resp-${c.id}" data-act="response" data-id="${c.id}" rows="3" maxlength="20000" placeholder="${T('寫下你的回覆，例如：已補充 30 與 60 天的敏感度分析…', 'Your reply, e.g. We added sensitivity analyses with 30 and 60 days…')}">${esc(c.response || '')}</textarea>` +
        `<label for="chg-${c.id}" style="margin-top:8px"><span>${T('修改位置（選填，會放進回覆信）', 'Where it changed (optional, goes into the letter)')}</span></label><input class="inp" id="chg-${c.id}" data-act="changes" data-id="${c.id}" maxlength="2000" value="${esc(c.changes || '')}" placeholder="${T('例如：p.5, L120–128; Table S4', 'e.g. p.5, L120–128; Table S4')}">` +
        `<div class="rvi-foot"><select data-act="comment-status" data-id="${c.id}" aria-label="${T('狀態', 'Status')}">${Object.entries(C_STATUS()).map(([k, l]) => `<option value="${k}"${k === c.status ? ' selected' : ''}>${l}</option>`).join('')}</select><button class="btn sm" data-act="reuse-answer" data-id="${c.id}">${T('從回覆庫帶入', 'Reuse a reply')}</button><button class="btn ghost sm" data-act="edit-comment" data-id="${c.id}">${ic('edit')}${T('編輯意見', 'Edit comment')}</button></div></div>` : '') + '</div>';
  }
  const reviewerOrder = (a, b) => { const k = (s) => (/^editor/i.test(s) ? -1 : (parseInt((s.match(/\d+/) || [999])[0], 10))); return k(a) - k(b) || a.localeCompare(b); };
  const reviewerNo = (name) => (/^editor/i.test(name) ? 'E' : ((name.match(/\d+/) || [''])[0] || name.slice(0, 1).toUpperCase()));
  function tabInfo(p) {
    const pr = p.project_id && byId('projects', p.project_id);
    const rows = [[T('標題', 'Title'), p.title], [T('專案', 'Project'), pr ? (pr.short_title || pr.title) : ''], [T('目標期刊', 'Target journal'), p.target_journal], [T('作者列', 'Authors'), p.authors], [T('作者序', 'Authorship'), p.my_role], [T('年份', 'Year'), p.year], ['DOI', p.doi], [T('自訂截止日', 'Own deadline'), ymd(p.deadline)], [T('備註', 'Notes'), p.notes]].filter((x) => x[1]);
    return `<div class="d-actions"><button class="btn sm" data-act="edit-paper" data-id="${p.id}">${ic('edit')}${T('編輯', 'Edit')}</button><button class="btn sm" data-act="cite" data-id="${p.id}">${ADMIN ? T('更新到 CV', 'Update CV') : T('書目資料', 'Citation details')}</button></div>` +
      `<dl class="kv" style="margin-top:10px">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` + todoBlock({ paper: p.id }) + authorsSection(p);
  }


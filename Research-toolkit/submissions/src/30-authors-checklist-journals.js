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
    await reload();
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
  const papersSeg = (which) => `<div class="seg" role="tablist" style="margin-bottom:6px">${[['papers', T('論文', 'Papers')], ['journals', T('期刊', 'Journals')], ['reviewing', T('我審的稿', 'Reviewing')], ['answers', T('回覆庫', 'Answers')]].map(([k, l]) => `<a role="tab" class="seg-a" href="#/${k}" aria-selected="${which === k}">${l}</a>`).join('')}</div>`;
  function journalStats(name) {
    const rs = D.rounds.filter((r) => normJ(r.journal) === normJ(name));
    const papers = [...new Set(rs.map((r) => r.paper_id))];
    const firstDays = papers.map((pid) => { const r = rs.filter((x) => x.paper_id === pid)[0]; return r && r.decision_on ? days(parseDate(r.submitted_on), parseDate(r.decision_on)) : null; }).filter((x) => x !== null && x >= 0);
    const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
    return { rounds: rs, papers: papers.length, firstMedian: median(firstDays), firstN: firstDays.length, desk: papers.filter((pid) => rs.some((r) => r.paper_id === pid && r.decision === 'desk_reject')).length, accepted: papers.filter((pid) => rs.some((r) => r.paper_id === pid && ['accept', 'pre_proof'].includes(r.decision))).length, rejected: papers.filter((pid) => rs.some((r) => r.paper_id === pid && r.decision === 'reject')).length, roundsPer: papers.length ? (rs.length / papers.length) : 0 };
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


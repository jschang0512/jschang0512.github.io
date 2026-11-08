// 活動報名：大家在這裡報名，結算時由主辦人轉成一筆一般的帳，之後的欠款和還款
// 都走既有流程，不另做收款。權限和人數上限的把關在資料庫（scripts/2026-11-events.sql）。
(function(){
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.sb = sb;
  const $ = id => document.getElementById(id);
  let myMember = null, memberRows = [], memberById = {};
  let events = [], regs = [];
  let closingEvent = null;

  $("backBtn").addEventListener("click", () => {
    if(history.length > 1) history.back();
    else location.href = "summary.html";
  });

  const money = (code, amount) => {
    const c = CURRENCIES.find(x => x.code === code);
    return (c ? c.symbol : code + " ") + formatAmt(amount);
  };
  const going = id => regs.filter(r => r.event_id === id && r.status === "going");
  const today = () => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  // 資料庫擋下報名時回的訊息
  function friendlyError(error){
    const m = (error && error.message) || "";
    if(m.includes("event_full")) return t("events.errFull");
    if(m.includes("event_closed")) return t("events.errClosed");
    if(m.includes("event_deadline_passed")) return t("events.errDeadline");
    return t("settings.msg.saveFailedRetry");
  }

  const locale = () => getLang() === "zh-Hant" ? "zh-TW" : getLang();
  const parseDay = iso => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  const dayNumber = iso => Math.round(Date.parse(iso + "T00:00:00Z") / 86400000);

  function feeText(e){
    if(e.fee_mode === "per_person") return { main: money(e.currency, e.fee_amount), unit: t("events.perPerson") };
    const n = going(e.id).length;
    return n
      ? { main: "≈ " + money(e.currency, Math.ceil(e.fee_amount / n)), unit: t("events.perPersonNow", { total: money(e.currency, e.fee_amount) }) }
      : { main: money(e.currency, e.fee_amount), unit: t("events.totalSplit") };
  }

  function cardHTML(e){
    const attendees = going(e.id);
    const mine = regs.find(r => r.event_id === e.id && r.member_id === myMember.id);
    const isGoing = mine && mine.status === "going";
    const isOrganizer = e.created_by === myMember.id;
    const full = e.capacity && attendees.length >= e.capacity;
    const expired = e.deadline && e.deadline < today();
    const open = e.status === "open";
    const date = parseDay(e.event_date);
    const fee = feeText(e);
    const daysToDeadline = e.deadline ? dayNumber(e.deadline) - dayNumber(today()) : null;
    const state = e.status === "cancelled" ? t("events.stateCancelled")
      : e.status === "closed" ? t("events.stateClosed")
      : expired ? t("events.stateExpired")
      : full ? t("events.full")
      : isGoing ? t("events.youreIn") : "";
    const stateCls = isGoing && open && !expired && !full ? " is-in" : "";
    const count = e.capacity ? t("events.countOf", { n: attendees.length, max: e.capacity }) : t("events.count", { n: attendees.length });
    const faces = attendees.map(r => renderAvatarHTML(memberRows.find(x => x.id === r.member_id) || { id: r.member_id, name: memberById[r.member_id] || "?" }, "avatar-md")).join("");
    const organizer = memberById[e.created_by] || "?";
    const mapUrl = e.location ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(e.location) : "";
    return `<article class="ev-card${open ? "" : " is-over"}" data-id="${e.id}">
      <div class="ev-head">
        <div class="ev-date">
          <span>${escapeHtml(date.toLocaleDateString(locale(), { month: "short" }))}</span>
          <b>${date.getDate()}</b>
          <span>${escapeHtml(date.toLocaleDateString(locale(), { weekday: "short" }))}</span>
        </div>
        <div class="ev-title">
          <h2>${escapeHtml(e.title)}</h2>
          ${e.location ? `<a class="ev-line" href="${mapUrl}" target="_blank" rel="noopener"><span class="sb-ico" style="--ico:var(--ico-pin)" aria-hidden="true"></span><span>${escapeHtml(e.location)}</span></a>` : ""}
          <p class="ev-line"><span class="sb-ico" style="--ico:var(--ico-user)" aria-hidden="true"></span><span>${escapeHtml(t("events.organizer", { name: organizer }))}</span></p>
        </div>
        ${state ? `<span class="ev-state${stateCls}">${escapeHtml(state)}</span>` : ""}
      </div>

      <div class="ev-fee"><b>${escapeHtml(fee.main)}</b><span>${escapeHtml(fee.unit)}</span></div>
      ${e.note ? `<p class="ev-note">${escapeHtml(e.note)}</p>` : ""}

      <div class="ev-people">
        <div class="ev-people-head">
          <span>${escapeHtml(count)}</span>
          ${open && e.deadline && !expired ? `<span>${escapeHtml(daysToDeadline === 0 ? t("events.deadlineToday") : t("events.deadlineIn", { n: daysToDeadline }))}</span>` : ""}
        </div>
        ${e.capacity ? `<div class="ev-bar"><i style="width:${Math.min(100, attendees.length / e.capacity * 100)}%"></i></div>` : ""}
        ${faces ? `<div class="ev-faces">${faces}</div>` : `<p class="ev-nobody">${escapeHtml(t("events.nobody"))}</p>`}
      </div>

      ${open ? `<div class="ev-actions">
        <button type="button" class="ev-btn${isGoing ? "" : " is-primary"}" data-act="${isGoing ? "leave" : "join"}"${!isGoing && (full || expired) ? " disabled" : ""}>${escapeHtml(isGoing ? t("events.leave") : full ? t("events.full") : expired ? t("events.stateExpired") : t("events.join"))}</button>
        ${isOrganizer ? `<div class="ev-admin">
          <button type="button" class="ev-link-btn" data-act="close">${escapeHtml(t("events.closeTitle"))}</button>
          <button type="button" class="ev-link-btn" data-act="edit">${escapeHtml(t("common.edit"))}</button>
          <button type="button" class="ev-link-btn is-quiet" data-act="cancel">${escapeHtml(t("events.cancel"))}</button>
        </div>` : ""}
      </div>` : ""}
      ${e.expense_id ? `<a class="ev-view" href="currency.html?c=${encodeURIComponent(e.currency)}&openExpense=${encodeURIComponent(e.expense_id)}">${escapeHtml(t("events.viewExpense"))} ›</a>` : ""}
      <div class="msg" data-msg></div>
    </article>`;
  }

  function render(){
    const active = events.filter(e => e.status === "open").sort((a, b) => a.event_date.localeCompare(b.event_date));
    const past = events.filter(e => e.status !== "open").sort((a, b) => b.event_date.localeCompare(a.event_date));
    $("eventList").innerHTML = active.map(cardHTML).join("");
    $("eventPastList").innerHTML = past.map(cardHTML).join("");
    $("eventEmpty").classList.toggle("hidden", !!active.length);
    $("eventPast").classList.toggle("hidden", !past.length);
    $("eventPastTitle").textContent = t("events.pastCount", { n: past.length });
  }

  async function load(){
    const { data, error } = await sb.from("events").select("*").eq("group_id", myMember.group_id).order("event_date", { ascending:true });
    if(error) throw error;
    events = data || [];
    regs = [];
    if(events.length){
      const res = await sb.from("event_registrations").select("*").in("event_id", events.map(e => e.id));
      if(res.error) throw res.error;
      regs = res.data || [];
    }
    render();
  }

  async function setStatus(card, e, status){
    const { error } = await sb.from("event_registrations").upsert(
      { event_id: e.id, member_id: myMember.id, status }, { onConflict: "event_id,member_id" });
    if(error){
      const msg = card.querySelector("[data-msg]");
      msg.textContent = friendlyError(error);
      msg.className = "msg error";
      return;
    }
    await load();
  }

  async function onCardClick(ev){
    const btn = ev.target.closest("[data-act]");
    if(!btn) return;
    const card = btn.closest(".ev-card");
    const e = events.find(x => x.id === card.dataset.id);
    if(!e) return;
    const act = btn.dataset.act;
    if(act === "join") return setStatus(card, e, "going");
    if(act === "leave") return setStatus(card, e, "not_going");
    if(act === "close") return openClose(e);
    if(act === "edit") return openForm(e);
    if(act === "cancel"){
      if(!(await sbConfirm(t("events.cancelConfirm", { name: e.title })))) return;
      const { error } = await sb.from("events").update({ status: "cancelled" }).eq("id", e.id);
      if(error){ await sbAlert(t("settings.msg.saveFailedRetry"), t("settings.errorTitle")); return; }
      await load();
    }
  }
  $("eventList").addEventListener("click", onCardClick);
  $("eventPastList").addEventListener("click", onCardClick);

  const showModal = m => { m.classList.remove("hidden"); m.classList.add("show"); };
  const hideModal = m => m.classList.remove("show");

  // ---------- 開新活動／編輯 ----------
  let editingEventId = null;
  let deadlineRel = null; // 用「活動前 N 天」選的截止日，活動日期改了跟著移
  const feeRadios = Array.from(document.querySelectorAll('input[name="evFee"]'));
  const feeMode = () => (feeRadios.find(r => r.checked) || feeRadios[0]).value;
  $("evCurrency").innerHTML = CURRENCIES.map(c => `<option value="${c.code}">${c.label} (${c.code})</option>`).join("");

  const isoOf = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const addDays = (iso, n) => { const d = parseDay(iso); d.setDate(d.getDate() + n); return isoOf(d); };
  const longDay = iso => parseDay(iso).toLocaleDateString(locale(), { month: "numeric", day: "numeric", weekday: "short" });
  function relDays(iso){
    const n = dayNumber(iso) - dayNumber(today());
    if(n === 0) return t("events.dToday");
    if(n === 1) return t("events.dTomorrow");
    return n > 1 ? t("events.inDays", { n }) : t("events.datePassed");
  }
  const activeCount = () => memberRows.filter(m => !m.left_at).length;
  const goingCount = () => editingEventId ? going(editingEventId).length : 0;

  // 快速選項：名稱、日期、備註
  const titleChips = $("evTitleChips");
  t("events.titleSuggestions").split(",").forEach(name => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = name;
    b.addEventListener("click", () => { $("evTitle").value = name; refreshForm(); $("evDate").focus(); });
    titleChips.appendChild(b);
  });
  const noteChips = $("evNoteChips");
  ["noteTime", "noteBring", "noteGetThere"].forEach(key => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = "+ " + t("events." + key);
    b.addEventListener("click", () => {
      const note = $("evNote");
      const line = t("events." + key) + "：";
      note.value = note.value.trim() ? note.value.replace(/\s+$/, "") + "\n" + line : line;
      note.focus();
      note.setSelectionRange(note.value.length, note.value.length);
      refreshForm();
    });
    noteChips.appendChild(b);
  });

  function renderDateChips(){
    const now = today();
    const dow = parseDay(now).getDay();
    const sat = addDays(now, (6 - dow + 7) % 7);
    const opts = [
      ["events.dToday", now], ["events.dTomorrow", addDays(now, 1)],
      ["events.dSat", sat], ["events.dSun", addDays(sat, 1)], ["events.dNextSat", addDays(sat, 7)]
    ];
    const seen = new Set();
    const cur = $("evDate").value;
    $("evDateChips").innerHTML = opts.filter(([, d]) => !seen.has(d) && seen.add(d))
      .map(([k, d]) => `<button type="button" data-date="${d}" class="${d === cur ? "is-on" : ""}">${escapeHtml(t(k))}</button>`).join("");
  }
  $("evDateChips").addEventListener("click", e => {
    const b = e.target.closest("[data-date]");
    if(!b) return;
    $("evDate").value = b.dataset.date;
    onDateChange();
  });

  function renderDeadlineChips(){
    const date = $("evDate").value;
    const opts = [[null, "events.dlNone"], [1, "events.dlDayBefore"], [3, "events.dl3Days"], [7, "events.dlWeek"]];
    const cur = $("evDeadline").value;
    $("evDeadlineChips").innerHTML = opts.map(([n, k]) => {
      const d = n && date ? addDays(date, -n) : null;
      const disabled = n && (!date || d < today());
      const on = n ? (d === cur) : !cur;
      return `<button type="button" data-rel="${n || ""}" class="${on ? "is-on" : ""}"${disabled ? " disabled" : ""}>${escapeHtml(t(k))}</button>`;
    }).join("");
  }
  $("evDeadlineChips").addEventListener("click", e => {
    const b = e.target.closest("[data-rel]");
    if(!b || b.disabled) return;
    deadlineRel = b.dataset.rel ? Number(b.dataset.rel) : null;
    $("evDeadline").value = deadlineRel && $("evDate").value ? addDays($("evDate").value, -deadlineRel) : "";
    refreshForm();
  });
  $("evDeadline").addEventListener("input", () => { deadlineRel = null; });

  function onDateChange(){
    if(deadlineRel && $("evDate").value) $("evDeadline").value = addDays($("evDate").value, -deadlineRel);
    refreshForm();
  }
  $("evDate").addEventListener("change", onDateChange);

  // 人數上限：± 按鈕，編輯時不能比已經報名的人少
  function setCapacity(v){ $("evCapacity").value = v == null ? "" : String(v); refreshForm(); }
  $("evCapMinus").addEventListener("click", () => {
    const v = Number($("evCapacity").value);
    if(!v) return;
    setCapacity(Math.max(1, goingCount(), v - 1));
  });
  $("evCapPlus").addEventListener("click", () => {
    const v = Number($("evCapacity").value);
    setCapacity(v ? v + 1 : Math.max(goingCount(), activeCount(), 2));
  });
  $("evCapClear").addEventListener("click", () => setCapacity(null));

  // 金額欄的標題跟著收費方式換
  function updateFeePreview(){
    $("evAmountLabel").textContent = t(feeMode() === "per_person" ? "events.amountEach" : "events.amountTotal");
  }

  function setHint(id, text, bad){
    const el = $(id);
    el.textContent = text || "";
    el.classList.toggle("hidden", !text);
    el.classList.toggle("is-bad", !!bad);
  }

  // 表單任何地方變了：提示、快速選項、預覽一起更新
  function formErrors(){
    const date = $("evDate").value;
    const deadline = $("evDeadline").value;
    const cap = Number($("evCapacity").value);
    const original = editingEventId && events.find(x => x.id === editingEventId);
    return {
      date: date && date < today() && (!original || original.event_date !== date) ? t("events.datePassed") : "",
      cap: cap && cap < goingCount() ? t("events.capBelowGoing", { n: goingCount() }) : "",
      deadline: deadline && date && deadline > date ? t("events.deadlineAfterEvent")
        : deadline && deadline < today() && (!original || original.deadline !== deadline) ? t("events.deadlinePassed") : ""
    };
  }
  function refreshForm(){
    const date = $("evDate").value;
    const deadline = $("evDeadline").value;
    const errs = formErrors();
    setHint("evDateHint", errs.date || (date ? `${longDay(date)}・${relDays(date)}` : ""), !!errs.date);
    const cap = Number($("evCapacity").value);
    setHint("evCapHint", errs.cap || (goingCount() ? t("events.capGoing", { n: goingCount() }) : cap ? "" : t("events.capNone")), !!errs.cap);
    setHint("evDeadlineHint", errs.deadline || (deadline ? t("events.dlUntil", { date: longDay(deadline) }) : t("events.dlNoneHint")), !!errs.deadline);
    $("evCapMinus").disabled = !cap || cap <= Math.max(1, goingCount());
    $("evCapClear").classList.toggle("hidden", !cap);
    renderDateChips();
    renderDeadlineChips();
    updateFeePreview();
    renderCardPreview();
  }

  // 用列表同一個卡片樣式畫出來，主辦人送出前就知道大家看到什麼
  function renderCardPreview(){
    const fake = {
      id: editingEventId || "__preview",
      title: $("evTitle").value.trim() || t("events.previewNoTitle"),
      event_date: $("evDate").value || today(),
      location: $("evLocation").value.trim() || null,
      note: $("evNote").value.trim() || null,
      currency: $("evCurrency").value,
      fee_mode: feeMode(),
      fee_amount: Number($("evAmount").value) || 0,
      capacity: Number($("evCapacity").value) || null,
      deadline: $("evDeadline").value || null,
      status: "open",
      created_by: myMember ? myMember.id : ""
    };
    $("evCardPreview").innerHTML = cardHTML(fake);
  }

  const formEl = $("eventFormModal");
  formEl.addEventListener("input", e => { if(e.target.id !== "evDate") refreshForm(); });
  feeRadios.forEach(r => r.addEventListener("change", refreshForm));
  $("evCurrency").addEventListener("change", refreshForm);

  function openForm(e){
    editingEventId = e ? e.id : null;
    $("eventFormTitle").textContent = t(e ? "events.editTitle" : "events.add");
    $("eventFormSubmit").textContent = t(e ? "events.save" : "events.create");
    $("evTitle").value = e ? e.title : "";
    $("evDate").value = e ? e.event_date : today();
    $("evLocation").value = (e && e.location) || "";
    $("evNote").value = (e && e.note) || "";
    $("evAmount").value = e ? e.fee_amount : "";
    $("evCapacity").value = (e && e.capacity) || "";
    $("evDeadline").value = (e && e.deadline) || "";
    deadlineRel = null;
    const mode = e ? e.fee_mode : "per_person";
    feeRadios.forEach(r => { r.checked = r.value === mode; });
    $("evCurrency").value = e ? e.currency : "TWD";
    enhanceSelect($("evCurrency"));
    $("eventFormMsg").textContent = "";
    refreshForm();
    showModal($("eventFormModal"));
  }
  $("eventAddBtn").addEventListener("click", () => openForm(null));
  $("eventFormClose").addEventListener("click", () => hideModal($("eventFormModal")));
  $("eventFormSubmit").addEventListener("click", async () => {
    const msg = $("eventFormMsg");
    const fail = text => { msg.textContent = text; msg.className = "msg error"; };
    const title = $("evTitle").value.trim();
    const amount = Number($("evAmount").value);
    const capacity = Number($("evCapacity").value) || null;
    const deadline = $("evDeadline").value || null;
    if(!title) return fail(t("events.needTitle"));
    if(!$("evDate").value) return fail(t("events.needDate"));
    if(!(amount > 0)) return fail(t("settings.recurringFormNeedAmount"));
    const errs = formErrors();
    if(errs.date || errs.cap || errs.deadline) return fail(errs.date || errs.cap || errs.deadline);
    const fields = {
      title, event_date: $("evDate").value, location: $("evLocation").value.trim() || null,
      note: $("evNote").value.trim() || null, currency: $("evCurrency").value,
      fee_mode: feeMode(), fee_amount: amount, capacity, deadline
    };
    const btn = $("eventFormSubmit");
    btn.disabled = true;
    const { error } = editingEventId
      ? await sb.from("events").update(fields).eq("id", editingEventId)
      : await sb.from("events").insert({ ...fields, group_id: myMember.group_id, created_by: myMember.id });
    btn.disabled = false;
    if(error) return fail(t("settings.msg.saveFailedRetry"));
    hideModal($("eventFormModal"));
    await load();
  });

  // ---------- 結算成帳目 ----------
  function closeCheckedIds(){
    return Array.from($("eventCloseAttendees").querySelectorAll("input:checked")).map(i => i.value);
  }
  function closeTotal(){
    const value = Number($("eventCloseAmount").value) || 0;
    return closingEvent.fee_mode === "per_person" ? value * closeCheckedIds().length : value;
  }
  function updateCloseSummary(){
    const n = closeCheckedIds().length;
    $("eventCloseSummary").textContent = n ? t("events.closeSummary", { n, total: money(closingEvent.currency, closeTotal()) }) : "";
  }
  function openClose(e){
    closingEvent = e;
    const ids = new Set(going(e.id).map(r => r.member_id));
    $("eventCloseAttendees").innerHTML = memberRows.filter(m => !m.left_at || ids.has(m.id)).map(m => `<label class="check-pill${ids.has(m.id) ? " checked" : ""}">
      <input type="checkbox" value="${m.id}"${ids.has(m.id) ? " checked" : ""}>
      ${renderAvatarHTML(m, "avatar-xs")}
      <span class="check-pill-name">${escapeHtml(memberById[m.id] || m.name)}</span>
    </label>`).join("");
    $("eventCloseAttendees").querySelectorAll("input").forEach(inp => inp.addEventListener("change", () => {
      inp.closest(".check-pill").classList.toggle("checked", inp.checked);
      updateCloseSummary();
    }));
    $("eventCloseAmountLabel").textContent = t(e.fee_mode === "per_person" ? "events.closeAmountEach" : "events.closeAmountTotal");
    $("eventCloseAmount").value = e.fee_amount;
    $("eventCloseMsg").textContent = "";
    updateCloseSummary();
    showModal($("eventCloseModal"));
  }
  $("eventCloseAmount").addEventListener("input", updateCloseSummary);
  $("eventCloseClose").addEventListener("click", () => hideModal($("eventCloseModal")));
  $("eventCloseSubmit").addEventListener("click", async () => {
    const msg = $("eventCloseMsg");
    const e = closingEvent;
    const ids = closeCheckedIds();
    const total = closeTotal();
    if(!ids.length){ msg.textContent = t("events.needAttendees"); msg.className = "msg error"; return; }
    if(!(total > 0)){ msg.textContent = t("settings.recurringFormNeedAmount"); msg.className = "msg error"; return; }
    const btn = $("eventCloseSubmit");
    btn.disabled = true;
    try{
      const formShared = await import("./expense-form-shared.js?v=" + APP_VERSION);
      const shares = formShared.computeEqualSplitShares({
        subtotal: total, taxAmount: 0, taxSplitMode: "ratio",
        participantIds: ids, payerIds: [myMember.id], addonAmounts: {}
      });
      const { data: expense, error } = await sb.from("expenses").insert({
        group_id: myMember.group_id, amount: total, description: e.title, note: e.note || null,
        expense_date: e.event_date, created_by: myMember.id, currency: e.currency, category: "general",
        payers: [{ member_id: myMember.id, amount: total }], shares
      }).select().single();
      if(error) throw error;
      const upd = await sb.from("events").update({ status: "closed", expense_id: expense.id }).eq("id", e.id);
      if(upd.error) throw upd.error;
      hideModal($("eventCloseModal"));
      await load();
      showRecordSuccess({
        title: t("record.expenseTitle"),
        headline: e.title,
        amount: money(e.currency, total),
        rows: [
          { label: t("record.split"), value: t("receipt.splitAmong", { count: ids.length }), people: ids.map(id => memberRows.find(m => m.id === id) || { id, name: memberById[id] || "?" }) },
          { label: t("record.date"), value: e.event_date }
        ]
      });
    }catch(err){
      console.error("活動結算失敗：", err);
      msg.textContent = t("settings.msg.saveFailedRetry");
      msg.className = "msg error";
    }finally{
      btn.disabled = false;
    }
  });

  (async function boot(){
    const { data:{ session } } = await sb.auth.getSession();
    if(!session || !session.user){
      location.href = "index.html?redirect=events.html";
      return;
    }
    const result = await loadGroupMembers(sb, session.user, false);
    myMember = result.myMember;
    memberRows = result.memberRows;
    memberById = result.memberById;
    window.myMember = myMember;
    window.memberRows = memberRows;
    if(!myMember){ location.href = "summary.html"; return; }
    try{
      await load();
    }catch(e){
      console.error("讀取活動失敗：", e);
      $("eventList").innerHTML = "";
      $("eventEmptyTitle").textContent = t("recap.loadFailTitle");
      $("eventEmptyText").textContent = t("events.loadFailed");
      $("eventEmpty").classList.remove("hidden");
      $("eventAddBtn").classList.add("hidden");
      return;
    }
    try{ localStorage.setItem("splitbill-events-seen-" + myMember.group_id, new Date().toISOString()); }catch(e){}
    sbEnablePullToRefresh(load);
  })();
})();

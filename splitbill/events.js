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

  function feeText(e){
    if(e.fee_mode === "per_person") return t("events.feeEach", { amount: money(e.currency, e.fee_amount) });
    const n = going(e.id).length;
    return n
      ? t("events.feeShared", { total: money(e.currency, e.fee_amount), amount: money(e.currency, Math.ceil(e.fee_amount / n)) })
      : t("events.feeTotal", { total: money(e.currency, e.fee_amount) });
  }

  function cardHTML(e){
    const attendees = going(e.id);
    const mine = regs.find(r => r.event_id === e.id && r.member_id === myMember.id);
    const isGoing = mine && mine.status === "going";
    const isOrganizer = e.created_by === myMember.id;
    const full = e.capacity && attendees.length >= e.capacity;
    const expired = e.deadline && e.deadline < today();
    const open = e.status === "open";
    const count = e.capacity ? t("events.countOf", { n: attendees.length, max: e.capacity }) : t("events.count", { n: attendees.length });
    const faces = attendees.map(r => {
      const m = memberRows.find(x => x.id === r.member_id) || { id: r.member_id, name: memberById[r.member_id] || "?" };
      return renderAvatarHTML(m, "avatar-md");
    }).join("");
    const state = e.status === "cancelled" ? t("events.stateCancelled")
      : e.status === "closed" ? t("events.stateClosed")
      : expired ? t("events.stateExpired") : "";
    return `<article class="event-card card" data-id="${e.id}">
      <div class="event-head">
        <h2>${escapeHtml(e.title)}</h2>
        ${state ? `<span class="event-state">${escapeHtml(state)}</span>` : ""}
      </div>
      <p class="event-meta">${escapeHtml(e.event_date)}${e.location ? "・" + escapeHtml(e.location) : ""}</p>
      <p class="event-fee">${escapeHtml(feeText(e))}</p>
      ${e.note ? `<p class="event-note">${escapeHtml(e.note)}</p>` : ""}
      <div class="event-people"><span>${escapeHtml(count)}</span><div class="event-faces">${faces}</div></div>
      ${e.deadline && open ? `<p class="event-meta">${escapeHtml(t("events.deadline", { date: e.deadline }))}</p>` : ""}
      ${open ? `<div class="event-actions">
        <button type="button" class="event-btn ${isGoing ? "" : "is-primary"}" data-act="${isGoing ? "leave" : "join"}" ${!isGoing && (full || expired) ? "disabled" : ""}>${escapeHtml(isGoing ? t("events.leave") : full ? t("events.full") : t("events.join"))}</button>
        ${isOrganizer ? `<button type="button" class="event-btn" data-act="close">${escapeHtml(t("events.closeTitle"))}</button>
        <button type="button" class="event-btn is-quiet" data-act="cancel">${escapeHtml(t("events.cancel"))}</button>` : ""}
      </div>` : ""}
      ${e.expense_id ? `<a class="event-link" href="currency.html?c=${encodeURIComponent(e.currency)}&openExpense=${encodeURIComponent(e.expense_id)}">${escapeHtml(t("events.viewExpense"))}</a>` : ""}
      <div class="msg" data-msg></div>
    </article>`;
  }

  function render(){
    const now = today();
    const active = events.filter(e => e.status === "open").sort((a, b) => a.event_date.localeCompare(b.event_date));
    const past = events.filter(e => e.status !== "open").sort((a, b) => b.event_date.localeCompare(a.event_date));
    $("eventList").innerHTML = active.map(cardHTML).join("");
    $("eventPastList").innerHTML = past.map(cardHTML).join("");
    $("eventEmpty").classList.toggle("hidden", !!events.length);
    $("eventPastTitle").classList.toggle("hidden", !past.length);
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
    const card = btn.closest(".event-card");
    const e = events.find(x => x.id === card.dataset.id);
    if(!e) return;
    const act = btn.dataset.act;
    if(act === "join") return setStatus(card, e, "going");
    if(act === "leave") return setStatus(card, e, "not_going");
    if(act === "close") return openClose(e);
    if(act === "cancel"){
      if(!(await sbConfirm(t("events.cancelConfirm", { name: e.title })))) return;
      const { error } = await sb.from("events").update({ status: "cancelled" }).eq("id", e.id);
      if(error){ await sbAlert(t("settings.msg.saveFailedRetry"), t("settings.errorTitle")); return; }
      await load();
    }
  }
  $("eventList").addEventListener("click", onCardClick);

  const showModal = m => { m.classList.remove("hidden"); m.classList.add("show"); };
  const hideModal = m => m.classList.remove("show");

  // ---------- 開新活動 ----------
  $("evCurrency").innerHTML = CURRENCIES.map(c => `<option value="${c.code}">${c.label} (${c.code})</option>`).join("");
  $("eventAddBtn").addEventListener("click", () => {
    ["evTitle", "evLocation", "evAmount", "evCapacity", "evDeadline", "evNote"].forEach(id => { $(id).value = ""; });
    $("evDate").value = today();
    $("evFeeMode").value = "per_person";
    $("evCurrency").value = "TWD";
    enhanceSelect($("evFeeMode"));
    enhanceSelect($("evCurrency"));
    $("eventFormMsg").textContent = "";
    showModal($("eventFormModal"));
  });
  $("eventFormClose").addEventListener("click", () => hideModal($("eventFormModal")));
  $("eventFormSubmit").addEventListener("click", async () => {
    const msg = $("eventFormMsg");
    const title = $("evTitle").value.trim();
    const amount = Number($("evAmount").value);
    const capacity = Number($("evCapacity").value) || null;
    if(!title){ msg.textContent = t("events.needTitle"); msg.className = "msg error"; return; }
    if(!$("evDate").value){ msg.textContent = t("events.needDate"); msg.className = "msg error"; return; }
    if(!(amount > 0)){ msg.textContent = t("settings.recurringFormNeedAmount"); msg.className = "msg error"; return; }
    const btn = $("eventFormSubmit");
    btn.disabled = true;
    const { error } = await sb.from("events").insert({
      group_id: myMember.group_id, created_by: myMember.id, title,
      event_date: $("evDate").value, location: $("evLocation").value.trim() || null,
      note: $("evNote").value.trim() || null, currency: $("evCurrency").value,
      fee_mode: $("evFeeMode").value, fee_amount: amount, capacity, deadline: $("evDeadline").value || null
    });
    btn.disabled = false;
    if(error){ msg.textContent = t("settings.msg.saveFailedRetry"); msg.className = "msg error"; return; }
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
      $("eventEmpty").textContent = t("events.loadFailed");
      $("eventEmpty").classList.remove("hidden");
      $("eventAddBtn").classList.add("hidden");
      return;
    }
    sbEnablePullToRefresh(load);
  })();
})();

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
      <div class="ev-extra">
        ${open ? `<button type="button" class="ev-link-btn" data-act="calendar"><span class="sb-ico" style="--ico:var(--ico-calendar)" aria-hidden="true"></span>${escapeHtml(t("events.addToCalendar"))}</button>` : `<button type="button" class="ev-link-btn" data-act="again">${escapeHtml(t("events.runAgain"))}</button>`}
      </div>
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

  // ---------- 加入行事曆 ----------
  // 活動只有日期；備註裡有「集合時間：19:00」這種寫法就從那個時間開始、抓兩小時，否則是整天。
  // 依裝置走最直接的路：iPhone 開 .ics（系統直接跳「加入行事曆」）、Android 瀏覽器用 intent
  // 開手機行事曆的新增畫面、App（Capacitor 不轉送 intent）和電腦開 Google 日曆的新增頁。
  // 從備註找開始時間，口語也認：「18:30」「下午 3 點」「晚上七點半」「早上9點15分」「中午12點」
  // 「午後3時」「7:30pm」「3 PM」。先看有「集合／時間／開始」字樣的那幾行，沒有才看整段。
  const CN_NUM = { "零":0, "〇":0, "一":1, "二":2, "兩":2, "两":2, "三":3, "四":4, "五":5, "六":6, "七":7, "八":8, "九":9, "十":10 };
  function cnToNum(s){
    if(/^\d+$/.test(s)) return Number(s);
    if(s.length === 1) return CN_NUM[s];
    if(s[0] === "十") return 10 + (CN_NUM[s[1]] || 0);           // 十一、十二
    if(s[1] === "十") return CN_NUM[s[0]] * 10 + (CN_NUM[s[2]] || 0); // 二十、二十五
    return NaN;
  }
  function parseNoteTime(text){
    const PM = /(下午|晚上|傍晚|夜晚|午後|夜|pm|p\.m\.)/i, AM = /(上午|早上|清晨|凌晨|午前|朝|am|a\.m\.)/i, NOON = /中午|正午|お昼/;
    const N = "(\\d{1,2}|[零〇一二兩两三四五六七八九十]{1,3})";
    const patterns = [
      new RegExp("(\\d{1,2})\\s*[:：]\\s*(\\d{2})", "g"),
      new RegExp(N + "\\s*[點点時时]\\s*(半|" + N + "\\s*分?)?", "g"),
      new RegExp("(\\d{1,2})\\s*(?:[:.](\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)", "gi")
    ];
    for(const re of patterns) for(const hit of text.matchAll(re)){
      let h = cnToNum(hit[1]);
      let min = hit[2] === "半" ? 30 : hit[2] ? cnToNum(String(hit[2]).replace(/\s*分$/, "")) : 0;
      if(re === patterns[1] && hit[3]) min = cnToNum(hit[3]);
      if(!Number.isFinite(h) || !Number.isFinite(min) || h > 24 || min > 59) continue;
      // 上下午看數字前面那一小段；英文的 am/pm 也可能接在後面（7:30pm）
      const after = text.slice(hit.index + hit[0].length, hit.index + hit[0].length + 5);
      const before = text.slice(Math.max(0, hit.index - 4), hit.index)
        + (re === patterns[2] ? hit[3] : "") + ((after.match(/^\s*(am|pm|a\.m\.|p\.m\.)/i) || [""])[0]);
      // 中文數字的「一點」常是「早一點到」這種意思，要有上下午字樣或「半／分」才算時間
      const marked = PM.test(before) || AM.test(before) || NOON.test(before);
      if(hit[1] === "一" && !(marked || hit[2])) continue;
      if(PM.test(before) && h < 12) h += 12;
      else if(NOON.test(before) && h < 11) h += 12;
      else if(AM.test(before) && h === 12) h = 0;
      // 沒寫上下午的 1～6 點，聚會幾乎都是下午（「兩點半集合」＝14:30）
      else if(!marked && re === patterns[1] && h >= 1 && h <= 6) h += 12;
      if(h === 24) h = 0;
      return { h, min };
    }
    return null;
  }
  function calendarTimes(e){
    const [y, m, d] = e.event_date.split("-").map(Number);
    const note = e.note || "";
    const keyLines = note.split("\n").filter(l => l.includes(t("events.noteTime")) || /集合|時間|时间|開始|开始|見合|開始|start|meet/i.test(l));
    const time = parseNoteTime(keyLines.join("\n")) || parseNoteTime(note);
    if(time){
      const start = new Date(y, m - 1, d, time.h, time.min);
      return { allDay: false, start, end: new Date(start.getTime() + 2 * 3600000) };
    }
    return { allDay: true, start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1) };
  }
  const pad2 = n => String(n).padStart(2, "0");
  const ymd = dt => dt.getFullYear() + pad2(dt.getMonth() + 1) + pad2(dt.getDate());
  const ymdhms = dt => ymd(dt) + "T" + pad2(dt.getHours()) + pad2(dt.getMinutes()) + "00";
  function calendarDetails(e){
    const fee = feeText(e);
    return [fee.main + " " + fee.unit, e.note || "", location.origin + location.pathname].filter(Boolean).join("\n\n");
  }
  function icsText(e){
    const { allDay, start, end } = calendarTimes(e);
    const esc = v => String(v || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
    return [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Splitbill//Events//EN", "BEGIN:VEVENT",
      "UID:" + e.id + "@splitbill",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
      allDay ? "DTSTART;VALUE=DATE:" + ymd(start) : "DTSTART:" + ymdhms(start),
      allDay ? "DTEND;VALUE=DATE:" + ymd(end) : "DTEND:" + ymdhms(end),
      "SUMMARY:" + esc(e.title),
      e.location ? "LOCATION:" + esc(e.location) : "",
      "DESCRIPTION:" + esc(calendarDetails(e)),
      "END:VEVENT", "END:VCALENDAR"
    ].filter(Boolean).join("\r\n");
  }
  function calendarLink(e){
    const ua = navigator.userAgent;
    const isApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const { allDay, start, end } = calendarTimes(e);
    if(isIOS) return { kind: "ics", url: "data:text/calendar;charset=utf-8," + encodeURIComponent(icsText(e)) };
    if(/Android/.test(ua) && !isApp){
      // 整天的活動 Android 用 UTC 午夜表示
      const begin = allDay ? Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) : start.getTime();
      const finish = allDay ? Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) : end.getTime();
      const x = v => encodeURIComponent(v || "");
      return { kind: "intent", url: "intent:#Intent;action=android.intent.action.INSERT;type=vnd.android.cursor.item/event;"
        + "S.title=" + x(e.title) + ";"
        + (e.location ? "S.eventLocation=" + x(e.location) + ";" : "")
        + "S.description=" + x(calendarDetails(e)) + ";"
        + "l.beginTime=" + begin + ";l.endTime=" + finish + ";"
        + (allDay ? "B.allDay=true;" : "") + "end" };
    }
    const q = new URLSearchParams({
      action: "TEMPLATE",
      text: e.title,
      dates: allDay ? ymd(start) + "/" + ymd(end) : ymdhms(start) + "/" + ymdhms(end),
      details: calendarDetails(e)
    });
    if(e.location) q.set("location", e.location);
    return { kind: "google", url: "https://calendar.google.com/calendar/render?" + q.toString() };
  }
  // App 1.1 起內建 CalendarIntent 外掛，直接開手機行事曆的新增畫面；舊版 App 沒有就照下面開 Google 日曆
  async function addToCalendar(e){
    const cap = window.Capacitor;
    if(cap && cap.isPluginAvailable && cap.isPluginAvailable("CalendarIntent")){
      const { allDay, start, end } = calendarTimes(e);
      const opts = {
        title: e.title, location: e.location || "", description: calendarDetails(e), allDay,
        // 整天的活動 Android 用 UTC 午夜表示
        begin: allDay ? Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) : start.getTime(),
        end: allDay ? Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) : end.getTime()
      };
      try {
        const plugin = cap.Plugins && cap.Plugins.CalendarIntent;
        if(plugin && plugin.insert) await plugin.insert(opts);
        else await cap.nativePromise("CalendarIntent", "insert", opts);
        return;
      } catch(err){ console.warn("CalendarIntent failed, falling back:", err); }
    }
    const link = calendarLink(e);
    if(link.kind === "google") window.open(link.url, "_blank", "noopener");
    else location.href = link.url;
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
    if(act === "calendar") return addToCalendar(e);
    if(act === "again") return openForm(null, e);
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

  // copyFrom：「再辦一次」，沿用舊活動的內容開一個新的；日期、截止日要重選
  function openForm(e, copyFrom){
    if(copyFrom){
      openForm(null);
      $("evTitle").value = copyFrom.title;
      $("evLocation").value = copyFrom.location || "";
      $("evNote").value = copyFrom.note || "";
      $("evAmount").value = copyFrom.fee_amount;
      $("evCapacity").value = copyFrom.capacity || "";
      feeRadios.forEach(r => { r.checked = r.value === copyFrom.fee_mode; });
      if(!feeRadios.some(r => r.checked)) feeRadios[0].checked = true;
      $("evCurrency").value = copyFrom.currency;
      enhanceSelect($("evCurrency"));
      refreshForm();
      return;
    }
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
      // 記帳和把活動改成已結算在資料庫裡一次做完（scripts/2026-11-close-event.sql），
      // 不會只做一半；已經結算過的活動會被擋下，按兩次也只記一筆
      const { error } = await sb.rpc("close_event", { p_event_id: e.id, p_total: total, p_shares: shares });
      if(error) throw error;
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
      if(/event_already_closed/.test(err && err.message || "")){
        hideModal($("eventCloseModal"));
        await load();
        await sbAlert(t("events.alreadyClosed"), t("settings.errorTitle"));
        return;
      }
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

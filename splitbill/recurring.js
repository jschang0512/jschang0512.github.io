// 固定收支頁：週期性支出範本的列表和表單。實際到期自動記帳的邏輯在 app.js 的
// generateDueRecurringExpenses。
(function(){
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.sb = sb;
  const shownCurrencies = JSON.parse(localStorage.getItem("splitbill-shown-currencies") || "null") || ["TWD"];
  let myMember = null, memberRows = [], memberById = {};

  document.getElementById("backBtn").addEventListener("click", () => {
    if(history.length > 1) history.back();
    else location.href = "summary.html";
  });

  // ---------- 週期性支出範本管理（暫停／繼續／刪除，實際的自動記錄邏輯在 app.js 的 generateDueRecurringExpenses） ----------
  // 誰能編輯／刪除／暫停：只有這筆範本的付款人、分攤人、或建立者——比照一般
  // 支出/還款的規則，跟後端 RLS policy（scripts/recurring_expenses_restrict_edit.sql）
  // 是同一套邏輯。renderRecurringTemplates()（列表按鈕要不要顯示）跟
  // openRecurringTemplateForm()（直接用網址開編輯表單時要不要擋）都會用到，
  // 拉到外層共用，不要各自維護一份。
  function isRecurringTemplateParty(tmpl, userId){
    return tmpl.created_by === userId
      || (tmpl.payers || []).some(p => p.member_id === userId)
      || (tmpl.shares || []).some(s => s.member_id === userId);
  }

  const dayNumber = iso => Math.round(Date.parse(iso + "T00:00:00Z") / 86400000);
  function todayIso(){
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function money(code, amount){
    const c = CURRENCIES.find(x => x.code === code);
    return (c ? c.symbol : code + " ") + Math.round(amount).toLocaleString("en-US");
  }
  function dueText(iso){
    const days = dayNumber(iso) - dayNumber(todayIso());
    if(days <= 0) return t("summary.dueToday");
    if(days === 1) return t("summary.dueTomorrow");
    if(days <= 30) return t("summary.dueInDays", { days });
    return iso;
  }
  // 一年 52 週，換算成每月大約多少，週週期才加得起來
  const perMonth = tmpl => tmpl.interval_unit === "weekly" ? 52 / 12 : 1;

  function renderSummary(active){
    const box = document.getElementById("fxSummary");
    if(!active.length){ box.classList.add("hidden"); return; }
    const myId = myMember && myMember.id;
    const byCurrency = {};
    active.forEach(tmpl => {
      const row = byCurrency[tmpl.currency] || (byCurrency[tmpl.currency] = { total:0, mine:0 });
      row.total += Number(tmpl.amount) * perMonth(tmpl);
      const share = (tmpl.shares || []).find(s => s.member_id === myId);
      if(share) row.mine += Number(share.amount) * perMonth(tmpl);
    });
    const next = active.slice().sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))[0];
    box.innerHTML = Object.keys(byCurrency).map(code => `<div class="fx-sum-main">
        <span>${escapeHtml(t("recurring.perMonthMine"))}</span>
        <strong>${escapeHtml(money(code, byCurrency[code].mine))}</strong>
        <small>${escapeHtml(t("recurring.perMonthGroup", { amount: money(code, byCurrency[code].total) }))}</small>
      </div>`).join("") + `<div class="fx-sum-next">
        <span class="sb-ico" style="--ico:var(--ico-clock)" aria-hidden="true"></span>
        <span>${escapeHtml(t("recurring.next", { name: next.description || "" }))}・${escapeHtml(dueText(next.next_due_date))}</span>
      </div>`;
    box.classList.remove("hidden");
  }

  function itemHTML(tmpl, weekdayNames){
    const myId = myMember && myMember.id;
    const meta = getCategoryMeta(tmpl.description, null, tmpl.category);
    const interval = tmpl.interval_unit === "weekly"
      ? t("settings.recurringIntervalWeekly", { weekday: weekdayNames[tmpl.interval_day] || "" })
      : t("settings.recurringIntervalMonthly", { day: tmpl.interval_day });
    const canEdit = isRecurringTemplateParty(tmpl, myId);
    const share = (tmpl.shares || []).find(s => s.member_id === myId);
    const people = (tmpl.shares || []).map(s => memberRows.find(m => m.id === s.member_id) || { id: s.member_id, name: memberById[s.member_id] || "?" });
    const payerId = tmpl.payers && tmpl.payers[0] && tmpl.payers[0].member_id;
    return `<article class="fx-item${tmpl.active ? "" : " is-paused"}" data-id="${tmpl.id}">
      <div class="fx-top">
        <span class="fx-icon" style="--c:${meta.color}">${meta.icon}</span>
        <div class="fx-name">
          <h2>${escapeHtml(tmpl.description || "")}</h2>
          <p>${escapeHtml(interval)}${tmpl.active ? "・" + escapeHtml(dueText(tmpl.next_due_date)) : ""}</p>
        </div>
        <div class="fx-amount">
          <b>${escapeHtml(money(tmpl.currency, tmpl.amount))}</b>
          ${share ? `<small>${escapeHtml(t("recurring.myShare", { amount: money(tmpl.currency, share.amount) }))}</small>` : ""}
        </div>
      </div>
      <div class="fx-bottom">
        <div class="fx-people">
          ${people.map(m => renderAvatarHTML(m, "avatar-sm")).join("")}
          <span>${escapeHtml(t("recurring.paidBy", { name: memberById[payerId] || "?" }))}</span>
        </div>
        ${canEdit ? `<div class="fx-actions">
          <label class="switch-toggle" title="${escapeHtml(t("recurring.toggle"))}">
            <input type="checkbox" class="recurring-tmpl-active-toggle" data-id="${tmpl.id}" aria-label="${escapeHtml(t("recurring.toggle"))}"${tmpl.active ? " checked" : ""}>
            <span class="switch-slider"></span>
          </label>
          <button type="button" class="fx-icon-btn recurring-tmpl-edit" data-id="${tmpl.id}" title="${t("common.edit")}" aria-label="${t("common.edit")}"><span class="sb-ico" style="--ico:var(--ico-pencil)" aria-hidden="true"></span></button>
          <button type="button" class="fx-icon-btn recurring-tmpl-delete" data-id="${tmpl.id}" data-name="${escapeHtml(tmpl.description || "")}" title="${t("settings.delete")}" aria-label="${t("settings.delete")}"><span class="sb-ico" style="--ico:var(--ico-trash)" aria-hidden="true"></span></button>
        </div>` : `<span class="recurring-tmpl-readonly-badge">${t("settings.recurringReadOnly")}</span>`}
      </div>
    </article>`;
  }

  let recurringTemplatesCache = [];
  async function renderRecurringTemplates(){
    const listEl = document.getElementById("recurringTemplatesList");
    const emptyEl = document.getElementById("recurringTemplatesEmpty");
    if(!listEl || !myMember || !myMember.group_id) return;

    const { data, error } = await sb
      .from("recurring_expenses")
      .select("*")
      .eq("group_id", myMember.group_id)
      .order("created_at", { ascending: false });
    if(error){
      console.warn("讀取週期性支出範本失敗：", error);
      await sbAlert(t("settings.msg.saveFailedRetry"), t("settings.errorTitle"));
      return;
    }

    const templates = data || [];
    recurringTemplatesCache = templates;
    emptyEl.classList.toggle("hidden", !!templates.length);
    const active = templates.filter(x => x.active).sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
    const paused = templates.filter(x => !x.active);
    renderSummary(active);

    const weekdayNames = t("currency.weekdays").split(",");
    listEl.innerHTML = active.map(x => itemHTML(x, weekdayNames)).join("")
      + (paused.length ? `<h2 class="sbf-group-title">${escapeHtml(t("recurring.paused"))}</h2>` + paused.map(x => itemHTML(x, weekdayNames)).join("") : "");

    listEl.querySelectorAll(".recurring-tmpl-edit").forEach(btn => {
      btn.addEventListener("click", () => openRecurringTemplateForm(btn.dataset.id));
    });
    listEl.querySelectorAll(".recurring-tmpl-active-toggle").forEach(inp => {
      inp.addEventListener("change", async () => {
        const { error: updErr } = await sb.from("recurring_expenses").update({ active: inp.checked }).eq("id", inp.dataset.id);
        if(updErr){
          console.error("更新週期性支出狀態失敗：", updErr);
          inp.checked = !inp.checked;
          await sbAlert(t("settings.msg.saveFailedRetry"), t("settings.errorTitle"));
          return;
        }
        renderRecurringTemplates();
      });
    });
    listEl.querySelectorAll(".recurring-tmpl-delete").forEach(btn => {
      btn.addEventListener("click", async () => {
        const ok = await sbConfirm(t("settings.recurringDeleteConfirm", { name: btn.dataset.name }));
        if(!ok) return;
        const { error: delErr } = await sb.from("recurring_expenses").delete().eq("id", btn.dataset.id);
        if(delErr){
          console.error("刪除週期性支出範本失敗：", delErr);
          await sbAlert(t("settings.msg.saveFailedRetry"), t("settings.errorTitle"));
          return;
        }
        renderRecurringTemplates();
      });
    });
  }

  // ---------- 🔁 週期性支出：獨立的建立/編輯範本表單 ----------
  // 跟一般記帳表單完全分開（不重用 currency.html 那個多步驟精靈），只支援
  // 「單一付款人 + 平分」，複雜的多付款人/自訂分攤/稅金/加點暫不支援——週期性
  // 支出（房租、訂閱）絕大多數就是這種最單純的形式，先求好用、再看要不要擴充。
  let editingRecurringTemplateId = null;

  // 跟 app.js 的 computeNextDueDate() 同一份邏輯（月週期固定在 interval_day 號、
  // 週週期加 7 天），這裡是設定頁自己獨立的一份，因為兩個檔案是各自獨立載入的
  // 頁面，沒有共用模組可以 import。
  // 只有「建立新範本」會呼叫這個函式算第一次的 next_due_date（編輯既有範本不會
  // 重算，避免改個金額就把排程打亂）。週期是「每週」時，第一次到期日一定要對齊
  // 使用者選的那個星期幾——原本這裡偷懶直接「今天+7天」，等於使用者選星期三
  // 也沒用，永遠都是照建立當下那天的星期幾在跑，選單形同虛設。
  function computeRecurTmplNextDueDate(intervalUnit, intervalDay, fromDateStr){
    const [y, m, d] = fromDateStr.split("-").map(Number);
    let dt;
    if(intervalUnit === "weekly"){
      const base = new Date(y, m - 1, d);
      let diff = (intervalDay - base.getDay() + 7) % 7;
      if(diff === 0) diff = 7; // 剛好今天就是選的那天，也要跳到下一次，不是今天
      dt = new Date(y, m - 1, d + diff);
    } else {
      dt = new Date(y, m, intervalDay);
    }
    return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
  }

  function initRecurringTemplateForm(){
    const addBtn = document.getElementById("recurringTemplateAddBtn");
    const modal = document.getElementById("recurringTemplateFormModal");
    const closeBtn = document.getElementById("recurringTemplateFormCloseBtn");
    const titleEl = document.getElementById("recurringTemplateFormTitle");
    const submitBtn = document.getElementById("recurTmplSubmitBtn");
    const msgEl = document.getElementById("recurTmplMsg");
    const descInp = document.getElementById("recurTmplDesc");
    const catSel = document.getElementById("recurTmplCategory");
    const curSel = document.getElementById("recurTmplCurrency");
    const amtInp = document.getElementById("recurTmplAmount");
    // 付款人和星期幾改成點選的按鈕，包成跟下拉選單一樣有 value 的介面，存檔那段邏輯不用改
    const payerWrap = document.getElementById("recurTmplPayer");
    const payerSel = {
      get value(){ const r = payerWrap.querySelector("input:checked"); return r ? r.value : ""; },
      set value(v){ payerWrap.querySelectorAll("input").forEach(r => { r.checked = r.value === v; r.closest(".check-pill").classList.toggle("checked", r.checked); }); }
    };
    const participantsWrap = document.getElementById("recurTmplParticipants");
    // 週期是兩顆單選按鈕，包成跟下拉選單一樣的介面，下面的邏輯不用分兩套
    const unitRadios = Array.from(document.querySelectorAll('input[name="recurUnit"]'));
    const unitSel = {
      get value(){ return (unitRadios.find(r => r.checked) || unitRadios[0]).value; },
      set value(v){ unitRadios.forEach(r => { r.checked = r.value === v; }); },
      addEventListener(type, fn){ unitRadios.forEach(r => r.addEventListener(type, fn)); }
    };
    const suggestWrap = document.getElementById("recurTmplSuggest");
    const SUGGEST_CATEGORY = { rent: "general", utilities: "general", internet: "network", subscription: "ticket", phone: "network" };
    ["rent", "utilities", "internet", "subscription", "phone"].forEach(key => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = t("recurring.sug." + key);
      b.addEventListener("click", () => {
        descInp.value = b.textContent;
        catSel.value = SUGGEST_CATEGORY[key];
        categoryTouched = true;
        enhanceSelect(catSel);
        amtInp.focus();
      });
      suggestWrap.appendChild(b);
    });
    const monthlyWrap = document.getElementById("recurTmplMonthlyWrap");
    const monthlyDaySel = document.getElementById("recurTmplMonthlyDay");
    const weeklyWrap = document.getElementById("recurTmplWeeklyWrap");
    const weeklyDayWrap = document.getElementById("recurTmplWeeklyDay");
    const weeklyDaySel = {
      get value(){ const r = weeklyDayWrap.querySelector("input:checked"); return r ? r.value : "1"; },
      set value(v){ weeklyDayWrap.querySelectorAll("input").forEach(r => { r.checked = r.value === String(v); }); }
    };
    const previewEl = document.getElementById("recurTmplPreview");
    let editingNextDue = null;
    let categoryTouched = false;
    if(!modal || !addBtn) return;

    if(curSel){
      curSel.innerHTML = CURRENCIES.map(c => `<option value="${c.code}">${c.label} (${c.code})</option>`).join("");
    }
    if(monthlyDaySel){
      monthlyDaySel.innerHTML = Array.from({length:28}, (_,i)=>i+1)
        .map(d => `<option value="${d}">${t("currency.recurringMonthlyDayOption", {day:d})}</option>`).join("");
    }
    const weekdayNames = t("currency.weekdays").split(",");
    weeklyDayWrap.innerHTML = weekdayNames.map((name, i) => `<label><input type="radio" name="recurWeekday" value="${i}"${i === 1 ? " checked" : ""}><span>${escapeHtml(name.replace(/^(星期|週)/, ""))}</span></label>`).join("");

    // 每人多少、下一次什麼時候記：邊填邊算給人看
    function updatePreview(){
      const amount = Number(amtInp.value);
      const n = participantsWrap.querySelectorAll("input:checked").length;
      if(!(amount > 0) || !n){ previewEl.classList.add("hidden"); return; }
      const intervalDay = Number(unitSel.value === "weekly" ? weeklyDaySel.value : monthlyDaySel.value);
      const next = editingNextDue || computeRecurTmplNextDueDate(unitSel.value, intervalDay, todayIso());
      const [y, m, d] = next.split("-").map(Number);
      const weekday = weekdayNames[new Date(y, m - 1, d).getDay()] || "";
      previewEl.textContent = t("recurring.preview", { each: money(curSel.value, amount / n), n, date: next, weekday });
      previewEl.classList.remove("hidden");
    }
    [amtInp, monthlyDaySel, curSel].forEach(el => el.addEventListener("input", updatePreview));
    [monthlyDaySel, curSel].forEach(el => el.addEventListener("change", updatePreview));
    weeklyDayWrap.addEventListener("change", () => { editingNextDue = null; updatePreview(); });
    monthlyDaySel.addEventListener("change", () => { editingNextDue = null; updatePreview(); });
    unitSel.addEventListener("change", () => { editingNextDue = null; updatePreview(); });
    participantsWrap.addEventListener("change", updatePreview);

    // 名稱打完自動猜類別，使用者自己改過類別就不再動
    catSel.addEventListener("change", () => { categoryTouched = true; });
    descInp.addEventListener("input", () => {
      if(categoryTouched || !descInp.value.trim()) return;
      catSel.value = getCategoryMeta(descInp.value, null, null).type || "general";
      enhanceSelect(catSel);
    });
    document.getElementById("recurTmplAll").addEventListener("click", () => {
      const boxes = Array.from(participantsWrap.querySelectorAll("input"));
      const allOn = boxes.every(b => b.checked);
      boxes.forEach(b => { b.checked = !allOn; b.closest(".check-pill").classList.toggle("checked", b.checked); });
      updatePreview();
    });
    if(unitSel && monthlyWrap && weeklyWrap){
      unitSel.addEventListener("change", ()=>{
        const isWeekly = unitSel.value === "weekly";
        monthlyWrap.classList.toggle("hidden", isWeekly);
        weeklyWrap.classList.toggle("hidden", !isWeekly);
      });
    }

    function populateMemberFields(){
      const activeMembers = (memberRows || []).filter(m => !m.left_at);
      payerWrap.innerHTML = activeMembers.map(m => `<label class="check-pill">
          <input type="radio" name="recurPayer" value="${m.id}">
          ${renderAvatarHTML(m, "avatar-xs")}
          <span class="check-pill-name">${escapeHtml(memberById[m.id] || m.name)}</span>
        </label>`).join("");
      payerWrap.querySelectorAll("input").forEach(inp => inp.addEventListener("change", () => { payerSel.value = inp.value; }));
      if(participantsWrap){
        participantsWrap.innerHTML = activeMembers.map(m => `<label class="check-pill checked">
          <input type="checkbox" value="${m.id}" checked>
          ${renderAvatarHTML(m, "avatar-xs")}
          <span class="check-pill-name">${escapeHtml(memberById[m.id] || m.name)}</span>
        </label>`).join("");
        participantsWrap.querySelectorAll("input[type=checkbox]").forEach(inp => {
          inp.addEventListener("change", () => inp.closest(".check-pill").classList.toggle("checked", inp.checked));
        });
      }
    }

    function resetForm(){
      editingRecurringTemplateId = null;
      if(titleEl) titleEl.textContent = t("settings.recurringFormTitleNew");
      if(submitBtn) submitBtn.textContent = t("settings.recurringFormSubmitNew");
      if(msgEl){ msgEl.textContent = ""; msgEl.className = "msg"; }
      if(descInp) descInp.value = "";
      if(catSel){ catSel.value = "general"; enhanceSelect(catSel); }
      if(curSel){ curSel.value = (shownCurrencies && shownCurrencies[0]) || "TWD"; enhanceSelect(curSel); }
      if(amtInp) amtInp.value = "";
      populateMemberFields();
      if(myMember) payerSel.value = myMember.id;
      editingNextDue = null;
      categoryTouched = false;
      unitSel.value = "monthly";
      if(monthlyWrap) monthlyWrap.classList.remove("hidden");
      if(weeklyWrap) weeklyWrap.classList.add("hidden");
    }

    function openModal(){
      resetForm();
      updatePreview();
      modal.classList.remove("hidden");
      modal.classList.add("show");
    }
    function closeModal(){
      modal.classList.remove("show");
      setTimeout(()=> modal.classList.add("hidden"), 200);
    }

    addBtn.addEventListener("click", openModal);
    if(closeBtn) closeBtn.addEventListener("click", closeModal);

    // 供外部呼叫：從範本清單點✎、或從「這筆以後都改」導過來（?editRecurring=id）都走這裡。
    window.openRecurringTemplateForm = function(templateId){
      const tmpl = recurringTemplatesCache.find(x => x.id === templateId);
      if(!tmpl){
        // 這筆帳的來源範本可能已經被刪掉了（歷史紀錄上舊的 [recurring:id] 標記還在，
        // 但範本本身不在了）——用專門的訊息說清楚，不要顯示成一般的「請再試一次」，
        // 不然使用者會一直重試一個註定失敗的操作。
        sbAlert(t("settings.recurringTemplateGone"), t("settings.errorTitle"));
        return;
      }
      // 直接帶網址進來（例如從幣別頁「這筆以後都改」導過來的）也要擋一次權限——
      // 光是清單裡藏按鈕不夠，這裡是另一個能開到編輯表單的入口，一樣要檢查。
      // 真的送出去的話後端 RLS 也會擋，但先在畫面上講清楚體驗比較好。
      if(!isRecurringTemplateParty(tmpl, myMember && myMember.id)){
        sbAlert(t("settings.recurringNoPermission"), t("settings.errorTitle"));
        return;
      }
      resetForm();
      editingRecurringTemplateId = templateId;
      if(titleEl) titleEl.textContent = t("settings.recurringFormTitleEdit");
      if(submitBtn) submitBtn.textContent = t("settings.recurringFormSubmitEdit");
      if(descInp) descInp.value = tmpl.description || "";
      if(catSel){ catSel.value = tmpl.category || "general"; enhanceSelect(catSel); }
      if(curSel){ curSel.value = tmpl.currency || "TWD"; enhanceSelect(curSel); }
      if(amtInp) amtInp.value = tmpl.amount;
      const payerId = tmpl.payers && tmpl.payers[0] && tmpl.payers[0].member_id;
      if(payerId) payerSel.value = payerId;
      editingNextDue = tmpl.next_due_date;
      categoryTouched = true;
      // 分攤名單依範本 shares 記錄勾回去；如果這個範本當初是用完整記帳表單建立、
      // 帶了自訂分攤或多付款人，這裡只能還原成「這些人平分」的簡化版本——
      // 儲存時會照這個簡化版本重新計算，等於把舊範本降版成平分制。
      if(participantsWrap && tmpl.shares){
        const shareIds = new Set(tmpl.shares.map(s => s.member_id));
        participantsWrap.querySelectorAll("input[type=checkbox]").forEach(inp => {
          const checked = shareIds.has(inp.value);
          inp.checked = checked;
          inp.closest(".check-pill").classList.toggle("checked", checked);
        });
      }
      unitSel.value = tmpl.interval_unit || "monthly";
      const isWeekly = tmpl.interval_unit === "weekly";
      if(monthlyWrap) monthlyWrap.classList.toggle("hidden", isWeekly);
      if(weeklyWrap) weeklyWrap.classList.toggle("hidden", !isWeekly);
      if(isWeekly){ weeklyDaySel.value = tmpl.interval_day; }
      else if(monthlyDaySel){ monthlyDaySel.value = tmpl.interval_day; enhanceSelect(monthlyDaySel); }
      updatePreview();
      modal.classList.remove("hidden");
      modal.classList.add("show");
    };

    if(submitBtn){
      submitBtn.addEventListener("click", async () => {
        const desc = (descInp.value || "").trim();
        const amount = Number(amtInp.value);
        const checkedIds = Array.from(participantsWrap.querySelectorAll("input:checked")).map(i => i.value);

        if(!desc){ msgEl.textContent = t("settings.recurringFormNeedDesc"); msgEl.className = "msg error"; return; }
        if(!amount || amount <= 0){ msgEl.textContent = t("settings.recurringFormNeedAmount"); msgEl.className = "msg error"; return; }
        if(!checkedIds.length){ msgEl.textContent = t("settings.recurringFormNeedParticipants"); msgEl.className = "msg error"; return; }

        submitBtn.disabled = true;
        try {
          const formShared = await import("./expense-form-shared.js?v=" + APP_VERSION);
          const shares = formShared.computeEqualSplitShares({
            subtotal: amount, taxAmount: 0, taxSplitMode: "ratio",
            participantIds: checkedIds, payerIds: [payerSel.value], addonAmounts: {}
          });
          const intervalUnit = unitSel.value;
          const intervalDay = Number(intervalUnit === "weekly" ? weeklyDaySel.value : monthlyDaySel.value);
          const payload = {
            group_id: myMember.group_id,
            description: desc,
            category: catSel.value || "general",
            amount,
            currency: curSel.value,
            payers: [{ member_id: payerSel.value, amount }],
            shares,
            interval_unit: intervalUnit,
            interval_day: intervalDay
          };

          if(editingRecurringTemplateId){
            const { error } = await sb.from("recurring_expenses").update(payload).eq("id", editingRecurringTemplateId);
            if(error) throw error;
            msgEl.textContent = t("settings.recurringUpdateSuccess");
          } else {
            payload.next_due_date = computeRecurTmplNextDueDate(intervalUnit, intervalDay, new Date().toISOString().slice(0,10));
            payload.created_by = myMember.id;
            const { error } = await sb.from("recurring_expenses").insert(payload);
            if(error) throw error;
            msgEl.textContent = t("settings.recurringCreateSuccess");
          }
          msgEl.className = "msg ok";
          renderRecurringTemplates();
          setTimeout(closeModal, 900);
        } catch(err){
          console.error("儲存週期性支出範本失敗：", err);
          msgEl.textContent = t("settings.msg.saveFailedRetry");
          msgEl.className = "msg error";
        } finally {
          submitBtn.disabled = false;
        }
      });
    }
  }

  (async function boot(){
    const { data:{ session } } = await sb.auth.getSession();
    if(!session || !session.user){
      location.href = "index.html?redirect=recurring.html";
      return;
    }
    const result = await loadGroupMembers(sb, session.user, false);
    myMember = result.myMember;
    memberRows = result.memberRows;
    memberById = result.memberById;
    window.myMember = myMember;
    window.memberRows = memberRows;
    if(!myMember){ location.href = "summary.html"; return; }
    initRecurringTemplateForm();
    await renderRecurringTemplates();
    sbEnablePullToRefresh(renderRecurringTemplates);
    const editId = new URLSearchParams(location.search).get("editRecurring");
    if(editId && typeof window.openRecurringTemplateForm === "function") window.openRecurringTemplateForm(editId);
  })();
})();

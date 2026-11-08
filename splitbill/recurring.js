// 固定收支頁：固定支出範本的列表、明細、填金額和建立／編輯表單。
// 到期自動記帳在 app.js 的 generateDueRecurringExpenses；下一期日期、漲價、
// 照比例分錢這些規則在 shared-ui.js 的 sbRecur*，兩邊共用同一份。
(function(){
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.sb = sb;
  const shownCurrencies = JSON.parse(localStorage.getItem("splitbill-shown-currencies") || "null") || ["TWD"];
  let myMember = null, memberRows = [], memberById = {};
  let templatesCache = [];

  document.getElementById("backBtn").addEventListener("click", () => {
    if(history.length > 1) history.back();
    else location.href = "summary.html";
  });

  // 誰能編輯／刪除／暫停／填金額／跳過：這筆範本的付款人、分攤人、或建立者，
  // 跟後端 RLS policy 是同一套規則。
  function isParty(tmpl, memberId){
    return tmpl.created_by === memberId
      || (tmpl.payers || []).some(p => p.member_id === memberId)
      || (tmpl.shares || []).some(s => s.member_id === memberId);
  }

  const dayNumber = iso => Math.round(Date.parse(iso + "T00:00:00Z") / 86400000);
  const todayIso = () => sbIsoDay(new Date());
  const weekdayNames = () => t("currency.weekdays").split(",");
  function weekdayOf(iso){
    const [y, m, d] = iso.split("-").map(Number);
    return weekdayNames()[new Date(y, m - 1, d).getDay()] || "";
  }
  function money(code, amount){
    const c = CURRENCIES.find(x => x.code === code);
    const dec = c ? c.decimals : 2;
    const n = Number(amount) || 0;
    const txt = dec && Math.round(n) !== n ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(n).toLocaleString("en-US");
    return (c ? c.symbol : code + " ") + txt;
  }
  function dueText(iso){
    const days = dayNumber(iso) - dayNumber(todayIso());
    if(days < 0) return t("recurring.overdue", { date: iso });
    if(days === 0) return t("summary.dueToday");
    if(days === 1) return t("summary.dueTomorrow");
    if(days <= 30) return t("summary.dueInDays", { days });
    return iso;
  }
  const memberObj = id => memberRows.find(m => m.id === id) || { id, name: memberById[id] || "?" };
  // 一年 52 週、每年一次，換算成每月大約多少，才加得起來
  const perMonth = tmpl => tmpl.interval_unit === "weekly" ? 52 / 12 : tmpl.interval_unit === "yearly" ? 1 / 12 : 1;
  const isEnded = tmpl => (tmpl.total_count && (tmpl.generated_count || 0) >= tmpl.total_count)
    || (tmpl.end_date && tmpl.next_due_date > tmpl.end_date);
  const needsFill = tmpl => tmpl.active && tmpl.variable_amount && tmpl.next_due_date <= todayIso() && !isEnded(tmpl);

  function intervalText(tmpl){
    if(tmpl.interval_unit === "weekly") return t("settings.recurringIntervalWeekly", { weekday: weekdayNames()[tmpl.interval_day] || "" });
    if(tmpl.interval_unit === "yearly") return t("recurring.intervalYearly", { month: tmpl.interval_month, day: tmpl.interval_day });
    return t("settings.recurringIntervalMonthly", { day: tmpl.interval_day });
  }
  function endText(tmpl){
    if(tmpl.total_count) return t("recurring.tagCount", { done: tmpl.generated_count || 0, total: tmpl.total_count });
    if(tmpl.end_date) return t("recurring.tagUntil", { date: tmpl.end_date });
    return "";
  }

  // ---------- 列表 ----------
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

  function itemHTML(tmpl){
    const myId = myMember && myMember.id;
    const meta = getCategoryMeta(tmpl.description, null, tmpl.category);
    const canEdit = isParty(tmpl, myId);
    const share = (tmpl.shares || []).find(s => s.member_id === myId);
    const people = (tmpl.shares || []).map(s => memberObj(s.member_id));
    const payerId = tmpl.payers && tmpl.payers[0] && tmpl.payers[0].member_id;
    const ended = isEnded(tmpl);
    const tags = [];
    if(tmpl.variable_amount) tags.push(t("recurring.tagVariable"));
    if(tmpl.split_mode === "ratio") tags.push(t("recurring.splitRatio"));
    if(tmpl.split_mode === "amount") tags.push(t("recurring.splitAmount"));
    const end = endText(tmpl);
    if(end) tags.push(end);
    if(tmpl.next_amount && tmpl.next_amount_from) tags.push(t("recurring.tagPriceChange", { date: tmpl.next_amount_from, amount: money(tmpl.currency, tmpl.next_amount) }));
    const status = ended ? t("recurring.ended") : needsFill(tmpl) ? t("recurring.waitFill") : tmpl.active ? dueText(tmpl.next_due_date) : "";
    const fill = needsFill(tmpl) && canEdit;
    return `<article class="fx-item${tmpl.active ? "" : " is-paused"}${fill ? " needs-fill" : ""}" data-id="${tmpl.id}" tabindex="0" role="button" aria-label="${escapeHtml(t("recurring.openDetail", { name: tmpl.description || "" }))}">
      <div class="fx-top">
        <span class="fx-icon" style="--c:${meta.color}">${meta.icon}</span>
        <div class="fx-name">
          <h2>${escapeHtml(tmpl.description || "")}</h2>
          <p>${escapeHtml(intervalText(tmpl))}${status ? "・" + escapeHtml(status) : ""}</p>
        </div>
        <div class="fx-amount">
          <b>${tmpl.variable_amount ? escapeHtml(t("recurring.about")) : ""}${escapeHtml(money(tmpl.currency, tmpl.amount))}</b>
          ${share ? `<small>${escapeHtml(t("recurring.myShare", { amount: money(tmpl.currency, share.amount) }))}</small>` : ""}
        </div>
      </div>
      ${tags.length ? `<div class="fx-tags">${tags.map(x => `<span>${escapeHtml(x)}</span>`).join("")}</div>` : ""}
      ${fill ? `<div class="fx-fill">
        <span>${escapeHtml(t("recurring.fillPending", { date: tmpl.next_due_date }))}</span>
        <button type="button" class="sbf-primary fx-fill-btn" data-id="${tmpl.id}">${escapeHtml(t("recurring.fillBtn"))}</button>
      </div>` : ""}
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

  // ---------- 檢視方式：全部／依類別／接下來 30 天 ----------
  const VIEW_KEY = "splitbill-recurring-view";
  function currentView(){
    try { const v = localStorage.getItem(VIEW_KEY); if(v === "category" || v === "upcoming") return v; } catch(e){}
    return "list";
  }
  function renderViewTabs(show){
    const box = document.getElementById("fxViews");
    box.classList.toggle("hidden", !show);
    box.setAttribute("aria-label", t("recurring.viewLabel"));
    const view = currentView();
    box.querySelectorAll("[data-view]").forEach(b => {
      const on = b.dataset.view === view;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", String(on));
    });
  }
  document.getElementById("fxViews").addEventListener("click", e => {
    const b = e.target.closest("[data-view]");
    if(!b) return;
    try { localStorage.setItem(VIEW_KEY, b.dataset.view); } catch(err){}
    renderRecurringTemplates();
  });

  // 不同幣別不能直接相加，金額一律「每個幣別各一個數字」用 + 串起來
  function sumByCurrency(rows){
    const by = {};
    rows.forEach(r => { by[r.currency] = (by[r.currency] || 0) + r.amount; });
    return Object.keys(by).map(code => money(code, by[code])).join(" + ");
  }

  function categoryHTML(active){
    const groups = {};
    active.forEach(tmpl => {
      const meta = getCategoryMeta(tmpl.description, null, tmpl.category);
      const g = groups[meta.type] || (groups[meta.type] = { meta, items: [], monthly: [] });
      g.items.push(tmpl);
      g.monthly.push({ currency: tmpl.currency, amount: Number(tmpl.amount) * perMonth(tmpl) });
    });
    return Object.values(groups)
      .sort((a, b) => b.monthly.reduce((s, r) => s + r.amount, 0) - a.monthly.reduce((s, r) => s + r.amount, 0))
      .map(g => `<section class="fx-group">
        <h2 class="fx-group-head">
          <span class="fx-icon" style="--c:${g.meta.color}">${g.meta.icon}</span>
          <span>${escapeHtml(g.meta.name)}<small>${escapeHtml(t("recurring.groupCount", { n: g.items.length }))}</small></span>
          <b>${escapeHtml(t("recurring.groupPerMonth", { amount: sumByCurrency(g.monthly) }))}</b>
        </h2>
        ${g.items.map(itemHTML).join("")}
      </section>`).join("");
  }

  // 從下一期開始一期一期往後推，到 30 天後為止；有結束日、次數、漲價都照算
  function occurrences(tmpl, untilIso){
    const out = [];
    if(isEnded(tmpl)) return out;
    let date = tmpl.next_due_date, n = tmpl.generated_count || 0, guard = 0;
    while(date <= untilIso && guard++ < 60){
      if(tmpl.end_date && date > tmpl.end_date) break;
      if(tmpl.total_count && n >= tmpl.total_count) break;
      const amount = tmpl.next_amount && tmpl.next_amount_from && tmpl.next_amount_from <= date ? Number(tmpl.next_amount) : Number(tmpl.amount);
      out.push({ tmpl, date, amount });
      n++;
      date = sbRecurNextDate(tmpl, date);
    }
    return out;
  }

  function upcomingHTML(active){
    const myId = myMember && myMember.id;
    const today = todayIso();
    const [y, m, d] = today.split("-").map(Number);
    const until = sbIsoDay(new Date(y, m - 1, d + 30));
    const rows = active.flatMap(tmpl => occurrences(tmpl, until)).sort((a, b) => a.date.localeCompare(b.date));
    if(!rows.length) return `<p class="fx-up-empty">${escapeHtml(t("recurring.upcomingEmpty"))}</p>`;
    const mineRows = rows.map(r => {
      const s = (sbRecurShares(r.tmpl, r.amount) || []).find(x => x.member_id === myId);
      return { currency: r.tmpl.currency, amount: s ? Number(s.amount) : 0, share: s };
    });
    const byDate = {};
    rows.forEach((r, i) => { (byDate[r.date] || (byDate[r.date] = [])).push({ ...r, share: mineRows[i].share }); });
    const head = `<div class="fx-up-total">
      <span>${escapeHtml(t("recurring.upcomingTotal"))}</span>
      <b>${escapeHtml(sumByCurrency(rows.map(r => ({ currency: r.tmpl.currency, amount: r.amount }))))}</b>
      <small>${escapeHtml(t("recurring.upcomingMine", { amount: sumByCurrency(mineRows) }))}</small>
    </div>`;
    return head + `<ol class="fx-timeline">` + Object.keys(byDate).map(date => {
      const [yy, mm, dd] = date.split("-").map(Number);
      const late = date < today;
      return `<li class="fx-up-day${late ? " is-late" : ""}">
        <div class="fx-up-date"><b>${mm}/${dd}</b><span>${escapeHtml(weekdayOf(date))}</span></div>
        <div class="fx-up-items">
          <p class="fx-up-when">${escapeHtml(dueText(date))}</p>
          ${byDate[date].map(r => {
            const meta = getCategoryMeta(r.tmpl.description, null, r.tmpl.category);
            const pending = r.tmpl.variable_amount && late;
            return `<button type="button" class="fx-up-row" data-id="${r.tmpl.id}">
              <span class="fx-icon" style="--c:${meta.color}">${meta.icon}</span>
              <span class="fx-up-name">${escapeHtml(r.tmpl.description || "")}${pending ? `<small>${escapeHtml(t("recurring.waitFill"))}</small>` : ""}</span>
              <span class="fx-up-amt"><b>${r.tmpl.variable_amount ? escapeHtml(t("recurring.about")) : ""}${escapeHtml(money(r.tmpl.currency, r.amount))}</b>${r.share ? `<small>${escapeHtml(t("recurring.myShare", { amount: money(r.tmpl.currency, r.share.amount) }))}</small>` : ""}</span>
            </button>`;
          }).join("")}
        </div>
      </li>`;
    }).join("") + `</ol>`;
  }

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
      console.warn("讀取固定支出失敗：", error);
      await sbAlert(t("settings.msg.saveFailedRetry"), t("settings.errorTitle"));
      return;
    }

    const templates = data || [];
    templatesCache = templates;
    emptyEl.classList.toggle("hidden", !!templates.length);
    // 要填金額的排最前面，其餘照下一期日期
    const active = templates.filter(x => x.active).sort((a, b) => (needsFill(b) - needsFill(a)) || a.next_due_date.localeCompare(b.next_due_date));
    const paused = templates.filter(x => !x.active);
    renderSummary(active);
    renderViewTabs(active.length >= 2);

    const view = active.length >= 2 ? currentView() : "list";
    const pausedHTML = paused.length ? `<h2 class="sbf-group-title">${escapeHtml(t("recurring.paused"))}</h2>` + paused.map(itemHTML).join("") : "";
    listEl.innerHTML = view === "upcoming" ? upcomingHTML(active)
      : (view === "category" ? categoryHTML(active) : active.map(itemHTML).join("")) + pausedHTML;

    listEl.querySelectorAll(".fx-up-row").forEach(row => row.addEventListener("click", () => openDetail(row.dataset.id)));
    listEl.querySelectorAll(".fx-item").forEach(card => {
      const open = e => {
        if(e.target.closest("button, label, input, a")) return;
        openDetail(card.dataset.id);
      };
      card.addEventListener("click", open);
      card.addEventListener("keydown", e => { if(e.key === "Enter" && e.target === card) openDetail(card.dataset.id); });
    });
    listEl.querySelectorAll(".fx-fill-btn").forEach(btn => btn.addEventListener("click", () => openFill(btn.dataset.id)));
    listEl.querySelectorAll(".recurring-tmpl-edit").forEach(btn => {
      btn.addEventListener("click", () => openRecurringTemplateForm(btn.dataset.id));
    });
    listEl.querySelectorAll(".recurring-tmpl-active-toggle").forEach(inp => {
      inp.addEventListener("change", async () => {
        const { error: updErr } = await sb.from("recurring_expenses").update({ active: inp.checked }).eq("id", inp.dataset.id);
        if(updErr){
          console.error("更新固定支出狀態失敗：", updErr);
          inp.checked = !inp.checked;
          await sbAlert(t("settings.msg.saveFailedRetry"), t("settings.errorTitle"));
          return;
        }
        renderRecurringTemplates();
      });
    });
    listEl.querySelectorAll(".recurring-tmpl-delete").forEach(btn => {
      btn.addEventListener("click", async () => {
        // 直接刪、跳一個可以復原的通知，不先問「確定嗎」；復原就是把同一列原樣放回去
        const row = templatesCache.find(x => x.id === btn.dataset.id);
        const { error: delErr } = await sb.from("recurring_expenses").delete().eq("id", btn.dataset.id);
        if(delErr){
          console.error("刪除固定支出失敗：", delErr);
          await sbAlert(t("settings.msg.saveFailedRetry"), t("settings.errorTitle"));
          return;
        }
        await renderRecurringTemplates();
        if(row) showToast(t("currency.deletedToastTitle"), row.description || "", t("currency.undoLabel"), async () => {
          const { error: insErr } = await sb.from("recurring_expenses").insert(row);
          if(insErr){ await sbAlert(t("currency.undoFailed") + insErr.message, t("settings.errorTitle")); return; }
          renderRecurringTemplates();
        });
      });
    });
  }

  // 資料庫擋下舊版 App 動排程時回的訊息；新版自己不會碰到，碰到就請對方重新整理
  async function alertSaveError(err){
    const old = err && /latest app version/.test(err.message || "");
    await sbAlert(t(old ? "recurring.needReload" : "settings.msg.saveFailedRetry"), t("settings.errorTitle"));
  }

  function showModal(modal){ modal.classList.remove("hidden"); modal.classList.add("show"); }
  function hideModal(modal){ modal.classList.remove("show"); setTimeout(() => modal.classList.add("hidden"), 200); }

  // ---------- 明細：每個人分多少、跳過這一期、記錄過的帳 ----------
  const detailModal = document.getElementById("fxDetailModal");
  document.getElementById("fxDetailClose").addEventListener("click", () => hideModal(detailModal));

  async function openDetail(id){
    const tmpl = templatesCache.find(x => x.id === id);
    if(!tmpl){ sbAlert(t("settings.recurringTemplateGone"), t("settings.errorTitle")); return; }
    const canEdit = isParty(tmpl, myMember.id);
    const body = document.getElementById("fxDetailBody");
    document.getElementById("fxDetailTitle").textContent = tmpl.description || "";
    const ended = isEnded(tmpl);
    const rows = [
      [t("recurring.dNext"), ended ? t("recurring.ended") : tmpl.active ? `${tmpl.next_due_date}（${weekdayOf(tmpl.next_due_date)}）` + (dueText(tmpl.next_due_date) !== tmpl.next_due_date ? `・${dueText(tmpl.next_due_date)}` : "") : t("recurring.paused")],
      [t("recurring.dInterval"), intervalText(tmpl)],
      [t(tmpl.variable_amount ? "recurring.amountEstimate" : "settings.recurringFormAmountLabel"), money(tmpl.currency, tmpl.amount)],
    ];
    if(tmpl.next_amount && tmpl.next_amount_from) rows.push([t("recurring.dPriceChange"), t("recurring.tagPriceChange", { date: tmpl.next_amount_from, amount: money(tmpl.currency, tmpl.next_amount) })]);
    const end = endText(tmpl);
    if(end) rows.push([t("recurring.endLabel"), end]);
    const payerId = tmpl.payers && tmpl.payers[0] && tmpl.payers[0].member_id;
    rows.push([t("settings.recurringFormPayerLabel"), memberById[payerId] || "?"]);
    const ratioOf = id => (tmpl.split_weights || []).find(w => w.member_id === id);
    body.innerHTML = `
      <dl class="fx-facts">${rows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("")}</dl>
      <h3 class="fx-sub">${escapeHtml(t("recurring.dShares"))}</h3>
      <ul class="fx-shares">${(tmpl.shares || []).map(s => {
        const r = tmpl.split_mode === "ratio" ? ratioOf(s.member_id) : null;
        return `<li>${renderAvatarHTML(memberObj(s.member_id), "avatar-sm")}<span>${escapeHtml(memberById[s.member_id] || "?")}${r ? `<small>${escapeHtml(t("recurring.parts", { n: r.weight }))}</small>` : ""}</span><b>${escapeHtml(money(tmpl.currency, s.amount))}</b></li>`;
      }).join("")}</ul>
      ${canEdit && tmpl.active && !ended ? `<div class="fx-detail-actions">
        ${needsFill(tmpl) ? `<button type="button" class="sbf-primary" id="fxDetailFill">${escapeHtml(t("recurring.fillBtn"))}</button>` : ""}
        <button type="button" class="sbf-ghost" id="fxDetailSkip">${escapeHtml(t("recurring.skipBtn", { date: tmpl.next_due_date }))}</button>
      </div>` : ""}
      <h3 class="fx-sub">${escapeHtml(t("recurring.dHistory"))}</h3>
      <ul class="fx-history" id="fxHistory"><li class="fx-history-empty">${escapeHtml(t("common.loading"))}</li></ul>`;
    const fillBtn = document.getElementById("fxDetailFill");
    if(fillBtn) fillBtn.addEventListener("click", () => { hideModal(detailModal); openFill(tmpl.id); });
    const skipBtn = document.getElementById("fxDetailSkip");
    if(skipBtn) skipBtn.addEventListener("click", () => skipPeriod(tmpl));
    showModal(detailModal);

    const { data, error } = await sb.from("expenses")
      .select("id,expense_date,amount,currency")
      .eq("group_id", myMember.group_id)
      .like("note", `%[recurring:${tmpl.id}]%`)
      .order("expense_date", { ascending: false })
      .limit(36);
    const list = document.getElementById("fxHistory");
    if(!list) return;
    if(error || !data || !data.length){
      list.innerHTML = `<li class="fx-history-empty">${escapeHtml(t(error ? "settings.msg.saveFailedRetry" : "recurring.historyEmpty"))}</li>`;
      return;
    }
    list.innerHTML = data.map(e => `<li><a href="currency.html?c=${encodeURIComponent(e.currency)}&openExpense=${encodeURIComponent(e.id)}">
        <span>${escapeHtml(e.expense_date)}<small>${escapeHtml(weekdayOf(e.expense_date))}</small></span>
        <b>${escapeHtml(money(e.currency, e.amount))}</b>
        <i aria-hidden="true">›</i>
      </a></li>`).join("");
  }

  async function skipPeriod(tmpl){
    const next = sbRecurNextDate(tmpl, tmpl.next_due_date);
    const ok = await sbConfirm(t("recurring.skipConfirm", { date: tmpl.next_due_date, next }));
    if(!ok) return;
    const { data, error } = await sb.from("recurring_expenses")
      .update(sbRecurAdvance(tmpl, { generated: false, todayIso: todayIso() }))
      .eq("id", tmpl.id).eq("next_due_date", tmpl.next_due_date).select();
    if(error){ console.error("跳過這一期失敗：", error); await alertSaveError(error); return; }
    hideModal(detailModal);
    await renderRecurringTemplates();
  }

  // ---------- 金額每期不同：填這期金額 ----------
  const fillModal = document.getElementById("fxFillModal");
  const fillAmt = document.getElementById("fxFillAmount");
  const fillPreview = document.getElementById("fxFillPreview");
  const fillMsg = document.getElementById("fxFillMsg");
  const fillSubmit = document.getElementById("fxFillSubmit");
  let fillTmpl = null;
  document.getElementById("fxFillClose").addEventListener("click", () => hideModal(fillModal));

  function updateFillPreview(){
    const amount = Number(fillAmt.value);
    if(!fillTmpl || !(amount > 0)){ fillPreview.classList.add("hidden"); return; }
    const shares = sbRecurShares(fillTmpl, amount);
    fillPreview.textContent = shares.map(s => `${memberById[s.member_id] || "?"} ${money(fillTmpl.currency, s.amount)}`).join("・");
    fillPreview.classList.remove("hidden");
  }
  fillAmt.addEventListener("input", updateFillPreview);

  function openFill(id){
    const tmpl = templatesCache.find(x => x.id === id);
    if(!tmpl){ sbAlert(t("settings.recurringTemplateGone"), t("settings.errorTitle")); return; }
    if(!needsFill(tmpl)){ openDetail(id); return; }
    fillTmpl = tmpl;
    document.getElementById("fxFillTitle").textContent = t("recurring.fillTitle", { name: tmpl.description || "" });
    document.getElementById("fxFillWhen").textContent = t("recurring.fillWhen", { date: tmpl.next_due_date, weekday: weekdayOf(tmpl.next_due_date), amount: money(tmpl.currency, tmpl.amount) });
    fillAmt.value = "";
    fillAmt.placeholder = String(tmpl.amount);
    fillMsg.textContent = ""; fillMsg.className = "msg";
    updateFillPreview();
    showModal(fillModal);
    setTimeout(() => fillAmt.focus(), 250);
  }

  fillSubmit.addEventListener("click", async () => {
    const tmpl = fillTmpl;
    const amount = Number(fillAmt.value);
    if(!tmpl) return;
    if(!(amount > 0)){ fillMsg.textContent = t("settings.recurringFormNeedAmount"); fillMsg.className = "msg error"; return; }
    fillSubmit.disabled = true;
    try{
      const upd = sbRecurAdvance(tmpl, { generated: true, amount, todayIso: todayIso() });
      const { data: claimed, error: claimErr } = await sb.from("recurring_expenses")
        .update(upd).eq("id", tmpl.id).eq("next_due_date", tmpl.next_due_date).select();
      if(claimErr) throw claimErr;
      if(!claimed || !claimed.length){
        // 別人剛剛已經填好這期了
        hideModal(fillModal);
        await sbAlert(t("recurring.fillTaken"), t("settings.errorTitle"));
        renderRecurringTemplates();
        return;
      }
      const shares = sbRecurShares(tmpl, amount);
      const payers = sbRecurPayers(tmpl, amount);
      const { data: exp, error: insErr } = await sb.from("expenses").insert({
        group_id: tmpl.group_id,
        description: tmpl.description,
        category: tmpl.category,
        amount,
        currency: tmpl.currency,
        payers,
        shares,
        expense_date: tmpl.next_due_date,
        created_by: myMember.id,
        note: `[recurring:${tmpl.id}]`
      }).select().single();
      if(insErr || !exp){
        // 帳沒記成功，把範本退回這一期，下次還能再填
        await sb.from("recurring_expenses").update({
          next_due_date: tmpl.next_due_date, amount: tmpl.amount, shares: tmpl.shares, payers: tmpl.payers,
          generated_count: tmpl.generated_count || 0, active: tmpl.active, last_generated_date: tmpl.last_generated_date,
          next_amount: tmpl.next_amount, next_amount_from: tmpl.next_amount_from,
          schedule_rev: upd.schedule_rev + 1
        }).eq("id", tmpl.id);
        throw insErr || new Error("insert failed");
      }
      hideModal(fillModal);
      await renderRecurringTemplates();
      const myShare = shares.find(s => s.member_id === myMember.id);
      const payerId = payers[0] && payers[0].member_id;
      window.showRecordSuccess({
        title: t("record.expenseTitle"),
        headline: tmpl.description || "",
        amount: money(tmpl.currency, amount),
        rows: [
          { label: t("record.payer"), value: memberById[payerId] || "?" },
          { label: t("record.split"), value: shares.length > 1 ? t("receipt.splitAmong", { count: shares.length }) : t("receipt.personalOnly"), people: shares.map(s => memberObj(s.member_id)) },
          ...(myShare ? [{ label: t("record.myShare"), value: money(tmpl.currency, myShare.amount) }] : []),
          { label: t("record.date"), value: tmpl.next_due_date }
        ],
        onEdit: () => { location.href = `currency.html?c=${encodeURIComponent(tmpl.currency)}&openExpense=${encodeURIComponent(exp.id)}`; }
      });
    } catch(err){
      console.error("填固定支出金額失敗：", err);
      fillMsg.textContent = t(/latest app version/.test(err && err.message || "") ? "recurring.needReload" : "settings.msg.saveFailedRetry");
      fillMsg.className = "msg error";
    } finally {
      fillSubmit.disabled = false;
    }
  });

  // ---------- 建立／編輯表單 ----------
  let editingId = null;

  function initRecurringTemplateForm(){
    const $ = id => document.getElementById(id);
    const addBtn = $("recurringTemplateAddBtn");
    const modal = $("recurringTemplateFormModal");
    const titleEl = $("recurringTemplateFormTitle");
    const submitBtn = $("recurTmplSubmitBtn");
    const msgEl = $("recurTmplMsg");
    const descInp = $("recurTmplDesc");
    const catSel = $("recurTmplCategory");
    const curSel = $("recurTmplCurrency");
    const amtInp = $("recurTmplAmount");
    const amtLabel = $("recurTmplAmountLabel");
    const variableChk = $("recurTmplVariable");
    const fromWrap = $("recurTmplFromWrap");
    const fromSel = $("recurTmplFrom");
    const payerWrap = $("recurTmplPayer");
    const participantsWrap = $("recurTmplParticipants");
    const splitRowsEl = $("recurTmplSplitRows");
    const splitNote = $("recurTmplSplitNote");
    const monthlyWrap = $("recurTmplMonthlyWrap");
    const monthWrap = $("recurTmplMonthWrap");
    const monthSel = $("recurTmplMonth");
    const daySel = $("recurTmplMonthlyDay");
    const dayLabel = $("recurTmplDayLabel");
    const weeklyWrap = $("recurTmplWeeklyWrap");
    const weeklyDayWrap = $("recurTmplWeeklyDay");
    const endDateWrap = $("recurTmplEndDateWrap");
    const endDateInp = $("recurTmplEndDate");
    const countWrap = $("recurTmplCountWrap");
    const countInp = $("recurTmplCount");
    const countDone = $("recurTmplCountDone");
    const previewEl = $("recurTmplPreview");
    const suggestWrap = $("recurTmplSuggest");
    if(!modal || !addBtn) return;

    // 單選按鈕群組包成有 value 的物件，下面讀寫都一樣
    const radioGroup = name => {
      const list = () => Array.from(document.querySelectorAll(`input[name="${name}"]`));
      return {
        get value(){ const r = list().find(x => x.checked); return r ? r.value : (list()[0] || {}).value; },
        set value(v){ list().forEach(r => { r.checked = r.value === String(v); }); },
        onChange(fn){ document.addEventListener("change", e => { if(e.target.name === name) fn(); }); }
      };
    };
    const unitSel = radioGroup("recurUnit");
    const splitSel = radioGroup("recurSplit");
    const endSel = radioGroup("recurEnd");
    const weekdaySel = radioGroup("recurWeekday");
    const payerSel = {
      get value(){ const r = payerWrap.querySelector("input:checked"); return r ? r.value : ""; },
      set value(v){ payerWrap.querySelectorAll("input").forEach(r => { r.checked = r.value === v; r.closest(".check-pill").classList.toggle("checked", r.checked); }); }
    };

    let editingTmpl = null;
    let categoryTouched = false;
    // 照比例的份數、指定金額，切換人或模式時保留著
    const splitVals = { ratio: {}, amount: {} };

    curSel.innerHTML = CURRENCIES.map(c => `<option value="${c.code}">${c.label} (${c.code})</option>`).join("");
    daySel.innerHTML = Array.from({ length: 28 }, (_, i) => i + 1)
      .map(d => `<option value="${d}">${t("currency.recurringMonthlyDayOption", { day: d })}</option>`).join("");
    monthSel.innerHTML = Array.from({ length: 12 }, (_, i) => i + 1)
      .map(m => `<option value="${m}">${t("recurring.monthOption", { month: m })}</option>`).join("");
    weeklyDayWrap.innerHTML = weekdayNames().map((name, i) => `<label><input type="radio" name="recurWeekday" value="${i}"${i === 1 ? " checked" : ""}><span>${escapeHtml(name.replace(/^(星期|週)/, ""))}</span></label>`).join("");

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
        // 水電瓦斯每期金額都不一樣
        if(key === "utilities" && !variableChk.checked){ variableChk.checked = true; syncVariable(); }
        amtInp.focus();
        refresh();
      });
      suggestWrap.appendChild(b);
    });

    const checkedIds = () => Array.from(participantsWrap.querySelectorAll("input:checked")).map(i => i.value);
    const formSchedule = () => ({
      interval_unit: unitSel.value,
      interval_day: Number(unitSel.value === "weekly" ? weekdaySel.value : daySel.value),
      interval_month: unitSel.value === "yearly" ? Number(monthSel.value) : null
    });
    const scheduleChanged = () => {
      if(!editingTmpl) return true;
      const s = formSchedule();
      return s.interval_unit !== editingTmpl.interval_unit || s.interval_day !== editingTmpl.interval_day
        || (s.interval_unit === "yearly" && s.interval_month !== editingTmpl.interval_month);
    };
    // 存檔後下一期是哪天：沒動排程就沿用原本的，動了就從今天重新算
    const nextDueToSave = () => {
      const s = formSchedule();
      return scheduleChanged() ? sbRecurFirstDate(s.interval_unit, s.interval_day, s.interval_month, todayIso()) : editingTmpl.next_due_date;
    };
    // 編輯時改了金額（固定金額的才算），要問從哪一期開始
    const priceChanged = () => editingTmpl && !variableChk.checked && Number(amtInp.value) > 0 && Number(amtInp.value) !== Number(editingTmpl.amount);

    // 依目前表單算每個人分多少；ok=false 時 note 說明哪裡不對
    function computeShares(amount){
      const ids = checkedIds();
      const cur = curSel.value;
      const mode = splitSel.value;
      if(!ids.length) return { ok: false, shares: [] };
      if(mode === "amount"){
        const shares = ids.map(id => ({ member_id: id, amount: Number(splitVals.amount[id]) || 0 }));
        const sum = shares.reduce((s, x) => s + x.amount, 0);
        const diff = Math.round((amount - sum) * 100) / 100;
        return { ok: amount > 0 && Math.abs(diff) < 0.005 && shares.every(s => s.amount >= 0), shares, diff };
      }
      const weights = ids.map(id => ({ member_id: id, weight: mode === "ratio" ? Number(splitVals.ratio[id] ?? 1) : 1 }));
      if(weights.some(w => !(w.weight > 0))) return { ok: false, shares: [], badRatio: true };
      return { ok: amount > 0, shares: amount > 0 ? sbSplitByWeights(amount, weights, cur) : [], weights };
    }

    function renderSplitRows(){
      const mode = splitSel.value;
      const ids = checkedIds();
      splitRowsEl.classList.toggle("hidden", mode === "equal" || !ids.length);
      if(mode === "equal" || !ids.length){ splitRowsEl.innerHTML = ""; return; }
      const cur = CURRENCIES.find(c => c.code === curSel.value);
      splitRowsEl.innerHTML = ids.map(id => {
        const v = mode === "ratio" ? (splitVals.ratio[id] ?? 1) : (splitVals.amount[id] ?? "");
        return `<div class="sbf-split-row" data-id="${id}">
          ${renderAvatarHTML(memberObj(id), "avatar-xs")}
          <span class="sbf-split-name">${escapeHtml(memberById[id] || "?")}</span>
          <span class="sbf-split-calc" data-calc="${id}"></span>
          <span class="sbf-split-input">
            ${mode === "amount" ? `<i>${escapeHtml(cur ? cur.symbol : "")}</i>` : ""}
            <input type="number" min="0" step="any" inputmode="decimal" value="${escapeHtml(String(v))}" aria-label="${escapeHtml(t(mode === "ratio" ? "recurring.partsOf" : "recurring.amountOf", { name: memberById[id] || "?" }))}">
            ${mode === "ratio" ? `<i>${escapeHtml(t("recurring.partsUnit"))}</i>` : ""}
          </span>
        </div>`;
      }).join("");
      splitRowsEl.querySelectorAll("input").forEach(inp => inp.addEventListener("input", () => {
        const id = inp.closest(".sbf-split-row").dataset.id;
        splitVals[mode][id] = inp.value === "" ? "" : Number(inp.value);
        updateCalc();
      }));
      updateCalc();
    }

    // 每列右邊的試算＋下面那行「還差多少」
    function updateCalc(){
      const mode = splitSel.value;
      const amount = Number(amtInp.value);
      const res = computeShares(amount);
      splitRowsEl.querySelectorAll("[data-calc]").forEach(el => {
        const s = mode === "ratio" && res.shares.find(x => x.member_id === el.dataset.calc);
        el.textContent = s ? money(curSel.value, s.amount) : "";
      });
      if(mode === "amount" && amount > 0 && checkedIds().length){
        splitNote.textContent = Math.abs(res.diff) < 0.005 ? t("recurring.splitDone")
          : res.diff > 0 ? t("recurring.splitLeft", { amount: money(curSel.value, res.diff) })
          : t("recurring.splitOver", { amount: money(curSel.value, -res.diff) });
        splitNote.classList.toggle("is-bad", Math.abs(res.diff) >= 0.005);
        splitNote.classList.remove("hidden");
      } else {
        splitNote.classList.add("hidden");
      }
      updatePreview();
    }

    function updatePreview(){
      const amount = Number(amtInp.value);
      const ids = checkedIds();
      if(!(amount > 0) || !ids.length){ previewEl.classList.add("hidden"); return; }
      const next = nextDueToSave();
      const parts = [];
      if(splitSel.value === "equal") parts.push(t("recurring.previewEach", { each: money(curSel.value, amount / ids.length), n: ids.length }));
      else parts.push(t("recurring.previewSplitN", { n: ids.length }));
      parts.push(t(variableChk.checked ? "recurring.previewAsk" : "recurring.previewAuto", { date: next, weekday: weekdayOf(next) }));
      if(endSel.value === "date" && endDateInp.value) parts.push(t("recurring.previewEndDate", { date: endDateInp.value }));
      if(endSel.value === "count" && Number(countInp.value) > 0) parts.push(t("recurring.previewCount", { n: Number(countInp.value) }));
      previewEl.textContent = parts.join("・");
      previewEl.classList.remove("hidden");
    }

    // 「新金額從哪一期開始」的選項：接下來六期
    function syncFrom(){
      const show = priceChanged();
      fromWrap.classList.toggle("hidden", !show);
      if(!show) return;
      const keep = fromSel.value;
      const s = formSchedule();
      const dates = [nextDueToSave()];
      while(dates.length < 6) dates.push(sbRecurNextDate(s, dates[dates.length - 1]));
      fromSel.innerHTML = dates.map((d, i) => `<option value="${d}">${escapeHtml(t(i === 0 ? "recurring.fromNext" : "recurring.fromOption", { date: d }))}</option>`).join("");
      if(dates.includes(keep)) fromSel.value = keep;
      enhanceSelect(fromSel);
    }

    function syncVariable(){
      const v = variableChk.checked;
      amtLabel.textContent = t(v ? "recurring.amountEstimate" : "settings.recurringFormAmountLabel");
      // 每期金額不同就沒辦法事先指定每個人幾塊，改成照同樣的比例
      const amountRadio = document.querySelector('input[name="recurSplit"][value="amount"]');
      amountRadio.disabled = v;
      amountRadio.closest("label").classList.toggle("is-disabled", v);
      if(v && splitSel.value === "amount"){
        checkedIds().forEach(id => { splitVals.ratio[id] = Number(splitVals.amount[id]) || 1; });
        splitSel.value = "ratio";
        renderSplitRows();
      }
    }

    function syncUnit(){
      const u = unitSel.value;
      monthlyWrap.classList.toggle("hidden", u === "weekly");
      weeklyWrap.classList.toggle("hidden", u !== "weekly");
      monthWrap.classList.toggle("hidden", u !== "yearly");
      dayLabel.textContent = t(u === "yearly" ? "recurring.dayLabel" : "recurring.monthDayLabel");
      // 每年模式下選項不能寫「每月 8 號」
      Array.from(daySel.options).forEach(o => { o.textContent = u === "yearly" ? t("recurring.dayOption", { day: o.value }) : t("currency.recurringMonthlyDayOption", { day: o.value }); });
      enhanceSelect(daySel);
    }
    function syncEnd(){
      endDateWrap.classList.toggle("hidden", endSel.value !== "date");
      countWrap.classList.toggle("hidden", endSel.value !== "count");
    }
    function refresh(){ syncFrom(); updateCalc(); }

    amtInp.addEventListener("input", refresh);
    curSel.addEventListener("change", () => { renderSplitRows(); refresh(); });
    variableChk.addEventListener("change", () => { syncVariable(); refresh(); });
    [daySel, monthSel].forEach(el => el.addEventListener("change", refresh));
    weekdaySel.onChange(refresh);
    unitSel.onChange(() => { syncUnit(); refresh(); });
    splitSel.onChange(() => { renderSplitRows(); refresh(); });
    endSel.onChange(() => { syncEnd(); updatePreview(); });
    [endDateInp, countInp].forEach(el => el.addEventListener("input", updatePreview));
    participantsWrap.addEventListener("change", () => { renderSplitRows(); refresh(); });

    catSel.addEventListener("change", () => { categoryTouched = true; });
    descInp.addEventListener("input", () => {
      if(categoryTouched || !descInp.value.trim()) return;
      catSel.value = getCategoryMeta(descInp.value, null, null).type || "general";
      enhanceSelect(catSel);
    });
    $("recurTmplAll").addEventListener("click", () => {
      const boxes = Array.from(participantsWrap.querySelectorAll("input"));
      const allOn = boxes.every(b => b.checked);
      boxes.forEach(b => { b.checked = !allOn; b.closest(".check-pill").classList.toggle("checked", b.checked); });
      renderSplitRows();
      refresh();
    });

    function populateMemberFields(){
      const activeMembers = (memberRows || []).filter(m => !m.left_at);
      const pill = (type, m, checked) => `<label class="check-pill${checked ? " checked" : ""}">
          <input type="${type}" ${type === "radio" ? 'name="recurPayer"' : ""} value="${m.id}"${checked ? " checked" : ""}>
          ${renderAvatarHTML(m, "avatar-xs")}
          <span class="check-pill-name">${escapeHtml(memberById[m.id] || m.name)}</span>
        </label>`;
      payerWrap.innerHTML = activeMembers.map(m => pill("radio", m, false)).join("");
      payerWrap.querySelectorAll("input").forEach(inp => inp.addEventListener("change", () => { payerSel.value = inp.value; }));
      participantsWrap.innerHTML = activeMembers.map(m => pill("checkbox", m, true)).join("");
      participantsWrap.querySelectorAll("input").forEach(inp => {
        inp.addEventListener("change", () => inp.closest(".check-pill").classList.toggle("checked", inp.checked));
      });
    }

    function resetForm(){
      editingId = null;
      editingTmpl = null;
      titleEl.textContent = t("settings.recurringFormTitleNew");
      submitBtn.textContent = t("settings.recurringFormSubmitNew");
      msgEl.textContent = ""; msgEl.className = "msg";
      descInp.value = "";
      catSel.value = "general"; enhanceSelect(catSel);
      curSel.value = (shownCurrencies && shownCurrencies[0]) || "TWD"; enhanceSelect(curSel);
      amtInp.value = "";
      variableChk.checked = false;
      populateMemberFields();
      if(myMember) payerSel.value = myMember.id;
      splitVals.ratio = {}; splitVals.amount = {};
      splitSel.value = "equal";
      categoryTouched = false;
      unitSel.value = "monthly";
      const today = new Date();
      daySel.value = String(Math.min(today.getDate(), 28)); enhanceSelect(daySel);
      monthSel.value = String(today.getMonth() + 1); enhanceSelect(monthSel);
      weekdaySel.value = "1";
      endSel.value = "never";
      endDateInp.value = ""; endDateInp.min = todayIso();
      countInp.value = ""; countInp.min = "1";
      countDone.classList.add("hidden");
      syncVariable(); syncUnit(); syncEnd(); renderSplitRows();
    }

    function openModal(){
      resetForm();
      refresh();
      showModal(modal);
    }
    addBtn.addEventListener("click", openModal);
    $("recurringTemplateFormCloseBtn").addEventListener("click", () => hideModal(modal));

    // 從列表的鉛筆、或幣別頁「這筆以後都改」（?editRecurring=id）進來都走這裡
    window.openRecurringTemplateForm = function(templateId){
      const tmpl = templatesCache.find(x => x.id === templateId);
      if(!tmpl){ sbAlert(t("settings.recurringTemplateGone"), t("settings.errorTitle")); return; }
      if(!isParty(tmpl, myMember && myMember.id)){ sbAlert(t("settings.recurringNoPermission"), t("settings.errorTitle")); return; }
      resetForm();
      editingId = templateId;
      editingTmpl = tmpl;
      titleEl.textContent = t("settings.recurringFormTitleEdit");
      submitBtn.textContent = t("settings.recurringFormSubmitEdit");
      descInp.value = tmpl.description || "";
      catSel.value = tmpl.category || "general"; enhanceSelect(catSel);
      curSel.value = tmpl.currency || "TWD"; enhanceSelect(curSel);
      variableChk.checked = !!tmpl.variable_amount;
      // 排了漲價的話，金額欄直接顯示新金額、選好生效的那期
      amtInp.value = tmpl.next_amount || tmpl.amount;
      const payerId = tmpl.payers && tmpl.payers[0] && tmpl.payers[0].member_id;
      if(payerId) payerSel.value = payerId;
      categoryTouched = true;
      const shareIds = new Set((tmpl.shares || []).map(s => s.member_id));
      participantsWrap.querySelectorAll("input").forEach(inp => {
        inp.checked = shareIds.has(inp.value);
        inp.closest(".check-pill").classList.toggle("checked", inp.checked);
      });
      (tmpl.shares || []).forEach(s => { splitVals.amount[s.member_id] = Number(s.amount); });
      (tmpl.split_weights || []).forEach(w => { splitVals.ratio[w.member_id] = Number(w.weight); });
      splitSel.value = tmpl.split_mode || "equal";
      unitSel.value = tmpl.interval_unit || "monthly";
      if(tmpl.interval_unit === "weekly") weekdaySel.value = tmpl.interval_day;
      else { daySel.value = String(tmpl.interval_day); enhanceSelect(daySel); }
      if(tmpl.interval_month){ monthSel.value = String(tmpl.interval_month); enhanceSelect(monthSel); }
      endSel.value = tmpl.total_count ? "count" : tmpl.end_date ? "date" : "never";
      endDateInp.value = tmpl.end_date || "";
      countInp.value = tmpl.total_count || "";
      const done = tmpl.generated_count || 0;
      countInp.min = String(done + 1);
      countDone.textContent = t("recurring.countDone", { n: done });
      countDone.classList.toggle("hidden", !done);
      syncVariable(); syncUnit(); syncEnd(); renderSplitRows();
      syncFrom();
      if(tmpl.next_amount_from && Array.from(fromSel.options).some(o => o.value === tmpl.next_amount_from)){
        fromSel.value = tmpl.next_amount_from; enhanceSelect(fromSel);
      }
      updateCalc();
      showModal(modal);
    };

    const fail = key => { msgEl.textContent = t(key); msgEl.className = "msg error"; };

    submitBtn.addEventListener("click", async () => {
      const desc = (descInp.value || "").trim();
      const amount = Number(amtInp.value);
      const ids = checkedIds();
      if(!desc) return fail("settings.recurringFormNeedDesc");
      if(!(amount > 0)) return fail("settings.recurringFormNeedAmount");
      if(!ids.length) return fail("settings.recurringFormNeedParticipants");
      const res = computeShares(amount);
      if(res.badRatio) return fail("recurring.needRatio");
      if(!res.ok) return fail(splitSel.value === "amount" ? "recurring.needSplitSum" : "settings.msg.saveFailedRetry");
      const end = endSel.value;
      if(end === "date" && !endDateInp.value) return fail("recurring.needEndDate");
      if(end === "date" && endDateInp.value < todayIso()) return fail("recurring.needEndFuture");
      const done = editingTmpl ? (editingTmpl.generated_count || 0) : 0;
      if(end === "count" && !(Number(countInp.value) >= 1)) return fail("recurring.needCount");
      if(end === "count" && Number(countInp.value) <= done) { msgEl.textContent = t("recurring.needCountMore", { n: done }); msgEl.className = "msg error"; return; }

      submitBtn.disabled = true;
      try {
        const s = formSchedule();
        const payerId = payerSel.value;
        let shares = res.shares;
        let saveAmount = amount;
        const payload = {
          group_id: myMember.group_id,
          description: desc,
          category: catSel.value || "general",
          currency: curSel.value,
          interval_unit: s.interval_unit,
          interval_day: s.interval_day,
          interval_month: s.interval_month,
          variable_amount: variableChk.checked,
          split_mode: splitSel.value,
          split_weights: splitSel.value === "ratio" ? res.weights : null,
          end_date: end === "date" ? endDateInp.value : null,
          total_count: end === "count" ? Number(countInp.value) : null,
          next_amount: null,
          next_amount_from: null
        };
        // 編輯時改了金額、而且選的不是下一期：現在的金額先不動，到那期才換
        if(priceChanged() && fromSel.value && fromSel.value !== nextDueToSave()){
          saveAmount = Number(editingTmpl.amount);
          shares = sbSplitByWeights(saveAmount, res.shares.map(x => ({ member_id: x.member_id, weight: x.amount })), curSel.value);
          payload.next_amount = amount;
          payload.next_amount_from = fromSel.value;
        }
        payload.amount = saveAmount;
        payload.shares = shares;
        payload.payers = [{ member_id: payerId, amount: saveAmount }];

        if(editingId){
          if(scheduleChanged()){
            payload.next_due_date = nextDueToSave();
            payload.schedule_rev = (editingTmpl.schedule_rev || 0) + 1;
          }
          const { error } = await sb.from("recurring_expenses").update(payload).eq("id", editingId);
          if(error) throw error;
          msgEl.textContent = t("settings.recurringUpdateSuccess");
        } else {
          payload.next_due_date = nextDueToSave();
          payload.created_by = myMember.id;
          const { error } = await sb.from("recurring_expenses").insert(payload);
          if(error) throw error;
          msgEl.textContent = t("settings.recurringCreateSuccess");
        }
        msgEl.className = "msg ok";
        renderRecurringTemplates();
        setTimeout(() => hideModal(modal), 900);
      } catch(err){
        console.error("儲存固定支出失敗：", err);
        fail(/latest app version/.test(err && err.message || "") ? "recurring.needReload" : "settings.msg.saveFailedRetry");
      } finally {
        submitBtn.disabled = false;
      }
    });
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
    const qs = new URLSearchParams(location.search);
    if(qs.get("editRecurring")) window.openRecurringTemplateForm(qs.get("editRecurring"));
    else if(qs.get("fill")) openFill(qs.get("fill"));
    else if(qs.get("show")) openDetail(qs.get("show"));
  })();
})();

// ============================================================
// 還沒註冊的成員＋認領（2026-11，v996）
// ============================================================
// 群組裡的人可以先建一個「還沒註冊的人」（members.user_id 是 null）一起記帳。
// 那個人之後註冊、用邀請碼加入，第一件事就是選「我是誰」：
//   request_member_claim → 等建群人 decide_member_claim 同意 → 帳全部合併到他身上
//   （建群人自己認領、或群組沒有建群人時直接生效）
//   生效後 72 小時內，本人或建群人可以 cancel_member_claim 還原。
//   沒有欠款的未認領成員，群組裡誰都可以 remove_placeholder_member。
// 用到頁面上的 window.sb / window.myMember / window.currentUser。
// sbClaim.prompt()：加入群組後首頁跳出「你是誰？」（index/settings 加入成功時寫 sb-claim-ask）
// sbClaim.renderSettings()：設定頁「群組」分頁的 #claimSection
// ============================================================
(function(){
  const ASK_KEY = "sb-claim-ask";
  const UNDO_MS = 72 * 3600 * 1000;
  const esc = s => (typeof escapeHtml === "function" ? escapeHtml(s) : String(s == null ? "" : s));
  const label = m => String((m && (m.nickname || m.name)) || "?").replace(/\(退出\)$/, "");

  async function load(){
    const sb = window.sb, me = window.myMember;
    if(!sb || !me) return null;
    const [memRes, claimRes, balRes, grpRes] = await Promise.all([
      sb.from("members").select("id,name,nickname,user_id,left_at,avatar_url").eq("group_id", me.group_id),
      sb.from("member_claims").select("id,placeholder_id,claimant_id,status,created_at,decided_at").eq("group_id", me.group_id)
        .in("status", ["pending", "approved"]).order("created_at", { ascending: false }),
      sb.rpc("member_balances"),
      sb.from("groups").select("created_by").eq("id", me.group_id).maybeSingle()
    ]);
    if(memRes.error) return null;
    const members = memRes.data || [];
    const byId = {};
    members.forEach(m => byId[m.id] = m);
    const bal = {};
    (balRes.data || []).forEach(r => {
      if(!byId[r.member_id] || Math.abs(Number(r.balance)) < 0.01) return;
      (bal[r.member_id] = bal[r.member_id] || []).push({ currency: r.currency, amount: Number(r.balance) });
    });
    const now = Date.now();
    const claims = (claimRes.data || []).filter(c => c.status === "pending" || (c.decided_at && now - new Date(c.decided_at).getTime() < UNDO_MS));
    const creatorId = grpRes.data && grpRes.data.created_by;
    const isCreator = !!(creatorId && window.currentUser && creatorId === window.currentUser.id);
    const placeholders = members.filter(m => !m.user_id && !m.left_at).sort((a, b) => label(a).localeCompare(label(b)));
    return { me, byId, bal, claims, isCreator, hasCreator: !!creatorId, placeholders };
  }

  function money(cur, amt){
    if(typeof splitbillNotifMoney === "function") return splitbillNotifMoney(Math.abs(amt), cur);
    return cur + " " + Math.abs(amt);
  }
  // 「欠 NT$1,200」「別人欠他 NT$300」「沒有欠款」
  function balText(list){
    if(!list || !list.length) return t("claim.balNone");
    const owe = list.filter(x => x.amount < 0).map(x => money(x.currency, x.amount));
    const owed = list.filter(x => x.amount > 0).map(x => money(x.currency, x.amount));
    return [owe.length ? t("claim.balOwe", { amount: owe.join("・") }) : "", owed.length ? t("claim.balOwed", { amount: owed.join("・") }) : ""].filter(Boolean).join({ en: " · ", ja: "・" }[typeof getLang === "function" ? getLang() : ""] || "，");
  }
  function errText(e){
    const m = String((e && e.message) || e || "");
    if(m.includes("duplicate name")) return t("claim.err.dupName");
    if(m.includes("unsettled balance")) return t("claim.err.unsettled");
    if(m.includes("already requested")) return t("claim.err.taken");
    if(m.includes("pending claim")) return t("claim.err.mine");
    if(m.includes("undo window")) return t("claim.err.window");
    if(m.includes("repayments between")) return t("claim.err.between");
    if(m.includes("not available")) return t("claim.err.gone");
    if(m.includes("claim not pending") || m.includes("claimant not active") || m.includes("claim not active") || m.includes("claim not found")) return t("claim.err.stale");
    if(m.includes("name required")) return t("claim.err.nameRequired");
    if(m.includes("name too long")) return t("claim.err.nameLong");
    return m;
  }
  function toast(a, b){ if(typeof showToast === "function") showToast(a, b || ""); }
  function pai(text, mood){ if(window.sbPai && window.sbPai.say) window.sbPai.say(text, { mood: mood || "joy" }); else toast(text); }

  // 送出「這是我」；回傳 true 代表已經生效（頁面要重新整理）
  async function claim(ph, ctx){
    const name = label(ph);
    const ok = await sbConfirm(t(ctx.isCreator || !ctx.hasCreator ? "claim.confirmDirect" : "claim.confirm", { name }), t("claim.confirmTitle"));
    if(!ok) return null;
    const { data, error } = await window.sb.rpc("request_member_claim", { p_placeholder: ph.id });
    if(error){ await sbAlert(errText(error), t("settings.errorTitle")); return null; }
    if(data === "approved"){ toast(t("claim.doneToast", { name })); return true; }
    pai(t("claim.sentPai", { name }), "smile");
    return false;
  }

  // ---------- 加入群組後：「你是誰？」 ----------
  async function prompt(force){
    const me = window.myMember;
    if(!me) return;
    let ask = null;
    try { ask = localStorage.getItem(ASK_KEY); } catch(e){}
    if(!force){
      if(!ask || ask !== me.group_id) return;
      try { localStorage.removeItem(ASK_KEY); } catch(e){}
    }
    const ctx = await load();
    if(!ctx || !ctx.placeholders.length) return;
    if(ctx.claims.some(c => c.claimant_id === me.id)) return;
    const taken = new Set(ctx.claims.filter(c => c.status === "pending").map(c => c.placeholder_id));
    const list = ctx.placeholders.filter(p => !taken.has(p.id));
    if(!list.length) return;

    const el = document.createElement("div");
    el.className = "calc-modal sb-claim-modal show";
    el.innerHTML = `
      <div class="calc-card card sb-claim-card" role="dialog" aria-modal="true" aria-labelledby="sbClaimTitle">
        <div class="sb-claim-head">
          <span class="sb-claim-pie" aria-hidden="true">${typeof sbPieMascotSVG === "function" ? sbPieMascotSVG(0, "joy", true) : ""}</span>
          <div>
            <h2 class="sb-claim-title" id="sbClaimTitle">${esc(t("claim.askTitle"))}</h2>
            <p class="sb-claim-sub">${esc(t(ctx.isCreator || !ctx.hasCreator ? "claim.askSubDirect" : "claim.askSub"))}</p>
          </div>
        </div>
        <div class="sb-claim-list">
          ${list.map(p => `<button type="button" class="sb-claim-pick" data-id="${p.id}">
              ${typeof renderAvatarHTML === "function" ? renderAvatarHTML({ id: p.id, name: label(p) }, "avatar-sm") : ""}
              <span class="sb-claim-pick-main"><b>${esc(label(p))}</b><small>${esc(balText(ctx.bal[p.id]))}</small></span>
            </button>`).join("")}
        </div>
        <button type="button" class="btn secondary sb-claim-none">${esc(t("claim.askNone"))}</button>
        <p class="sb-claim-foot">${esc(t("claim.askLater"))}</p>
      </div>`;
    document.body.appendChild(el);
    const close = () => { el.classList.remove("show"); setTimeout(() => el.remove(), 200); };
    el.querySelector(".sb-claim-none").addEventListener("click", close);
    el.addEventListener("click", async e => {
      if(e.target === el){ close(); return; }
      const b = e.target.closest(".sb-claim-pick");
      if(!b) return;
      const ph = list.find(p => p.id === b.dataset.id);
      const done = await claim(ph, ctx);
      if(done === null) return;
      close();
      if(done) setTimeout(() => location.reload(), 900);
    });
    const first = el.querySelector(".sb-claim-pick");
    if(first) first.focus({ preventScroll: true });
  }

  // ---------- 設定頁「還沒註冊的成員」 ----------
  async function renderSettings(){
    const box = document.getElementById("claimSection");
    if(!box) return;
    const ctx = await load();
    if(!ctx){ box.innerHTML = ""; return; }
    const { me, byId, bal, claims, isCreator, placeholders } = ctx;
    const mine = claims.find(c => c.claimant_id === me.id);
    const pendingFor = {};
    claims.filter(c => c.status === "pending").forEach(c => pendingFor[c.placeholder_id] = c);
    const loc = { en: "en-US", ja: "ja-JP" }[typeof getLang === "function" ? getLang() : ""] || "zh-TW";
    const fmtUntil = c => new Date(new Date(c.decided_at).getTime() + UNDO_MS).toLocaleString(loc, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

    let html = "";
    // 1. 跟我有關的認領（我送出的、建群人要決定的、還能取消的）
    claims.forEach(c => {
      const ph = byId[c.placeholder_id], cl = byId[c.claimant_id];
      if(!ph || !cl) return;
      const isMine = c.claimant_id === me.id;
      if(c.status === "pending" && isMine){
        html += `<div class="sb-claim-note is-wait"><p>${esc(t("claim.myPending", { name: label(ph) }))}</p>
          <div class="sb-claim-acts"><button type="button" class="sbs-btn" data-act="cancel" data-id="${c.id}">${esc(t("claim.withdraw"))}</button></div></div>`;
      } else if(c.status === "pending" && isCreator){
        html += `<div class="sb-claim-note is-ask"><p>${esc(t("claim.askCreator", { who: label(cl), name: label(ph) }))}</p>
          <small>${esc(balText(bal[ph.id]))}</small>
          <div class="sb-claim-acts"><button type="button" class="sbs-btn sbs-save" data-act="approve" data-id="${c.id}">${esc(t("claim.approve"))}</button>
          <button type="button" class="sbs-btn" data-act="reject" data-id="${c.id}">${esc(t("claim.reject"))}</button></div></div>`;
      } else if(c.status === "approved" && (isMine || isCreator)){
        html += `<div class="sb-claim-note is-done"><p>${esc(t(isMine ? "claim.myDone" : "claim.otherDone", { who: label(cl), name: label(ph) }))}</p>
          <small>${esc(t("claim.undoUntil", { time: fmtUntil(c) }))}</small>
          <div class="sb-claim-acts"><button type="button" class="sbs-btn" data-act="undo" data-id="${c.id}">${esc(t("claim.undo"))}</button></div></div>`;
      }
    });

    // 2. 還沒認領的人
    if(placeholders.length){
      html += `<ul class="sb-claim-rows">` + placeholders.map(p => {
        const pend = pendingFor[p.id];
        const settled = !bal[p.id];
        return `<li class="sb-claim-row">
          ${typeof renderAvatarHTML === "function" ? renderAvatarHTML({ id: p.id, name: label(p) }, "avatar-xs") : ""}
          <span class="sb-claim-row-main"><span class="sb-claim-row-name"><b>${esc(label(p))}</b> <span class="sb-claim-tag">${esc(t(pend ? "claim.tagPending" : "claim.tag"))}</span></span>
            <small>${esc(pend && pend.claimant_id !== me.id ? t("claim.pendingBy", { who: label(byId[pend.claimant_id]) }) : balText(bal[p.id]))}</small></span>
          <span class="sb-claim-row-acts">
            ${!pend && !mine ? `<button type="button" class="sbs-btn" data-act="claim" data-id="${p.id}">${esc(t("claim.thisIsMe"))}</button>` : ""}
            ${!pend && settled ? `<button type="button" class="sbs-btn sb-claim-del" data-act="remove" data-id="${p.id}" aria-label="${esc(t("claim.removeAria", { name: label(p) }))}">${esc(t("settings.delete"))}</button>` : ""}
          </span>
        </li>`;
      }).join("") + `</ul>`;
    }

    // 3. 新增
    html += `<p class="sbs-hint sb-claim-hint">${esc(t("claim.addHint"))}</p>
      <div class="sbs-field sb-claim-add">
        <input type="text" id="claimAddName" maxlength="30" placeholder="${esc(t("claim.addPlaceholder"))}" aria-label="${esc(t("claim.addPlaceholder"))}">
        <button type="button" class="sbs-btn sbs-save" data-act="add">${esc(t("claim.add"))}</button>
      </div>
      <div class="msg" id="claimMsg"></div>`;
    box.innerHTML = html;

    const msg = box.querySelector("#claimMsg");
    const setMsg = (text, ok) => { msg.textContent = text; msg.className = "msg " + (ok ? "ok" : "error"); };
    const inp = box.querySelector("#claimAddName");
    inp.addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); box.querySelector('[data-act="add"]').click(); } });

    box.onclick = async e => {
      const b = e.target.closest("button[data-act]");
      if(!b || b.disabled) return;
      const act = b.dataset.act, id = b.dataset.id;
      const sb = window.sb;
      const c = claims.find(x => x.id === id);
      const ph = byId[id] || (c && byId[c.placeholder_id]);
      b.disabled = true;
      try {
        if(act === "add"){
          const name = inp.value.trim();
          if(!name){ setMsg(t("claim.err.nameRequired")); return; }
          const { error } = await sb.rpc("create_placeholder_member", { p_name: name });
          if(error){ setMsg(errText(error)); return; }
          toast(t("claim.addedToast", { name }));
          return void setTimeout(() => location.reload(), 700); // 記帳的成員清單要重抓
        }
        if(act === "claim"){
          const done = await claim(ph, ctx);
          if(done) return void setTimeout(() => location.reload(), 900);
          if(done === false) await renderSettings();
          return;
        }
        if(act === "remove"){
          if(!(await sbConfirm(t("claim.removeConfirm", { name: label(ph) })))) return;
          const { error } = await sb.rpc("remove_placeholder_member", { p_member: id });
          if(error){ setMsg(errText(error)); return; }
          toast(t("claim.removedToast", { name: label(ph) }));
          return void setTimeout(() => location.reload(), 700);
        }
        if(act === "approve" || act === "reject"){
          const who = label(byId[c.claimant_id]), name = label(byId[c.placeholder_id]);
          if(!(await sbConfirm(t(act === "approve" ? "claim.approveConfirm" : "claim.rejectConfirm", { who, name })))) return;
          const { error } = await sb.rpc("decide_member_claim", { p_claim: id, p_approve: act === "approve" });
          if(error){ setMsg(errText(error)); return; }
          toast(t(act === "approve" ? "claim.approvedToast" : "claim.rejectedToast", { who, name }));
          if(act === "approve") return void setTimeout(() => location.reload(), 900);
          await renderSettings();
          return;
        }
        if(act === "cancel" || act === "undo"){
          const name = label(byId[c.placeholder_id]);
          if(!(await sbConfirm(t(act === "undo" ? "claim.undoConfirm" : "claim.withdrawConfirm", { name })))) return;
          const { data, error } = await sb.rpc("cancel_member_claim", { p_claim: id });
          if(error){ setMsg(errText(error)); return; }
          toast(t(act === "undo" ? "claim.undoneToast" : "claim.withdrawnToast", { name }), data > 0 ? t("claim.undoSkipped", { n: data }) : "");
          if(act === "undo") return void setTimeout(() => location.reload(), 900);
          await renderSettings();
        }
      } finally {
        if(b.isConnected) b.disabled = false;
      }
    };

    // 從通知點進來（settings.html#claim）：切到群組分頁、捲到這裡
    if(location.hash === "#claim" && !renderSettings.jumped){
      renderSettings.jumped = true;
      const tab = document.querySelector('[data-settings-tab="group"]');
      if(tab) tab.click();
      setTimeout(() => box.scrollIntoView({ block: "center", behavior: "smooth" }), 600);
    }
  }

  window.sbClaim = { prompt, renderSettings, ASK_KEY };
})();

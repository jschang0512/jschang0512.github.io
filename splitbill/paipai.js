// ============================================================
// 派派常駐（2026-11）：標題旁永遠有派派，沒事時打瞌睡、眨眼；
// 有話要說時從她旁邊冒出一個小泡泡（幾秒後自己收起來）。
//
// · sbPai.say(text, opts)     冒泡泡。opts：{ mood, level, action:{label, fn}, auto }
//                             auto＝不是使用者自己點的，這種一天最多 3 次，打字中、有提示訊息時不冒
// · sbPai.moments(ctx)        首頁載入完呼叫：挑今天最值得講的一件事（有人還你錢、活動、固定支出、
//                             月初、節日、很久沒記帳、打招呼），一次開頁最多講一件
// · sbPai.recordLine(info)    記帳成功畫面的那一句（大筆支出嚇一跳、這個月第幾筆）
// · sbPai.tap(btn, onClick)   標題旁的派派被點：第 1 下照原本的事做，連點會不耐煩，點 7 下會裂開
// · 往下拖派派會彈回去；網路斷了會哭、回來會開心；首頁載入超過 2 秒會出來轉圈
//
// 派派提醒設成「關閉」時這裡全部不做；「溫和」時不會不耐煩、不會裂開。
// 用到的東西都在 shared-ui.js（sbNagMode、sbNagSetLogo、sbPieMascotSVG、sbNagMoney…），要在它後面載入。
// ============================================================
(function(){
  const store = {
    get(k, d){ try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch(e){ return d; } },
    set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
  };
  const today = () => sbIsoDay(new Date());
  const dayNum = iso => Math.round(Date.parse(iso + "T00:00:00Z") / 86400000);
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return sbIsoDay(d); };
  const mode = () => (typeof sbNagMode === "function" ? sbNagMode() : "normal");
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const has = k => t(k) !== k;
  // 同一組台詞（key1、key2…）每天換一句
  function pick(prefix, vars){
    const keys = [];
    for(let i = 1; i <= 9; i++) if(has(prefix + i)) keys.push(prefix + i);
    if(!keys.length) return has(prefix) ? t(prefix, vars) : "";
    return t(keys[(Math.round(Date.now() / 86400000) + prefix.length) % keys.length], vars);
  }

  // ---------- 沒事時的派派：半夜睡覺，其他時間微笑（CSS 讓她偶爾眨眼） ----------
  function idleMood(){
    const h = new Date().getHours();
    if(!navigator.onLine) return "cry";
    return h >= 1 && h < 6 ? "sleep" : "smile";
  }
  function idleLogo(){
    if(mode() === "off" || typeof sbNagSetLogo !== "function") return;
    sbNagSetLogo(0, idleMood(), () => poke(), true);
  }

  // ---------- 泡泡 ----------
  let bubbleEl = null, bubbleTimer = null;
  function headerPie(){ return document.querySelector(".app-header .title-row .sb-title-pie"); }
  function blocked(){
    const a = document.activeElement;
    if(a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return true;
    const toasts = document.getElementById("sbToastContainer");
    if(toasts && toasts.children.length) return true;
    if(document.querySelector(".sb-record-overlay, .modal-overlay:not(.hidden), .calc-modal.show, dialog[open]")) return true;
    return false;
  }
  function autoLeft(){
    const c = store.get("sb-pai-auto", null);
    return !c || c.day !== today() ? 3 : 3 - c.n;
  }
  function countAuto(){
    const c = store.get("sb-pai-auto", null);
    store.set("sb-pai-auto", { day: today(), n: (c && c.day === today() ? c.n : 0) + 1 });
  }
  function hide(){
    clearTimeout(bubbleTimer);
    if(!bubbleEl) return;
    const el = bubbleEl; bubbleEl = null;
    el.classList.add("is-out");
    setTimeout(() => el.remove(), 200);
  }
  // 自動冒的泡泡：被擋住（打字中、有提示）就等一下再試，最多試 3 次
  function say(text, opts = {}, tries = 0){
    if(opts.auto && opts.onShown && tries === 0){ const cb = opts.onShown; opts = Object.assign({}, opts, { onShown: null, _cb: cb }); }
    if(!text || mode() === "off") return false;
    const btn = headerPie();
    if(!btn){ idleLogo(); if(!headerPie()) return false; return say(text, opts, tries); }
    if(opts.auto){
      if(autoLeft() <= 0) return false;
      const r = btn.getBoundingClientRect();
      if(blocked() || document.hidden || r.bottom < 0 || r.top > innerHeight){
        // 被擋住就每 3 秒再試，最多等 30 秒（例如更新公告還開著）
        if(tries < 10) setTimeout(() => say(text, opts, tries + 1), 3000);
        return false;
      }
      countAuto();
      if(opts._cb) opts._cb();
    }
    hide();
    if(opts.mood) setMood(opts.mood, opts.level, opts.hold);
    const el = document.createElement("div");
    el.className = "sb-pai-bubble";
    el.setAttribute("role", "status");
    const p = document.createElement("p");
    p.textContent = text;
    el.appendChild(p);
    if(opts.action){
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sb-pai-bubble-act";
      b.textContent = opts.action.label;
      b.addEventListener("click", ev => { ev.stopPropagation(); hide(); opts.action.fn(); });
      el.appendChild(b);
    }
    el.addEventListener("click", hide);
    document.body.appendChild(el);
    place(el, btn);
    bubbleEl = el;
    bubbleTimer = setTimeout(hide, opts.action ? 8000 : Math.min(7000, 3200 + text.length * 70));
    return true;
  }
  // 泡泡放在派派正下方，箭頭對著她；靠邊時往內縮，不超出螢幕
  function place(el, btn){
    const r = btn.getBoundingClientRect();
    const w = el.offsetWidth, gutter = 12;
    const cx = r.left + r.width / 2;
    const left = Math.max(gutter, Math.min(innerWidth - w - gutter, cx - w / 2));
    el.style.left = (left + scrollX) + "px";
    el.style.top = (r.bottom + scrollY + 8) + "px";
    el.style.setProperty("--arrow", Math.round(cx - left) + "px");
  }
  addEventListener("resize", hide);
  // 點到別的地方（例如打開通知、選單）就把泡泡收起來，不要蓋在彈窗上面
  document.addEventListener("pointerdown", e => { if(bubbleEl && !bubbleEl.contains(e.target) && !e.target.closest(".sb-title-pie")) hide(); }, true);

  // 暫時換表情（泡泡收起來後換回原本的）
  let moodTimer = null;
  function setMood(mood, level, hold){
    const btn = headerPie();
    if(!btn) return;
    if(btn.dataset.baseMood == null){
      btn.dataset.baseMood = btn.dataset.mood || "smile";
      btn.dataset.baseLevel = btn.dataset.level || "0";
    }
    btn.innerHTML = sbPieMascotSVG(level || 0, mood);
    clearTimeout(moodTimer);
    moodTimer = setTimeout(() => restoreMood(btn), hold || 4500);
  }
  function restoreMood(btn){
    if(!btn || btn.dataset.baseMood == null) return;
    btn.innerHTML = sbPieMascotSVG(Number(btn.dataset.baseLevel) || 0, btn.dataset.baseMood, true);
    delete btn.dataset.baseMood; delete btn.dataset.baseLevel;
  }

  // ---------- 點她 ----------
  function hourKey(){
    const h = new Date().getHours();
    return h >= 5 && h < 11 ? "morning" : h >= 11 && h < 14 ? "noon" : h >= 14 && h < 18 ? "afternoon" : h >= 18 && h < 23 ? "evening" : "late";
  }
  // 沒事時點她：講一句跟現在有關的話（不算在一天 3 次裡）
  function poke(){
    const s = window.__sbPaiStats || {};
    const pool = [pick("pai.hi." + hourKey())];
    if(s.monthCount) pool.push(t("pai.poke.month", { n: s.monthCount }));
    if(s.streak >= 3) pool.push(t("nag.streakTitle", { n: s.streak }));
    if(!navigator.onLine) pool.push(t("pai.offline"));
    for(let i = 1; i <= 6; i++) if(has("pai.poke" + i)) pool.push(t("pai.poke" + i));
    const n = store.get("sb-pai-poke", 0);
    store.set("sb-pai-poke", n + 1);
    say(pool[n % pool.length], { mood: n % 3 === 2 ? "sweet" : undefined });
  }
  let taps = 0, tapTimer = null, cracked = false;
  function tap(btn, onClick){
    if(btn.dataset.dragged){ delete btn.dataset.dragged; return; }
    if(cracked) return;
    taps++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { taps = 0; }, 900);
    if(taps === 1){ if(onClick) onClick(); return; }
    const gentle = mode() === "gentle";
    if(taps === 3) say(pick(gentle ? "pai.tapSoft" : "pai.tap"), { mood: gentle ? "sweet" : "sideeye" });
    else if(taps === 5 && !gentle) say(pick("pai.tapMore"), { mood: "angry", level: 2 });
    else if(taps === 7 && !gentle){
      cracked = true;
      buzz([30, 50, 30]);
      hide();
      btn.classList.add("is-cracked");
      say(pick("pai.cracked"), { mood: "dead", level: 4, hold: 2600 });
      setTimeout(() => {
        btn.classList.remove("is-cracked");
        restoreMood(btn);
        cracked = false; taps = 0;
        say(pick("pai.fixed"), { mood: "smirk" });
      }, 2600);
    }
  }

  // ---------- 往下拖：拉到一個程度放手會彈回去 ----------
  function enableDrag(btn){
    if(btn.dataset.drag) return;
    btn.dataset.drag = "1";
    let y0 = null, id = null, dy = 0;
    btn.addEventListener("pointerdown", e => { if(e.button) return; y0 = e.clientY; id = e.pointerId; dy = 0; btn.classList.remove("is-spring"); });
    btn.addEventListener("pointermove", e => {
      if(e.pointerId !== id || y0 == null) return;
      dy = Math.max(0, e.clientY - y0);
      if(dy > 6){
        btn.setPointerCapture(id);
        btn.style.transform = "translateY(" + Math.round(Math.min(56, dy * .55)) + "px) rotate(" + Math.round(Math.min(12, dy * .15)) + "deg)";
      }
    });
    const end = e => {
      if(e.pointerId !== id) return;
      id = null; y0 = null;
      if(dy > 6){
        btn.dataset.dragged = "1";
        setTimeout(() => delete btn.dataset.dragged, 400);
        btn.classList.add("is-spring");
        btn.style.transform = "";
        buzz(12);
        if(dy > 40 && mode() !== "off") say(pick("pai.drag"), { mood: "shock" });
      }
      dy = 0;
    };
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointercancel", end);
  }

  // ---------- 首頁的大小事：一次開頁只講一件 ----------
  // ctx：{ myId, expenses, repayments, events, recurring, notifications, memberName(id) }
  function moments(ctx){
    if(mode() === "off" || !ctx) return;
    const T = today(), tomorrow = addDays(1);
    const once = (key, every) => { const d = store.get("sb-pai-m-" + key, null); return !d || (every ? dayNum(T) - dayNum(d) >= every : false); };
    const mark = key => store.set("sb-pai-m-" + key, T);
    const nagShown = () => { const c = document.getElementById("nagCard"); return c && !c.hidden && c.querySelector(".sb-nag"); };
    const list = [];

    // 1. 有人還你錢（通知裡還沒看過的那幾筆）
    (ctx.notifications || []).forEach(n => {
      const p = n.params || {};
      if(n.type === "repayments_insert" && p.role === "to" && once("repaid-" + n.id))
        list.push({ key: "repaid-" + n.id, mood: "joy", text: t("pai.repaid", { name: p.from || p.actor || "?", amount: sbNagMoney(p.amount, p.currency) }), strong: true, buzz: true });
    });
    // 2. 自己開的活動已經過了日期還沒結算 → 問要不要結算（三天問一次）
    (ctx.events || []).forEach(ev => {
      if(ev.created_by === ctx.myId && ev.event_date && ev.event_date < T && once("evdone-" + ev.id, 3))
        list.push({ key: "evdone-" + ev.id, mood: "smirk", text: t("pai.eventDone", { title: ev.title }), strong: true,
          action: { label: t("pai.eventDoneGo"), fn: () => { location.href = "events.html#" + encodeURIComponent(ev.id); } } });
    });
    // 3. 明天有活動
    (ctx.events || []).forEach(ev => {
      if(ev.event_date === tomorrow && once("evtmr-" + ev.id))
        list.push({ key: "evtmr-" + ev.id, mood: "sweet", text: t("pai.eventTomorrow", { title: ev.title }) });
    });
    // 4. 明天要繳的固定支出
    (ctx.recurring || []).forEach(r => {
      if(r.active !== false && r.next_due_date === tomorrow && once("rec-" + r.id + "-" + r.next_due_date))
        list.push({ key: "rec-" + r.id + "-" + r.next_due_date, mood: "stare", text: t("pai.recurringTomorrow", { title: r.description, amount: sbNagMoney(r.amount, r.currency) }) });
    });
    // 5. 月初（1～3 號）：上個月我分到多少
    const now = new Date();
    if(now.getDate() <= 3){
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const ym = lm.getFullYear() + "-" + String(lm.getMonth() + 1).padStart(2, "0");
      let total = 0, n = 0;
      (ctx.expenses || []).forEach(e => {
        if(!String(e.expense_date || "").startsWith(ym)) return;
        const s = (e.shares || []).find(x => x.member_id === ctx.myId);
        if(!s) return;
        n++;
        total += typeof convertToTWD === "function" ? Number(convertToTWD(s.amount, e.currency || "TWD")) || 0 : Number(s.amount) || 0;
      });
      if(n && once("month-" + ym)) list.push({ key: "month-" + ym, mood: "smile", text: t("pai.lastMonth", { month: lm.getMonth() + 1, amount: sbNagMoney(Math.round(total), "TWD"), n }) });
    }
    // 6. 節日當天
    const hol = document.documentElement.getAttribute("data-holiday");
    if(hol && has("pai.holiday." + hol) && once("hol-" + hol + "-" + T)) list.push({ key: "hol-" + hol + "-" + T, mood: "sweet", text: t("pai.holiday." + hol) });
    // 7. 群組 7 天以上沒有新帳（三天問一次）
    const last = (ctx.expenses || []).reduce((m, e) => (e.expense_date || "") > m ? e.expense_date : m, "");
    if(last && dayNum(T) - dayNum(last) >= 7 && once("idle", 3)) list.push({ key: "idle", mood: "stare", text: t("pai.noRecord", { days: dayNum(T) - dayNum(last) }) });
    // 8. 每天第一次打開：依時段打招呼
    if(once("hi-" + T)) list.push({ key: "hi-" + T, mood: hourKey() === "late" ? "sleep" : "sweet", text: pick("pai.hi." + hourKey()) });

    // 派派的欠款卡片這次正完整出現的話，只講真正要緊的（有人還錢、活動結算）
    const item = list.find(x => !nagShown() || x.strong);
    if(!item) return;
    setTimeout(() => say(item.text, { mood: item.mood, action: item.action, auto: true, onShown: () => { mark(item.key); if(item.buzz) buzz([20, 60, 20]); } }), 900);
  }

  // ---------- 記帳成功畫面的那一句 ----------
  // info：{ id, amount, currency, myId, expenses }（expenses 是這個幣別或全部的支出，可能還沒有剛記的這筆）
  function recordLine(info){
    if(mode() === "off" || !info) return null;
    const toTWD = (a, c) => typeof convertToTWD === "function" ? Number(convertToTWD(a, c || "TWD")) || Number(a) || 0 : Number(a) || 0;
    const mine = (info.expenses || []).filter(e => e.id !== info.id && ((e.shares || []).some(s => s.member_id === info.myId) || (e.payers || []).some(p => p.member_id === info.myId)));
    // 大筆：換成台幣 3,000 以上，而且是最近 30 筆中位數的 3 倍以上
    const amt = toTWD(info.amount, info.currency);
    const recent = mine.slice().sort((a, b) => String(b.expense_date).localeCompare(String(a.expense_date))).slice(0, 30).map(e => toTWD(e.amount, e.currency)).sort((a, b) => a - b);
    const median = recent.length >= 5 ? recent[Math.floor(recent.length / 2)] : 0;
    if(amt >= 3000 && median && amt >= median * 3) return { mood: "shock", level: 0, line: t("pai.bigSpend", { amount: sbNagMoney(info.amount, info.currency), x: Math.round(amt / median) }) };
    // 這個月第幾筆：一天最多誇兩次
    const c = store.get("sb-pai-praise", null);
    if(c && c.day === today() && c.n >= 2) return null;
    const ym = today().slice(0, 7);
    const d = new Date(); const lmDate = new Date(d.getFullYear(), d.getMonth() - 1, Math.min(d.getDate(), 28));
    const lmYm = sbIsoDay(lmDate).slice(0, 7), lmCut = sbIsoDay(lmDate);
    const n = mine.filter(e => String(e.expense_date || "").startsWith(ym)).length + 1;
    const lastN = mine.filter(e => String(e.expense_date || "").startsWith(lmYm) && e.expense_date <= lmCut).length;
    store.set("sb-pai-praise", { day: today(), n: (c && c.day === today() ? c.n : 0) + 1 });
    window.__sbPaiStats = Object.assign(window.__sbPaiStats || {}, { monthCount: n });
    return { mood: "sweet", level: 0, line: n > lastN && lastN > 0 ? t("pai.recordMore", { n, last: lastN }) : n === 1 ? t("pai.recordFirst") : t("pai.recordN", { n }) };
  }

  // ---------- 載入超過 2 秒：派派在骨架上轉圈 ----------
  function watchLoading(){
    setTimeout(() => {
      if(mode() === "off") return;
      const box = document.getElementById("myAmtList");
      if(!box || !box.querySelector(".skeleton") || box.querySelector(".sb-pai-loading")) return;
      box.insertAdjacentHTML("afterbegin", '<div class="sb-pai-loading" role="status">' + sbPieMascotSVG(0, "smile", true) + '<span>' + escapeHtml(t("pai.loading")) + '</span></div>');
    }, 2000);
  }

  // ---------- 網路斷了／回來了 ----------
  addEventListener("offline", () => { if(mode() === "off") return; idleLogo(); say(t("pai.offline"), { mood: "cry" }); });
  addEventListener("online", () => { if(mode() === "off") return; say(t("pai.online"), { mood: "joy" }); setTimeout(idleLogo, 4600); });

  function boot(){
    if(mode() === "off") return;
    if(!headerPie()) idleLogo();
    watchLoading();
    // 活動頁沒有活動時，空白頁的圖示換成派派
    const ee = document.querySelector("#eventEmpty > .sb-ico");
    if(ee) ee.outerHTML = '<span class="sb-empty-pie" aria-hidden="true">' + sbPieMascotSVG(0, "sweet", true) + '</span>';
    mountDex();
  }

  // ---------- 設定頁的派派圖鑑：看過的表情才顯示，沒看過的是問號 ----------
  function mountDex(){
    const row = document.querySelector(".sb-nag-setting");
    if(!row || document.getElementById("paiDex")) return;
    const wrap = document.createElement("details");
    wrap.className = "sbs-row sb-pai-dex";
    wrap.id = "paiDex";
    row.after(wrap);
    const render = () => {
      let seen = [];
      try { seen = JSON.parse(localStorage.getItem("sb-pai-seen") || "[]"); } catch(e){}
      const all = SB_PIE_MOODS;
      const got = all.filter(m => seen.includes(m)).length;
      const open = wrap.open;
      wrap.innerHTML = '<summary><span class="sbs-body"><span class="sbs-title">' + escapeHtml(t("pai.dexTitle")) + '</span>'
        + '<span class="sbs-hint">' + escapeHtml(t("pai.dexHint", { n: got, left: all.length - got })) + '</span></span>'
        + '<span class="sbs-ctl"><span class="sbs-val">' + got + ' / ' + all.length + '</span></span></summary>'
        + '<ul class="sb-pai-dex-grid">' + all.map(m => seen.includes(m)
          ? '<li title="' + escapeHtml(t("pai.mood." + m)) + '">' + sbPieMascotSVG(m === "dead" ? 4 : m === "sob" ? 3 : 0, m, true) + '<span>' + escapeHtml(t("pai.mood." + m)) + '</span></li>'
          : '<li class="is-locked"><span class="sb-pai-dex-q" aria-hidden="true">?</span><span>' + escapeHtml(t("pai.dexLocked")) + '</span></li>').join("") + '</ul>';
      wrap.open = open;
    };
    render();
    document.addEventListener("splitbill-lang-changed", render);
    wrap.addEventListener("toggle", () => { if(wrap.open) render(); });
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();


  // ---------- 幣別頁：跟這個幣別有關的一件事 ----------
  // ctx：{ currency, label, myId, expenses, repayments }（都是這個幣別的）
  function curMoments(ctx){
    if(mode() === "off" || !ctx || !(ctx.expenses || []).length) return;
    const T = today(), code = ctx.currency;
    const once = (key, every) => { const d = store.get("sb-pai-m-" + key, null); return !d || dayNum(T) - dayNum(d) >= every; };
    const mark = key => store.set("sb-pai-m-" + key, T);
    const nag = document.querySelector("#settleReminderBanner .sb-nag");
    if(nag) return; // 欠款卡片正完整出現，就不另外講
    const items = typeof sbNagItems === "function" ? sbNagItems(ctx.myId, ctx.expenses, ctx.repayments) : [];
    const list = [];
    // 這個幣別跟大家都兩清（一週講一次）
    if(!items.length) list.push({ key: "cur-settled-" + code, every: 7, mood: "joy", text: t("pai.curSettled", { cur: ctx.label }) });
    // 別人欠你的加起來（三天講一次）
    const owed = items.filter(x => !x.iOwe).reduce((s, x) => s + x.amount, 0);
    if(owed > 0) list.push({ key: "cur-owed-" + code, every: 3, mood: "smirk", text: t("pai.curOwed", { cur: ctx.label, amount: sbNagMoney(owed, code), n: items.filter(x => !x.iOwe).length }) });
    // 這個月這個幣別你分到多少（一天講一次）
    const ym = T.slice(0, 7);
    let mine = 0, n = 0;
    ctx.expenses.forEach(e => {
      if(!String(e.expense_date || "").startsWith(ym)) return;
      const s = (e.shares || []).find(x => x.member_id === ctx.myId);
      if(s){ mine += Number(s.amount) || 0; n++; }
    });
    if(n) list.push({ key: "cur-month-" + code, every: 1, mood: "sweet", text: t("pai.curMonth", { cur: ctx.label, amount: sbNagMoney(mine, code), n }) });
    const item = list.find(x => once(x.key, x.every));
    if(item) setTimeout(() => say(item.text, { mood: item.mood, auto: true, onShown: () => mark(item.key) }), 1200);
  }

  // ---------- 震動：App 和支援的 Android 瀏覽器才會震，減少動態時不震 ----------
  function buzz(pattern){
    try { if(!reduced() && navigator.vibrate) navigator.vibrate(pattern); } catch(e){}
  }

  window.sbPai = { say, moments, curMoments, recordLine, tap, enableDrag, idleLogo, idleMood, hide, buzz };
})();

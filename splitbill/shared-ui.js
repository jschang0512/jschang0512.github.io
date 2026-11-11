// ============================================================
// 全站共用的小工具，給 index.html / settings.html / summary.html /
// currency.html（透過 app.js）一起載入使用。
//
// 這幾個原本是四個地方各自複製一份維護的（escapeHtml、自訂下拉選單、
// 滑動式登入過期判斷），改一邊常常忘了改另一邊——例如「複製精簡版/完整版」
// 那次的 cleanNote/copyToClipboard 就是這種複製貼上沒同步造成的 bug。
// 抽成這份共用檔案後，四個地方永遠是同一份程式碼、同一個行為。
//
// forceLogout() 沒有放進來：每個頁面 session 失效後要導去的網址不一樣
// （例如 currency.html 要帶著 ?c=幣別、?redirect= 這些各自的參數），
// 硬塞進共用檔案反而要多繞一層參數傳遞，維持各頁面自己定義、呼叫這裡的
// isSessionExpired()/refreshLoginTime() 就好，是比較單純的做法。
// ============================================================

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

// 📴 離線提示：斷線時在畫面上方跳出提示，避免使用者在網路不穩（漫遊、
// 飯店 wifi）時新增支出/還款，Supabase 呼叫悄悄失敗卻不知道，以為存
// 進去了其實沒有。純狀態顯示，不攔截、不阻擋任何操作——只是讓使用者
// 自己判斷要不要等網路穩定再操作。summary/currency/settings 三頁都有
// #offlineBanner 這個容器才會顯示，沒有的頁面呼叫也不會出錯。
function initOfflineBanner(){
  const banner = document.getElementById("offlineBanner");
  if(!banner) return;
  function update(){
    banner.classList.toggle("hidden", navigator.onLine);
  }
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}
window.initOfflineBanner = initOfflineBanner;

// ---------- Topbar「姓名 (群組)」：如果這個帳號同時在一個以上的群組裡，
// 把群組名稱換成跟全站其他下拉選單同一套外觀的小圓角選單（用 enhanceSelect
// 套上去，不是原生 <select> 那種瀏覽器預設樣式），選別的群組就直接呼叫
// switch_active_group 切換過去並跳到 summary.html，不用特地跑一趟設定頁的
// 「群組」分頁。只有一個群組時沒有切換的必要，維持原本純文字顯示。----------
// eyebrowElId：currency.html 這頁把切換器從頂欄搬到標題上方那排小字
// （原本顯示 TWD/JPY 這種目前幣別代碼，跟下面「臺幣/日幣」分頁按鈕重複，
// 騰出來放更有用的群組切換），這種情況下傳這個容器的 id 進來；其他頁面
// （summary.html/settings.html）不傳，維持切換器長在頂欄姓名旁邊的原本行為。
async function renderWhoamiGroupSwitcher(sb, currentUser, myMember, getDisplayName, eyebrowElId){
  const nameEl = document.getElementById("whoamiName");
  const textWrap = document.getElementById("whoamiText");
  if(!nameEl || !currentUser) return;
  const displayName = (typeof getDisplayName === "function" ? getDisplayName() : null) || (myMember && myMember.name) || currentUser.email;
  const currentGroupName = (myMember && myMember.groups && myMember.groups.name) || "";
  const eyebrowEl = eyebrowElId ? document.getElementById(eyebrowElId) : null;
  const mountEl = eyebrowEl || textWrap || nameEl.parentNode;

  const oldSwitcher = mountEl && mountEl.querySelector(".whoami-group-switcher");
  if(oldSwitcher) oldSwitcher.remove();

  let groups = [];
  try {
    const { data } = await sb.from("members")
      .select("group_id, groups(name)")
      .eq("user_id", currentUser.id)
      .is("left_at", null);
    groups = data || [];
  } catch(e){}

  nameEl.textContent = displayName;

  if(!myMember || groups.length <= 1){
    if(eyebrowEl){
      eyebrowEl.textContent = currentGroupName || eyebrowEl.textContent;
    } else if(currentGroupName){
      nameEl.textContent = displayName + ` (${currentGroupName})`;
    }
    return;
  }

  const sel = document.createElement("select");
  sel.title = t("shared.switchGroupTitle");
  groups.forEach(g=>{
    const opt = document.createElement("option");
    opt.value = g.group_id;
    opt.textContent = (g.groups && g.groups.name) || "?";
    if(g.group_id === myMember.group_id) opt.selected = true;
    sel.appendChild(opt);
  });

  const wrap = document.createElement("span");
  wrap.className = "whoami-group-switcher";
  wrap.appendChild(sel);
  if(eyebrowEl) eyebrowEl.textContent = "";
  mountEl.appendChild(wrap);
  enhanceSelect(sel);

  sel.addEventListener("change", async ()=>{
    const targetId = sel.value;
    if(!targetId || targetId === myMember.group_id) return;
    const prevValue = myMember.group_id;
    sel.disabled = true;
    enhanceSelect(sel);
    const { error } = await sb.rpc("switch_active_group", { p_group_id: targetId });
    if(error){
      if(typeof sbAlert === "function") await sbAlert(t("shared.switchGroupFailed", {error: error.message}), t("settings.errorTitle"));
      sel.disabled = false;
      sel.value = prevValue;
      enhanceSelect(sel);
      return;
    }
    location.href = "summary.html";
  });
}

// ---------- 滑動式登入過期判斷：只要在 14 天內有繼續使用（換頁、或這頁
// 還開著撐過一次 5 分鐘的檢查），時間就往後推，不會單純因為帳號用得久就
// 被踢出；真的超過 14 天完全沒有任何動作才會被登出。----------
const LOGIN_TIME_KEY = "sb_login_time";
const SESSION_DURATION_MS = 90 * 24 * 60 * 60 * 1000;
// 「記住我」：存在這台裝置。沒設定過（舊用戶）當作有勾。
// 沒勾的人靠一個不設期限的 cookie（sb_alive）判斷：瀏覽器／App 關掉就消失，下次打開要重新登入。
// index.html <head> 的快速跳轉也照同一套規則判斷，改這裡要一起改那邊。
function sbRememberMe(){
  try{ return localStorage.getItem("sb_remember") !== "0"; }catch(e){ return true; }
}
function sbSessionAlive(){
  return /(?:^|;\s*)sb_alive=1/.test(document.cookie || "");
}
function isSessionExpired(){
  const loginTime = Number(localStorage.getItem(LOGIN_TIME_KEY));
  if(!loginTime) return false;
  if(!sbRememberMe() && !sbSessionAlive()) return true;
  return (Date.now() - loginTime > SESSION_DURATION_MS);
}
function refreshLoginTime(){
  localStorage.setItem(LOGIN_TIME_KEY, String(Date.now()));
  try{ document.cookie = "sb_alive=1; path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : ""); }catch(e){}
}

// ---------- 成員名單：summary.html / currency.html(app.js) / settings.html
// 原本各自維護一份幾乎一樣的「抓目前群組成員」邏輯，三邊分開改很容易
// 漏掉其中一邊（settings.html 那份就曾經漏了 my_group_id 抓不到時的
// 復原機制）。統一成這一份共用函式，各頁的 loadMembers() 只留自己要
// 把結果存進哪些變數的那幾行。
//
// 回傳 { MEMBERS, memberById, myMember, memberRows }：
// - MEMBERS：目前群組（或這個帳號能看到）的完整成員陣列，name 欄位
//   已經套用暱稱覆蓋、accountName 保留原始帳號姓名。
// - memberById：{ 成員id: 顯示名稱 } 查詢表。
// - myMember：目前登入帳號在這批成員裡對應的那一筆（優先找還在群組
//   內的，找不到才退而求其次抓已退出的那筆），沒登入或找不到則 null。
// - memberRows：依 showLeftMembers 決定要不要把已退出成員也算進去。
async function loadGroupMembers(sb, currentUser, showLeftMembers){
  let activeGroupId = null;
  if(currentUser){
    try {
      const { data: gid, error: gidError } = await sb.rpc("my_group_id");
      if(!gidError && gid) activeGroupId = gid;
    } catch(e){}

    // 如果 my_group_id 沒抓到，從 members 表查出此 user_id 的第一筆啟用群組，
    // 順便把這次查到的結果存回去給下次用（不用等它回來，等了只是白白多卡
    // 一趟網路來回）。
    if(!activeGroupId){
      try {
        const { data: userMembers } = await sb.from("members")
          .select("id,user_id,group_id,name,nickname,email,shown_currencies,left_at,account_deleted_at,groups(name)")
          .eq("user_id", currentUser.id)
          .is("left_at", null)
          .limit(1);
        if(userMembers && userMembers.length > 0){
          activeGroupId = userMembers[0].group_id;
          sb.rpc("set_active_group", { p_group_id: activeGroupId }).catch(()=>{});
        }
      } catch(e){}
    }
  }

  let MEMBERS = [];
  try {
    let query = sb.from("members").select("id,user_id,group_id,name,nickname,email,avatar_url,payment_accounts_visible,shown_currencies,left_at,account_deleted_at,groups(name)").order("name");
    if(activeGroupId) query = query.eq("group_id", activeGroupId);
    const { data, error } = await query;
    if(error){
      console.error("讀取群組成員失敗：", error);
      const { data: fallbackData } = await sb.from("members").select("id,user_id,group_id,name,nickname,email,avatar_url,payment_accounts_visible,shown_currencies,left_at,account_deleted_at,groups(name)").order("name");
      MEMBERS = fallbackData || [];
    } else {
      MEMBERS = data || [];
    }
  } catch(e){
    console.error("讀取 members 異常：", e);
    MEMBERS = [];
  }

  MEMBERS.forEach(m=>{
    if(m.avatar_url){
      localStorage.setItem("sb_avatar_" + m.id, m.avatar_url);
      if(m.user_id) localStorage.setItem("sb_avatar_" + m.user_id, m.avatar_url);
    } else {
      localStorage.removeItem("sb_avatar_" + m.id);
      if(m.user_id) localStorage.removeItem("sb_avatar_" + m.user_id);
    }
    m.accountName = m.name; // 保留帳號原始姓名（不含暱稱/標籤），設定頁「姓名」欄位要用
    if(m.nickname) m.name = m.nickname; // 這個群組如果有另外設定暱稱，畫面上一律優先顯示暱稱
    // 退出/銷毀的「(退出)」「(銷毀)」後綴現在由資料庫 trigger 直接寫進 nickname，
    // 這裡不用再疊加一次，不然會變成「(銷毀) (銷毀)」。
  });

  const memberById = {};
  MEMBERS.forEach(m => memberById[m.id] = m.name);
  const myMember = currentUser
    ? (MEMBERS.find(m => m.user_id === currentUser.id && !m.left_at) || MEMBERS.find(m => m.user_id === currentUser.id))
    : null;
  const memberRows = showLeftMembers ? MEMBERS : MEMBERS.filter(m => !m.left_at);

  // 舊帳號的頭貼還是存整張圖片的 Base64 文字（v680 以前的做法，塞在
  // avatar_url 欄位裡，每次抓成員清單都要整包一起傳）——這裡偷偷在背景
  // 把它搬去 Storage，只存一個網址回去，不擋畫面渲染，也不用另外跑一次
  // 遷移指令碼：每個人下次登入自己就會被治好，失敗也沒關係，下次登入
  // 再試一次就好。
  if(myMember && myMember.avatar_url && myMember.avatar_url.startsWith("data:") && currentUser){
    migrateLegacyBase64Avatar(sb, currentUser, myMember).catch(()=>{});
  }

  return { MEMBERS, memberById, myMember, memberRows };
}

async function migrateLegacyBase64Avatar(sb, currentUser, myMember){
  const blob = await (await fetch(myMember.avatar_url)).blob();
  const path = `${currentUser.id}/avatar.jpg`;
  const { error: uploadErr } = await sb.storage.from("avatars").upload(path, blob, {
    contentType: "image/jpeg",
    upsert: true
  });
  if(uploadErr) throw uploadErr;
  const { data: pub } = sb.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = pub.publicUrl + "?t=" + Date.now();

  const { error: memberErr } = await sb.from("members").update({ avatar_url: avatarUrl }).eq("user_id", currentUser.id);
  if(memberErr) throw memberErr;
  sb.auth.updateUser({ data: { avatar_url: avatarUrl } }).catch(()=>{});

  myMember.avatar_url = avatarUrl;
  localStorage.setItem("sb_avatar_" + myMember.id, avatarUrl);
  if(myMember.user_id) localStorage.setItem("sb_avatar_" + myMember.user_id, avatarUrl);
  localStorage.setItem("sb_my_avatar", avatarUrl);
}

// ---------- 全站統一的自訂下拉選單：外觀跟債務趨勢圖的日/週/月/年選單一致。
// 把真正的 <select> 包一層視覺隱藏起來當資料來源，.value/innerHTML/dataset
// 這些既有邏輯完全不用改；每次選項或值有變動，呼叫 enhanceSelect(選到的
// select) 讓畫面上顯示的按鈕/選單重新同步一次即可（第一次呼叫時才會真的
// 建立包裝）。----------
// 類別下拉：選項前面放該類別的線條圖示（其他下拉維持純文字）
function ddOptionHTML(selectEl, o){
  const meta = (typeof CATEGORY_MAP !== "undefined" && /categor/i.test(selectEl.id || "")) ? CATEGORY_MAP[o.value] : null;
  return (meta && meta.icon ? meta.icon : "") + escapeHtml(o.textContent);
}

function enhanceSelect(selectEl){
  if(!selectEl) return;
  if(!selectEl._ddSync){
    const wrap = document.createElement("div");
    wrap.className = "dd-select";
    selectEl.parentNode.insertBefore(wrap, selectEl);
    wrap.appendChild(selectEl);
    selectEl.tabIndex = -1; // 視覺隱藏的原生 select 不該再佔用 Tab 鍵順序，交給下面的 .dd-btn
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dd-btn";
    btn.innerHTML = '<span class="dd-btn-text"></span><span class="dd-caret">▾</span>';
    const textEl = btn.querySelector(".dd-btn-text");
    const menu = document.createElement("div");
    menu.className = "dd-menu hidden";
    wrap.appendChild(btn);
    wrap.appendChild(menu);

    const closeMenu = () => { menu.classList.add("hidden"); btn.classList.remove("open"); };
    const openMenu = () => { menu.classList.remove("hidden"); btn.classList.add("open"); };
    btn.addEventListener("click", (e)=>{
      e.stopPropagation();
      if(selectEl.disabled) return;
      menu.classList.contains("hidden") ? openMenu() : closeMenu();
    });
    document.addEventListener("click", (e)=>{ if(!wrap.contains(e.target)) closeMenu(); });

    selectEl._ddSync = function(){
      menu.innerHTML = "";
      Array.from(selectEl.options).forEach((o, i)=>{
        const optBtn = document.createElement("button");
        optBtn.type = "button";
        optBtn.className = "dd-option" + (o.selected ? " active" : "");
        optBtn.innerHTML = ddOptionHTML(selectEl, o);
        optBtn.disabled = o.disabled;
        optBtn.addEventListener("click", ()=>{
          selectEl.selectedIndex = i;
          closeMenu();
          selectEl._ddSync();
          selectEl.dispatchEvent(new Event("change", { bubbles:true }));
        });
        menu.appendChild(optBtn);
      });
      const cur = selectEl.selectedOptions[0];
      textEl.innerHTML = cur ? ddOptionHTML(selectEl, cur) : "";
      btn.classList.toggle("disabled", !!selectEl.disabled);
      closeMenu();
    };
  }
  selectEl._ddSync();
}

// ---------- 帳務更動的即時通知小提示卡，跟 app.js 的即時同步共用同一套
// 元件；settings.html 也拿來當切換/建立/加入群組成功的明顯回饋。
// actionLabel/actionFn 是選填的操作按鈕（例如刪除紀錄後的「復原」），
// 按下去會取消自動消失的倒數、立刻關掉 toast 並執行 actionFn。----------
function showToast(title, body, actionLabel, actionFn){
  let container = document.getElementById("sbToastContainer");
  if(!container){
    container = document.createElement("div");
    container.id = "sbToastContainer";
    container.className = "sb-toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = "sb-toast";
  const textEl = document.createElement("div");
  textEl.className = "sb-toast-text";
  textEl.innerHTML = body ? `<b>${escapeHtml(title)}</b><span>${escapeHtml(body)}</span>` : `<b>${escapeHtml(title)}</b>`;
  toast.appendChild(textEl);

  let autoDismissTimer = null;
  let countdownTimer = null;

  const dismiss = () => {
    if(autoDismissTimer) clearTimeout(autoDismissTimer);
    if(countdownTimer) clearInterval(countdownTimer);
    toast.classList.add("sb-toast-out");
    setTimeout(()=> toast.remove(), 250);
  };

  if(actionLabel && actionFn){
    let remaining = 5;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sb-toast-action";
    btn.textContent = `${actionLabel} (${remaining}s)`;
    btn.addEventListener("click", ()=>{
      dismiss();
      actionFn();
    });
    toast.appendChild(btn);

    const progress = document.createElement("div");
    progress.className = "sb-toast-progress";
    toast.appendChild(progress);

    countdownTimer = setInterval(()=>{
      remaining--;
      if(remaining > 0){
        btn.textContent = `${actionLabel} (${remaining}s)`;
      } else {
        clearInterval(countdownTimer);
      }
    }, 1000);
  }

  container.appendChild(toast);
  autoDismissTimer = setTimeout(dismiss, actionLabel ? 5000 : 4000);
}

// ============================================================
// 全站頭貼點擊 → 直接開啟成員個人資料彈窗 (Avatar Click → Member Profile Modal)
// 原本這裡是先跳一張 2.6 秒後自動消失的懸浮小卡片、要再點一次小卡片才會
// 打開完整資料彈窗，使用者反映多這一層沒必要，改成點一下頭像就直接開
// 完整彈窗。
// ============================================================
(function initAvatarProfileClick(){
  document.addEventListener("click", (e)=>{
    // 設定頁面與設定相關彈窗/編輯元件（大頭貼裁切/上傳等）不觸發
    if(location.pathname.endsWith("settings.html") ||
       location.href.includes("settings.html") ||
       e.target.closest(".settings-card, #avatarCropModal, .avatar-crop-modal, .avatar-preview-wrap, .avatar-editor-modal, .profile-avatar-wrap, .member-manage-pill, .member-manage-row, .settings-section")){
      return;
    }

    // 嚴格排除所有類別相關與圖表元素
    if(e.target.closest(".donut-slice, .donut-legend-item, .exp-cat-badge, .exp-cat-chip, .category-detail-modal-title, #catModalTitleWrap, .cat-modal-icon, .donut-center-info, .donut-svg-wrap, #donutScopeTabs, .exp-cat-dot")) return;

    const avatar = e.target.closest(".sb-avatar, .cat-exp-avatar-bubble, .mem-avatar, .avatar-wrap");
    if(!avatar) return;

    // 分攤人勾選、共同品項自付人勾選、多選篩選下拉選單裡的頭像維持原本
    // 「點了切換勾選/篩選」的行為，不搶走點擊去開個人資料彈窗。
    if(e.target.closest("label.check-pill, .sb-ms-item")) return;

    const memberId = avatar.dataset.memberId || "";
    if(memberId && typeof window.showMemberProfileModal === "function"){
      window.showMemberProfileModal(memberId);
    }
  }, { passive: true });
})();

// ============================================================
// 👤 成員個人資料彈窗（點浮動小卡片本身觸發，見上面 initFloatingAvatarTooltip）
// 不用另外寫一套 initXXX(deps) 在每個頁面手動呼叫初始化——直接讀
// window.cachedExpenses/cachedRepayments/allGroupExpenses/allGroupRepayments/
// memberRows/myMember 這些頁面本來就會設定好的全域變數，跟其他共用函式
// 自己讀取全域變數的既有寫法一致。currency.html、summary.html 只要各自
// 有 #memberProfileModal 這個彈窗骨架就會動，不用額外接線。
// ============================================================
async function showMemberProfileModal(memberId){
  const modal = document.getElementById("memberProfileModal");
  if(!modal || !memberId) return;

  const myMember = window.myMember;
  // 首頁本來就有全部幣別的資料；幣別頁只抓自己那個幣別，這裡要跨幣別總額就自己抓一份（超過 20 秒就重抓）
  const stale = window.__sbAllGroupAt && Date.now() - window.__sbAllGroupAt > 20000;
  if(myMember && myMember.group_id && (!window.allGroupExpenses || !window.allGroupExpenses.length || stale)){
    try {
      const sb = window.sb;
      const [allExpRes, allRepRes] = await Promise.all([
        sb.from("expenses").select("*").eq("group_id", myMember.group_id).order("created_at", { ascending:false }),
        sb.from("repayments").select("*").eq("group_id", myMember.group_id).order("created_at", { ascending:false })
      ]);
      if(allExpRes.data) window.allGroupExpenses = allExpRes.data;
      if(allExpRes.data) window.__sbAllGroupAt = Date.now();
      if(allRepRes.data) window.allGroupRepayments = allRepRes.data;
    } catch(e){}
  }

  const expenses = window.allGroupExpenses || window.cachedExpenses || [];
  const repayments = window.allGroupRepayments || window.cachedRepayments || [];
  const memberRows = window.memberRows || [];
  const member = memberRows.find(m => m.id === memberId) || { id: memberId, name: memberId };

  const avatarWrap = document.getElementById("memberProfileAvatarWrap");
  if(avatarWrap) avatarWrap.innerHTML = window.renderAvatarHTML ? window.renderAvatarHTML(member, "avatar-xl") : "";

  const nameEl = document.getElementById("memberProfileName");
  if(nameEl) nameEl.textContent = member.name || "?";

  const balanceEl = document.getElementById("memberProfileBalance");
  if(balanceEl && typeof window.computeMemberNetBalanceTWD === "function"){
    const netTWD = window.computeMemberNetBalanceTWD(memberId, expenses, repayments);
    const cls = netTWD > 0.5 ? "pos" : netTWD < -0.5 ? "neg" : "zero";
    const label = netTWD > 0.5 ? t("shared.owedAmountTWD", {amount: "NT$" + Math.round(netTWD).toLocaleString()})
      : netTWD < -0.5 ? t("shared.oweAmountTWD", {amount: "NT$" + Math.round(Math.abs(netTWD)).toLocaleString()})
      : t("summary.settledCheer");
    balanceEl.textContent = label;
    balanceEl.className = "member-profile-balance " + cls;
  }

  // 跟「我」的關係：只有在看別人的資料卡時才顯示（自己不會欠自己），
  // 逐幣別分開列出、不跨幣別合併，才看得出來是哪個幣別區欠的。
  const relationEl = document.getElementById("memberProfileRelation");
  if(relationEl){
    const viewerId = window.myMember && window.myMember.id;
    if(viewerId && viewerId !== memberId && typeof window.computePairNetBalanceByCurrency === "function"){
      const byCurrency = window.computePairNetBalanceByCurrency(viewerId, memberId, expenses, repayments);
      const allCurrencies = (typeof CURRENCIES !== "undefined" && CURRENCIES) || [];
      const rows = [];
      Object.keys(byCurrency).forEach(cur => {
        const curObj = allCurrencies.find(c => c.code === cur);
        const sym = curObj ? curObj.symbol : cur;
        const curLabel = curObj ? curObj.label : cur;
        const round = v => window.roundToCurrency ? window.roundToCurrency(v, cur) : v;
        const owesYou = round(byCurrency[cur].owesYou);
        const youOwe = round(byCurrency[cur].youOwe);
        // 一般情況下同一個幣別只會有一個方向非零；但跟「逐筆債務表」一樣，
        // 兩個方向同時有欠款時不自動互相沖銷合併，各自誠實列一行。
        if(owesYou > 0.5){
          const amtText = window.formatAmt ? window.formatAmt(owesYou) : Math.round(owesYou);
          rows.push(`<div class="member-profile-relation-row pos"><span class="member-profile-relation-currency-tag">${escapeHtml(curLabel)}</span>${t("shared.owesYouSuffix", {amount: sym+amtText})}</div>`);
        }
        if(youOwe > 0.5){
          const amtText = window.formatAmt ? window.formatAmt(youOwe) : Math.round(youOwe);
          rows.push(`<div class="member-profile-relation-row neg"><span class="member-profile-relation-currency-tag">${escapeHtml(curLabel)}</span>${t("shared.youOweSuffix", {amount: sym+amtText})}</div>`);
        }
      });
      relationEl.innerHTML = rows.length ? rows.join("") : `<div class="member-profile-relation-row zero">${t("shared.noMutualDebt")}</div>`;
      relationEl.classList.remove("hidden");
    } else {
      relationEl.classList.add("hidden");
    }
  }

  const paymentInfoEl = document.getElementById("memberProfilePaymentInfo");
  if(paymentInfoEl){
    // 收款帳戶已改存在 Supabase Vault，member 物件上不會再直接帶明碼的
    // payment_accounts 了，這裡開彈窗當下才呼叫 RPC 現查現解密——RPC
    // 內部自己會重新檢查「顯示開關有沒有開」「呼叫者跟目標是不是同一個
    // 還在的群組成員」，不符合就回傳空陣列，前端不用再自己判斷一次。
    paymentInfoEl.classList.add("hidden");
    paymentInfoEl.innerHTML = "";
    let accounts = [];
    try {
      const sbClient = window.sb;
      if(sbClient){
        const { data, error } = await sbClient.rpc("get_member_payment_accounts", { p_member_id: memberId });
        if(error) console.error("讀取收款帳戶失敗：", error);
        else accounts = Array.isArray(data) ? data.filter(a => a && (a.bankName || a.account)) : [];
      }
    } catch(e){ console.error("讀取收款帳戶異常：", e); }
    if(accounts.length){
      paymentInfoEl.innerHTML = `<span class="member-profile-payment-label">${t("shared.paymentAccountsLabel")}</span>` +
        accounts.map((acc, idx) => {
          const label = window.formatBankLabel ? window.formatBankLabel(acc.bankCode, acc.bankName) : (acc.bankName || "");
          const valueText = acc.account ? `${label} ${acc.account}` : label;
          const copyBtn = acc.account ? `<button type="button" class="member-profile-payment-copy" data-account="${escapeHtml(acc.account)}" title="${t("shared.copyAccountTitle")}"><span class="sb-ico" style="--ico:var(--ico-list)" aria-hidden="true"></span></button>` : "";
          return `
          <div class="member-profile-payment-row">
            <span class="member-profile-payment-index">${idx + 1}</span>
            <span class="member-profile-payment-value">${escapeHtml(valueText)}</span>
            ${copyBtn}
          </div>
        `;
        }).join("");
      paymentInfoEl.classList.remove("hidden");
      paymentInfoEl.querySelectorAll(".member-profile-payment-copy").forEach(btn => {
        btn.addEventListener("click", async ()=>{
          const num = btn.dataset.account;
          if(!num) return;
          try {
            await navigator.clipboard.writeText(num);
            btn.textContent = "✓";
            setTimeout(()=>{ btn.innerHTML = sbIcon("list"); }, 1200);
          } catch(e){}
        });
      });
    } else {
      paymentInfoEl.classList.add("hidden");
    }
  }

  modal.classList.remove("hidden");
  modal.classList.add("show");

  const closeBtn = document.getElementById("memberProfileCloseBtn");
  if(closeBtn){
    closeBtn.onclick = ()=>{
      modal.classList.remove("show");
      setTimeout(()=> modal.classList.add("hidden"), 200);
    };
  }
  modal.onclick = (e)=>{
    if(e.target === modal){
      modal.classList.remove("show");
      setTimeout(()=> modal.classList.add("hidden"), 200);
    }
  };
}
window.showMemberProfileModal = showMemberProfileModal;

// ============================================================
// App 已安裝、正在執行時，掃到邀請 QR code（App Links 驗證通過後系統會
// 直接把 https://.../splitbill/index.html?join=代碼 這個網址交給 App，
// 不會另外開系統瀏覽器）——不管使用者這時候人在 index/settings/summary/
// currency 哪一頁，都先把邀請碼存起來；如果已經登入，直接導去設定頁的
// 「用邀請碼加入」，讓使用者接著完成；還沒登入的話不用多做什麼，登入完成
// 後既有流程（showGroupChoiceScreen）本來就會自己讀出這個值來用。
// ============================================================
(function(){
  if(typeof window.Capacitor === "undefined" || !window.Capacitor.Plugins || !window.Capacitor.Plugins.App) return;
  window.Capacitor.Plugins.App.addListener("appUrlOpen", (event)=>{
    if(!event || !event.url) return;
    let joinCode = "";
    try{ joinCode = new URL(event.url).searchParams.get("join") || ""; }catch(e){}
    if(!joinCode) return;
    localStorage.setItem("splitbill-pending-invite-code", joinCode);
    if(window.currentUser){
      location.href = "settings.html";
    }
  });
})();

// ============================================================
// 🔔 站內通知夾：取代原本要靠瀏覽器/系統推播權限才會動的通知機制。
// ============================================================
// Capacitor（原生 App）用 Google Firebase、網頁版用 Supabase 各自
// 要另外處理推播權限，使用者常常沒開，通知等於白做——改成新增支出/
// 還款、催款提醒都直接寫進 notifications 這張表，不管有沒有開任何
// 系統權限都看得到。三個頁面（summary/currency/settings）登入後都呼叫
// initNotificationBell(sb, myMember)，把小鈴鐺按鈕跟未讀數字掛到頁面
// 上原本 topbar-actions 裡的 #notificationBellContainer。
// ============================================================
async function initNotificationBell(sb, myMember){
  const container = document.getElementById("notificationBellContainer");
  if(!container || !myMember) return;
  // 同一頁只裝一次：之後再呼叫（例如自動記了固定支出）只更新未讀數字，
  // 不要重畫鈴鐺、更不要再開一條即時連線（以前會越開越多條）
  if(window.__sbBell && window.__sbBell.memberId === myMember.id){ window.__sbBell.refresh(); return; }

  container.innerHTML = `
    <div class="notif-bell-wrap" id="notifBellWrap">
      <button type="button" class="icon-btn notif-bell-btn" id="notifBellBtn" title="${t("shared.notifLabel")}" aria-label="${t("shared.notifLabel")}">
        <span class="notif-badge hidden" id="notifBadge">0</span>
      </button>
    </div>
  `;
  // 通知清單是一般的彈出視窗（.calc-modal）：手機從底部滑上來、電腦置中，
  // 返回鍵／點旁邊／Esc 關閉都交給全站彈窗管理。掛在 body 底下，不受頁首的層疊影響。
  document.getElementById("notifModal")?.remove();
  const panel = document.createElement("div");
  panel.className = "calc-modal notif-modal";
  panel.id = "notifModal";
  panel.innerHTML = `
    <div class="calc-card card notif-card" role="dialog" aria-modal="true" aria-labelledby="notifModalTitle">
      <div class="calc-header notif-card-head">
        <span class="calc-header-name" id="notifModalTitle">${t("shared.notifLabel")}</span>
        <button type="button" class="link-btn" id="notifMarkAllReadBtn">${t("shared.markAllRead")}</button>
        <button type="button" class="calc-close" id="notifCloseBtn" aria-label="${t("common.close")}">✕</button>
      </div>
      <div class="notif-panel-list" id="notifPanelList"></div>
    </div>`;
  document.body.appendChild(panel);
  const isOpen = () => panel.classList.contains("show");

  const bellBtn = document.getElementById("notifBellBtn");
  const badge = document.getElementById("notifBadge");
  const listEl = document.getElementById("notifPanelList");
  const markAllBtn = document.getElementById("notifMarkAllReadBtn");

  function notifTimeAgo(iso){
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if(mins < 1) return t("shared.justNow");
    if(mins < 60) return t("shared.minutesAgo", {mins});
    const hrs = Math.floor(mins / 60);
    if(hrs < 24) return t("shared.hoursAgo", {hrs});
    const days = Math.floor(hrs / 24);
    if(days < 7) return t("shared.daysAgo", {days});
    const lang = (typeof getLang === "function") ? getLang() : "zh-Hant";
    const locale = lang === "ja" ? "ja-JP" : lang === "en" ? "en-US" : "zh-TW";
    return new Date(iso).toLocaleDateString(locale);
  }

  async function refreshBadge(){
    const { count, error } = await sb
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("member_id", myMember.id)
      .eq("is_read", false);
    if(error){
      // 故意不要把「查詢失敗」悄悄當成「0 則通知」處理掉——不然這張表
      // 建錯、RLS 設錯之類的真問題，畫面上永遠只會顯示正常的 0，完全
      // 看不出來哪裡壞了。
      console.error("讀取通知數量失敗：", error);
      return;
    }
    const n = count || 0;
    if(badge){
      badge.textContent = n > 99 ? "99+" : String(n);
      badge.classList.toggle("hidden", n === 0);
    }
    renderUnreadAlert(n);
  }

  // 「我的款項」上方的未讀提示：幣別頁放在餘額橫幅前，總覽頁放在「我的款項」卡片標題前。
  // 點一下捲回頂端、打開通知面板；沒有未讀就整條拿掉。
  function renderUnreadAlert(n){
    const balance = document.getElementById("myBalance");
    const amtTitle = document.querySelector('#myAmtList')?.closest(".card")?.querySelector("h2");
    const slot = document.getElementById("homeAlertSlot") || document.getElementById("curAlertSlot"); // 首頁／幣別頁專門留的位置
    const anchor = balance || amtTitle;
    if(!anchor && !slot) return;
    let el = document.getElementById("unreadNotifAlert");
    if(!n){ if(el) el.remove(); return; }
    if(!el){
      el = document.createElement("button");
      el.type = "button";
      el.id = "unreadNotifAlert";
      el.className = "unread-notif-alert";
      el.addEventListener("click", (e)=>{
        e.stopPropagation(); // 不然冒泡到 document 的「點外面就關面板」會馬上又關掉
        window.scrollTo({ top: 0, behavior: "smooth" });
        if(bellBtn && !isOpen()) bellBtn.click();
      });
      // 幣別頁：放在「我的款項」橫幅正下方（最重要的數字先看到）；總覽頁：放在「我的款項」卡片標題前
      if(slot) slot.appendChild(el);
      else if(balance) balance.after(el); else anchor.parentNode.insertBefore(el, anchor);
    }
    el.textContent = n === 1 ? t("shared.unreadNotifAlertOne") : t("shared.unreadNotifAlert", { n: n > 99 ? "99+" : n });
  }

  // 新通知（2026-10 起）帶 params：文字交給 notif-text.js 依目前語言組。
  // 沒有 params 的舊通知照資料庫存的 title/body 顯示，只把「TWD 1250」這種寫法換成「NT$1,250」。
  function notifText(n){
    const txt = splitbillNotifText(n.type, n.params, getLang());
    if(txt) return txt;
    const body = String(n.body || "").replace(/\b([A-Z]{3}) (-?\d+(?:\.\d+)?)\b/g, (m, code, num) => splitbillNotifMoney(num, code));
    return { title: String(n.title || "").replace(/^\p{Extended_Pictographic}\s*/u, ""), body };
  }
  const NOTIF_KIND = { expenses_insert: "add", expenses_update: "edit", recurring_generated: "repeat",
    repayments_insert: "repay", repayments_update: "repay", debt_reminder: "remind", event_created: "add",
    recurring_upcoming: "repeat", recurring_need_amount: "repeat" };

  async function loadList(){
    listEl.innerHTML = `<p class="filter-hint">${t("common.loading")}</p>`;
    const { data, error } = await sb
      .from("notifications")
      .select("id,type,title,body,params,is_read,created_at,related_table,related_id")
      .eq("member_id", myMember.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if(error){
      console.error("讀取通知清單失敗：", error);
      listEl.innerHTML = `<p class="filter-hint">${t("shared.notifLoadFailed")}</p>`;
      return;
    }
    if(!data || !data.length){
      listEl.innerHTML = `<p class="filter-hint">${t("shared.noNotifications")}</p>`;
      return;
    }
    listEl.innerHTML = data.map(n => { const txt = notifText(n); return `
      <div class="notif-item notif-kind-${NOTIF_KIND[n.type] || "other"}${n.is_read ? "" : " unread"}${n.related_table && n.related_id ? " notif-item-linked" : ""}" data-id="${n.id}" data-type="${escapeHtml(n.type || "")}" data-related-table="${n.related_table || ""}" data-related-id="${n.related_id || ""}">
        <div class="notif-item-main">
          <div class="notif-item-title">${n.is_read ? "" : '<span class="notif-unread-dot"></span>'}${escapeHtml(txt.title)}</div>
          <div class="notif-item-body">${escapeHtml(txt.body)}</div>
          <div class="notif-item-time">${notifTimeAgo(n.created_at)}</div>
        </div>
        <button type="button" class="notif-item-del" data-id="${n.id}" title="${t("shared.deleteNotifTitle")}" aria-label="${t("settings.delete")}">✕</button>
      </div>
    `; }).join("");
    listEl.querySelectorAll(".notif-item-main").forEach(el=>{
      el.addEventListener("click", async ()=>{
        const item = el.closest(".notif-item");
        if(item.classList.contains("unread")){
          item.classList.remove("unread");
          await sb.from("notifications").update({ is_read: true }).eq("id", item.dataset.id);
          refreshBadge();
        }
        // related_table/related_id 有值的話，點通知直接跳到對應內容，不用只能
        // 標已讀、自己再去找是哪一筆——目前只有「週期性支出自動記錄」這個通知
        // 類型會填這兩欄，其他類型（例如催款提醒）沒有就維持原本單純標已讀的行為。
        const relatedTable = item.dataset.relatedTable;
        const relatedId = item.dataset.relatedId;
        if(relatedTable === "expenses" && relatedId){
          const { data: exp } = await sb.from("expenses").select("currency").eq("id", relatedId).maybeSingle();
          if(exp && exp.currency){
            location.href = `currency.html?c=${encodeURIComponent(exp.currency)}&openExpense=${encodeURIComponent(relatedId)}`;
          }
        } else if(relatedTable === "recurring_expenses" && relatedId){
          location.href = `recurring.html?${item.dataset.type === "recurring_need_amount" ? "fill" : "show"}=${encodeURIComponent(relatedId)}`;
        } else if(relatedTable === "events"){
          location.href = "events.html";
        }
      });
    });
    listEl.querySelectorAll(".notif-item-del").forEach(btn=>{
      btn.addEventListener("click", async (e)=>{
        e.stopPropagation();
        const item = btn.closest(".notif-item");
        const wasUnread = item.classList.contains("unread");
        if(window.sbCollapseEl) await window.sbCollapseEl(item);
        item.remove();
        await sb.from("notifications").delete().eq("id", btn.dataset.id);
        if(wasUnread) refreshBadge();
        if(!listEl.querySelector(".notif-item")){
          listEl.innerHTML = `<p class="filter-hint">${t("shared.noNotifications")}</p>`;
        }
      });
    });
  }

  if(bellBtn){
    bellBtn.addEventListener("click", (e)=>{
      e.stopPropagation();
      panel.classList.add("show");
      loadList();
    });
  }
  document.getElementById("notifCloseBtn").addEventListener("click", ()=> panel.classList.remove("show"));
  if(markAllBtn){
    markAllBtn.addEventListener("click", async ()=>{
      await sb.from("notifications").update({ is_read: true }).eq("member_id", myMember.id).eq("is_read", false);
      listEl.querySelectorAll(".notif-item.unread").forEach(el => el.classList.remove("unread"));
      refreshBadge();
    });
  }

  refreshBadge();
  window.__sbBell = { memberId: myMember.id, refresh: refreshBadge };

  // 即時更新未讀數字：這個帳號一有新通知寫進來就重新算一次角標，
  // 面板開著的話順便重畫清單，不用手動重新整理頁面才看得到。
  sb.channel("notif-" + myMember.id)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `member_id=eq.${myMember.id}` }, () => {
      refreshBadge();
      if(isOpen()) loadList();
    })
    .subscribe();
}

// ============================================================
// 📍 城市／🌤️ 天氣小徽章：summary.html／currency.html／settings.html
// 共用，畫面上 app-header 標題正上方那兩顆小膠囊（城市在左、天氣在右，
// 分別對應 #locationCard/#locationText 與 #weatherCard/#weatherText 這幾個
// id，頁面上要有這些容器才會顯示）。定位優先用瀏覽器 GPS + OpenStreetMap
// Nominatim 反查城市/行政區，被拒絕或裝置不支援時退回用 IP 概略定位，兩條
// 路徑都會盡量連帶查出行政區（例如「新北市」+「樹林區」），查不到就只顯示
// 城市。天氣用 Open-Meteo，跟定位共用同一組經緯度、不用另外要權限。
// ============================================================
const WEATHER_ICON_MAP = {
  0:"☀️", 1:"🌤️", 2:"⛅", 3:"☁️",
  45:"🌫️", 48:"🌫️",
  51:"🌦️", 53:"🌦️", 55:"🌦️", 56:"🌧️", 57:"🌧️",
  61:"🌧️", 63:"🌧️", 65:"🌧️", 66:"🌧️", 67:"🌧️",
  71:"🌨️", 73:"🌨️", 75:"🌨️", 77:"🌨️",
  80:"🌦️", 81:"🌧️", 82:"⛈️", 85:"🌨️", 86:"🌨️",
  95:"⛈️", 96:"⛈️", 99:"⛈️"
};

async function fetchOpenMeteoWeather(lat, lon){
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 4000);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
    const r = await fetch(url, { signal: ctrl.signal });
    if(!r.ok) return null;
    const d = await r.json();
    if(!d.current || d.current.temperature_2m === undefined) return null;
    return { temp: Math.round(d.current.temperature_2m), icon: WEATHER_ICON_MAP[d.current.weather_code] || "🌡️" };
  } catch(e){ return null; }
}

// IP 定位備援：GPS 沒開權限、使用者拒絕、裝置不支援，或反查失敗時才會用到。
// 原本試過 freeipapi.com，實測瀏覽器直接呼叫會被 CORS 擋掉（沒有回
// Access-Control-Allow-Origin，這種問題只有真的在瀏覽器裡測才測得出來，
// 文件看不出來）。改用 BigDataCloud 的免費 client-side reverse-geocode
// API——沒帶經緯度參數呼叫的話，它會自動退回用「這次請求的來源 IP」查
// 位置（lookupSource 會回傳 "ip geolocation"），瀏覽器端直接 fetch 測過
// 沒有 CORS 問題，一樣免費、不用金鑰。準確度只到城市/行政區等級，比 GPS
// 粗略，但總比完全沒有備援、直接放棄自動偵測好。
async function getIpBasedLocation(){
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch("https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=zh", { signal: ctrl.signal });
    if(!r.ok) return null;
    const d = await r.json();
    const cc = (d.countryCode || "").toLowerCase();
    if(!cc) return null;
    const city = d.city || d.locality || "";
    const district = (d.locality && d.locality !== city) ? d.locality : "";
    return { countryCode: cc, city, district, countryName: d.countryName || "", lat: d.latitude, lon: d.longitude };
  } catch(e){ return null; }
}

function composeLocationLabel(city, district){
  if(city && district && district !== city) return city + district;
  return city || district || "";
}

function renderLocationBadge(locationLabel){
  const card = document.getElementById("locationCard");
  const textEl = document.getElementById("locationText");
  if(!card || !textEl) return;
  if(!locationLabel){ card.classList.add("hidden"); return; }
  textEl.textContent = locationLabel;
  card.title = locationLabel;
  card.classList.remove("hidden");
}

function renderWeatherBadge(weather){
  const card = document.getElementById("weatherCard");
  const textEl = document.getElementById("weatherText");
  if(!card || !textEl) return;
  if(!weather){ card.classList.add("hidden"); return; }
  const full = `${weather.icon} ${weather.temp}°C`;
  textEl.textContent = full;
  card.title = full;
  card.classList.remove("hidden");
}

// 城市/天氣結果快取：20 分鐘內在總覽/幣別頁/設定頁之間切來切去，直接沿用
// 同一份結果，不用每切一次頁就重打一次 GPS 定位＋Nominatim 反查＋Open-
// Meteo（使用者反映切頁會一直重抓，體感也比較耗電/耗流量）。20 分鐘夠
// 涵蓋「開 App 逛一輪」的正常使用情境，真的移動到別的城市時也不會等太久
// 才更新。存在 localStorage（不是 sessionStorage）是因為就算把分頁關掉、
// 過一下子重開，只要還在這 20 分鐘內，人通常還在原地，一樣不用重抓。
const LOCATION_WEATHER_CACHE_KEY = "sb_location_weather_cache";
const LOCATION_WEATHER_CACHE_MS = 20 * 60 * 1000;

// onDetected(info)：選用 callback，帶回 {lat, lon, countryCode, city,
// district, countryName}，讓 summary.html 這類需要額外邏輯（例如切換國家
// 時跳出「建議切換幣別」提示）的頁面自己接著處理；currency.html/
// settings.html 只需要顯示這兩顆徽章，不用傳這個參數。沒有 #locationCard/
// #weatherCard 容器的頁面（不在 summary/currency/settings 範圍內）呼叫這
// 支函式也不會出錯，只是徽章不會顯示（renderXxxBadge 內部會做 null 檢查）。
// 系統權限視窗一台裝置只主動跳一次：使用者關掉或沒回應，之後就不再自己跳，
// 要開的話自己去設定按。第一次呼叫回傳 true，之後都是 false。
function sbAskOnce(key){
  try{
    if(localStorage.getItem(key)) return false;
    localStorage.setItem(key, "1");
  }catch(e){ return false; }
  return true;
}
window.sbAskOnce = sbAskOnce;

// 這次可不可以呼叫 GPS。已經授權就直接用；還沒決定的話只問一次，之後改用
// IP 定位（到城市等級，顯示所在地和判斷幣別都夠用），不會每次開 App 都跳視窗。
async function sbCanUseGps(){
  if(!navigator.geolocation) return false;
  let state = "";
  try{
    const native = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation;
    if(native && native.checkPermissions){
      const p = await native.checkPermissions();
      state = p.location || "";
    } else if(navigator.permissions && navigator.permissions.query){
      state = (await navigator.permissions.query({ name: "geolocation" })).state;
    }
  }catch(e){}
  if(state === "granted") return true;
  if(state === "denied") return false;
  return sbAskOnce("splitbill-gps-asked");
}
window.sbCanUseGps = sbCanUseGps;

async function initLocationWeatherWidget(onDetected){
  try {
    const cachedRaw = localStorage.getItem(LOCATION_WEATHER_CACHE_KEY);
    if(cachedRaw){
      const cached = JSON.parse(cachedRaw);
      if(cached && cached.ts && (Date.now() - cached.ts < LOCATION_WEATHER_CACHE_MS) && cached.info){
        renderLocationBadge(composeLocationLabel(cached.info.city, cached.info.district));
        renderWeatherBadge(cached.weather || null);
        if(typeof onDetected === "function") onDetected(cached.info);
        return cached.info;
      }
    }
  } catch(e){}

  let lat, lon, countryCode = '', city = '', district = '', countryName = '';
  try {
    if(!(await sbCanUseGps())) throw new Error("gps not allowed");
    const pos = await new Promise((res, rej) => {
      navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
    });
    lat = pos.coords.latitude; lon = pos.coords.longitude;
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1&accept-language=zh-TW,zh,en`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } }).catch(() => null);
    if(!r || !r.ok) throw new Error("reverse geocode failed");
    const d = await r.json();
    const addr = d.address || {};
    countryCode = (addr.country_code || '').toLowerCase();
    city = addr.city || addr.county || addr.state || '';
    district = addr.suburb || addr.city_district || addr.town || addr.village || '';
    countryName = addr.country || '';
  } catch(e){
    const ipLoc = await getIpBasedLocation();
    if(!ipLoc) return null;
    lat = ipLoc.lat; lon = ipLoc.lon;
    countryCode = ipLoc.countryCode; city = ipLoc.city; district = ipLoc.district; countryName = ipLoc.countryName;
  }
  if(!countryCode) return null;

  renderLocationBadge(composeLocationLabel(city, district));
  const weather = null; // 天氣徽章已移除（2026-10），不再查 Open-Meteo

  const info = { lat, lon, countryCode, city, district, countryName };
  try {
    localStorage.setItem(LOCATION_WEATHER_CACHE_KEY, JSON.stringify({ ts: Date.now(), weather, info }));
  } catch(e){}

  if(typeof onDetected === "function") onDetected(info);
  return info;
}
window.initLocationWeatherWidget = initLocationWeatherWidget;
window.initNotificationBell = initNotificationBell;

// ============================================================
// 💹 金額跳動：餘額數字從舊值滾到新值（記一筆、還款、即時同步之後）。
// 純顯示效果——只在畫面已經寫好新數字之後，暫時把那段數字文字從舊值補間
// 到新值，結束時一定停在原本寫進去的文字，不讀也不改任何資料。
// 使用者開啟「減少動態效果」時完全不跑。
// ============================================================
(function initAmountTween(){
  if(typeof window === "undefined" || !window.MutationObserver) return;
  if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const SEL = ".my-balance-amt, .my-mini-balance .amt";
  const NUM_RE = /-?\d[\d,]*(?:\.\d+)?/;
  const lastValue = new Map();   // key -> number last shown
  const running = new WeakSet();

  function keyOf(el){
    if(el.id) return "#" + el.id;
    const box = el.closest(".my-mini-balance");
    const label = box ? (box.textContent || "").replace(NUM_RE, "").replace(/\s+/g, "").slice(0, 24) : "";
    return "mini:" + label;
  }
  function numberNode(el){
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while((n = walker.nextNode())){ if(NUM_RE.test(n.nodeValue)) return n; }
    return null;
  }
  function tween(node, from, to, finalText, match){
    const decimals = (match.split(".")[1] || "").length;
    const fmt = (v) => v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const t0 = performance.now(), dur = 480;
    running.add(node);
    function step(now){
      if(!node.isConnected || document.hidden){ node.nodeValue = finalText; running.delete(node); return; }
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      if(p < 1){
        node.nodeValue = finalText.replace(NUM_RE, fmt(from + (to - from) * e));
        requestAnimationFrame(step);
      } else {
        node.nodeValue = finalText;
        running.delete(node);
      }
    }
    requestAnimationFrame(step);
  }
  function check(el){
    const node = numberNode(el);
    if(!node || running.has(node)) return;
    const text = node.nodeValue;
    const match = text.match(NUM_RE)[0];
    const value = parseFloat(match.replace(/,/g, ""));
    if(!isFinite(value)) return;
    const key = keyOf(el);
    const prev = lastValue.get(key);
    lastValue.set(key, value);
    if(prev === undefined || prev === value || document.hidden) return;
    tween(node, prev, value, text, match);
  }
  let queued = false;
  const pending = new Set();
  const observer = new MutationObserver((records) => {
    for(const r of records){
      const target = r.target.nodeType === 3 ? r.target.parentElement : r.target;
      if(!target) continue;
      const hit = target.closest ? target.closest(SEL) : null;
      if(hit) pending.add(hit);
      if(target.querySelectorAll) target.querySelectorAll(SEL).forEach(el => pending.add(el));
    }
    if(!queued && pending.size){
      queued = true;
      setTimeout(() => { queued = false; pending.forEach(check); pending.clear(); }, 0);
    }
  });
  function start(){ observer.observe(document.body, { childList: true, subtree: true, characterData: true }); document.querySelectorAll(SEL).forEach(check); }
  if(document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();


// ============================================================
// 手機版底部導覽（2026-11）
// ============================================================
// 幣別面板：從底部滑出，第一項是「首頁」，接著是要顯示的幣別。
// current：目前的幣別代碼，或 "SUMMARY"（在首頁）；tabParam：換幣別時要保留的分頁（"&tab=expense"）
let sbSheetEl = null;
let sbSheetOpener = null;
function sbCloseCurrencySheet(){
  if(!sbSheetEl) return;
  const el = sbSheetEl;
  sbSheetEl = null;
  el.classList.remove("open");
  setTimeout(() => el.remove(), 260);
  if(sbSheetOpener) sbSheetOpener.focus({ preventScroll: true });
}
function sbOpenCurrencySheet(opener, current, tabParam){
  if(sbSheetEl) return;
  sbSheetOpener = opener || null;
  let shown = null;
  try { shown = JSON.parse(localStorage.getItem("splitbill-shown-currencies") || "null"); } catch(e){}
  shown = shown || ["TWD"];
  const list = CURRENCIES.filter(c => shown.includes(c.code) || c.code === current);
  const onHome = current === "SUMMARY";
  const onSettings = current === "SETTINGS";
  const title = escapeHtml(t("currency.switchCurrencyTitle"));
  const el = document.createElement("div");
  el.className = "sb-sheet-backdrop";
  el.innerHTML = `
    <div class="sb-sheet" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="sb-sheet-handle" aria-hidden="true"></div>
      <div class="sb-sheet-title">${title}</div>
      <a class="sb-sheet-item${onHome ? " is-current" : ""}" href="summary.html"${onHome ? ' aria-current="page"' : ""}><span class="sb-sheet-item-ico">${sbIcon("grid")}</span><span class="sb-sheet-item-label">${escapeHtml(t("common.overview"))}</span>${onHome ? sbIcon("check") : ""}</a>
      <a class="sb-sheet-item${onSettings ? " is-current" : ""}" href="settings.html"${onSettings ? ' aria-current="page"' : ""}><span class="sb-sheet-item-ico">${sbIcon("gear")}</span><span class="sb-sheet-item-label">${escapeHtml(t("common.settings"))}</span>${onSettings ? sbIcon("check") : ""}</a>
      <div class="sb-sheet-sep" aria-hidden="true"></div>
      ${list.map(c => `<a class="sb-sheet-item${c.code === current ? " is-current" : ""}" href="currency.html?c=${c.code}${tabParam || ""}"${c.code === current ? ' aria-current="page"' : ""}>
          <span class="sb-sheet-item-ico">${currencyFlagImgHTML(c.code) || sbIcon("globe")}</span>
          <span class="sb-sheet-item-label">${escapeHtml(c.label)}</span>
          <span class="sb-sheet-item-code">${c.code}</span>
          ${c.code === current ? sbIcon("check") : ""}
        </a>`).join("")}
    </div>`;
  document.body.appendChild(el);
  sbSheetEl = el;
  requestAnimationFrame(() => el.classList.add("open"));
  el.addEventListener("click", (e) => {
    if(e.target === el){ sbCloseCurrencySheet(); return; }
    if(e.target.closest(".sb-sheet-item.is-current")){ e.preventDefault(); sbCloseCurrencySheet(); }
  });
  const first = el.querySelector(".sb-sheet-item");
  if(first) first.focus({ preventScroll: true });
}
document.addEventListener("keydown", (e) => { if(e.key === "Escape") sbCloseCurrencySheet(); });
window.sbOpenCurrencySheet = sbOpenCurrencySheet;

// 鍵盤打開時收起底部導覽列，不擋住輸入中的表單
let sbKbBound = false;
function sbBindKeyboardHide(){
  if(sbKbBound) return;
  sbKbBound = true;
  const isTyping = (el) => el && (el.tagName === "TEXTAREA" || el.isContentEditable || (el.tagName === "INPUT" && !/^(checkbox|radio|button|submit|range|color|file)$/i.test(el.type)));
  document.addEventListener("focusin", (e) => { if(isTyping(e.target)) document.body.classList.add("kb-open"); });
  document.addEventListener("focusout", () => { setTimeout(() => { if(!isTyping(document.activeElement)) document.body.classList.remove("kb-open"); }, 80); });
}
window.sbBindKeyboardHide = sbBindKeyboardHide;

// 首頁與設定頁的底部導覽：首頁 · 幣別 · 記一筆 · 設定（幣別頁有自己的一列，見 app.js）
function sbBuildPageNav(){
  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  const current = page === "summary.html" ? "SUMMARY" : page === "settings.html" ? "SETTINGS" : (page === "recurring.html" || page === "events.html") ? "TOOL" : null;
  if(!current || document.querySelector(".sb-bottom-nav")) return;
  const item = (key, icon, label, active) =>
    `<button type="button" data-nav="${key}"${active ? ' class="active" aria-current="page"' : ""}><span class="sb-nav-ico">${sbIcon(icon)}</span><span>${escapeHtml(label)}</span></button>`;
  const nav = document.createElement("nav");
  nav.className = "sb-bottom-nav is-page-nav";
  nav.setAttribute("aria-label", t("nav.mainLabel"));
  // 幣別切換放最右邊，大拇指最好按
  nav.innerHTML = item("home", "grid", t("common.overview"), current === "SUMMARY")
    + item("quick", "zap", t("summary.quickExpFabText"), false)
    + item("settings", "gear", t("common.settings"), current === "SETTINGS")
    + `<button type="button" data-nav="currency" aria-haspopup="dialog"><span class="sb-nav-ico">${sbIcon("globe")}</span><span>${escapeHtml(t("nav.currencies"))} ▾</span></button>`;
  document.body.appendChild(nav);
  document.body.classList.add("has-bottom-nav");
  nav.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-nav]");
    if(!b) return;
    const k = b.dataset.nav;
    if(k === "home"){ if(current === "SUMMARY") window.scrollTo({ top: 0, behavior: "smooth" }); else location.href = "summary.html"; }
    else if(k === "settings"){ if(current === "SETTINGS") window.scrollTo({ top: 0, behavior: "smooth" }); else location.href = "settings.html"; }
    else if(k === "currency"){ sbOpenCurrencySheet(b, current, ""); }
    else if(k === "quick"){
      const fab = document.getElementById("openQuickExpenseBtn");
      if(fab) fab.click(); else location.href = "summary.html?quick=1";
    }
  });
  sbBindKeyboardHide();
}
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", sbBuildPageNav);
else sbBuildPageNav();


// 名字那一列的深淺色切換（2026-11，取代原本的設定按鈕）：淺色時顯示月亮、深色時顯示太陽；
// 跟設定頁「深色模式」那一列、其他頁的角落按鈕同步
function sbSyncThemeButtons(){
  const dark = (window.splitbillGetTheme ? window.splitbillGetTheme() : document.documentElement.getAttribute("data-theme")) === "dark";
  document.querySelectorAll(".sb-theme-btn .sb-ico, #settingsThemeBtn .sb-ico, #themeRowIcon .sb-ico").forEach(ic => ic.style.setProperty("--ico", "var(--ico-" + (dark ? "sun" : "moon") + ")"));
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest(".sb-theme-btn");
  if(!b || typeof window.splitbillToggleTheme !== "function") return;
  window.splitbillToggleTheme();
});
window.addEventListener("splitbill-theme-change", sbSyncThemeButtons);
if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", sbSyncThemeButtons); else sbSyncThemeButtons();

// 年度回顧只在跨年前後一週開放（12/24–1/7），回傳這段期間要回顧的年份，其他時間回傳 null。
function recapYearFor(date){
  const m = date.getMonth(), d = date.getDate();
  if(m === 11 && d >= 24) return date.getFullYear();
  if(m === 0 && d <= 7) return date.getFullYear() - 1;
  return null;
}

// 底部視窗的拖曳把手：往下拉超過 90px 放開就關閉，沒拉到彈回原位。
// 關閉時直接按視窗自己的 ✕，各視窗原本的收尾邏輯才不用寫兩份。
(function initSheetDragHandles(){
  let card = null, startY = 0, deltaY = 0;
  document.addEventListener("touchstart", e => {
    const handle = e.target.closest && e.target.closest(".sb-drag-handle");
    if(!handle) return;
    card = handle.closest(".calc-card");
    startY = e.touches[0].clientY;
    deltaY = 0;
    if(card) card.style.transition = "none";
  }, { passive:true });
  document.addEventListener("touchmove", e => {
    if(!card) return;
    deltaY = Math.max(0, e.touches[0].clientY - startY);
    card.style.transform = `translateY(${deltaY}px)`;
  }, { passive:true });
  function release(){
    if(!card) return;
    const c = card;
    card = null;
    c.style.transition = "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)";
    if(deltaY > 90){
      const closeBtn = c.querySelector(".calc-close");
      c.style.transform = "translateY(100%)";
      setTimeout(() => {
        if(closeBtn) closeBtn.click();
        setTimeout(() => { c.style.transform = ""; c.style.transition = ""; }, 240);
      }, 200);
    } else {
      c.style.transform = "";
    }
  }
  document.addEventListener("touchend", release);
  document.addEventListener("touchcancel", release);
})();

// 支出名稱裡可能夾帶 [xcur:...]／[recurring:...]／<!--CAT:...--> 這類隱藏標記，
// 要顯示給人看之前先拿掉
function sbCleanExpenseTitle(desc){
  return String(desc || "").replace(/<!--[\s\S]*?-->/g, "").replace(/\[[a-z]+:[^\]]*\]/gi, "").replace(/AI_RECEIPT_DATA[\s\S]*$/, "").trim();
}
window.sbCleanExpenseTitle = sbCleanExpenseTitle;

// 下拉重新整理：頁面在最頂端時往下拉超過門檻就重抓資料。頁面呼叫
// sbEnablePullToRefresh(非同步函式) 才會啟用，有視窗開著或從可橫向捲動的表格開始拉都不算。
function sbEnablePullToRefresh(refresh){
  const THRESHOLD = 64;
  document.documentElement.classList.add("sb-ptr-on");
  const dot = document.createElement("div");
  dot.className = "sb-ptr";
  dot.setAttribute("aria-hidden", "true");
  dot.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M20 12a8 8 0 1 1-2.4-5.7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M20 3v5h-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  document.body.appendChild(dot);

  let startX = 0, startY = 0, pull = 0, tracking = false, busy = false;
  const place = () => { dot.style.transform = `translate(-50%, ${pull - 44}px) rotate(${pull * 4}deg)`; dot.style.opacity = Math.min(1, pull / THRESHOLD); };
  function blocked(target){
    return window.scrollY > 0 || busy
      || document.querySelector(".calc-modal.show, .sb-record-overlay, .sb-sheet-backdrop, .sb-moment")
      || (target.closest && target.closest("input, textarea, select, .matrix-scroll, .sb-drag-handle"));
  }
  document.addEventListener("touchstart", e => {
    tracking = !blocked(e.target);
    if(!tracking) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    pull = 0;
    dot.classList.remove("is-settling");
  }, { passive:true });
  document.addEventListener("touchmove", e => {
    if(!tracking) return;
    const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
    if(dy <= 0 || Math.abs(dx) > dy){ pull = 0; place(); return; }
    pull = Math.min(dy * .5, 96);
    place();
  }, { passive:true });
  async function release(){
    if(!tracking) return;
    tracking = false;
    dot.classList.add("is-settling");
    if(pull < THRESHOLD){ pull = 0; place(); return; }
    busy = true;
    pull = THRESHOLD;
    dot.classList.add("is-busy");
    dot.style.transform = `translate(-50%, ${pull - 44}px)`;
    dot.style.opacity = 1;
    try{ await refresh(); }catch(e){ console.error("重新整理失敗：", e); }
    busy = false;
    dot.classList.remove("is-busy");
    pull = 0;
    place();
  }
  document.addEventListener("touchend", release);
  document.addEventListener("touchcancel", release);
}
window.sbEnablePullToRefresh = sbEnablePullToRefresh;

// ---------- 固定支出共用：固定收支頁跟幣別頁的自動記帳都用這幾個，規則只寫一份 ----------
function sbIsoDay(dt){
  return dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
}
// 從某一期往後推一期
function sbRecurNextDate(tmpl, fromIso){
  const [y, m, d] = fromIso.split("-").map(Number);
  if(tmpl.interval_unit === "weekly") return sbIsoDay(new Date(y, m - 1, d + 7));
  if(tmpl.interval_unit === "yearly") return sbIsoDay(new Date(y + 1, (tmpl.interval_month || m) - 1, tmpl.interval_day));
  return sbIsoDay(new Date(y, m, tmpl.interval_day));
}
// 新建或改了排程時的第一期：今天之後最近的那一天（今天本身不算，避免一建立就馬上記帳）
function sbRecurFirstDate(unit, day, month, todayIso){
  const [y, m, d] = todayIso.split("-").map(Number);
  if(unit === "weekly"){
    const base = new Date(y, m - 1, d);
    const diff = ((day - base.getDay() + 7) % 7) || 7;
    return sbIsoDay(new Date(y, m - 1, d + diff));
  }
  if(unit === "yearly"){
    const thisYear = sbIsoDay(new Date(y, month - 1, day));
    return thisYear > todayIso ? thisYear : sbIsoDay(new Date(y + 1, month - 1, day));
  }
  const thisMonth = sbIsoDay(new Date(y, m - 1, day));
  return thisMonth > todayIso ? thisMonth : sbIsoDay(new Date(y, m, day));
}
// 這一期要記的金額：排了漲價而且已經到了，就用新金額
function sbRecurAmount(tmpl){
  return tmpl.next_amount && tmpl.next_amount_from && tmpl.next_amount_from <= tmpl.next_due_date
    ? Number(tmpl.next_amount) : Number(tmpl.amount);
}
// 依權重分錢，捨入的零頭給小數部分最大的人，總和一定等於 total
function sbSplitByWeights(total, weights, currency){
  const c = (typeof CURRENCIES !== "undefined" ? CURRENCIES : []).find(x => x.code === currency);
  const unit = Math.pow(10, c ? c.decimals : 2);
  const units = Math.round(Number(total) * unit);
  const sum = weights.reduce((s, w) => s + Number(w.weight), 0) || 1;
  const rows = weights.map(w => {
    const exact = units * Number(w.weight) / sum;
    return { member_id: w.member_id, u: Math.floor(exact), frac: exact - Math.floor(exact) };
  });
  let rest = units - rows.reduce((s, r) => s + r.u, 0);
  rows.slice().sort((a, b) => b.frac - a.frac).forEach(r => { if(rest > 0){ r.u++; rest--; } });
  return rows.map(r => ({ member_id: r.member_id, amount: r.u / unit }));
}
// 金額變了，分攤跟付款照原本的比例重算（比例模式用設定的份數）
function sbRecurShares(tmpl, amount){
  if(Number(amount) === Number(tmpl.amount)) return tmpl.shares;
  const weights = tmpl.split_mode === "ratio" && Array.isArray(tmpl.split_weights) && tmpl.split_weights.length
    ? tmpl.split_weights
    : (tmpl.shares || []).map(s => ({ member_id: s.member_id, weight: Number(s.amount) }));
  return sbSplitByWeights(amount, weights, tmpl.currency);
}
function sbRecurPayers(tmpl, amount){
  if(Number(amount) === Number(tmpl.amount)) return tmpl.payers;
  return sbSplitByWeights(amount, (tmpl.payers || []).map(p => ({ member_id: p.member_id, weight: Number(p.amount) || 1 })), tmpl.currency);
}
// 往下一期推：記了帳（generated）或跳過這期都走這裡。回傳要寫回範本的欄位。
// schedule_rev 一定要加一，資料庫靠它分辨是新版 App 在動排程。
function sbRecurAdvance(tmpl, { generated, amount, todayIso }){
  const next = sbRecurNextDate(tmpl, tmpl.next_due_date);
  const upd = { next_due_date: next, schedule_rev: (tmpl.schedule_rev || 0) + 1 };
  const amt = amount != null ? Number(amount) : sbRecurAmount(tmpl);
  if(amt !== Number(tmpl.amount)){
    upd.amount = amt;
    upd.shares = sbRecurShares(tmpl, amt);
    upd.payers = sbRecurPayers(tmpl, amt);
  }
  if(tmpl.next_amount_from && tmpl.next_amount_from <= tmpl.next_due_date){
    upd.next_amount = null;
    upd.next_amount_from = null;
  }
  if(generated){
    upd.generated_count = (tmpl.generated_count || 0) + 1;
    upd.last_generated_date = todayIso;
  }
  if((tmpl.total_count && generated && upd.generated_count >= tmpl.total_count) || (tmpl.end_date && next > tmpl.end_date)){
    upd.active = false;
  }
  return upd;
}
window.sbIsoDay = sbIsoDay;
window.sbRecurNextDate = sbRecurNextDate;
window.sbRecurFirstDate = sbRecurFirstDate;
window.sbRecurAmount = sbRecurAmount;
window.sbSplitByWeights = sbSplitByWeights;
window.sbRecurShares = sbRecurShares;
window.sbRecurPayers = sbRecurPayers;
window.sbRecurAdvance = sbRecurAdvance;

// ============================================================
// 全站彈窗：返回鍵、點背景、Esc 都能關（2026-11）
//
// 各頁的彈窗都是 .calc-modal，加上 .show（或 .open）就顯示。這裡不改各頁怎麼開關，
// 只在旁邊看著：有彈窗打開時多推一筆瀏覽紀錄，所以 Android 返回鍵是「關彈窗」
// 而不是離開整頁；點背景、按 Esc 也一樣。關的時候按彈窗自己的關閉鈕，各頁原本
// 的收尾邏輯照跑。使用者在彈窗裡打過字的話，用這三種「不小心」的方式關之前先問一句；
// 按 ✕ 是明確要關，就不問。
// 不適合誤觸就關的彈窗（從信件點進來的重設密碼）加 data-sb-sticky。
// ============================================================
(function initSbModalManager(){
  const OPEN_SEL = ".calc-modal.show, .calc-modal.open";
  let order = [];          // 打開的順序，最後一個在最上面
  let armed = false;       // 瀏覽紀錄裡有沒有我們推的那一筆
  let ignorePop = 0;       // 自己呼叫 history.back() 造成的 popstate 不處理
  const usesHidden = new WeakSet();
  const dirty = new WeakSet();

  const isOpen = m => m.matches(OPEN_SEL);
  const top = () => order[order.length - 1] || null;

  function closeBtnOf(m){
    return m.querySelector(".calc-close, [id$='CloseBtn'], [id$='Close'], [data-sb-close]");
  }
  function forceClose(m){
    const btn = closeBtnOf(m);
    if(btn && !btn.disabled){ btn.click(); }
    if(isOpen(m)){
      m.classList.remove("show", "open");
      if(usesHidden.has(m)) setTimeout(() => { if(!isOpen(m)) m.classList.add("hidden"); }, 200);
    }
  }
  async function requestClose(m){
    if(!m || m.hasAttribute("data-sb-sticky")) return false;
    if(dirty.has(m)){
      const msg = typeof t === "function" ? t("shared.discardChanges") : "還沒儲存的內容會不見，確定要關閉嗎？";
      const ok = typeof window.sbConfirm === "function" ? await window.sbConfirm(msg) : window.confirm(msg);
      if(!ok) return false;
    }
    forceClose(m);
    return true;
  }

  function sync(){
    const now = Array.from(document.querySelectorAll(OPEN_SEL));
    order = order.filter(m => now.includes(m));
    now.forEach(m => { if(!order.includes(m)){ order.push(m); dirty.delete(m); const c = m.querySelector(".calc-card"); if(c) c.scrollTop = 0; } });
    if(order.length && !armed){
      history.pushState(Object.assign({}, history.state, { sbModal: true }), "");
      armed = true;
    } else if(!order.length && armed){
      armed = false;
      if(history.state && history.state.sbModal){ ignorePop++; history.back(); }
    }
  }

  new MutationObserver(muts => {
    muts.forEach(mu => {
      const m = mu.target;
      if(m.classList && m.classList.contains("calc-modal") && isOpen(m) && /\bhidden\b/.test(mu.oldValue || "")) usesHidden.add(m);
    });
    sync();
  }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true, childList: false });

  window.addEventListener("popstate", () => {
    if(ignorePop){ ignorePop--; return; }
    armed = false;
    const m = top();
    if(!m) return;
    // 先把那一筆補回去：彈窗沒關成（使用者選了不關、或還有下一層），再按返回一樣是關彈窗
    history.pushState(Object.assign({}, history.state, { sbModal: true }), "");
    armed = true;
    requestClose(m);
  });

  document.addEventListener("keydown", e => {
    if(e.key !== "Escape" || e.defaultPrevented) return;
    const m = top();
    if(m){ e.preventDefault(); e.stopPropagation(); requestClose(m); }
  });

  // 按下跟放開都在背景上才算（從卡片裡拖選文字拖到外面不算）
  let downOnBackdrop = null;
  document.addEventListener("pointerdown", e => {
    downOnBackdrop = e.target.classList && e.target.classList.contains("calc-modal") && isOpen(e.target) ? e.target : null;
  }, true);
  document.addEventListener("click", e => {
    const m = e.target;
    if(m === downOnBackdrop && m === top()) requestClose(m);
    downOnBackdrop = null;
  });

  const markDirty = e => {
    if(!e.isTrusted) return;
    const m = e.target.closest && e.target.closest(".calc-modal");
    // 只算打字的欄位；勾選、下拉這類一點就生效的不算（篩選視窗之類的關掉也不會掉東西）
    if(m && !m.classList.contains("sb-dialog-modal") && !m.hasAttribute("data-sb-nodirty")
      && e.target.matches("textarea, input:not([type=file]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=search])")) dirty.add(m);
  };
  document.addEventListener("input", markDirty, true);
  document.addEventListener("change", markDirty, true);

  window.sbModalTop = top;
  window.sbModalRequestClose = requestClose;
})();

// ============================================================
// 更新公告（2026-11）
// 每台裝置記住看過的版本（localStorage）。APP_VERSION 變了，就去讀 release-notes.js，
// 有比上次看過的版本更新的公告才跳一次；跳出來的當下就記成看過，之後不再出現。
// 只在登入後的頁面跳（登入頁、條款、關於不跳）；別的彈窗開著就等它關掉再跳。
// 這台裝置從沒記過（第一次用、或這個功能剛上線）只顯示最新那一則。
// ============================================================
const SB_SEEN_VERSION_KEY = "splitbill-seen-version";
function sbLoadReleaseNotes(){
  if(window.SB_RELEASE_NOTES) return Promise.resolve(window.SB_RELEASE_NOTES);
  return new Promise(resolve => {
    const s = document.createElement("script");
    s.src = typeof sbAsset === "function" ? sbAsset("release-notes.js") : "release-notes.js";
    s.onload = () => resolve(window.SB_RELEASE_NOTES || []);
    s.onerror = () => resolve([]);
    document.head.appendChild(s);
  });
}
function sbNoteItems(note){
  const lang = typeof getLang === "function" ? getLang() : "zh-Hant";
  return note[lang] || note["zh-Hant"] || [];
}
// 設定頁「最新更新項目」：顯示最新一則
async function sbRenderLatestNotes(headerEl, listEl){
  const notes = await sbLoadReleaseNotes();
  const latest = notes.find(n => Number(n.version) <= Number(APP_VERSION));
  if(!latest || !listEl) return;
  if(headerEl) headerEl.textContent = t("settings.changelogHeader", { ver: latest.version });
  listEl.innerHTML = sbNoteItems(latest).map(x => `<li>${escapeHtml(x)}</li>`).join("");
}
window.sbRenderLatestNotes = sbRenderLatestNotes;

(function initWhatsNew(){
  if(typeof APP_VERSION === "undefined") return;
  const page = location.pathname.split("/").pop() || "index.html";
  if(!["summary.html", "currency.html", "settings.html", "events.html", "recurring.html", "recap.html"].includes(page)) return;
  let seen = null;
  try { seen = localStorage.getItem(SB_SEEN_VERSION_KEY); } catch(e){ return; }
  if(seen === APP_VERSION) return;
  const markSeen = () => { try { localStorage.setItem(SB_SEEN_VERSION_KEY, APP_VERSION); } catch(e){} };

  const busy = () => document.visibilityState !== "visible"
    || document.querySelector(".calc-modal.show, .calc-modal.open, .sb-record-overlay, .sb-sheet-backdrop, .sb-moment");

  function show(notes){
    const modal = document.createElement("div");
    modal.className = "calc-modal sb-whatsnew-modal";
    modal.id = "sbWhatsNewModal";
    modal.innerHTML = `<div class="calc-card card sb-whatsnew-card" role="dialog" aria-modal="true" aria-labelledby="sbWhatsNewTitle">
      <div class="calc-header">
        <span class="calc-header-name" id="sbWhatsNewTitle">${escapeHtml(t("shared.whatsNewTitle"))}</span>
        <button type="button" class="calc-close" id="sbWhatsNewClose" aria-label="${escapeHtml(t("common.close"))}">✕</button>
      </div>
      ${notes.map(n => `<section class="sb-whatsnew-sec">
        <p class="sb-whatsnew-ver">v${escapeHtml(n.version)}${n.date ? "・" + escapeHtml(n.date) : ""}</p>
        <ul>${sbNoteItems(n).map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
      </section>`).join("")}
      <div class="sbf-actions"><button type="button" class="sbf-primary sbf-wide" id="sbWhatsNewOk">${escapeHtml(t("shared.whatsNewOk"))}</button></div>
    </div>`;
    document.body.appendChild(modal);
    const close = () => { modal.classList.remove("show"); setTimeout(() => modal.remove(), 250); };
    modal.querySelector("#sbWhatsNewClose").addEventListener("click", close);
    modal.querySelector("#sbWhatsNewOk").addEventListener("click", close);
    modal.classList.add("show");
    markSeen();
    modal.querySelector("#sbWhatsNewOk").focus({ preventScroll: true });
  }

  window.addEventListener("load", () => setTimeout(async () => {
    const notes = (await sbLoadReleaseNotes()).filter(n => Number(n.version) <= Number(APP_VERSION));
    const fresh = seen == null ? notes.slice(0, 1) : notes.filter(n => Number(n.version) > Number(seen));
    if(!fresh.length){ markSeen(); return; }
    let tries = 0;
    (function attempt(){
      if(!busy()) return show(fresh);
      if(++tries < 60) setTimeout(attempt, 1000);   // 最多等一分鐘，等不到就下次打開再說
    })();
  }, 1200));
})();

// App 裡按「下載 APK」：App 的 WebView 不會處理下載，交給 Chrome（Browser 外掛開 Custom Tab）去下載。
// 一般瀏覽器照連結本身的 download 屬性下載，不用管。
document.addEventListener("click", e => {
  const a = e.target.closest && e.target.closest('a[href$=".apk"], a[href*=".apk?"]');
  if(!a) return;
  const cap = window.Capacitor;
  if(!(cap && cap.isNativePlatform && cap.isNativePlatform())) return;
  e.preventDefault();
  const url = new URL(a.getAttribute("href"), location.href).href;
  const browser = cap.Plugins && cap.Plugins.Browser;
  if(browser && browser.open) browser.open({ url }).catch(() => { location.href = url; });
  else window.open(url, "_blank");
});

// ============================================================
// 手機底部視窗往下拖就關（2026-11）
// 只有從底部滑上來的那幾種（不含確認框、重設密碼、看大圖、裁頭貼；快速記帳、
// 成員資料有自己的拖曳）。視窗內容已經捲到最上面、手指往下拉才算拖曳，
// 不會跟捲動內容搶。拖超過 110px（或快速往下甩）就關；打過字的話照樣先問，
// 選了不關就彈回原位。
// ============================================================
(function initSheetSwipe(){
  const mq = window.matchMedia("(max-width: 767px)");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const EXCLUDE = ".sb-bottom-sheet, .sb-dialog-modal, #recoveryModal, #receiptLightboxModal, #avatarCropModal";
  const isSheet = m => m && m.classList.contains("calc-modal") && !m.matches(EXCLUDE);

  // 標記可拖的視窗，CSS 用它畫頂端的小橫條
  function mark(){
    document.querySelectorAll(".calc-modal").forEach(m => m.classList.toggle("sb-swipe-sheet", mq.matches && isSheet(m)));
  }
  new MutationObserver(mark).observe(document.body || document.documentElement, { childList: true });
  if(mq.addEventListener) mq.addEventListener("change", mark);
  document.addEventListener("DOMContentLoaded", mark);
  mark();

  let drag = null;
  document.addEventListener("touchstart", e => {
    if(!mq.matches || e.touches.length !== 1) return;
    const card = e.target.closest && e.target.closest(".calc-modal.sb-swipe-sheet.show > .calc-card");
    if(!card) return;
    if(e.target.closest("input[type=range], .no-swipe, canvas")) return;
    // 手指底下到卡片之間，任何一層捲動區（例如通知清單）還沒捲到頂，就是要捲內容不是要拖
    for(let el = e.target; el && el !== card.parentElement; el = el.parentElement){
      if(el.scrollTop > 0) return;
    }
    drag = { card, modal: card.parentElement, y0: e.touches[0].clientY, x0: e.touches[0].clientX, t0: Date.now(), dy: 0, active: false };
  }, { passive: true });

  document.addEventListener("touchmove", e => {
    if(!drag) return;
    const dy = e.touches[0].clientY - drag.y0;
    const dx = e.touches[0].clientX - drag.x0;
    if(!drag.active){
      // 內容還沒捲到頂、往上滑、或比較像左右滑：交給原本的捲動
      if(dy < -4 || (Math.abs(dx) > 8 && Math.abs(dx) > dy)){ drag = null; return; }
      if(dy < 8) return;
      drag.active = true;
      drag.card.style.transition = "none";
    }
    e.preventDefault();
    drag.dy = Math.max(0, dy);
    drag.card.style.transform = `translateY(${drag.dy}px)`;
  }, { passive: false });

  async function end(){
    if(!drag) return;
    const d = drag; drag = null;
    if(!d.active) return;
    const speed = d.dy / Math.max(1, Date.now() - d.t0);
    const ease = reduce.matches ? "none" : "transform .22s cubic-bezier(.16,1,.3,1)";
    if(d.dy > 110 || (d.dy > 60 && speed > 0.8)){
      d.card.style.transition = ease;
      d.card.style.transform = "translateY(100%)";
      const closed = window.sbModalRequestClose ? await window.sbModalRequestClose(d.modal) : false;
      if(closed){
        setTimeout(() => { d.card.style.transition = ""; d.card.style.transform = ""; }, 260);
        return;
      }
    }
    d.card.style.transition = ease;
    d.card.style.transform = "";
    setTimeout(() => { d.card.style.transition = ""; }, 240);
  }
  document.addEventListener("touchend", end);
  document.addEventListener("touchcancel", end);
})();

// ============================================================
// 電腦版左側選單（2026-11）：寬度 ≥ 1100px 時出現，取代上方「首頁／臺幣／日幣」
// 那排膠囊和首頁的「固定收支／活動」按鈕，一眼看到所有地方。手機、平板不出現，
// 照舊用底部導覽列和上方膠囊。幣別清單跟上方膠囊同一份（設定裡勾選顯示的幣別）。
// ============================================================
(function initSideNav(){
  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  const params = new URLSearchParams(location.search);
  const here = page === "summary.html" ? "home"
    : page === "currency.html" ? "cur:" + (params.get("c") || "TWD")
    : page === "settings.html" ? "settings"
    : page === "recurring.html" ? "recurring"
    : page === "events.html" ? "events" : null;
  if(!here) return;

  // 頭像、名字、群組切換：有這組的頁面（首頁、幣別、設定）在電腦版把它整組搬進選單，
  // 縮回平板／手機寬度時搬回原位（搬的是同一組元素，群組切換照常能用）。
  // 固定收支、活動頁沒有這組，就用上次在別頁看到的頭像、名字、群組畫一份靜態的。
  const PROFILE_KEY = "splitbill-side-profile";
  const desktop = window.matchMedia("(min-width: 1100px)");
  function saveProfile(){
    const av = document.getElementById("whoamiAvatar");
    const name = document.getElementById("whoamiName");
    if(!av || !name || !name.textContent.trim()) return;
    const grp = document.querySelector("#whoamiWrap .whoami-group-switcher .dd-btn-text");
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ avatar: av.innerHTML, name: name.textContent.trim(), group: grp ? grp.textContent.trim() : "" })); } catch(e){}
  }
  // 把頁面上的一組元素在電腦版搬進選單、縮窄時搬回原位（搬的是同一組元素，事件照常）
  function dock(el, slot){
    if(!el || !slot) return;
    const home = document.createComment("sb-dock");
    el.parentNode.insertBefore(home, el);
    const move = () => { if(desktop.matches){ if(el.parentNode !== slot) slot.appendChild(el); } else if(home.parentNode && el.parentNode === slot){ home.parentNode.insertBefore(el, home.nextSibling); } };
    move();
    if(desktop.addEventListener) desktop.addEventListener("change", move);
  }
  function placeProfile(slot){
    const who = document.getElementById("whoamiWrap");
    if(!who){
      let p = null;
      try { p = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); } catch(e){}
      if(p) slot.innerHTML = `<a class="sb-side-me" href="settings.html"><span class="sb-side-me-av">${p.avatar}</span><span class="sb-side-me-text"><b>${escapeHtml(p.name)}</b>${p.group ? `<small>${escapeHtml(p.group)}</small>` : ""}</span></a>`;
      return;
    }
    dock(who, slot);
    new MutationObserver(saveProfile).observe(who, { childList: true, subtree: true, characterData: true });
    saveProfile();
  }

  // 每個幣別旁邊顯示「我在這個幣別」的淨額：別人欠我是綠色 +，我欠別人是紅色 −，結清就不顯示。
  // 跟「我的款項」用同一支 member_balances；記帳、還款後畫面上的款項一變就重新抓一次。
  async function loadSideBalances(nav){
    const me = window.myMember;
    if(!window.sb || !me) return;
    // 頁面剛查過（5 秒內）就直接用，不再多打一次資料庫
    let rows = window.__sbBalRows && Date.now() - window.__sbBalRows.at < 5000 ? window.__sbBalRows.rows : null;
    if(!rows){
      try { const { data, error } = await window.sb.rpc("member_balances", { p_since: null }); if(!error){ rows = data || []; window.__sbBalRows = { at: Date.now(), rows }; } } catch(e){}
    }
    if(!rows) return;
    nav.querySelectorAll(".sb-side-bal").forEach(el => {
      const code = el.dataset.bal;
      const row = rows.find(r => r.member_id === me.id && r.currency === code);
      const v = row ? Number(row.balance) : 0;
      const c = (typeof CURRENCIES !== "undefined" ? CURRENCIES : []).find(x => x.code === code);
      const tiny = Math.abs(v) < (c && c.decimals === 0 ? 0.5 : 0.005);
      el.textContent = tiny ? "" : (v > 0 ? "+" : "−") + (c ? c.symbol : "") + (typeof formatAmt === "function" ? formatAmt(Math.abs(v)) : Math.abs(v).toFixed(0));
      el.classList.toggle("is-pos", !tiny && v > 0);
      el.classList.toggle("is-neg", !tiny && v < 0);
    });
  }
  function watchSideBalances(nav){
    let timer = null;
    const later = (ms) => { clearTimeout(timer); timer = setTimeout(() => loadSideBalances(nav), ms); };
    // 等登入、成員資料好了再抓
    let tries = 0;
    (function wait(){ if(window.myMember && window.sb) loadSideBalances(nav); else if(++tries < 40) setTimeout(wait, 500); })();
    ["myBalanceAmt", "myAmtList"].forEach(id => {
      const el = document.getElementById(id);
      if(el) new MutationObserver(() => later(800)).observe(el, { childList: true, subtree: true, characterData: true });
    });
    document.addEventListener("visibilitychange", () => { if(document.visibilityState === "visible") later(300); });
  }

  function build(){
    if(document.querySelector(".sb-side-nav") || typeof sbIcon !== "function") return;
    let shown = ["TWD"];
    try { shown = JSON.parse(localStorage.getItem("splitbill-shown-currencies") || "null") || ["TWD"]; } catch(e){}
    const curCode = here.startsWith("cur:") ? here.slice(4) : null;
    const list = (typeof CURRENCIES !== "undefined" ? CURRENCIES : []).filter(c => shown.includes(c.code) || c.code === curCode);
    const link = (href, key, iconHtml, label, extra) =>
      `<a href="${href}" title="${escapeHtml(label)}" data-key="${key}"${key === here ? ' class="is-current" aria-current="page"' : ""}><span class="sb-side-ico">${iconHtml}</span><span class="sb-side-text">${escapeHtml(label)}</span>${extra || ""}</a>`;
    // 幣別頁：目前幣別底下列出「總表、支出、還款、紀錄」（電腦版取代頁面上那排分頁）
    const subTabs = curCode ? Array.from(document.querySelectorAll("#mainAppTabs .app-tab")) : [];
    const subHTML = subTabs.length ? `<div class="sb-side-sub">${subTabs.map((tab, i) => `<button type="button" data-tab="${tab.dataset.tab}" title="${escapeHtml(tab.dataset.i18n ? t(tab.dataset.i18n) : tab.textContent.trim())}"><span>${escapeHtml(tab.dataset.i18n ? t(tab.dataset.i18n) : tab.textContent.trim())}</span><kbd>${i + 1}</kbd></button>`).join("")}</div>` : "";
    const nav = document.createElement("nav");
    nav.className = "sb-side-nav";
    nav.setAttribute("aria-label", t("nav.mainLabel"));
    nav.innerHTML = `
      <a class="sb-side-brand" href="summary.html">
        <svg class="app-logo" viewBox="0 0 512 512" aria-hidden="true"><path class="s1" d="M256,238 L118.5,138.1 A170,170 0 0,1 393.5,138.1 Z"/><path class="s2" d="M271.6,265 L426.9,195.9 A170,170 0 0,1 289.4,434.1 Z"/><path class="s3" d="M240.4,265 L222.6,434.1 A170,170 0 0,1 85.1,195.9 Z"/></svg>
        <span>Splitbill</span>
      </a>
      <button type="button" class="sb-side-quick" title="${escapeHtml(t("summary.quickExpFabText"))} (N)"><span class="sb-side-ico">${sbIcon("plus")}</span><span class="sb-side-text">${escapeHtml(t("summary.quickExpFabText"))}</span><kbd>N</kbd></button>
      ${link("summary.html", "home", sbIcon("grid"), t("common.overview"), "<kbd>H</kbd>")}
      <p class="sb-side-label">${escapeHtml(t("nav.currencies"))}</p>
      ${list.map(c => link("currency.html?c=" + encodeURIComponent(c.code), "cur:" + c.code,
          (typeof currencyFlagImgHTML === "function" && currencyFlagImgHTML(c.code)) || sbIcon("globe"), c.label, `<span class="sb-side-bal" data-bal="${c.code}"></span>`) + (c.code === curCode ? subHTML : "")).join("")}
      <p class="sb-side-label">${escapeHtml(t("nav.tools"))}</p>
      ${link("recurring.html", "recurring", sbIcon("repeat"), t("recurring.title"))}
      ${link("events.html", "events", sbIcon("calendar"), t("events.title"))}
      ${typeof recapYearFor === "function" && recapYearFor(new Date()) ? link("recap.html", "recap", sbIcon("sparkle"), t("nav.recap")) : ""}
      <div class="sb-side-profile"><div class="sb-side-profile-me"></div></div>
      <button type="button" class="sb-side-notif" hidden><span class="sb-side-ico">${sbIcon("bell")}</span><span class="sb-side-text">${escapeHtml(t("shared.notifLabel"))}</span><span class="sb-side-badge" hidden></span></button>
      <div class="sb-side-foot">
        ${link("settings.html", "settings", sbIcon("gear"), t("common.settings"))}
        <button type="button" class="sb-theme-btn sb-side-theme" title="${escapeHtml(t("shared.themeToggleAria"))}" aria-label="${escapeHtml(t("shared.themeToggleAria"))}"><span class="sb-ico" style="--ico:var(--ico-${document.documentElement.getAttribute("data-theme") === "dark" ? "sun" : "moon"})" aria-hidden="true"></span></button>
      </div>
      <button type="button" class="sb-side-logout"><span class="sb-side-ico"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg></span><span class="sb-side-text">${escapeHtml(t("common.logout"))}</span></button>
      <button type="button" class="sb-side-keys">${escapeHtml(t("shortcuts.title"))} <kbd>?</kbd></button>`;
    document.body.appendChild(nav);
    document.body.classList.add("has-side-nav");
    placeProfile(nav.querySelector(".sb-side-profile-me"));
    nav.querySelector(".sb-side-quick").addEventListener("click", sbStartQuickExpense);
    nav.querySelector(".sb-side-keys").addEventListener("click", () => window.sbShowShortcuts && window.sbShowShortcuts());
    // 幣別分頁子項目：點了等於點頁面上的分頁；目前在哪一頁跟著反白
    if(subTabs.length){
      const syncSub = () => {
        const active = document.querySelector("#mainAppTabs .app-tab.active");
        nav.querySelectorAll(".sb-side-sub button").forEach(b => {
          const on = !!active && b.dataset.tab === active.dataset.tab;
          b.classList.toggle("is-current", on);
          if(on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
        });
      };
      nav.querySelector(".sb-side-sub").addEventListener("click", e => {
        const b = e.target.closest("button[data-tab]");
        const tab = b && document.querySelector(`#mainAppTabs .app-tab[data-tab="${b.dataset.tab}"]`);
        if(!tab) return;
        tab.click();
        window.scrollTo({ top: 0, behavior: "auto" });
      });
      subTabs.forEach(tab => new MutationObserver(syncSub).observe(tab, { attributes: true, attributeFilter: ["class"] }));
      syncSub();
    }
    watchSideBalances(nav);
    // 通知：設定上面獨立一列，點了打開跟鈴鐺同一個通知視窗；未讀數字照抄鈴鐺上的。
    // 鈴鐺是登入後才裝上去的，所以等它出現再接上；電腦版頁首的鈴鐺由 CSS 藏起來。
    const notifRow = nav.querySelector(".sb-side-notif");
    const bellHost = document.getElementById("notificationBellContainer");
    if(bellHost){
      const hook = () => {
        const bell = document.getElementById("notifBellBtn");
        const src = document.getElementById("notifBadge");
        if(!bell || notifRow.dataset.ready) return;
        notifRow.dataset.ready = "1";
        notifRow.hidden = false;
        notifRow.addEventListener("click", e => { e.stopPropagation(); bell.click(); });
        const badge = notifRow.querySelector(".sb-side-badge");
        const sync = () => { badge.textContent = src ? src.textContent : ""; badge.hidden = !src || src.classList.contains("hidden") || !src.textContent.trim(); };
        if(src) new MutationObserver(sync).observe(src, { attributes: true, childList: true, characterData: true, subtree: true });
        sync();
      };
      hook();
      if(!notifRow.dataset.ready) new MutationObserver((m, obs) => { hook(); if(notifRow.dataset.ready) obs.disconnect(); }).observe(bellHost, { childList: true, subtree: true });
    }
    nav.querySelector(".sb-side-logout").addEventListener("click", async () => {
      const own = document.getElementById("logoutBtn");
      if(own){ own.click(); return; }
      try { localStorage.removeItem(LOGIN_TIME_KEY); } catch(e){}
      try { if(window.sb) await window.sb.auth.signOut(); } catch(e){}
      location.href = "index.html";
    });
    // 首頁上「活動」捷徑的未看數字，選單上也顯示一份
    const src = document.getElementById("homeEventsBadge");
    const evLink = nav.querySelector('a[href="events.html"]');
    if(src && evLink){
      const badge = document.createElement("span");
      badge.className = "sb-side-badge";
      evLink.appendChild(badge);
      const sync = () => { badge.textContent = src.textContent; badge.hidden = src.classList.contains("hidden") || !src.textContent.trim(); };
      new MutationObserver(sync).observe(src, { attributes: true, childList: true, characterData: true, subtree: true });
      sync();
    }
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();

// ============================================================
// 記一筆：首頁開快速記帳視窗、幣別頁切到「支出」表單，其他頁回首頁直接打開快速記帳。
// 側邊選單的「記一筆」和鍵盤 N 都用這個。
// ============================================================
function sbStartQuickExpense(){
  const quick = document.getElementById("openQuickExpenseBtn");
  if(quick){ quick.click(); return; }
  const fab = document.getElementById("currencyAddExpenseFab");
  if(fab){ fab.click(); return; }
  location.href = "summary.html?quick=1";
}
window.sbStartQuickExpense = sbStartQuickExpense;

// ============================================================
// 鍵盤快捷鍵（電腦）：N 記一筆、H 回首頁、幣別頁 1–4 切分頁、/ 搜尋紀錄、? 看說明。
// 正在打字、按著 Ctrl/⌘/Alt、或有彈窗開著的時候不作用（? 除外的都是）。
// ============================================================
(function initShortcuts(){
  const page = (location.pathname.split("/").pop() || "").toLowerCase();
  if(!["summary.html", "currency.html", "settings.html", "recurring.html", "events.html"].includes(page)) return;
  const typing = el => el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName));

  function showHelp(){
    let m = document.getElementById("sbKeysModal");
    if(!m){
      const row = (keys, label) => `<li><span>${keys.map(k => `<kbd>${escapeHtml(k)}</kbd>`).join(" ")}</span><span>${escapeHtml(label)}</span></li>`;
      m = document.createElement("div");
      m.className = "calc-modal sb-keys-modal";
      m.id = "sbKeysModal";
      m.innerHTML = `<div class="calc-card card sb-keys-card" role="dialog" aria-modal="true" aria-labelledby="sbKeysTitle">
        <div class="calc-header"><span class="calc-header-name" id="sbKeysTitle">${escapeHtml(t("shortcuts.title"))}</span><button type="button" class="calc-close" id="sbKeysCloseBtn" aria-label="${escapeHtml(t("common.close"))}">✕</button></div>
        <ul class="sb-keys-list">
          ${row(["N"], t("shortcuts.quick"))}
          ${row(["H"], t("shortcuts.home"))}
          ${row(["1", "2", "3", "4"], t("shortcuts.tabs"))}
          ${row(["/"], t("shortcuts.search"))}
          ${row(["Esc"], t("shortcuts.close"))}
          ${row(["?"], t("shortcuts.help"))}
        </ul>
      </div>`;
      document.body.appendChild(m);
      m.querySelector("#sbKeysCloseBtn").addEventListener("click", () => m.classList.remove("show"));
    }
    m.classList.add("show");
  }
  window.sbShowShortcuts = showHelp;

  document.addEventListener("keydown", e => {
    if(e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented || typing(e.target)) return;
    if(e.key === "?"){ e.preventDefault(); showHelp(); return; }
    if(document.querySelector(".calc-modal.show, .calc-modal.open")) return;
    const k = e.key.toLowerCase();
    if(k === "n"){ e.preventDefault(); sbStartQuickExpense(); return; }
    if(k === "h"){ if(page !== "summary.html"){ e.preventDefault(); location.href = "summary.html"; } return; }
    if(page === "currency.html" && /^[1-4]$/.test(e.key)){
      const tab = document.querySelectorAll("#mainAppTabs .app-tab")[Number(e.key) - 1];
      if(tab){ e.preventDefault(); tab.click(); window.scrollTo({ top: 0, behavior: "auto" }); }
      return;
    }
    if(e.key === "/" && page === "currency.html"){
      const hist = document.querySelector('#mainAppTabs .app-tab[data-tab="history"]');
      const inp = document.getElementById("historyLiveSearch");
      if(hist && inp){
        e.preventDefault();
        if(!hist.classList.contains("active")) hist.click();
        setTimeout(() => { inp.focus(); inp.select(); }, 60);
      }
    }
  });
})();

// ============================================================
// 派派：太久沒還錢就開始情勒的吉祥物（2026-11）
//
// 欠款天數 = 你欠某人的錢「從哪天開始一直沒還清」（buildDebtMatrix 記的 __since），
// 跟欠款表是同一套計算。取最久的那筆，依天數分四級：
//   14 天開始出現 → 30 天 → 60 天 出現裂痕 → 90 天 裂開掉一片（表情跟著當天那句台詞）
// 台詞每天換一句。「明天再說」：今天先不出現，但隔天會記仇；拖越多次越酸。
// 沒有欠人、只有別人欠你很久（30 天以上）時，派派問要不要幫你催——按了才會去，不會自動催。
// ============================================================
const SB_NAG_LEVELS = [14, 30, 60, 90];
function sbNagLevel(days){ let lv = 0; SB_NAG_LEVELS.forEach((d, i) => { if(days >= d) lv = i + 1; }); return lv; }
// 嚴重程度 = 天數 × 金額權重。金額先換成台幣，NT$1,000 權重 1（門檻就是 14／30／60／90 天）；
// 越多越快升級（最多 2 倍：NT$4,000 以上 7 天就出現），越少越慢（最少 0.5 倍：NT$250 以下要 28 天）。
function sbNagWeight(amount, currency){
  const twd = typeof convertToTWD === "function" ? Number(convertToTWD(amount, currency)) || amount : amount;
  return Math.min(2, Math.max(0.5, Math.sqrt(Math.max(0, twd) / 1000)));
}

// 一整顆派長出臉。level 決定派本身（3 = 出現裂痕、4 = 裂開掉一片），mood 決定表情（跟著台詞走）。
// 線條類的五官都是「白線＋深色描邊」，淺色、深色模式的派上都看得清楚。
const SB_PIE_MOODS = ["smile", "sweet", "sideeye", "stare", "smirk", "angry", "furious", "shock", "cry", "sob", "sinister", "dead", "joy"];
function sbPieMascotSVG(level, mood){
  if(!SB_PIE_MOODS.includes(mood)) mood = ["smile", "smile", "sideeye", "cry", "dead"][Math.min(4, Math.max(0, level))];
  const top = '<path d="M32 33 L9.48 20 A26 26 0 0 1 54.52 20 Z" fill="var(--logo-3)"/>';
  const right = '<path d="M32 33 L54.52 20 A26 26 0 0 1 32 59 Z" fill="var(--logo-2)"/>';
  const leftPath = '<path d="M32 33 L32 59 A26 26 0 0 1 9.48 20 Z" fill="var(--logo-1)"/>';
  const left = level >= 4 ? '<g class="sb-pie-fallen" transform="translate(-5 4) rotate(-12 20 40)">' + leftPath + '</g>' : leftPath;
  const seams = level >= 4 ? '<path d="M32 33 L54.52 20"/>'
    : level >= 3 ? '<path d="M32 33 L9.48 20 M32 33 L54.52 20"/>'
    : '<path d="M32 33 L9.48 20 M32 33 L54.52 20 M32 33 L32 59"/>';
  const crack = level === 3 ? '<path class="sb-pie-crack" d="M32 33 L31 41 L33 47 L31 53 L32 59"/>' : "";

  // ---- 零件 ----
  const ln = d => '<path class="sb-pie-mouth-o" d="' + d + '"/><path class="sb-pie-mouth" d="' + d + '"/>';
  const eyeRound = (cx, dx, dy, r, pr) => '<circle class="sb-pie-white" cx="' + cx + '" cy="31" r="' + (r || 4.6) + '"/><circle class="sb-pie-ink" cx="' + (cx + (dx || 0)) + '" cy="' + (31 + (dy || 0)) + '" r="' + (pr || 2.4) + '"/>';
  const eyesRound = (dx, dy, r, pr) => eyeRound(24, dx, dy, r, pr) + eyeRound(40, dx, dy, r, pr);
  // 半閉眼：只畫下半個眼白，上面一條眼皮線
  const eyeHalf = (cx, dx) => '<path class="sb-pie-white" d="M' + (cx - 4.6) + ' 30.5 A4.6 4.6 0 0 0 ' + (cx + 4.6) + ' 30.5 Z"/><circle class="sb-pie-ink" cx="' + (cx + dx) + '" cy="32.6" r="2"/>' + ln("M" + (cx - 5) + " 30.5 L" + (cx + 5) + " 30.5");
  const eyesHalf = dx => eyeHalf(24, dx) + eyeHalf(40, dx);
  const eyesDots = '<circle class="sb-pie-ink sb-pie-ring" cx="24" cy="31" r="2.2"/><circle class="sb-pie-ink sb-pie-ring" cx="40" cy="31" r="2.2"/>';
  const eyesHappy = ln("M20 32 Q24 27 28 32 M36 32 Q40 27 44 32");
  const eyesSadClosed = ln("M20 30 Q24 34 28 30 M36 30 Q40 34 44 30");
  const eyesX = ln("M20.5 27.5 l7 7 m0 -7 l-7 7 M36.5 27.5 l7 7 m0 -7 l-7 7");
  const browsAngry = '<path class="sb-pie-brow" d="M18 23.5 L28.5 27.5 M46 23.5 L35.5 27.5"/>';
  const browsSad = '<path class="sb-pie-brow" d="M18 27.5 L28 24.5 M46 27.5 L36 24.5"/>';
  const vein = '<path class="sb-pie-vein" d="M46 15 l2 3 l3 -1 m-3 1 l-1 3 m1 -3 l3 2"/>';
  const cheeks = '<ellipse class="sb-pie-cheek" cx="18.5" cy="38" rx="3.4" ry="2"/><ellipse class="sb-pie-cheek" cx="45.5" cy="38" rx="3.4" ry="2"/>';
  const blush = '<ellipse class="sb-pie-blush" cx="18.5" cy="37.5" rx="3.2" ry="1.8"/><ellipse class="sb-pie-blush" cx="45.5" cy="37.5" rx="3.2" ry="1.8"/>';
  const tear = '<path class="sb-pie-tear" d="M21.5 36.5 q-2.4 4.6 0 5.8 q2.4 -1.2 0 -5.8"/>';
  const streams = '<path class="sb-pie-tear" d="M21 33 q-1.6 8 0.4 16 l2.6 0 q-1.4 -8 0 -16 Z M43 33 q1.6 8 -0.4 16 l-2.6 0 q1.4 -8 0 -16 Z"/>';
  const sweat = '<path class="sb-pie-tear" d="M48.5 21 q-2.6 4.8 0 6.2 q2.6 -1.4 0 -6.2"/>';
  const mouthO = (rx, ry) => '<ellipse class="sb-pie-ink sb-pie-ring" cx="32" cy="43" rx="' + rx + '" ry="' + ry + '"/>';
  const grit = '<rect class="sb-pie-white" x="24.5" y="39" width="15" height="6.4" rx="2"/><path class="sb-pie-teeth" d="M29.5 39 V45.4 M34.5 39 V45.4 M24.5 42.2 H39.5"/>';
  const grin = '<path class="sb-pie-white" d="M22.5 38 Q32 49 41.5 38 Z"/><path class="sb-pie-teeth" d="M27 38.6 V42.6 M32 38.6 V44.4 M37 38.6 V42.6"/>';

  const faces = {
    smile:    eyesRound(0, 0.6) + ln("M25 40 Q32 46 39 40"),
    sweet:    eyesHappy + blush + ln("M25 40 Q32 46 39 40"),
    sideeye:  eyesHalf(2.3) + ln("M26.5 42 L37.5 42"),
    stare:    eyesDots + ln("M27 42 L37 42"),
    smirk:    eyesHalf(0) + ln("M26 42.5 Q33 44 39 39"),
    angry:    browsAngry + eyesRound(0, 1.2) + vein + ln("M25 45 Q32 39.5 39 45"),
    furious:  browsAngry + eyesRound(0, 0.8, 4.6, 1.6) + vein + cheeks + grit,
    shock:    eyesRound(0, 0, 5.6, 1.5) + sweat + mouthO(3.4, 4),
    cry:      browsSad + eyesRound(0, 1.4) + tear + ln("M25 45 Q32 39 39 45"),
    sob:      browsSad + eyesSadClosed + streams + ln("M24 44 q2 -2 4 0 t4 0 t4 0 t4 0"),
    sinister: browsAngry + eyesHappy + grin,
    dead:     eyesX + mouthO(4.4, 3.4),
    joy:      eyesHappy + blush + '<path class="sb-pie-white" d="M23.5 38 Q32 49 40.5 38 Z"/>' + '<path class="sb-pie-spark" d="M11 14 l1.4 3 l3 1.4 l-3 1.4 l-1.4 3 l-1.4 -3 l-3 -1.4 l3 -1.4 Z M53 10 l1 2.2 l2.2 1 l-2.2 1 l-1 2.2 l-1 -2.2 l-2.2 -1 l2.2 -1 Z"/>'
  };
  return '<svg class="sb-pie lv-' + level + ' mood-' + mood + '" viewBox="0 0 64 64" aria-hidden="true">' + top + right + left
    + '<g class="sb-pie-seam">' + seams + '</g>' + crack + faces[mood] + '</svg>';
}
window.sbPieMascotSVG = sbPieMascotSVG;

// 每一句台詞配的表情（各語言共用）
const SB_NAG_MOOD = {
  "nag.l1_1": "sweet",    "nag.l1_2": "stare",   "nag.l1_3": "smile",   "nag.l1_4": "sideeye", "nag.l1_5": "smirk",   "nag.l1_6": "sweet",
  "nag.l2_1": "stare",    "nag.l2_2": "smirk",   "nag.l2_3": "angry",   "nag.l2_4": "sideeye", "nag.l2_5": "cry",     "nag.l2_6": "angry",
  "nag.l3_1": "sinister", "nag.l3_2": "angry",   "nag.l3_3": "cry",     "nag.l3_4": "furious", "nag.l3_5": "stare",   "nag.l3_6": "smirk",
  "nag.l4_1": "dead",     "nag.l4_2": "shock",   "nag.l4_3": "stare",   "nag.l4_4": "sob",     "nag.l4_5": "sinister","nag.l4_6": "furious",
  "nag.snoozedOnce": "angry", "nag.snoozedAgain": "smirk", "nag.snoozedMany": "furious",
  "nag.creditor1": "sinister", "nag.creditor2": "angry", "nag.creditor3": "smirk", "nag.creditor4": "sinister",
  "nag.roast1": "smirk", "nag.roast2": "sideeye", "nag.roast3": "stare", "nag.roast4": "angry",
  "nag.peek1": "stare", "nag.peek2": "sideeye", "nag.peek3": "smirk",
  "nag.yay1": "joy", "nag.yay2": "joy", "nag.yay3": "joy", "nag.yayOwed1": "joy", "nag.yayOwed2": "joy"
};

// 使用者自己選的派派模式：off 關閉／gentle 溫和／normal 正常（預設）。只存在這台裝置。
function sbNagMode(){
  try { const m = localStorage.getItem("sb-nag-mode"); return m === "off" || m === "gentle" ? m : "normal"; } catch(e){ return "normal"; }
}
window.sbNagMode = sbNagMode;
// 溫和模式只用這些表情的台詞，派也不會裂開
const SB_NAG_GENTLE_MOODS = ["smile", "sweet", "stare", "sideeye", "smirk"];
const sbNagStore = {
  get(k, d){ try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch(e){ return d; } },
  set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
};
const sbNagToday = () => sbIsoDay(new Date());
const sbNagDayNum = iso => Math.round(Date.parse(iso + "T00:00:00Z") / 86400000);

// 我跟每個人之間、每個幣別的欠款，各自從哪天開始欠、加權後多嚴重。expenses / repayments 可以是多個幣別。
function sbNagItems(myId, expenses, repayments){
  if(!myId || typeof buildDebtMatrix !== "function") return [];
  const today = sbNagToday();
  const byCur = {};
  (expenses || []).forEach(e => { const c = e.currency || "TWD"; (byCur[c] || (byCur[c] = { e: [], r: [] })).e.push(e); });
  (repayments || []).forEach(r => { const c = r.currency || "TWD"; (byCur[c] || (byCur[c] = { e: [], r: [] })).r.push(r); });
  const items = [];
  Object.keys(byCur).forEach(code => {
    const owed = buildDebtMatrix(byCur[code].e, byCur[code].r);
    const since = owed.__since || {};
    const meta = (typeof CURRENCIES !== "undefined" ? CURRENCIES : []).find(c => c.code === code);
    const tiny = meta && meta.decimals === 0 ? 0.5 : 0.01;
    Object.keys(owed).forEach(creditor => Object.keys(owed[creditor]).forEach(debtor => {
      if(creditor !== myId && debtor !== myId) return;
      const net = (owed[creditor][debtor] || 0) - ((owed[debtor] && owed[debtor][creditor]) || 0);
      if(net <= tiny) return;
      const from = since[creditor] && since[creditor][debtor];
      if(!from) return;
      const days = sbNagDayNum(today) - sbNagDayNum(from);
      items.push({ key: code + "-" + creditor + "-" + debtor, currency: code, creditor, debtor, amount: net, since: from, days,
        score: days * sbNagWeight(net, code), iOwe: debtor === myId });
    }));
  });
  return items;
}
window.sbNagItems = sbNagItems;

// 挑今天要講的那一筆：先看你欠人的；沒有才看別人欠你的（同一個人一週最多問一次「要不要幫你催」）
function sbNagFind(myId, expenses, repayments, items){
  items = items || sbNagItems(myId, expenses, repayments);
  const today = sbNagToday();
  const snoozed = it => { const s = sbNagStore.get("sb-nag-" + it.key, null); return s && s.until > today; };
  const askedThisWeek = it => { const d = sbNagStore.get("sb-nag-asked-" + it.key, null); return d && sbNagDayNum(today) - sbNagDayNum(d) < 7; };
  const pick = list => list.filter(it => !snoozed(it)).sort((a, b) => b.score - a.score)[0] || null;
  return pick(items.filter(it => it.iOwe && it.score >= SB_NAG_LEVELS[0]))
    || pick(items.filter(it => !it.iOwe && it.score >= SB_NAG_LEVELS[1] && !askedThisWeek(it)));
}
window.sbNagFind = sbNagFind;

// 從今天輪替的台詞裡挑一句；溫和模式只挑客氣表情的那幾句
function sbNagPickKey(prefixes, gentle){
  const all = [];
  prefixes.forEach(prefix => { for(let i = 1; i <= 9; i++){ const k = prefix + i; if(t(k) !== k && (!gentle || SB_NAG_GENTLE_MOODS.includes(SB_NAG_MOOD[k]))) all.push(k); } });
  return all.length ? all[Math.round(Date.now() / 86400000) % all.length] : null;
}

function sbNagMoney(amount, currency){
  const meta = (typeof CURRENCIES !== "undefined" ? CURRENCIES : []).find(c => c.code === currency);
  return (meta ? meta.symbol : currency + " ") + (typeof formatAmt === "function" ? formatAmt(amount) : Math.round(amount));
}

// 標題旁的 logo：派派有話要說時變成帶表情的派派，點了展開那張卡片；沒事時恢復成一般 logo
function sbNagSetLogo(level, mood, onClick){
  const row = document.querySelector(".app-header .title-row");
  const logo = row && row.querySelector(".app-logo");
  if(!row || !logo) return;
  let btn = row.querySelector(".sb-title-pie");
  if(level == null){ row.classList.remove("has-pie"); if(btn) btn.remove(); return; }
  if(!btn){
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sb-title-pie";
    logo.parentNode.insertBefore(btn, logo);
  }
  const size = Math.round(logo.getBoundingClientRect().width) || 32;
  btn.style.width = btn.style.height = (size + 8) + "px";
  btn.setAttribute("aria-label", t("nag.logoAria"));
  btn.title = t("nag.logoAria");
  btn.innerHTML = sbPieMascotSVG(level, mood);
  btn.onclick = onClick;
  row.classList.add("has-pie");
}

// 把派派畫進 el。opts：{ myId, expenses, repayments, nameOf(id), onPay(item), onNudge(item),
//   surface（"home" 或 "cur:TWD"，一天各自只完整出現一次）, scope（幣別頁傳 "TWD"；首頁不傳＝全部幣別）, expand }
function sbRenderNag(el, opts){
  if(!el) return;
  const mode = sbNagMode();
  const clear = () => { el.innerHTML = ""; el.hidden = true; };
  if(mode === "off"){ clear(); sbNagSetLogo(null); window.__sbNagCurrent = null; window.__sbNagItems = []; return; }
  const gentle = mode === "gentle";
  const today = sbNagToday();
  const items = sbNagItems(opts.myId, opts.expenses, opts.repayments);
  window.__sbNagItems = items;

  // ---- 還清了：派派唸過的那筆不見了，就開心一次 ----
  // 只檢查這次資料涵蓋的幣別（幣別頁只有自己那個幣別）；資料是空的（可能讀取失敗）就不判斷，免得誤報
  const tracked = sbNagStore.get("sb-nag-track", {});
  if((opts.expenses || []).length){
    const cleared = Object.keys(tracked).filter(k => {
      const tr = tracked[k];
      if(opts.scope && tr.currency !== opts.scope) return false;
      return !items.some(it => it.key === k && it.since === tr.since);
    });
    if(cleared.length){
      const tr = tracked[cleared[0]];
      cleared.forEach(k => { delete tracked[k]; try { localStorage.removeItem("sb-nag-" + k); } catch(e){} });
      sbNagStore.set("sb-nag-track", tracked);
      const lineKey = sbNagPickKey([tr.iOwe ? "nag.yay" : "nag.yayOwed"], false);
      el.hidden = false;
      el.innerHTML = '<div class="card sb-nag is-yay" role="status">'
        + '<div class="sb-nag-pie">' + sbPieMascotSVG(0, "joy") + '</div>'
        + '<div class="sb-nag-body"><p class="sb-nag-line">' + escapeHtml(t(lineKey, { name: tr.name, amount: tr.amountText })) + '</p>'
        + '<div class="sb-nag-actions"><button type="button" class="sbf-primary sb-nag-ok">' + escapeHtml(t("nag.yayOk")) + '</button></div></div></div>';
      sbNagSetLogo(0, "joy", () => el.scrollIntoView({ behavior: "smooth", block: "center" }));
      el.querySelector(".sb-nag-ok").addEventListener("click", () => {
        el.querySelector(".sb-nag").classList.add("is-leaving");
        setTimeout(() => sbRenderNag(el, Object.assign({}, opts, { expand: false })), 220);
      });
      return;
    }
  }

  let it = sbNagFind(opts.myId, opts.expenses, opts.repayments, items);
  window.__sbNagCurrent = it && it.iOwe ? it : null;
  // 欠的錢都按了「明天再說」：今天不再跳出來，但還沒還，logo 維持派派（斜眼瞪你），點了再叫出來
  let held = false;
  if(!it){
    const owed = items.filter(x => x.iOwe && x.score >= SB_NAG_LEVELS[0]).sort((a, b) => b.score - a.score)[0];
    if(!owed){ clear(); sbNagSetLogo(null); return; }
    if(!opts.peekSnoozed){
      clear();
      const heldLevel = gentle ? Math.min(sbNagLevel(owed.score), 2) : sbNagLevel(owed.score);
      sbNagSetLogo(heldLevel, "sideeye", () => {
        sbRenderNag(el, Object.assign({}, opts, { expand: true, peekSnoozed: true }));
        setTimeout(() => el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }), 30);
      });
      return;
    }
    it = owed;
    held = true;
  }

  const amount = sbNagMoney(it.amount, it.currency);
  const other = it.iOwe ? it.creditor : it.debtor;
  const name = opts.nameOf(other) || "?";
  // 記下派派唸過哪一筆，之後還清了才知道要開心
  tracked[it.key] = { since: it.since, currency: it.currency, iOwe: it.iOwe, name, amountText: amount };
  if(it.iOwe) window.__sbNagCurrent = Object.assign({}, it, { name });
  sbNagStore.set("sb-nag-track", tracked);

  const snoozeInfo = sbNagStore.get("sb-nag-" + it.key, null);
  // 記仇只記這一筆：還清後又欠的新債（開始日期不同）重新算
  const count = snoozeInfo && snoozeInfo.since === it.since ? snoozeInfo.count || 0 : 0;
  const vars = { name, amount, days: it.days, n: count };
  let level = it.iOwe ? sbNagLevel(it.score) : 0;
  if(gentle) level = Math.min(level, 2);
  let lineKey;
  if(!it.iOwe) lineKey = sbNagPickKey(["nag.creditor"], gentle);
  else if(!gentle && count >= 4) lineKey = "nag.snoozedMany";
  else if(!gentle && count >= 2) lineKey = "nag.snoozedAgain";
  else if(!gentle && count === 1) lineKey = "nag.snoozedOnce";
  else lineKey = sbNagPickKey(gentle ? ["nag.l1_", "nag.l2_"] : ["nag.l" + level + "_"], gentle);
  const line = lineKey ? t(lineKey, vars) : "";
  const mood = SB_NAG_MOOD[lineKey];

  // 外幣在灰字補上「約 NT$…」；只有真的有匯率（即時或內建表）才換算
  const rate = it.currency !== "TWD" && ((window.cachedExchangeRates || {})[it.currency] || (window.DEFAULT_RATES_TO_TWD || {})[it.currency]);
  const approx = rate ? t("nag.approx", { twd: "NT$" + (typeof formatAmt === "function" ? formatAmt(Math.round(it.amount * rate)) : Math.round(it.amount * rate)) }) : "";
  const sub = t(it.iOwe ? "nag.subOwe" : "nag.subOwed", Object.assign({}, vars, { amount: amount + approx }));

  // 一天只完整出現一次（每個頁面各自算）；其餘時間縮在標題旁的 logo，點了才展開
  const seenKey = "sb-nag-seen-" + (opts.surface || "home");
  const expand = () => { sbRenderNag(el, Object.assign({}, opts, { expand: true })); setTimeout(() => el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }), 30); };
  sbNagSetLogo(level, mood, expand);
  // 這次開頁已經完整出現過的，頁面重畫（資料更新、即時同步）時維持展開，不要自己縮回去
  const shownThisVisit = window.__sbNagFullShown || (window.__sbNagFullShown = {});
  const surfaceId = opts.surface || "home";
  if(!opts.expand && !shownThisVisit[surfaceId] && sbNagStore.get(seenKey, null) === today){ clear(); return; }
  shownThisVisit[surfaceId] = true;
  sbNagStore.set(seenKey, today);
  if(!it.iOwe) sbNagStore.set("sb-nag-asked-" + it.key, today);

  el.hidden = false;
  el.innerHTML = '<div class="card sb-nag lv-' + level + (it.iOwe ? "" : " is-creditor") + '" role="status">'
    + '<div class="sb-nag-pie" title="' + escapeHtml(t("nag.mascotName")) + '">' + sbPieMascotSVG(level, mood) + '</div>'
    + '<div class="sb-nag-body">'
    + '<p class="sb-nag-line">' + escapeHtml(line) + '</p>'
    // 台詞已經講了金額，下面那行灰字就不重複（外幣例外，要看換算）
    + (line.includes(amount) && !approx ? '' : '<p class="sb-nag-sub">' + escapeHtml(sub) + '</p>')
    + '<div class="sb-nag-actions">'
    + '<button type="button" class="sbf-primary sb-nag-go">' + escapeHtml(t(it.iOwe ? "nag.pay" : "nag.nudge")) + '</button>'
    + '<button type="button" class="sb-nag-later">' + escapeHtml(t(it.iOwe ? "nag.snooze" : "nag.later")) + '</button>'
    + '</div></div></div>';
  el.querySelector(".sb-nag-go").addEventListener("click", () => (it.iOwe ? opts.onPay : opts.onNudge)(it));
  el.querySelector(".sb-nag-later").addEventListener("click", () => {
    if(it.iOwe && !held){
      // 欠人的：明天再出現，而且記一次
      const d = new Date(); d.setDate(d.getDate() + 1);
      sbNagStore.set("sb-nag-" + it.key, { until: sbIsoDay(d), count: count + 1, since: it.since });
    }
    el.querySelector(".sb-nag").classList.add("is-leaving");
    setTimeout(() => sbRenderNag(el, Object.assign({}, opts, { expand: false, peekSnoozed: false })), 220);
  });
}
window.sbRenderNag = sbRenderNag;

// 記帳成功畫面裡的吐槽：你還欠人錢（第 2 級以上）卻又記了一筆帳。一天最多一次，只在「正常」模式。
function sbNagRoast(){
  const it = window.__sbNagCurrent;
  if(sbNagMode() !== "normal" || !it || !it.iOwe || sbNagLevel(it.score) < 2) return null;
  const today = sbNagToday();
  if(sbNagStore.get("sb-nag-roast", null) === today) return null;
  sbNagStore.set("sb-nag-roast", today);
  const lineKey = sbNagPickKey(["nag.roast"], false);
  const name = it.name || "?";
  return { level: Math.min(sbNagLevel(it.score), 3), mood: SB_NAG_MOOD[lineKey], line: t(lineKey, { name, amount: sbNagMoney(it.amount, it.currency), days: it.days }) };
}
window.sbNagRoast = sbNagRoast;

// 往來明細裡探頭：打開「你欠他錢」的那個人時，派派在旁邊補一句
function sbNagPeekHTML(creditorId, currency, name){
  if(sbNagMode() === "off") return "";
  const it = (window.__sbNagItems || []).find(x => x.iOwe && x.creditor === creditorId && x.currency === currency && x.score >= SB_NAG_LEVELS[0]);
  if(!it) return "";
  const gentle = sbNagMode() === "gentle";
  const lineKey = sbNagPickKey(["nag.peek"], gentle);
  if(!lineKey) return "";
  const level = gentle ? Math.min(sbNagLevel(it.score), 2) : sbNagLevel(it.score);
  return '<div class="sb-pair-peek">' + sbPieMascotSVG(Math.min(level, 2), SB_NAG_MOOD[lineKey])
    + '<p>' + escapeHtml(t(lineKey, { name, amount: sbNagMoney(it.amount, it.currency), days: it.days })) + '</p></div>';
}
window.sbNagPeekHTML = sbNagPeekHTML;


// 設定頁「派派提醒」：關閉／溫和／正常（存在這台裝置）
(function initNagModeSetting(){
  function setup(){
    const seg = document.getElementById("nagModeSeg");
    if(!seg) return;
    const icon = document.getElementById("nagModeIcon");
    const hint = document.getElementById("nagModeHint");
    const sync = () => {
      const mode = sbNagMode();
      seg.querySelectorAll("[data-mode]").forEach(b => {
        const on = b.dataset.mode === mode;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-checked", String(on));
      });
      if(icon) icon.innerHTML = sbPieMascotSVG(mode === "normal" ? 2 : 1, mode === "off" ? "stare" : mode === "gentle" ? "sweet" : "smirk");
      if(hint) hint.textContent = t(mode === "off" ? "nag.settingHintOff" : mode === "gentle" ? "nag.settingHintGentle" : "nag.settingHint");
    };
    seg.addEventListener("click", e => {
      const b = e.target.closest("[data-mode]");
      if(!b) return;
      try { localStorage.setItem("sb-nag-mode", b.dataset.mode); } catch(err){}
      sync();
    });
    document.addEventListener("splitbill-lang-changed", sync);
    sync();
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup); else setup();
})();

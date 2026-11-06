// ============================================================
// 年度回顧：把這個群組一年的帳整理成一張一張的卡片，最後產生一張
// 可以分享的圖。全部用現有的 expenses 資料在前端算，不用動資料庫。
// 金額一律算「我的份額」（shares 裡我的那一份），不是整筆帳的總額。
// ============================================================
(function(){
  const track = document.getElementById("rcTrack");
  const stage = document.getElementById("rcStage");
  const progress = document.getElementById("rcProgress");
  const yearsEl = document.getElementById("rcYears");
  const prevBtn = document.getElementById("rcPrev");
  const nextBtn = document.getElementById("rcNext");
  const LOGO_PATHS = '<path class="s1" d="M256,238 L118.5,138.1 A170,170 0 0,1 393.5,138.1 Z"/><path class="s2" d="M271.6,265 L426.9,195.9 A170,170 0 0,1 289.4,434.1 Z"/><path class="s3" d="M240.4,265 L222.6,434.1 A170,170 0 0,1 85.1,195.9 Z"/>';
  const MIN_EXPENSES = 3;
  const TRAVEL_TYPES = ["transit", "car", "flight", "hotel", "ticket"];
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function showStatus(title, text, withBack){
    track.innerHTML = `<section class="rc-slide rc-status is-on">
      <h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p>
      ${withBack ? `<a class="rc-btn" href="summary.html">${escapeHtml(t("recap.emptyBack"))}</a>` : ""}
    </section>`;
    progress.innerHTML = "";
    prevBtn.hidden = nextBtn.hidden = true;
  }

  if(typeof window.supabase === "undefined"){
    showStatus(t("recap.loadFailTitle"), t("summary.configLoadFailText"), true);
    return;
  }
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // PostgREST 一次最多回 1000 筆，一整年的帳可能超過，要分頁抓完
  async function fetchAllExpenses(groupId){
    const PAGE = 1000;
    const rows = [];
    for(let from = 0; ; from += PAGE){
      const { data, error } = await sb.from("expenses")
        .select("id,amount,description,note,category,expense_date,currency,payers,shares")
        .eq("group_id", groupId)
        .order("expense_date", { ascending:true })
        .range(from, from + PAGE - 1);
      if(error) throw error;
      rows.push(...(data || []));
      if(!data || data.length < PAGE) return rows;
    }
  }

  async function fetchAllRepayments(groupId){
    const PAGE = 1000;
    const rows = [];
    for(let from = 0; ; from += PAGE){
      const { data, error } = await sb.from("repayments")
        .select("id,amount,currency,payment_date,from_member,to_member,offset_group")
        .eq("group_id", groupId)
        .order("payment_date", { ascending:true })
        .range(from, from + PAGE - 1);
      if(error) throw error;
      rows.push(...(data || []));
      if(!data || data.length < PAGE) return rows;
    }
  }

  // 留言只是回顧的其中一張，抓不到也不該讓整頁失敗
  async function fetchFeedback(groupId){
    try{
      const { data, error } = await sb.from("feedback").select("id,created_by,created_at").eq("group_id", groupId);
      return error ? [] : (data || []);
    }catch(e){ return []; }
  }

  // 一次抓齊所有幣別對臺幣的匯率。回傳 { JPY: 0.21, ... }，抓不到就是空物件。
  async function fetchTwdRates(){
    const sources = [
      { url:"https://open.er-api.com/v6/latest/TWD", pick:d => d && d.rates, upper:true },
      { url:"https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/twd.json", pick:d => d && d.twd, upper:false }
    ];
    for(const src of sources){
      try{
        const res = await fetch(src.url);
        if(!res.ok) continue;
        const table = src.pick(await res.json());
        if(!table) continue;
        const rates = {};
        Object.keys(table).forEach(k => { if(table[k] > 0) rates[k.toUpperCase()] = 1 / table[k]; });
        return rates;
      }catch(e){}
    }
    return {};
  }

  // 只有一種幣別就照原幣顯示；有外幣才換成臺幣，換不到的就不計入，並在畫面上講清楚。
  async function buildConverter(rows){
    const counts = {};
    rows.forEach(r => { counts[r.currency] = (counts[r.currency] || 0) + 1; });
    const codes = Object.keys(counts);
    if(codes.length <= 1) return { base: codes[0] || "TWD", toBase: { [codes[0]]: 1 }, converted: false, skipped: false };
    const rates = await fetchTwdRates();
    const toBase = { TWD: 1 };
    codes.forEach(c => { if(rates[c]) toBase[c] = rates[c]; });
    if(Object.keys(toBase).length === 1 && !counts.TWD){
      const main = codes.sort((a, b) => counts[b] - counts[a])[0];
      return { base: main, toBase: { [main]: 1 }, converted: false, skipped: true };
    }
    return { base: "TWD", toBase, converted: true, skipped: codes.some(c => !toBase[c]) };
  }

  function moneyText(code, amount){
    const meta = CURRENCIES.find(c => c.code === code);
    const sym = meta ? meta.symbol : code + " ";
    return sym + Math.round(amount).toLocaleString("en-US");
  }

  // description 可能夾帶 [xcur:...]／[recurring:...]／<!--CAT:...--> 這類隱藏標記
  function cleanTitle(desc){
    return String(desc || "").replace(/<!--[\s\S]*?-->/g, "").replace(/\[[a-z]+:[^\]]*\]/gi, "").replace(/AI_RECEIPT_DATA[\s\S]*$/, "").trim();
  }

  function formatDate(iso){
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(recapLocale(), { month:"long", day:"numeric" });
  }
  function recapLocale(){
    const lang = getLang();
    return lang === "zh-Hant" ? "zh-TW" : lang;
  }
  function monthName(i){
    return new Date(2000, i, 1).toLocaleDateString(recapLocale(), { month:"long" });
  }
  // 2023/1/1 是星期日，i 跟 Date.getDay() 同一套編號
  function weekdayName(i, style){
    return new Date(2023, 0, 1 + i).toLocaleDateString(recapLocale(), { weekday: style });
  }
  function isoWeekday(iso){
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).getDay();
  }
  function isoDayNumber(iso){
    return Math.round(Date.parse(iso + "T00:00:00Z") / 86400000);
  }
  // 今年還沒過完，平均只算到今天
  function daysInYearSoFar(year){
    const now = new Date();
    const end = year === now.getFullYear() ? now : new Date(year, 11, 31);
    return Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(year, 0, 1)) / 86400000) + 1;
  }
  function longestStreak(days){
    const sorted = Array.from(days).sort();
    let best = { len:0 }, start = 0;
    sorted.forEach((iso, i) => {
      if(i > 0 && isoDayNumber(iso) - isoDayNumber(sorted[i - 1]) !== 1) start = i;
      if(i - start + 1 > best.len) best = { len: i - start + 1, from: sorted[start], to: iso };
    });
    return best;
  }

  function computeStats(rows, repayments, feedback, year, myId, memberById, conv){
    const stats = { total:0, count:0, days:new Set(), months:Array(12).fill(0), weekdays:Array(7).fill(0), byDay:{}, titles:{}, currencies:new Set(), cats:{}, food:{}, all:{}, priciest:null, first:null, paidCount:0, paidForOthers:0, repayCount:0, repaySent:0, repayReceived:0, repayWith:{}, travel:{}, helpers:{}, fronted:{}, lively:null, messages:0, myMessages:0, talkers:{} };
    rows.forEach(r => {
      if(!r.expense_date || !r.expense_date.startsWith(String(year))) return;
      const rate = conv.toBase[r.currency];
      if(!rate) return;
      const meta = getCategoryMeta(r.description, r.note, r.category);
      if(meta.type === "xcur") return;
      const shares = Array.isArray(r.shares) ? r.shares : [];
      const mine = shares.find(s => s.member_id === myId);
      const myShare = mine ? Number(mine.amount) * rate : 0;
      if(myShare <= 0) return;

      if(r.currency !== conv.base) stats.foreign = true;
      stats.total += myShare;
      stats.count += 1;
      stats.days.add(r.expense_date);
      stats.months[Number(r.expense_date.slice(5, 7)) - 1] += myShare;
      stats.weekdays[isoWeekday(r.expense_date)] += myShare;
      stats.currencies.add(r.currency);
      const day = stats.byDay[r.expense_date] || (stats.byDay[r.expense_date] = { amount:0, count:0 });
      day.amount += myShare;
      day.count += 1;

      const cat = stats.cats[meta.type] || (stats.cats[meta.type] = { meta, amount:0, count:0 });
      cat.amount += myShare;
      cat.count += 1;

      const isMeal = meta.type === "food" || meta.type === "drink";
      const isTravel = TRAVEL_TYPES.includes(meta.type);
      const payers = (Array.isArray(r.payers) ? r.payers : []).filter(p => Number(p.amount) > 0);
      const paidTotal = payers.reduce((sum, p) => sum + Number(p.amount), 0);
      const myPaid = payers.filter(p => p.member_id === myId).reduce((sum, p) => sum + Number(p.amount), 0);
      shares.forEach(s => {
        if(s.member_id === myId || !(Number(s.amount) > 0) || !memberById[s.member_id]) return;
        stats.all[s.member_id] = (stats.all[s.member_id] || 0) + 1;
        if(isMeal) stats.food[s.member_id] = (stats.food[s.member_id] || 0) + 1;
        if(isTravel) stats.travel[s.member_id] = (stats.travel[s.member_id] || 0) + 1;
        // 多人一起付的帳，依各自付的比例算誰墊了誰的份額
        if(myPaid > 0) stats.fronted[s.member_id] = (stats.fronted[s.member_id] || 0) + Number(s.amount) * rate * myPaid / paidTotal;
      });
      payers.forEach(p => {
        if(p.member_id === myId || !memberById[p.member_id]) return;
        const h = stats.helpers[p.member_id] || (stats.helpers[p.member_id] = { amount:0, count:0 });
        h.amount += myShare * Number(p.amount) / paidTotal;
        h.count += 1;
      });

      const title = cleanTitle(r.description) || meta.name;
      if(!stats.priciest || myShare > stats.priciest.myShare){
        stats.priciest = { title, myShare, date: r.expense_date };
      }
      if(!stats.first || r.expense_date < stats.first.date) stats.first = { title, myShare, date: r.expense_date };
      const seen = stats.titles[title] || (stats.titles[title] = { title, amount:0, count:0 });
      seen.amount += myShare;
      seen.count += 1;

      const people = shares.filter(s => Number(s.amount) > 0).length;
      if(!stats.lively || people > stats.lively.people || (people === stats.lively.people && myShare > stats.lively.myShare)){
        stats.lively = { title, people, myShare, date: r.expense_date };
      }

      const paid = (Array.isArray(r.payers) ? r.payers : []).find(p => p.member_id === myId);
      if(paid && Number(paid.amount) > 0){
        stats.paidCount += 1;
        stats.paidForOthers += Math.max(0, Number(paid.amount) * rate - myShare);
      }
    });
    // offset_group 是跨幣別債務轉移的內部沖帳，不是真的有人還錢
    repayments.forEach(p => {
      if(p.offset_group || !p.payment_date || !p.payment_date.startsWith(String(year))) return;
      const rate = conv.toBase[p.currency];
      if(!rate || (p.from_member !== myId && p.to_member !== myId)) return;
      stats.repayCount += 1;
      if(p.from_member === myId) stats.repaySent += Number(p.amount) * rate;
      else stats.repayReceived += Number(p.amount) * rate;
      const other = p.from_member === myId ? p.to_member : p.from_member;
      if(memberById[other]) stats.repayWith[other] = (stats.repayWith[other] || 0) + 1;
    });
    feedback.forEach(f => {
      if(!String(f.created_at || "").startsWith(String(year))) return;
      stats.messages += 1;
      if(f.created_by === myId) stats.myMessages += 1;
      if(memberById[f.created_by]) stats.talkers[f.created_by] = (stats.talkers[f.created_by] || 0) + 1;
    });
    stats.catList = Object.values(stats.cats).sort((a, b) => b.amount - a.amount);
    stats.topDay = Object.keys(stats.byDay).sort((a, b) => stats.byDay[b].amount - stats.byDay[a].amount)[0];
    stats.topTitle = Object.values(stats.titles).sort((a, b) => b.count - a.count || b.amount - a.amount)[0];
    stats.streak = longestStreak(stats.days);
    return stats;
  }

  function topOf(counts){
    const id = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    return id ? { id, count: counts[id] } : null;
  }

  function disk(turn, extra){
    return `<svg class="rc-disk" viewBox="60 90 392 392" style="--turn:${turn}deg;${extra || ""}" aria-hidden="true">${LOGO_PATHS}</svg>`;
  }

  function faceHTML(ctx, id, cls){
    const name = ctx.memberById[id];
    const m = ctx.member(id);
    return m && m.avatar_url
      ? `<span class="${cls}" style="background-image:url('${escapeHtml(m.avatar_url)}')"></span>`
      : `<span class="${cls}" style="background:${getAvatarColor(name)}">${escapeHtml(name.slice(0, 1))}</span>`;
  }

  function slideHTML(cls, turn, body, attrs){
    return `<section class="rc-slide ${cls}" ${attrs || ""}>${disk(turn)}<div class="rc-body">${body}</div></section>`;
  }

  function buildSlides(ctx){
    const { stats, year, groupName, myName, base, conv, memberById } = ctx;
    const out = [];
    const noteHTML = stats.foreign || conv.skipped
      ? `<p class="rc-note rc-rise" style="--i:3">${escapeHtml(t(conv.skipped ? "recap.noteSkipped" : "recap.noteConverted"))}</p>` : "";

    out.push(slideHTML("", 18, `
      <p class="rc-cover-group rc-rise">${escapeHtml(groupName)}</p>
      <p class="rc-cover-year rc-rise" style="--i:1">${year}</p>
      <h1 class="rc-cover-title rc-rise" style="--i:2">${escapeHtml(t("recap.coverTitle", { name: myName }))}</h1>
    `) .replace("</section>", `<p class="rc-hint rc-rise" style="--i:4">${escapeHtml(t("recap.coverHint"))}</p></section>`));

    out.push(slideHTML("is-brand", 96, `
      <p class="rc-label rc-rise">${escapeHtml(t("recap.totalLabel"))}</p>
      <p class="rc-big rc-rise" style="--i:1" data-count="${Math.round(stats.total)}" data-code="${base}">${escapeHtml(moneyText(base, stats.total))}</p>
      <p class="rc-detail rc-rise" style="--i:2">${t("recap.totalDetail", { count:`<b>${stats.count}</b>`, days:`<b>${stats.days.size}</b>` })}</p>
      ${noteHTML}
    `));

    const perDay = stats.total / daysInYearSoFar(year);
    out.push(slideHTML("is-ocean", 150, `
      <p class="rc-label rc-rise">${escapeHtml(t("recap.avgLabel"))}</p>
      <p class="rc-big rc-rise" style="--i:1">${escapeHtml(moneyText(base, perDay))}</p>
      <p class="rc-detail rc-rise" style="--i:2">${t("recap.avgDetail", { amount:`<b>${escapeHtml(moneyText(base, stats.total / stats.count))}</b>` })}</p>
    `));

    const top = stats.catList[0];
    const topThree = stats.catList.slice(0, 3);
    out.push(slideHTML("is-cat", 210, `
      <span class="rc-cat-icon rc-rise">${top.meta.icon}</span>
      <p class="rc-label rc-rise" style="--i:1">${escapeHtml(t("recap.catLabel"))}</p>
      <p class="rc-big is-name rc-rise" style="--i:2">${escapeHtml(top.meta.name)}</p>
      <p class="rc-detail rc-rise" style="--i:3">${t("recap.catDetail", { pct:`<b>${Math.round(top.amount / stats.total * 100)}</b>`, count:`<b>${top.count}</b>` })}</p>
      ${topThree.length > 1 ? `<ol class="rc-rank rc-rise" style="--i:4">${topThree.map(c => `<li>
        <span class="rc-rank-name">${escapeHtml(c.meta.name)}</span><span class="rc-rank-amt">${escapeHtml(moneyText(base, c.amount))}</span>
        <span class="rc-rank-bar"><i style="--w:${(c.amount / top.amount).toFixed(3)}"></i></span>
      </li>`).join("")}</ol>` : ""}
    `, `style="--cat:${top.meta.color}"`));

    if(stats.topTitle.count >= 3){
      out.push(slideHTML("is-cream", 70, `
        <p class="rc-label rc-rise">${escapeHtml(t("recap.storeLabel"))}</p>
        <p class="rc-big is-name is-long rc-rise" style="--i:1">${escapeHtml(stats.topTitle.title)}</p>
        <p class="rc-detail rc-rise" style="--i:2">${t("recap.storeDetail", { count:`<b>${stats.topTitle.count}</b>`, amount:`<b>${escapeHtml(moneyText(base, stats.topTitle.amount))}</b>` })}</p>
      `));
    }

    // 一起吃飯的次數太少就不具代表性，改講一起分帳的次數
    const foodTop = topOf(stats.food);
    const partner = foodTop && foodTop.count >= 3 ? { ...foodTop, meal:true } : topOf(stats.all);
    if(partner){
      const name = memberById[partner.id];
      out.push(slideHTML("is-plum", 300, `
        ${faceHTML(ctx, partner.id, "rc-avatar rc-rise")}
        <p class="rc-label rc-rise" style="--i:1">${escapeHtml(t(partner.meal ? "recap.partnerFoodLabel" : "recap.partnerAllLabel"))}</p>
        <p class="rc-big is-name rc-rise" style="--i:2">${escapeHtml(name)}</p>
        <p class="rc-detail rc-rise" style="--i:3">${t(partner.meal ? "recap.partnerFoodDetail" : "recap.partnerAllDetail", { count:`<b>${partner.count}</b>` })}</p>
        <p class="rc-detail rc-rise" style="--i:4">${t("recap.partnerPeople", { n:`<b>${Object.keys(stats.all).length}</b>` })}</p>
      `));
      ctx.partnerName = name;
    }

    const crew = Object.keys(stats.all).sort((a, b) => stats.all[b] - stats.all[a]).slice(0, 3);
    if(crew.length >= 2){
      out.push(slideHTML("is-mist", 200, `
        <p class="rc-label rc-rise">${escapeHtml(t("recap.crewLabel"))}</p>
        <ol class="rc-crew">${crew.map((id, i) => `<li class="rc-rise" style="--i:${i + 1}">
          ${faceHTML(ctx, id, "rc-crew-face")}
          <span class="rc-crew-name">${escapeHtml(memberById[id])}</span>
          <span class="rc-crew-count">${escapeHtml(t("recap.crewCount", { count: stats.all[id] }))}</span>
        </li>`).join("")}</ol>
      `));
    }

    const buddy = topOf(stats.travel);
    if(buddy && buddy.count >= 3){
      out.push(slideHTML("is-ocean", 120, `
        ${faceHTML(ctx, buddy.id, "rc-avatar rc-rise")}
        <p class="rc-label rc-rise" style="--i:1">${escapeHtml(t("recap.buddyLabel"))}</p>
        <p class="rc-big is-name rc-rise" style="--i:2">${escapeHtml(memberById[buddy.id])}</p>
        <p class="rc-detail rc-rise" style="--i:3">${t("recap.buddyDetail", { count:`<b>${buddy.count}</b>` })}</p>
      `));
    }

    const helperId = Object.keys(stats.helpers).sort((a, b) => stats.helpers[b].amount - stats.helpers[a].amount)[0];
    if(helperId){
      const helper = stats.helpers[helperId];
      out.push(slideHTML("is-pine", 40, `
        ${faceHTML(ctx, helperId, "rc-avatar rc-rise")}
        <p class="rc-label rc-rise" style="--i:1">${escapeHtml(t("recap.helperLabel"))}</p>
        <p class="rc-big is-name rc-rise" style="--i:2">${escapeHtml(memberById[helperId])}</p>
        <p class="rc-detail rc-rise" style="--i:3">${t("recap.helperDetail", { count:`<b>${helper.count}</b>`, amount:`<b>${escapeHtml(moneyText(base, helper.amount))}</b>` })}</p>
      `));
    }

    if(stats.paidCount > 0 && stats.paidForOthers > 0){
      const frontedId = Object.keys(stats.fronted).sort((a, b) => stats.fronted[b] - stats.fronted[a])[0];
      out.push(slideHTML("is-brand", 250, `
        <p class="rc-label rc-rise">${escapeHtml(t("recap.paidLabel"))}</p>
        <p class="rc-big rc-rise" style="--i:1">${escapeHtml(moneyText(base, stats.paidForOthers))}</p>
        <p class="rc-detail rc-rise" style="--i:2">${t("recap.paidDetail", { count:`<b>${stats.paidCount}</b>` })}</p>
        ${frontedId ? `<p class="rc-detail rc-rise" style="--i:3">${t("recap.frontedDetail", { name:`<b>${escapeHtml(memberById[frontedId])}</b>`, amount:`<b>${escapeHtml(moneyText(base, stats.fronted[frontedId]))}</b>` })}</p>` : ""}
      `));
    }

    if(stats.lively.people >= 3){
      out.push(slideHTML("is-cream", 310, `
        <p class="rc-label rc-rise">${escapeHtml(t("recap.livelyLabel"))}</p>
        <p class="rc-big is-name is-long rc-rise" style="--i:1">${escapeHtml(stats.lively.title)}</p>
        <p class="rc-detail rc-rise" style="--i:2">${t("recap.livelyDetail", { date: escapeHtml(formatDate(stats.lively.date)), n:`<b>${stats.lively.people}</b>` })}</p>
      `));
    }

    if(stats.messages > 0){
      const talker = topOf(stats.talkers);
      out.push(slideHTML("is-plum", 170, `
        <p class="rc-label rc-rise">${escapeHtml(t("recap.messagesLabel"))}</p>
        <p class="rc-big rc-rise" style="--i:1">${escapeHtml(t("recap.messagesValue", { n: stats.messages }))}</p>
        <p class="rc-detail rc-rise" style="--i:2">${t("recap.messagesMine", { n:`<b>${stats.myMessages}</b>` })}</p>
        ${talker ? `<p class="rc-detail rc-rise" style="--i:3">${t("recap.messagesTop", { name:`<b>${escapeHtml(memberById[talker.id])}</b>` })}</p>` : ""}
      `));
    }

    const p = stats.priciest;
    out.push(slideHTML("is-wine", 40, `
      <p class="rc-label rc-rise">${escapeHtml(t("recap.priciestLabel"))}</p>
      <p class="rc-big rc-rise" style="--i:1">${escapeHtml(moneyText(base, p.myShare))}</p>
      <p class="rc-detail rc-rise" style="--i:2"><b>${escapeHtml(p.title)}</b></p>
      <p class="rc-detail rc-rise" style="--i:3">${escapeHtml(formatDate(p.date))}</p>
    `));

    // 那天只有最貴的那一筆的話，跟上一張講的是同一件事，不用重複
    const topDay = stats.byDay[stats.topDay];
    if(topDay.count > 1) out.push(slideHTML("is-ocean", 270, `
      <p class="rc-label rc-rise">${escapeHtml(t("recap.dayLabel"))}</p>
      <p class="rc-big is-name rc-rise" style="--i:1">${escapeHtml(formatDate(stats.topDay))}</p>
      <p class="rc-detail rc-rise" style="--i:2">${t("recap.dayDetail", { amount:`<b>${escapeHtml(moneyText(base, topDay.amount))}</b>`, count:`<b>${topDay.count}</b>` })}</p>
    `));

    const peak = stats.months.indexOf(Math.max(...stats.months));
    const peakAmt = stats.months[peak];
    out.push(slideHTML("is-mist", 150, `
      <p class="rc-label rc-rise">${escapeHtml(t("recap.monthLabel"))}</p>
      <p class="rc-big is-name rc-rise" style="--i:1">${escapeHtml(monthName(peak))}</p>
      <p class="rc-detail rc-rise" style="--i:2">${t("recap.monthDetail", { amount:`<b>${escapeHtml(moneyText(base, peakAmt))}</b>` })}</p>
      <div class="rc-months rc-rise" style="--i:3" aria-hidden="true">${stats.months.map((v, i) => `<div class="rc-month${i === peak ? " is-peak" : ""}" style="--i:${i}"><i style="--h:${(v / peakAmt).toFixed(3)};--i:${i}"></i><span>${i + 1}</span></div>`).join("")}</div>
    `));

    const peakDay = stats.weekdays.indexOf(Math.max(...stats.weekdays));
    const peakDayAmt = stats.weekdays[peakDay];
    out.push(slideHTML("is-cream", 20, `
      <p class="rc-label rc-rise">${escapeHtml(t("recap.weekdayLabel"))}</p>
      <p class="rc-big is-name rc-rise" style="--i:1">${escapeHtml(weekdayName(peakDay, "long"))}</p>
      <p class="rc-detail rc-rise" style="--i:2">${t("recap.weekdayDetail", { amount:`<b>${escapeHtml(moneyText(base, peakDayAmt))}</b>` })}</p>
      <div class="rc-months is-week rc-rise" style="--i:3" aria-hidden="true">${stats.weekdays.map((v, i) => `<div class="rc-month${i === peakDay ? " is-peak" : ""}" style="--i:${i}"><i style="--h:${(v / peakDayAmt).toFixed(3)};--i:${i}"></i><span>${escapeHtml(weekdayName(i, "narrow"))}</span></div>`).join("")}</div>
    `));

    if(stats.streak.len >= 3){
      out.push(slideHTML("is-pine", 110, `
        <p class="rc-label rc-rise">${escapeHtml(t("recap.streakLabel"))}</p>
        <p class="rc-big rc-rise" style="--i:1">${escapeHtml(t("recap.streakValue", { n: stats.streak.len }))}</p>
        <p class="rc-detail rc-rise" style="--i:2">${escapeHtml(t("recap.streakDetail", { from: formatDate(stats.streak.from), to: formatDate(stats.streak.to) }))}</p>
      `));
    }

    out.push(slideHTML("is-brand", 200, `
      <p class="rc-label rc-rise">${escapeHtml(t("recap.firstLabel"))}</p>
      <p class="rc-big is-name is-long rc-rise" style="--i:1">${escapeHtml(stats.first.title)}</p>
      <p class="rc-detail rc-rise" style="--i:2">${escapeHtml(t("recap.firstDetail", { date: formatDate(stats.first.date), amount: moneyText(base, stats.first.myShare) }))}</p>
    `));

    if(stats.currencies.size >= 2){
      const names = Array.from(stats.currencies).map(code => {
        const c = CURRENCIES.find(x => x.code === code);
        return c ? c.label : code;
      });
      out.push(slideHTML("is-plum", 350, `
        <p class="rc-label rc-rise">${escapeHtml(t("recap.currencyLabel"))}</p>
        <p class="rc-big rc-rise" style="--i:1">${escapeHtml(t("recap.currencyValue", { n: names.length }))}</p>
        <p class="rc-detail rc-rise" style="--i:2">${escapeHtml(names.join("、"))}</p>
      `));
    }

    if(stats.repayCount > 0){
      out.push(slideHTML("is-brand", 60, `
        <p class="rc-label rc-rise">${escapeHtml(t("recap.repayLabel"))}</p>
        <p class="rc-big rc-rise" style="--i:1">${escapeHtml(t("recap.repayValue", { n: stats.repayCount }))}</p>
        <p class="rc-detail rc-rise" style="--i:2">${t("recap.repayDetail", { sent:`<b>${escapeHtml(moneyText(base, stats.repaySent))}</b>`, received:`<b>${escapeHtml(moneyText(base, stats.repayReceived))}</b>` })}</p>
        ${topOf(stats.repayWith) ? `<p class="rc-detail rc-rise" style="--i:3">${t("recap.repayWith", { name:`<b>${escapeHtml(memberById[topOf(stats.repayWith).id])}</b>` })}</p>` : ""}
      `));
    }

    const finalRows = [
      [t("recap.finalTotal"), moneyText(base, stats.total)],
      [t("recap.catLabel"), top.meta.name],
      ctx.partnerName ? [t(partner.meal ? "recap.partnerFoodLabel" : "recap.partnerAllLabel"), ctx.partnerName] : null,
      [t("recap.priciestLabel"), `${p.title}・${moneyText(base, p.myShare)}`],
      [t("recap.monthLabel"), monthName(peak)]
    ].filter(Boolean);
    ctx.finalRows = finalRows;
    ctx.tiles = [
      { bg:"#4F5599", fg:"#FFFFFF", soft:"#DADCF6", label:t("recap.finalTotal"), value:moneyText(base, stats.total), sub:t("recap.totalDetail", { count:stats.count, days:stats.days.size }) },
      { bg:"#6E1D3A", fg:"#FFFFFF", soft:"#F3CFDA", label:t("recap.priciestLabel"), value:moneyText(base, p.myShare), sub:p.title },
      ctx.partnerName
        ? { bg:"#F6EEDF", fg:"#2A2233", soft:"#6A5E55", label:t(partner.meal ? "recap.partnerFoodLabel" : "recap.partnerAllLabel"), value:ctx.partnerName, sub:t(partner.meal ? "recap.partnerFoodDetail" : "recap.partnerAllDetail", { count:partner.count }) }
        : { bg:"#F6EEDF", fg:"#2A2233", soft:"#6A5E55", label:t("recap.avgLabel"), value:moneyText(base, perDay), sub:t("recap.avgDetail", { amount:moneyText(base, stats.total / stats.count) }) },
      { bg:"#0E4A30", fg:"#FFFFFF", soft:"#BFE3CF", label:t("recap.monthLabel"), value:monthName(peak), sub:t("recap.monthDetail", { amount:moneyText(base, peakAmt) }) }
    ];
    const canShare = !!(navigator.canShare && navigator.share);
    out.push(slideHTML("is-final", 330, `
      <h2 class="rc-final-title rc-rise">${escapeHtml(t("recap.finalTitle", { name: myName, year }))}</h2>
      <dl class="rc-final-list rc-rise" style="--i:1">${finalRows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("")}</dl>
      <div class="rc-actions rc-rise" style="--i:2">
        ${canShare ? `<button type="button" class="rc-btn" id="rcShareBtn">${sbIcon("upload")}${escapeHtml(t("recap.share"))}</button>` : ""}
        <button type="button" class="rc-btn${canShare ? " is-ghost" : ""}" id="rcSaveBtn">${sbIcon("download")}${escapeHtml(t("recap.save"))}</button>
        <button type="button" class="rc-btn is-ghost" id="rcReplayBtn" ${canShare ? 'style="grid-column:1 / -1"' : ""}>${sbIcon("rotate")}${escapeHtml(t("recap.replay"))}</button>
      </div>
      <p class="rc-share-msg" id="rcShareMsg" role="status"></p>
    `));
    return out;
  }

  // ---------- 分享圖：1080×1350，直接畫，不靠截圖 ----------
  function fitFont(c, text, weight, size, maxW){
    let s = size;
    c.font = `${weight} ${s}px ${FONT}`;
    while(s > 24 && c.measureText(text).width > maxW){
      s -= 2;
      c.font = `${weight} ${s}px ${FONT}`;
    }
    return s;
  }
  const FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
  function truncate(c, text, maxW){
    if(c.measureText(text).width <= maxW) return text;
    let s = text;
    while(s.length > 1 && c.measureText(s + "…").width > maxW) s = s.slice(0, -1);
    return s + "…";
  }

  function roundRectPath(c, x, y, w, h, rad){
    c.beginPath();
    c.moveTo(x + rad, y);
    c.arcTo(x + w, y, x + w, y + h, rad);
    c.arcTo(x + w, y + h, x, y + h, rad);
    c.arcTo(x, y + h, x, y, rad);
    c.arcTo(x, y, x + w, y, rad);
    c.closePath();
  }

  // 把這一年的花費切成幾片，跟 logo 一樣每片往外推開一點：每個人的圖都不一樣
  function drawYearPie(c, cx, cy, radius, slices){
    const total = slices.reduce((sum, s) => sum + s.amount, 0);
    let start = -Math.PI / 2;
    slices.forEach(s => {
      const sweep = s.amount / total * Math.PI * 2;
      const mid = start + sweep / 2;
      const push = slices.length > 1 ? 9 : 0;
      const x = cx + Math.cos(mid) * push, y = cy + Math.sin(mid) * push;
      c.beginPath();
      c.moveTo(x, y);
      c.arc(x, y, radius, start, start + sweep);
      c.closePath();
      c.fillStyle = s.color;
      c.fill();
      start += sweep;
    });
  }

  async function renderShareImage(ctx){
    if(document.fonts && document.fonts.load){
      await Promise.all([document.fonts.load(`900 120px ${FONT}`), document.fonts.load(`700 44px ${FONT}`), document.fonts.load(`600 30px ${FONT}`)]).catch(()=>{});
    }
    const W = 1080, H = 1350, PAD = 64, INNER = W - PAD * 2;
    const INK = "#F5F4FF", SOFT = "#C9CCF2";
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const c = canvas.getContext("2d");
    c.fillStyle = "#23254F";
    c.fillRect(0, 0, W, H);
    c.textBaseline = "alphabetic";

    c.fillStyle = SOFT;
    c.font = `700 28px ${FONT}`;
    c.textAlign = "left";
    c.fillText("SPLITBILL", PAD, 92);
    c.textAlign = "right";
    c.font = `600 28px ${FONT}`;
    c.fillText(truncate(c, ctx.groupName, INNER - 240), W - PAD, 92);
    c.textAlign = "left";

    // 年份撐滿整個版面寬，是這張圖的主角
    const yearText = String(ctx.year);
    let yearSize = 200;
    c.font = `900 ${yearSize}px ${FONT}`;
    yearSize = Math.floor(yearSize * INNER / c.measureText(yearText).width);
    c.font = `900 ${yearSize}px ${FONT}`;
    c.fillStyle = "#F6EEDF";
    const yearBase = 124 + c.measureText(yearText).actualBoundingBoxAscent;
    c.fillText(yearText, PAD + c.measureText(yearText).actualBoundingBoxLeft, yearBase);

    const title = t("recap.coverTitle", { name: ctx.myName });
    c.fillStyle = INK;
    fitFont(c, title, 700, 46, INNER);
    c.fillText(title, PAD, yearBase + 74);

    // 花費圓餅和圖例
    const pieTop = yearBase + 112, radius = 132;
    const cats = ctx.stats.catList;
    const shown = cats.slice(0, 3).map(s => ({ name: s.meta.name, amount: s.amount, color: s.meta.color }));
    const rest = cats.slice(3).reduce((sum, s) => sum + s.amount, 0);
    if(rest > 0) shown.push({ name: t("recap.otherCat"), amount: rest, color: "#8C8FB8" });
    const pieX = PAD + radius + 10, pieY = pieTop + radius + 10;
    drawYearPie(c, pieX, pieY, radius, shown);

    const legendX = PAD + radius * 2 + 76, rowH = 62;
    let ly = pieY - (shown.length - 1) * rowH / 2;
    shown.forEach(s => {
      const pct = Math.round(s.amount / ctx.stats.total * 100) + "%";
      c.fillStyle = s.color;
      roundRectPath(c, legendX, ly - 13, 26, 26, 7);
      c.fill();
      c.textBaseline = "middle";
      c.fillStyle = INK;
      c.font = `700 34px ${FONT}`;
      c.textAlign = "right";
      c.fillText(pct, W - PAD, ly + 1);
      const pctW = c.measureText(pct).width;
      c.textAlign = "left";
      c.font = `600 32px ${FONT}`;
      c.fillText(truncate(c, s.name, W - PAD - pctW - 24 - legendX - 44), legendX + 44, ly + 1);
      c.textBaseline = "alphabetic";
      ly += rowH;
    });

    // 下方四格：跟回顧卡片同一套底色
    const gap = 16, tileW = (INNER - gap) / 2;
    const tilesTop = pieTop + radius * 2 + 54;
    const tileH = (H - PAD - tilesTop - gap) / 2;
    ctx.tiles.forEach((tile, i) => {
      const x = PAD + (i % 2) * (tileW + gap);
      const y = tilesTop + Math.floor(i / 2) * (tileH + gap);
      c.fillStyle = tile.bg;
      roundRectPath(c, x, y, tileW, tileH, 30);
      c.fill();
      const tx = x + 30, maxW = tileW - 60;
      c.fillStyle = tile.soft;
      c.font = `600 27px ${FONT}`;
      c.fillText(truncate(c, tile.label, maxW), tx, y + 50);
      c.fillStyle = tile.fg;
      fitFont(c, tile.value, 900, 56, maxW);
      c.fillText(tile.value, tx, y + tileH / 2 + 22);
      c.fillStyle = tile.soft;
      c.font = `600 26px ${FONT}`;
      c.fillText(truncate(c, tile.sub, maxW), tx, y + tileH - 24);
    });
    return new Promise(resolve => canvas.toBlob(resolve, "image/png"));
  }

  function wireShare(ctx){
    const msg = document.getElementById("rcShareMsg");
    const fileName = `splitbill-${ctx.year}.png`;
    function download(blob){
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      msg.textContent = t("recap.saved");
    }
    const saveBtn = document.getElementById("rcSaveBtn");
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      try{ download(await renderShareImage(ctx)); }
      catch(e){ msg.textContent = t("recap.shareFailed"); }
      saveBtn.disabled = false;
    });
    const shareBtn = document.getElementById("rcShareBtn");
    if(shareBtn) shareBtn.addEventListener("click", async () => {
      shareBtn.disabled = true;
      try{
        const blob = await renderShareImage(ctx);
        const file = new File([blob], fileName, { type:"image/png" });
        if(navigator.canShare({ files:[file] })) await navigator.share({ files:[file] });
        else download(blob);
      }catch(e){
        if(e && e.name !== "AbortError") msg.textContent = t("recap.shareFailed");
      }
      shareBtn.disabled = false;
    });
    document.getElementById("rcReplayBtn").addEventListener("click", () => {
      slides.forEach(s => s.classList.remove("is-on"));
      track.querySelectorAll("[data-done]").forEach(el => { delete el.dataset.done; });
      goTo(0);
    });
  }

  // ---------- 卡片切換 ----------
  // 用 transform 自己移動，不靠原生橫向捲動：手機瀏覽器對捲動吸附的行為
  // 不一致，有時根本滑不動；這樣手指拖多少卡片就跟多少，滑鼠也能拖。
  let slides = [];
  let rail = null;
  let index = 0;
  function placeRail(dragPx, animate){
    if(!rail) return;
    rail.style.transition = animate && !reducedMotion ? "transform .38s cubic-bezier(.16,1,.3,1)" : "none";
    rail.style.transform = `translate3d(calc(${-index * 100}% + ${dragPx}px),0,0)`;
  }
  function goTo(i){
    if(!slides.length) return;
    setActive(Math.max(0, Math.min(slides.length - 1, i)));
    placeRail(0, true);
  }

  const drag = { id:null, x:0, y:0, dx:0, t:0, active:false };
  track.addEventListener("pointerdown", e => {
    if(!rail || drag.id !== null || (e.pointerType === "mouse" && e.button !== 0) || e.target.closest("button, a")) return;
    Object.assign(drag, { id:e.pointerId, x:e.clientX, y:e.clientY, dx:0, t:e.timeStamp, active:false });
  });
  track.addEventListener("pointermove", e => {
    if(e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if(!drag.active){
      if(Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)){ drag.id = null; return; }
      if(Math.abs(dx) < 8) return;
      drag.active = true;
      track.setPointerCapture(e.pointerId);
    }
    // 第一張往右、最後一張往左拉不動，只給一點阻力當回饋
    const atEdge = (index === 0 && dx > 0) || (index === slides.length - 1 && dx < 0);
    drag.dx = atEdge ? dx * .3 : dx;
    placeRail(drag.dx, false);
  });
  function endDrag(e, cancelled){
    if(e.pointerId !== drag.id) return;
    const { active, dx, t:startT } = drag;
    drag.id = null;
    if(!active) return;
    const fast = Math.abs(dx) > 24 && Math.abs(dx) / Math.max(1, e.timeStamp - startT) > .35;
    const far = Math.abs(dx) > track.clientWidth * .2;
    goTo(!cancelled && (fast || far) ? index + (dx < 0 ? 1 : -1) : index);
  }
  track.addEventListener("pointerup", e => endDrag(e, false));
  track.addEventListener("pointercancel", e => endDrag(e, true));

  // 金額從 0 跑到最終值；先用最終文字算好字級，跑動時才不會忽大忽小
  function countUp(el){
    if(reducedMotion || el.dataset.done) return;
    el.dataset.done = "1";
    const end = Number(el.dataset.count), code = el.dataset.code;
    const start = performance.now(), dur = 900;
    (function frame(now){
      const p = Math.min(1, (now - start) / dur);
      el.textContent = moneyText(code, end * (1 - Math.pow(1 - p, 3)));
      if(p < 1) requestAnimationFrame(frame);
    })(start);
  }

  function setActive(i){
    index = i;
    const slide = slides[i];
    slide.classList.add("is-on");
    // 畫面外的卡片不能被 Tab 走到
    slides.forEach((s, n) => { s.inert = n !== i; });
    progress.querySelectorAll("i").forEach((seg, n) => seg.classList.toggle("is-done", n <= i));
    stage.classList.toggle("is-light-slide", slide.classList.contains("is-cream") || slide.classList.contains("is-mist"));
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === slides.length - 1;
    yearsEl.style.visibility = i === 0 ? "" : "hidden";
    slide.querySelectorAll("[data-count]").forEach(countUp);
  }

  function fitBigText(){
    track.querySelectorAll(".rc-big:not(.is-name)").forEach(el => {
      el.style.fontSize = "";
      const maxW = el.parentElement.clientWidth;
      let size = parseFloat(getComputedStyle(el).fontSize);
      while(size > 26 && el.scrollWidth > maxW){
        size -= 2;
        el.style.fontSize = size + "px";
      }
    });
  }

  function mount(ctx){
    track.innerHTML = `<div class="rc-rail">${buildSlides(ctx).join("")}</div>`;
    rail = track.firstElementChild;
    slides = Array.from(rail.children);
    progress.innerHTML = slides.map(() => "<i></i>").join("");
    prevBtn.hidden = nextBtn.hidden = false;
    fitBigText();
    wireShare(ctx);
    setActive(0);
    placeRail(0, false);
    track.focus({ preventScroll:true });
  }

  prevBtn.addEventListener("click", () => goTo(index - 1));
  nextBtn.addEventListener("click", () => goTo(index + 1));
  document.addEventListener("keydown", e => {
    if(e.key === "ArrowRight"){ e.preventDefault(); goTo(index + 1); }
    else if(e.key === "ArrowLeft"){ e.preventDefault(); goTo(index - 1); }
    else if(e.key === "Escape") location.href = "summary.html";
  });
  window.addEventListener("resize", fitBigText);

  function defaultYear(years){
    const wanted = recapYearFor(new Date());
    return years.includes(wanted) ? wanted : years[0];
  }

  (async function boot(){
    // 開放期間以外直接回首頁；網址加 ?preview=1 可以提前看
    if(!recapYearFor(new Date()) && new URLSearchParams(location.search).get("preview") !== "1"){
      location.replace("summary.html");
      return;
    }
    try{
      const { data:{ session } } = await sb.auth.getSession();
      if(!session || !session.user){
        location.href = "index.html?redirect=recap.html";
        return;
      }
      const { MEMBERS, memberById, myMember } = await loadGroupMembers(sb, session.user, true);
      if(!myMember || !myMember.group_id){
        location.href = "summary.html";
        return;
      }
      const [rows, repayments, feedback] = await Promise.all([fetchAllExpenses(myMember.group_id), fetchAllRepayments(myMember.group_id), fetchFeedback(myMember.group_id)]);
      const conv = await buildConverter(rows.concat(repayments));
      const member = id => MEMBERS.find(m => m.id === id);
      const groupName = (myMember.groups && myMember.groups.name) || "";

      const statsByYear = {};
      Array.from(new Set(rows.map(r => Number((r.expense_date || "").slice(0, 4))).filter(Boolean))).forEach(y => {
        const s = computeStats(rows, repayments, feedback, y, myMember.id, memberById, conv);
        if(s.count >= MIN_EXPENSES) statsByYear[y] = s;
      });
      const years = Object.keys(statsByYear).map(Number).sort((a, b) => b - a);
      if(!years.length){
        showStatus(t("recap.emptyTitle"), t("recap.emptyText"), true);
        return;
      }

      function show(year){
        mount({ stats: statsByYear[year], year, groupName, myName: myMember.name, base: conv.base, conv, member, memberById });
        yearsEl.querySelectorAll(".rc-year").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.year) === year)));
      }
      if(years.length > 1){
        yearsEl.innerHTML = years.slice(0, 4).map(y => `<button type="button" class="rc-year" data-year="${y}">${y}</button>`).join("");
        yearsEl.classList.remove("hidden");
        yearsEl.addEventListener("click", e => {
          const b = e.target.closest(".rc-year");
          if(b) show(Number(b.dataset.year));
        });
      }
      show(defaultYear(years));
    }catch(e){
      console.error("年度回顧載入失敗：", e);
      showStatus(t("recap.loadFailTitle"), t("recap.loadFailText"), true);
    }
  })();
})();

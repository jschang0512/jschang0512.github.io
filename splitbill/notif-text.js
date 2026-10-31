// ============================================================
// 通知文字（2026-10）
// ============================================================
// 頁面（<script>）跟 Service Worker（importScripts）共用這一份，所以
// 只用 self 不用 window。
//
// 資料庫 trigger / notify-push 只存「種類 + 數值」（notifications.type +
// params），文字在這裡依讀者的語言組：
//   splitbillNotifParams()：從一筆 expenses / repayments 算出「對某位成員」
//     的 params（他分攤多少、先付多少、要付給誰…），規則跟資料庫
//     notify_expense_or_repayment() 與 notify-push 一致；回傳 null 代表
//     這個人不用通知。頁面的即時提示用它。
//   splitbillNotifText()：kind + params + 語言 → { title, body }。
// ============================================================
(function(){
  const SYMBOLS = { TWD:"NT$", JPY:"¥", KRW:"₩", CNY:"CN¥", HKD:"HK$", MOP:"MOP$", USD:"$", VND:"₫", THB:"฿", PHP:"₱",
    SGD:"S$", MYR:"RM", IDR:"Rp", KHR:"៛", EUR:"€", GBP:"£", CHF:"Fr", AUD:"A$", NZD:"NZ$", TRY:"₺", CZK:"Kč", HUF:"Ft",
    SEK:"kr", NOK:"kr", DKK:"kr", ISK:"kr" };
  const ZERO_DECIMALS = ["TWD", "JPY", "KRW", "VND", "IDR", "KHR", "HUF", "ISK"];

  function money(amount, currency){
    const num = Number(amount);
    const digits = ZERO_DECIMALS.includes(currency) ? 0 : 2;
    const txt = isNaN(num) ? String(amount) : num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: digits });
    return (SYMBOLS[currency] || (currency ? currency + " " : "")) + txt;
  }

  function cleanDesc(desc){
    return String(desc || "")
      .replace(/<!--[\s\S]*?-->/gi, "")
      .replace(/AI_RECEIPT_DATA:[\s\S]*/gi, "")
      .replace(/\s*\[xcur[:_][^\]]+\]/gi, "")
      .trim()
      .split("\n")[0]
      .replace(/\(AI自動拆單\)/g, "")
      .trim();
  }

  function sumFor(list, id){
    return (list || []).reduce((s, x) => s + (x && x.member_id === id ? Number(x.amount) || 0 : 0), 0);
  }
  function involves(rec, id){
    return (rec.payers || []).some(p => p.member_id === id) || (rec.shares || []).some(s => s.member_id === id);
  }
  const same = (a, b) => JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b);

  // op: "INSERT" | "UPDATE"；old 可以是 null（拿不到舊資料時就不比對改了什麼）
  function splitbillNotifParams(table, op, rec, old, recipientId, nameOf){
    if(!rec || !recipientId) return null;
    const name = (id) => (id && nameOf(id)) || "";
    const hasOld = old && Object.keys(old).length > 1;

    if(table === "expenses"){
      if(op === "UPDATE" && hasOld &&
         ["amount", "currency", "payers", "shares", "description", "expense_date"].every(f => same(rec[f], old[f]))) return null;
      const recurring = op === "INSERT" && String(rec.note || "").includes("[recurring:");
      const nowIn = involves(rec, recipientId);
      const wasIn = op === "UPDATE" && hasOld && involves(old, recipientId);
      if(!nowIn && !wasIn) return null;
      if(!recurring && rec.created_by === recipientId) return null;

      const payers = (rec.payers || []).filter(p => Number(p.amount) > 0);
      const paid = sumFor(rec.payers, recipientId);
      const single = payers.length === 1 ? payers[0].member_id : null;
      const params = {
        actor: name(rec.created_by),
        desc: cleanDesc(rec.description),
        amount: Number(rec.amount),
        currency: rec.currency,
        share: sumFor(rec.shares, recipientId),
        paid,
        payee: single && single !== recipientId ? name(single) : null,
        payee_is_actor: !!single && single === rec.created_by
      };
      if(op === "UPDATE" && hasOld){
        if(!same(Number(rec.amount), Number(old.amount))) params.old_amount = Number(old.amount);
        if(nowIn && !wasIn) params.added = true;
        if(!nowIn && wasIn) params.removed = true;
      }
      return { kind: recurring ? "recurring_generated" : "expenses_" + op.toLowerCase(), params };
    }

    if(table === "repayments"){
      if(op === "UPDATE" && hasOld &&
         ["amount", "currency", "from_member", "to_member", "payment_date"].every(f => same(rec[f], old[f]))) return null;
      if(recipientId !== rec.from_member && recipientId !== rec.to_member) return null;
      if(rec.created_by === recipientId) return null;
      const params = {
        actor: name(rec.created_by),
        from: name(rec.from_member),
        to: name(rec.to_member),
        role: recipientId === rec.to_member ? "to" : "from",
        amount: Number(rec.amount),
        currency: rec.currency
      };
      if(op === "UPDATE" && hasOld && !same(Number(rec.amount), Number(old.amount))) params.old_amount = Number(old.amount);
      return { kind: "repayments_" + op.toLowerCase(), params };
    }
    return null;
  }

  const TEXT = {
    "zh-Hant": {
      someone: "有人", item: "支出",
      expNew: "{actor}記了一筆支出", expEdit: "{actor}修改了「{desc}」",
      expAdded: "{actor}把你加入「{desc}」", expRemoved: "{actor}把你從「{desc}」移除", removedBody: "你不用分攤了",
      recur: "{desc}已自動記錄",
      line: "{desc} {amount}", amountChange: "金額 {old} → {amount}",
      share: "（你分攤其中 {share}）", owe: "・你應付 {share} 給{payee}",
      paidMore: "你先付 {paid}，別人欠你 {diff}", paidLess: "你先付 {paid}，還要付 {diff}", paidEven: "你先付 {paid}",
      repNew: "{actor}記了一筆還款", repEdit: "{actor}修改了一筆還款",
      repTo: "{from}還你 {amount}", repFrom: "你還給{to} {amount}", repWas: "（原本 {old}）",
      remind: "還款提醒", remindBody: "{creditor}提醒你結清 {amount}"
    },
    "ja": {
      someone: "誰か", item: "支出",
      expNew: "{actor}さんが支出を記録しました", expEdit: "{actor}さんが「{desc}」を修正しました",
      expAdded: "{actor}さんがあなたを「{desc}」に追加しました", expRemoved: "{actor}さんがあなたを「{desc}」から外しました", removedBody: "あなたの負担はなくなりました",
      recur: "{desc}を自動記録しました",
      line: "{desc} {amount}", amountChange: "金額 {old} → {amount}",
      share: "（あなたの負担 {share}）", owe: "・{payee}さんに {share} を支払い",
      paidMore: "{paid} を立て替え、{diff} を受け取る予定", paidLess: "{paid} を立て替え、あと {diff} を支払い", paidEven: "{paid} を立て替え",
      repNew: "{actor}さんが返済を記録しました", repEdit: "{actor}さんが返済を修正しました",
      repTo: "{from}さんから {amount} の返済", repFrom: "{to}さんに {amount} を返済", repWas: "（変更前 {old}）",
      remind: "返済リマインド", remindBody: "{creditor}さんから {amount} の精算リマインドが届きました"
    },
    "en": {
      someone: "Someone", item: "Expense",
      expNew: "{actor} added an expense", expEdit: "{actor} edited \"{desc}\"",
      expAdded: "{actor} added you to \"{desc}\"", expRemoved: "{actor} removed you from \"{desc}\"", removedBody: "You no longer share this expense",
      recur: "\"{desc}\" was recorded automatically",
      line: "{desc} {amount}", amountChange: "Amount {old} → {amount}",
      share: " (your share {share})", owe: " · you owe {payee} {share}",
      paidMore: "You paid {paid}; others owe you {diff}", paidLess: "You paid {paid}; you still owe {diff}", paidEven: "You paid {paid}",
      repNew: "{actor} recorded a repayment", repEdit: "{actor} edited a repayment",
      repTo: "{from} paid you {amount}", repFrom: "You paid {to} {amount}", repWas: " (was {old})",
      remind: "Repayment reminder", remindBody: "{creditor} asked you to settle {amount}"
    }
  };

  function splitbillNotifText(kind, p, lang){
    if(!p || typeof p !== "object") return null;
    const L = TEXT[lang] || TEXT["zh-Hant"];
    const cur = p.currency;
    const round = (v) => ZERO_DECIMALS.includes(cur) ? Math.round(v) : Math.round(v * 100) / 100;
    const vals = {
      actor: p.actor || L.someone, desc: p.desc || L.item, from: p.from || "?", to: p.to || "?",
      creditor: p.creditor || L.someone, payee: p.payee || "",
      amount: money(p.amount, cur), old: p.old_amount != null ? money(p.old_amount, cur) : "",
      share: money(round(p.share || 0), cur), paid: money(round(p.paid || 0), cur),
      diff: money(Math.abs(round((p.paid || 0) - (p.share || 0))), cur)
    };
    const f = (tpl) => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vals ? vals[k] : m));

    // 「你的份」那一段：有先付錢 → 另起一行講誰欠誰；只有一個付款人且不是記帳的人 → 講要付給誰；其他 → 括號寫分攤多少
    function mine(){
      const share = round(p.share || 0), paid = round(p.paid || 0);
      if(paid > 0){
        const diff = round(paid - share);
        return { tail: share > 0 ? f(L.share) : "", extra: f(diff > 0 ? L.paidMore : diff < 0 ? L.paidLess : L.paidEven) };
      }
      if(p.payee && !p.payee_is_actor) return { tail: f(L.owe), extra: "" };
      return { tail: f(L.share), extra: "" };
    }
    const join = (head, m) => head + m.tail + (m.extra ? "\n" + m.extra : "");

    switch(kind){
      case "expenses_insert":
      case "expenses_update": {
        if(p.removed) return { title: f(L.expRemoved), body: f(L.removedBody) };
        const title = f(p.added ? L.expAdded : kind === "expenses_insert" ? L.expNew : L.expEdit);
        const head = kind === "expenses_update" && !p.added && p.old_amount != null ? f(L.amountChange) : f(L.line);
        return { title, body: join(head, mine()) };
      }
      case "recurring_generated":
        return { title: f(L.recur), body: join(vals.amount, mine()) };
      case "repayments_insert":
      case "repayments_update": {
        const body = f(p.role === "from" ? L.repFrom : L.repTo) + (kind === "repayments_update" && p.old_amount != null ? f(L.repWas) : "");
        return { title: f(kind === "repayments_insert" ? L.repNew : L.repEdit), body };
      }
      case "debt_reminder":
        return { title: f(L.remind), body: f(L.remindBody) };
    }
    return null;
  }

  self.splitbillNotifMoney = money;
  self.splitbillNotifParams = splitbillNotifParams;
  self.splitbillNotifText = splitbillNotifText;
})();

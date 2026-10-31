// ============================================================
// Split Bill — Web Push 通知 Edge Function
// ============================================================
//
// 由 Supabase Database Webhook 在 expenses / repayments 有
// INSERT 或 UPDATE 時觸發。
//
// 2026-10 起「要通知誰、寫什麼」全部由資料庫 trigger
// notify_expense_or_repayment() 決定：它在同一個交易裡替每位收件人
// 寫好 notifications 一列（type + 從他角度算的 params + 中文備援
// title/body）。Webhook 是交易 commit 之後才送出，所以這裡只要把
// 「這筆帳還沒推播過的通知」原子性地認領下來（pushed_at），逐一推給
// 那個人的裝置就好——推播內容跟站內通知永遠一致，也不會重複送。
// trigger 判斷不用通知（例如只補了收據照片）時就沒有列，這裡自然不送。
//
// 推播帶 kind + params，Service Worker 用 notif-text.js 依使用者語言
// 組字；title/body 是舊版 Service Worker 的中文備援。tag 用帳的 id，
// 同一筆帳的新推播會取代舊的。
//
// 需要的環境變數（用 `supabase secrets set` 設定，或在 Supabase
// 後台 Edge Functions > Secrets 設定）：
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
// SUPABASE_URL 跟 SUPABASE_SERVICE_ROLE_KEY 是 Supabase 平台
// 自動注入的，不用自己設定。
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails("mailto:admin@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  // Supabase Database Webhook 的 payload 格式：
  // { type: "INSERT"|"UPDATE"|"DELETE", table, record, old_record, schema }
  const { type, table, record } = payload;
  if (!record || type === "DELETE") {
    return new Response("skipped");
  }
  if (table !== "expenses" && table !== "repayments") {
    return new Response("skipped");
  }

  // 認領 trigger 剛寫好、還沒推播過的通知（update ... where pushed_at is null 是原子的，
  // 同一筆帳的 webhook 就算重送或並行，也只有一邊拿得到）
  const { data: rows, error } = await sb
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .eq("related_table", table)
    .eq("related_id", record.id)
    .is("pushed_at", null)
    .select("member_id,type,title,body,params");
  if (error) {
    console.error("claim notifications failed", error);
    return new Response("error", { status: 500 });
  }
  if (!rows || !rows.length) {
    return new Response("no recipients");
  }

  const cur = encodeURIComponent(record.currency || "");
  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("*")
    .in("member_id", rows.map((r) => r.member_id));

  await Promise.all(
    (subs || []).map(async (sub) => {
      const n = rows.find((r) => r.member_id === sub.member_id)!;
      const url = table === "expenses" && !n.params?.removed
        ? `currency.html?c=${cur}&openExpense=${encodeURIComponent(record.id)}`
        : `currency.html?c=${cur}`;
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify({ title: n.title, body: n.body, kind: n.type, params: n.params, tag: record.id, url })
        );
      } catch (err: any) {
        // 訂閱已失效（使用者移除權限、換裝置等），清掉舊紀錄
        if (err.statusCode === 404 || err.statusCode === 410) {
          await sb.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );

  return new Response("ok");
});

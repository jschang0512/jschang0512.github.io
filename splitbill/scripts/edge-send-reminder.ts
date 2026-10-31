// ============================================================
// Split Bill — 「催款提醒」推播加分層 (Edge Function)
// ============================================================
//
// 雙軌制的其中一軌：站內通知（notifications 表）是保證看得到的那條，
// 由 send_debt_reminder() 這支資料庫 RPC 負責寫入、也負責節流判斷
// （同一組人同一個幣別 24 小時只能提醒一次）。
//
// 這支 Edge Function 是「加分」的那一軌——RPC 確認沒被節流之後，前端
// 才會順便呼叫這裡，額外幫欠錢的人發一則真的系統推播（如果他有訂閱
// 的話）。故意不在這裡重複做節流判斷：RPC 剛更新過節流紀錄，這裡如果
// 自己再查一次同一張表，會看到「剛剛才發過」而誤判成節流，反而擋下
// 這次真的該送的推播。推播就算失敗（例如對方根本沒訂閱、或發送出
// 錯），也完全不影響站內通知已經寫進去這件事，所以這裡的錯誤處理
// 都是「盡量送、送不到就算了」，不會讓前端整個提醒動作失敗。
//
// 2026-10：推播內容直接用 send_debt_reminder() 寫的那則站內通知（kind + params，
// Service Worker 依使用者語言組字；title/body 是舊版 SW 的中文備援）。
//
// 需要的環境變數（沿用專案裡原本自動推播那支 function 的同一組）：
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY 是
// Supabase 平台自動注入的，不用自己設定。
//
// 部署方式：
//   supabase functions deploy send-reminder
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails("mailto:admin@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// 瀏覽器直接呼叫（sb.functions.invoke），一定要處理 CORS，不然連
// preflight 都過不了，前端只會看到含糊的網路錯誤。
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  // 確認真的是登入中的使用者本人在按，不是隨便誰都能觸發推播騷擾別人。
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !userData?.user) {
    return jsonResponse({ error: "UNAUTHORIZED" }, 401);
  }
  const authedUserId = userData.user.id;

  let payload: {
    debtorMemberId?: string;
    creditorMemberId?: string;
    amount?: number;
    currency?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "BAD_REQUEST" }, 400);
  }
  const { debtorMemberId, creditorMemberId, amount, currency } = payload;
  if (!debtorMemberId || !creditorMemberId || !amount || !currency) {
    return jsonResponse({ error: "MISSING_FIELDS" }, 400);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 只驗證身分，不做節流判斷——節流已經由呼叫端在打這支之前的
  // send_debt_reminder() RPC 判斷過了。
  const { data: callerMember } = await sb
    .from("members")
    .select("id,user_id")
    .eq("id", creditorMemberId)
    .maybeSingle();
  if (!callerMember || callerMember.user_id !== authedUserId) {
    return jsonResponse({ error: "FORBIDDEN" }, 403);
  }

  // 站內通知那一列（send_debt_reminder() 剛寫的）就是推播內容：認領還沒推過的那一列，
  // 文字跟站內通知一致，也不會重複送。
  const { data: rows } = await sb
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .eq("member_id", debtorMemberId)
    .eq("type", "debt_reminder")
    .eq("related_id", creditorMemberId)
    .is("pushed_at", null)
    .select("title,body,params");
  const n = rows && rows[0];
  if (!n) {
    return jsonResponse({ ok: true, sentCount: 0 });
  }
  const url = `currency.html?c=${encodeURIComponent(currency)}`;

  const { data: subs } = await sb
    .from("push_subscriptions")
    .select("*")
    .eq("member_id", debtorMemberId);

  let sentCount = 0;
  await Promise.all(
    (subs || []).map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };
      try {
        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify({ title: n.title, body: n.body, kind: "debt_reminder", params: n.params, url })
        );
        sentCount++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await sb.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );

  // 不管有沒有真的送出任何一支裝置，都回 200——這支本來就是「加分」，
  // 對方沒訂閱推播是正常情況，不算失敗。
  return jsonResponse({ ok: true, sentCount });
});

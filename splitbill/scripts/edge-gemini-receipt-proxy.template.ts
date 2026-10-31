// ============================================================
// Split Bill — AI 拍照拆單「系統預設金鑰」代理 (Edge Function)
// ============================================================
//
// 背景：ai-receipt.js 原本在使用者沒有自己填 Gemini API Key 時，會
// 直接從 app_settings 資料表把系統預設金鑰讀到前端明碼，導致任何人
// （不用登入）都能用 anon key 打 REST API 把金鑰撈走。
//
// 修法：金鑰只存在這支 Function 的環境變數（GEMINI_API_KEY），前端
// 永遠碰不到。使用者沒有自己金鑰時，改成把裁切好的收據圖片丟進來，
// 由這支 Function 代打 Gemini、解析完直接把結構化 JSON 回傳給前端。
//
// 需要的環境變數：
//   GEMINI_API_KEY — 系統預設的金鑰。跟前端「使用者自訂 API Key」欄位
//     一樣是「萬用格式」：可以是 OpenRouter key（sk-or-...）、OpenAI key
//     （sk-...），或是原生 Google Gemini key（其他格式），下面會依前綴
//     自動分流打對的 API，維持跟前端 parseReceiptWithGemini() 完全一致的行為。
// SUPABASE_URL / SUPABASE_ANON_KEY 是 Supabase 平台自動注入的，
// 不用自己設定。
//
// 2026-11：prompt 加上單據類型判斷與「點菜單手寫劃記」規則（正字筆畫、
// 記號歸屬、大/小分欄、忽略桌號…）。RECEIPT_PROMPT 由
// scripts/build-receipt-proxy.js 從 ai-receipt.js 的 prompt 產生，兩邊永遠同一份。
//
// 部署方式：
//   node scripts/build-receipt-proxy.js
//   supabase functions deploy gemini-receipt-proxy
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

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

// 跟 ai-receipt.js 前端版本完全同一份 prompt（由 build 腳本帶入），維持辨識品質/格式一致。
const RECEIPT_PROMPT = __RECEIPT_PROMPT__;

const CANDIDATE_MODELS = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
const OPENROUTER_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "openrouter/free",
  "openrouter/auto",
];

// base64 圖片上限（約略對應原圖 8MB 左右），擋濫用/異常大檔案，避免
// 有心人拿這支當免費影像轉發服務亂打。
const MAX_BASE64_LEN = 11_000_000;

function parseJsonReply(rawText: string): Record<string, unknown> {
  const cleaned = (rawText || "{}").replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}

async function callOpenRouter(pureBase64: string, mimeType: string): Promise<Record<string, unknown>> {
  let lastErr: Error | null = null;
  for (const model of OPENROUTER_MODELS) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GEMINI_API_KEY}`,
          "HTTP-Referer": "https://jschang0512.github.io/splitbill",
          "X-Title": "Splitbill Receipt OCR",
        },
        body: JSON.stringify({
          model,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: RECEIPT_PROMPT },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${pureBase64}` } },
            ],
          }],
          max_tokens: 8192,
          temperature: 0.1,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error(`[gemini-receipt-proxy] openrouter model=${model} HTTP ${res.status}:`, JSON.stringify(err));
        lastErr = new Error((err && err.error && err.error.message) || `OpenRouter HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      return parseJsonReply(data?.choices?.[0]?.message?.content);
    } catch (e) {
      console.error(`[gemini-receipt-proxy] openrouter model=${model} threw:`, e);
      lastErr = e as Error;
    }
  }
  throw lastErr || new Error("OpenRouter AI 辨識失敗，請稍候重試。");
}

async function callOpenAI(pureBase64: string, mimeType: string): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GEMINI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: RECEIPT_PROMPT },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${pureBase64}` } },
        ],
      }],
      max_tokens: 8192,
      temperature: 0.1,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`[gemini-receipt-proxy] openai HTTP ${res.status}:`, JSON.stringify(err));
    throw new Error((err && err.error && err.error.message) || `OpenAI HTTP ${res.status}`);
  }
  const data = await res.json();
  return parseJsonReply(data?.choices?.[0]?.message?.content);
}

async function callNativeGemini(pureBase64: string, mimeType: string): Promise<Record<string, unknown>> {
  let lastErr: Error | null = null;
  for (const model of CANDIDATE_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: RECEIPT_PROMPT },
              { inlineData: { mimeType, data: pureBase64 } },
            ],
          }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192, temperature: 0.1 },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = (err && err.error && err.error.message) || `HTTP ${res.status}`;
        console.error(`[gemini-receipt-proxy] model=${model} HTTP ${res.status}:`, JSON.stringify(err));
        lastErr = new Error(msg);
        continue;
      }
      const data = await res.json();
      return parseJsonReply(data?.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (e) {
      console.error(`[gemini-receipt-proxy] model=${model} threw:`, e);
      lastErr = e as Error;
    }
  }
  throw lastErr || new Error("AI 辨識收據失敗，請確認網路連線或稍候重試。");
}

// 跟前端 parseReceiptWithGemini() 同一套依金鑰前綴分流的邏輯。
async function callAI(pureBase64: string, mimeType: string): Promise<Record<string, unknown>> {
  if (GEMINI_API_KEY.startsWith("sk-or-")) return await callOpenRouter(pureBase64, mimeType);
  if (GEMINI_API_KEY.startsWith("sk-")) return await callOpenAI(pureBase64, mimeType);
  return await callNativeGemini(pureBase64, mimeType);
}

Deno.serve(async (req) => {
  // 整支包在最外層 try/catch，確保任何沒預期到的例外都會被印出完整
  // 堆疊、並回傳正常的 JSON 錯誤回應，而不是讓 Deno 直接判定成
  // EDGE_FUNCTION_ERROR（那種情況下 Gateway log 只看得到 metadata，
  // 看不到真正的錯誤內容，很難排查）。
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
      return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);
    }
    if (!GEMINI_API_KEY) {
      console.error("[gemini-receipt-proxy] GEMINI_API_KEY secret 未設定或是空字串");
      return jsonResponse({ error: "系統尚未設定 Gemini API Key，請先在「⚙️ 設定」中填寫自己的 Gemini API Key。" }, 503);
    }

    // 一定要是登入中的使用者才能用，擋掉未登入的匿名請求（也順便擋掉
    // 舊漏洞那種完全不用帳號就能打 API 的情境）。
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !userData?.user) {
      console.error("[gemini-receipt-proxy] auth.getUser 失敗:", authErr);
      return jsonResponse({ error: "UNAUTHORIZED" }, 401);
    }

    let payload: { image?: string; mimeType?: string };
    try {
      payload = await req.json();
    } catch (e) {
      console.error("[gemini-receipt-proxy] req.json() 解析失敗:", e);
      return jsonResponse({ error: "BAD_REQUEST" }, 400);
    }
    const { image, mimeType } = payload;
    if (!image || typeof image !== "string") {
      return jsonResponse({ error: "MISSING_IMAGE" }, 400);
    }
    if (image.length > MAX_BASE64_LEN) {
      return jsonResponse({ error: "圖片檔案過大，請重新裁切或壓縮後再試一次。" }, 413);
    }

    try {
      const parsed = await callAI(image, mimeType || "image/jpeg");
      return jsonResponse({ ok: true, data: parsed });
    } catch (e) {
      console.error("[gemini-receipt-proxy] callAI 最終失敗:", e);
      return jsonResponse({ error: (e as Error)?.message || "AI 辨識收據失敗，請稍候重試。" }, 502);
    }
  } catch (e) {
    console.error("[gemini-receipt-proxy] 未預期的例外:", e);
    return jsonResponse({ error: (e as Error)?.message || "系統發生未預期的錯誤，請稍候重試。" }, 500);
  }
});

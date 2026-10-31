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
const RECEIPT_PROMPT = `You are an expert multilingual receipt & invoice OCR parsing AI. Analyze the image carefully.
Extract all receipt details and output in STRICT JSON format (no markdown, no backticks, only valid raw JSON):
{
  "docType": "receipt | tally_sheet | total_only (see rule 7)",
  "storeName": "Natural Traditional Chinese store name with branch, district, station or location if printed on the receipt (e.g. '星巴克 淺草雷門店 (Starbucks)', '唐吉訶德 澀谷本店 (ドン・キホーテ)', '一蘭拉麵 淺草店', '鼎泰豐 101店')",
  "currencyCode": "Detected 3-letter currency code (e.g. 'JPY', 'TWD', 'KRW', 'USD', 'EUR', 'THB', 'VND', 'SGD', 'HKD', 'CNY', 'GBP', 'AUD')",
  "date": "Receipt date in YYYY-MM-DD format if found, otherwise empty string",
  "time": "Receipt time in HH:MM format if found, otherwise empty string",
  "subtotal": 0,
  "serviceCharge": 0,
  "tax": 0,
  "discount": 0,
  "totalAmount": 0,
  "writtenTotal": 0,
  "items": [
    {
      "name": "Natural, recognizable Traditional Chinese Name (Original Foreign Name)",
      "price": 0,
      "qty": 1,
      "mark": "tally sheets only: the handwritten mark exactly as written, otherwise empty string",
      "uncertain": false
    }
  ]
}

CRITICAL TRANSLATION & NAMING GUIDELINES:
1. NEVER do rigid, awkward, word-for-word machine translation. Translations must be natural, appetizing, and match everyday Traditional Chinese (Taiwan/Hong Kong) common usage and vocabulary.
2. FAMOUS BRAND NAMES & POPULAR PRODUCTS: Keep widely recognized English or popular brand names rather than awkward phonetic literal translations:
   - 'キットカット' (KitKat) -> 'KitKat 巧克力' (DO NOT translate to '奇巧' or '奇巧巧克力')
   - 'オトナの甘さ' / 'オトナの甘' -> '大人味微甜 / 黑巧克力' (DO NOT translate to '成人甜味')
   - Example: '★キットカット オトナの甘' -> 'KitKat 大人味巧克力 (★キットカット オトナの甘)'
   - 'ポッキー' (Pocky) -> 'Pocky 巧克力棒' (DO NOT translate to '百奇')
   - 'ブラックサンダー' -> '雷神巧克力'
   - 'じゃがりこ' / 'カルビー' -> 'Calbee 薯條 / 餅乾'
   - 'コカ・コーラ' -> '可口可樂' / 'ZERO 可樂'
   - '午後的紅茶' -> '午後紅茶 (奶茶/檸檬茶/紅茶)'
   - 'レッドブル' -> 'Red Bull 紅牛能量飲'
   - 'モンスター' -> 'Monster 魔爪能量飲'
   - 'ハーゲンダッツ' -> '哈根達斯 冰淇淋'
   - 'スターバックス' -> '星巴克'
3. RESTAURANT & FOOD DISHES: Use clear, everyday dining terms:
   - '唐揚げ' -> '日式唐揚炸雞'
   - '生ビール' / '生中' -> '生啤酒 (中杯)'
   - 'ハイボール' -> 'Highball 角嗨/威士忌蘇打'
   - 'サワー' -> '沙瓦'
   - 'カルビ' -> '牛五花'
   - 'ロース' -> '牛里肌 / 豬里肌'
   - 'ハラミ' -> '牛橫膈膜'
   - 'タン' / '牛タン' -> '牛舌'
   - 'つくね' -> '雞肉丸'
   - '枝豆' -> '毛豆'
   - 'お通し' -> '開胃小菜 / 居酒屋前菜'
   - '替玉' -> '加麵 / 續麵'
   - '餃子' -> '煎餃'
   - 'デザート' -> '甜點'
4. FORMAT: Always use '通俗自然中文名稱 (原文)' for foreign items. If the receipt is already in Chinese, just output the Chinese name directly.
5. NUMBERS: 'price' must be the UNIT price for a single item (NOT the line total). If the receipt only shows a line total and a quantity, divide: price = printed_line_total / qty. 'totalAmount', 'subtotal', 'serviceCharge', 'tax', 'discount' must be clean numbers without symbols.
6. QUANTITY: Read the actual quantity printed on the receipt for each line (look for patterns like 'x3', '×3', '3個', '3個入', a standalone number column, etc.) and put it in 'qty'. Default to 1 only if no quantity is shown or the line is clearly a single unit. Do NOT guess a quantity that wasn't printed. (Handwritten tally sheets follow rule 8 instead.)
7. DOCUMENT TYPE: First decide "docType":
   - "receipt": a printed receipt / invoice that lists what was bought (the default).
   - "tally_sheet": a printed order sheet or menu (點菜單) listing many dishes with unit prices, where the customer marked quantities BY HAND in a quantity (數量) column — 正-character tally strokes, digits, ticks or circles. Very common in Taiwanese restaurants.
   - "total_only": a slip that shows only a total without line items (card slip, handwritten receipt, 領収書). Put the total in totalAmount and leave items empty.
8. TALLY SHEET RULES (only when docType is "tally_sheet"):
   a. Output ONLY rows that carry a handwritten mark. Unmarked rows were NOT ordered — never output the whole menu.
   b. Count 正-character tally strokes; every stroke is 1. The character is built up stroke by stroke: 一 = 1, 丅 or a T shape = 2, 下 = 3, 止 (正 missing its bottom stroke) = 4, 正 = 5. Several characters add up (正正一 = 11). A T shape is TWO strokes (one horizontal + one vertical), never 1. A lone horizontal dash (一 / - / —) = 1. A handwritten digit = that number. A tick (✓) or circle = 1 unless a number is written with it.
   c. Marks are written loosely: they may sit a little above or below the row, cross a grid line, or touch the section's header line. Assign each mark to the row whose quantity cell it is vertically closest to, within the SAME column block; a mark touching a header line belongs to the first row under that header.
   d. price = the printed unit price of the marked row. When a dish has variant sub-rows (大/小, 乾/湯, 中碗/大碗), the marked sub-row decides the variant and price; name it like '排骨飯（大）'.
   e. When row labels sit under a group label printed to their left (e.g. group '蚵仔' with rows '油麵', '米粉'), combine them: '蚵仔油麵'. Keep printed prefixes such as '乾' ('乾油麵').
   f. IGNORE handwriting that is not a quantity: table numbers (內用桌號 / 桌號 / 外帶 boxes), phone numbers, addresses, opening hours, notes.
   g. qty = the counted marks. Set totalAmount = sum of price × qty. If a total is handwritten on the sheet, put it in "writtenTotal" (otherwise 0).
   h. For every item add "mark": exactly what is written, using only these characters for tally strokes: 一 丅 下 止 正 (write a T shape as 丅), or the digits as written (e.g. '丅', '正一', '2', '一'), and "uncertain": true when the mark is faint, sits between two rows, or its stroke count is unclear (otherwise false).
   i. storeName comes from the sheet's header; date and time are usually absent (empty strings).
9. APP SCREENSHOTS: When the image is a phone screenshot of an app order or trip (food delivery such as Uber Eats / foodpanda, shopping apps, ride-hailing such as Uber / Grab / taxi apps, booking confirmations), treat it as docType "receipt" and:
   a. Ignore phone and app chrome: status bar clock and battery, navigation bars, buttons, maps, ads, ratings, "order again" or recommended items.
   b. items = the ordered products with their unit price and quantity (lines like '2x' or '×2' are quantities). For a ride, use a single item such as 'Uber 車資 (pickup → drop-off)' with the fare.
   c. Delivery fee, service fee, small-order fee, platform fee, bag fee and tips go into serviceCharge (sum them). Coupons, promotions, membership discounts and vouchers go into discount as a positive number.
   d. totalAmount = the final amount actually charged (the 'Total' / '合計' / '實付金額' line), after fees and discounts.
   e. storeName = the restaurant / shop / service name (e.g. '麥當勞 信義店 (Uber Eats)'); date and time = the order or trip time if shown.`;

const CANDIDATE_MODELS = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
// openrouter/free 每次隨機分配免費模型，有些會回傳空殼——空殼時多抽幾次免費的；
// 因為空殼而重試時不升級到付費的 openrouter/auto（auto 只在免費模型都連不上時才用）。
const OPENROUTER_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "openrouter/free",
  "openrouter/free",
  "openrouter/free",
  "openrouter/auto",
];

function receiptNum(v: unknown): number {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const n = Number(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isFinite(n) ? n : 0;
}

// 至少要有一個有價格的品項或一個總額，才算辨識到東西
function isUsableReceipt(p: Record<string, unknown>): boolean {
  const items = Array.isArray(p?.items) ? (p.items as Record<string, unknown>[]) : [];
  return items.some((it) => receiptNum(it?.price ?? it?.amount ?? it?.total) > 0) || receiptNum(p?.totalAmount) > 0;
}

// base64 圖片上限（約略對應原圖 8MB 左右），擋濫用/異常大檔案，避免
// 有心人拿這支當免費影像轉發服務亂打。
const MAX_BASE64_LEN = 11_000_000;

function parseJsonReply(rawText: string): Record<string, unknown> {
  const cleaned = (rawText || "{}").replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned);
}

async function callOpenRouter(pureBase64: string, mimeType: string): Promise<Record<string, unknown>> {
  let lastErr: Error | null = null;
  let lastEmpty: Record<string, unknown> | null = null;
  const started = Date.now();
  for (const model of OPENROUTER_MODELS) {
    // 空殼重試有時間上限：免費模型一次可能要一分鐘，Edge Function 有執行時間上限
    if (lastEmpty && (model === "openrouter/auto" || Date.now() - started > 90_000)) break;
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
      const parsed = parseJsonReply(data?.choices?.[0]?.message?.content);
      if (isUsableReceipt(parsed)) return parsed;
      console.error(`[gemini-receipt-proxy] openrouter model=${model} (${data?.model || "?"}) returned no items/total:`, JSON.stringify(parsed).slice(0, 300));
      lastEmpty = parsed;
    } catch (e) {
      console.error(`[gemini-receipt-proxy] openrouter model=${model} threw:`, e);
      lastErr = e as Error;
    }
  }
  if (lastEmpty) return lastEmpty;
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

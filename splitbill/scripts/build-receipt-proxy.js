// 產生 gemini-receipt-proxy 的 index.ts：把 ai-receipt.js 裡的辨識 prompt 原封不動帶進
// Edge Function，前端（個人金鑰）跟後端（系統金鑰）兩條路徑永遠用同一份 prompt。
//   node scripts/build-receipt-proxy.js  →  scripts/edge-gemini-receipt-proxy.ts
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "ai-receipt.js"), "utf8");
const start = src.indexOf("const prompt = `");
const end = src.indexOf("`;", start);
if (start < 0 || end < 0) throw new Error("prompt not found in ai-receipt.js");
const prompt = src.slice(start + "const prompt = `".length, end);
if (prompt.includes("${")) throw new Error("prompt must not contain template expressions");

const tpl = fs.readFileSync(path.join(__dirname, "edge-gemini-receipt-proxy.template.ts"), "utf8");
const out = tpl.replace("__RECEIPT_PROMPT__", () => "`" + prompt + "`");
fs.writeFileSync(path.join(__dirname, "edge-gemini-receipt-proxy.ts"), out);
console.log("wrote scripts/edge-gemini-receipt-proxy.ts (" + prompt.length + " chars of prompt)");

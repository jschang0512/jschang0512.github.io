// ============================================================
// Split Bill — 幫每個檔案蓋上「內容指紋」當版本號（2026-11）
//
// 用法（每次發版前，改完 version.js 的 APP_VERSION 之後）：
//   node splitbill/scripts/stamp-assets.js
//
// 為什麼：以前每次發版，所有檔案的 ?v= 一起換，手機上的快取全部作廢，大家每次
// 更新都要把整個 App 重抓一遍。現在每個檔案的 ?v= 是它自己內容的指紋——沒改到的
// 檔案網址不變，快取繼續用；只有真的改了的檔案會重抓。sw.js 也會比對指紋，
// 確定抓到的內容跟網址對得上才存進快取（部署到一半時 CDN 可能還給舊內容）。
//
// 會更新的地方：
//   1. i18n.js 裡的 SB_LANG_V（日文、英文翻譯檔的指紋，i18n.js 自己動態載入用）
//   2. version.js 裡的 SB_ASSET_V（按需載入的檔案：AI 拆單、表單、節日場景、更新公告…）
//   3. 每個 .html 裡本地 .js / .css 的 ?v=
// 順序有關係：被別人引用的檔案先算，引用它的檔案（i18n.js、version.js）改完才算自己的指紋。
// 指紋演算法要跟 sw.js 的 verifyHash() 一樣：SHA-256 十六進位的前 10 碼。
// ============================================================
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dir = path.resolve(__dirname, "..");
const read = f => fs.readFileSync(path.join(dir, f));
// 用 Git 存的換行（LF）算：GitHub Pages 送出去的是 LF，Windows 上的工作副本可能被轉成 CRLF
const hashOf = f => crypto.createHash("sha256").update(read(f).toString("utf8").replace(/\r\n/g, "\n"), "utf8").digest("hex").slice(0, 10);
const objLiteral = obj => "{" + Object.keys(obj).sort().map(k => JSON.stringify(k) + ": " + JSON.stringify(obj[k])).join(", ") + "}";

function setConst(file, name, value){
  const p = path.join(dir, file);
  const src = fs.readFileSync(p, "utf8");
  const re = new RegExp("const " + name + " = \\{[^}]*\\};");
  if(!re.test(src)) throw new Error(file + " 裡找不到 const " + name + " = {...};");
  fs.writeFileSync(p, src.replace(re, "const " + name + " = " + objLiteral(value) + ";"));
}

// 1. 翻譯檔 → i18n.js
setConst("i18n.js", "SB_LANG_V", { ja: hashOf("i18n-ja.js"), en: hashOf("i18n-en.js") });

// 2. 按需載入的檔案 → version.js
const onDemand = ["ai-receipt.js", "einvoice.js", "expense-form-shared.js", "holiday-scene.js", "release-notes.js"];
const assetV = {};
onDemand.forEach(f => { if(fs.existsSync(path.join(dir, f))) assetV[f] = hashOf(f); });
setConst("version.js", "SB_ASSET_V", assetV);

// 3. 各頁面引用的本地 js / css
const htmlFiles = fs.readdirSync(dir).filter(f => f.endsWith(".html"));
const seen = new Map();
let changed = 0;
for(const h of htmlFiles){
  const p = path.join(dir, h);
  const src = fs.readFileSync(p, "utf8");
  const out = src.replace(/((?:src|href)=")([^":?#]+\.(?:js|css))\?v=[^"]*(")/g, (m, a, file, b) => {
    if(!fs.existsSync(path.join(dir, file))) return m;
    if(!seen.has(file)) seen.set(file, hashOf(file));
    return a + file + "?v=" + seen.get(file) + b;
  });
  if(out !== src){ fs.writeFileSync(p, out); changed++; }
}
console.log("stamped " + seen.size + " files in " + htmlFiles.length + " pages (" + changed + " pages changed); on-demand: " + Object.keys(assetV).length + "; languages: 2");

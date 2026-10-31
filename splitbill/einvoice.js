// ============================================================
// 台灣電子發票 QR code 讀取（2026-11）
// ============================================================
// 電子發票證明聯左右兩個 QR code 依財政部規格記著發票號碼、日期、金額、
// 賣方統編與品項明細。照片裡讀得到的話，品項與金額直接照發票，不用送 AI
// （準確、免費、資料不離開手機）；讀不到再交給 AI 辨識。
//
// 左邊 QR：前 77 碼固定欄位
//   [0,10) 發票字軌號碼  [10,17) 民國年月日  [17,21) 隨機碼
//   [21,29) 銷售額（未稅，16 進位）  [29,37) 總計額（含稅，16 進位）
//   [37,45) 買方統編  [45,53) 賣方統編  [53,77) 加密驗證資訊
// 之後以「:」分隔：營業人自行使用區(10) : 本 QR 記載品目筆數 : 交易品目總筆數 :
//   中文編碼參數(0=Big5, 1=UTF-8, 2=Base64) : 品名 : 數量 : 單價 : 品名 : …
// 右邊 QR：以「**」開頭，接續品名:數量:單價…
//
// QR 解碼用 jsQR（只在掃描時才從 jsDelivr 載入）。頁面與 node 測試都可用：
// 解析函式不碰 DOM。
// ============================================================
(function(){
  const JSQR_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
  let jsqrPromise = null;

  function loadJsQR(){
    if(typeof self.jsQR === "function") return Promise.resolve(self.jsQR);
    if(!jsqrPromise){
      jsqrPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = JSQR_URL;
        s.async = true;
        s.onload = () => (typeof self.jsQR === "function" ? resolve(self.jsQR) : reject(new Error("jsQR missing")));
        s.onerror = () => { jsqrPromise = null; reject(new Error("jsQR load failed")); };
        document.head.appendChild(s);
      });
    }
    return jsqrPromise;
  }

  const LEFT_HEAD = /^[A-Z]{2}\d{8}\d{7}[0-9A-Za-z]{4}[0-9A-Fa-f]{16}\d{8}\d{8}/;

  function decodeBytes(bytes, label){
    try { return new TextDecoder(label).decode(new Uint8Array(bytes)); }
    catch(e){ return null; }
  }
  function asciiOf(bytes){
    let s = "";
    for(let i = 0; i < Math.min(bytes.length, 120); i++) s += String.fromCharCode(bytes[i] & 0x7f);
    return s;
  }
  function base64Utf8(s){
    try {
      const bin = atob(s);
      const bytes = new Uint8Array(bin.length);
      for(let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder("utf-8").decode(bytes);
    } catch(e){ return s; }
  }

  // 品名:數量:單價 三個一組；數量或單價不是數字的那組跳過（有些 POS 會塞空白欄位）
  function readTriples(fields, out, b64){
    for(let i = 0; i + 2 < fields.length; i += 3){
      const name = (b64 ? base64Utf8(fields[i]) : fields[i]).trim();
      const qty = Number(String(fields[i + 1]).trim());
      const price = Number(String(fields[i + 2]).trim());
      if(!name || !isFinite(qty) || !isFinite(price) || qty === 0) continue;
      out.push({ name, qty, price });
    }
  }

  // codes: [{ bytes:number[] | Uint8Array, text?:string }]（jsQR 的 binaryData 優先，才能正確處理 Big5）
  function parseEInvoiceCodes(codes){
    let leftBytes = null;
    const rightBytesList = [];
    for(const c of codes || []){
      const bytes = c.bytes || [];
      const head = asciiOf(bytes);
      if(!leftBytes && LEFT_HEAD.test(head)) leftBytes = bytes;
      else if(head.startsWith("**")) rightBytesList.push(bytes);
    }
    if(!leftBytes) return null;

    const asciiLeft = asciiOf(leftBytes);
    const header = asciiLeft.slice(0, 77);
    const encParam = (asciiLeft.slice(77).split(":")[4] || "1").trim();
    const label = encParam === "0" ? "big5" : "utf-8";
    const left = decodeBytes(leftBytes, label) || asciiLeft;
    const rights = rightBytesList.map(b => decodeBytes(b, label) || "");

    const invoiceNumber = header.slice(0, 10);
    const roc = header.slice(10, 17);
    const year = Number(roc.slice(0, 3)) + 1911;
    const date = `${year}-${roc.slice(3, 5)}-${roc.slice(5, 7)}`;
    const salesAmount = parseInt(header.slice(21, 29), 16);
    const totalAmount = parseInt(header.slice(29, 37), 16);
    const buyerId = header.slice(37, 45);
    const sellerId = header.slice(45, 53);

    const fields = left.slice(77).split(":");
    // fields[0] 是第一個「:」前的空字串，[1] 營業人自行使用區，[2] 本 QR 筆數，[3] 總筆數，[4] 編碼參數，[5…] 品項
    const totalCount = Number(fields[3]) || 0;
    const b64 = encParam === "2";
    const items = [];
    readTriples(fields.slice(5), items, b64);
    for(const r of rights){
      readTriples(r.replace(/^\*\*/, "").split(":"), items, b64);
    }

    return {
      invoiceNumber, date, salesAmount, totalAmount, buyerId, sellerId,
      itemCount: totalCount, items,
      itemsComplete: totalCount === 0 || items.length >= totalCount
    };
  }

  // 依 jsQR 的特性分區掃：一次只會回一個 QR，所以全圖、左半、右半各掃一次，
  // 太大的圖先縮到 1400px 內（jsQR 在中等解析度最穩）。
  async function scanQRCodesFromCanvas(canvas){
    const jsQR = await loadJsQR();
    const found = [];
    const seen = new Set();
    const W = canvas.width, H = canvas.height;
    const regions = [
      [0, 0, W, H],
      [0, 0, Math.round(W * 0.6), H],
      [Math.round(W * 0.4), 0, W - Math.round(W * 0.4), H],
      [0, 0, W, Math.round(H * 0.6)],
      [0, Math.round(H * 0.4), W, H - Math.round(H * 0.4)]
    ];
    for(const [x, y, w, h] of regions){
      for(const maxSide of [1400, 900]){
        const k = Math.min(1, maxSide / Math.max(w, h));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * k));
        c.height = Math.max(1, Math.round(h * k));
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(canvas, x, y, w, h, 0, 0, c.width, c.height);
        const img = ctx.getImageData(0, 0, c.width, c.height);
        const r = jsQR(img.data, c.width, c.height, { inversionAttempts: "attemptBoth" });
        if(r && r.binaryData && r.binaryData.length){
          const key = asciiOf(r.binaryData);
          if(!seen.has(key)){ seen.add(key); found.push({ bytes: r.binaryData, text: r.data }); }
          break; // 這一區找到了就不用再換尺寸
        }
      }
    }
    return found;
  }

  // 讀得到電子發票就回傳解析結果，否則回 null（不丟例外，交給 AI 接手）
  async function readEInvoiceFromCanvas(canvas){
    try {
      const codes = await scanQRCodesFromCanvas(canvas);
      return parseEInvoiceCodes(codes);
    } catch(e){
      console.warn("電子發票 QR 讀取失敗，改用 AI：", e);
      return null;
    }
  }

  self.splitbillParseEInvoiceCodes = parseEInvoiceCodes;
  self.splitbillReadEInvoice = readEInvoiceFromCanvas;
})();

const APP_VERSION = "983";

// 按需載入的檔案各自的內容指紋，由 scripts/stamp-assets.js 自動填，不要手改。
// 網址帶自己的指紋：檔案沒改，網址就不變，手機上的快取可以一直用，更新時不用重抓。
const SB_ASSET_V = {"ai-receipt.js": "8322b8aff7", "einvoice.js": "7bf60ca976", "expense-form-shared.js": "e8a5b90921", "holiday-scene.js": "016805d8c9", "release-notes.js": "f3e7fa4d01"};
function sbAsset(name){ return name + "?v=" + (SB_ASSET_V[name] || APP_VERSION); }

// ============================================================
// Splitbill Smart App Download / Install Floating Banner
// ============================================================
// 2026-11 精簡：
// - 只在總覽頁與登入頁出現（其他頁面是在做事，不該被打擾），同一個工作階段只出現一次
// - 關閉或按下載後 60 天內不再出現
// - 縮成一行（圖示、標題、下載、關閉），並告訴頁面它的高度，讓「記一筆」按鈕讓開
// ============================================================
(function(){
  // 1. 如果已經在原生 Capacitor APK 裡，絕不顯示提示
  if(typeof window.Capacitor !== "undefined" && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform()){
    return;
  }
  // 2. 如果已經在 PWA 獨立全螢幕模式（已加入主畫面），也不顯示提示
  const isStandalone = !!(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || !!window.navigator.standalone;
  if(isStandalone) return;

  // 3. 只在總覽頁與登入頁
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if(page !== "summary.html" && page !== "index.html") return;

  // 4. 關閉或下載過：60 天內不再出現；這個工作階段已經出現過：不再出現
  const DISMISS_KEY = "sb_app_banner_dismissed";
  const SESSION_KEY = "sb_app_banner_shown";
  let dismissedTime = 0;
  try { dismissedTime = Number(localStorage.getItem(DISMISS_KEY) || 0); } catch(e){}
  if(dismissedTime && (Date.now() - dismissedTime < 60 * 24 * 60 * 60 * 1000)) return;
  try { if(sessionStorage.getItem(SESSION_KEY) === "1") return; } catch(e){}

  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  // 只針對 Android 或 iOS 行動裝置顯示專屬提示
  if(!isAndroid && !isIOS) return;

  function showBanner(){
    if(document.getElementById("sbAppInstallBanner")) return;
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch(e){}

    const banner = document.createElement("div");
    banner.id = "sbAppInstallBanner";
    banner.className = "sb-app-banner" + (isIOS ? " is-ios" : "");
    banner.setAttribute("role", "region");

    const tt = (typeof window.t === "function") ? window.t : (k => k);
    const icon = (n) => `<span class="sb-ico" style="--ico:var(--ico-${n})" aria-hidden="true"></span>`;
    banner.setAttribute("aria-label", tt(isIOS ? "banner.iosTitle" : "banner.androidTitle"));

    banner.innerHTML = `
      <div class="sb-app-banner-icon">${icon("smartphone")}</div>
      <div class="sb-app-banner-text">
        <div class="sb-app-banner-title">${tt(isIOS ? "banner.iosTitle" : "banner.androidTitle")}</div>
        <div class="sb-app-banner-desc">${tt(isIOS ? "banner.iosDesc" : "banner.androidDesc")}</div>
      </div>
      ${isAndroid ? `<a class="sb-app-banner-btn" id="sbAppInstallGet" href="splitbill.apk?v=2.5.0">${tt("banner.downloadApk")}</a>` : ""}
      <button type="button" class="sb-app-banner-close" id="sbAppInstallClose" aria-label="${tt("common.close")}">${icon("x")}</button>
    `;
    document.body.appendChild(banner);

    // 讓「記一筆」等浮動按鈕知道要往上讓多少
    const syncHeight = () => {
      document.documentElement.style.setProperty("--app-banner-h", banner.classList.contains("show") ? (banner.offsetHeight + 12) + "px" : "0px");
    };
    setTimeout(()=>{
      banner.classList.add("show");
      document.body.classList.add("has-app-banner");
      syncHeight();
    }, 1200);
    window.addEventListener("resize", syncHeight);

    const dismiss = () => {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch(e){}
      banner.classList.remove("show");
      document.body.classList.remove("has-app-banner");
      syncHeight();
      setTimeout(()=> banner.remove(), 400);
    };
    document.getElementById("sbAppInstallClose").addEventListener("click", dismiss);
    const getBtn = document.getElementById("sbAppInstallGet");
    if(getBtn) getBtn.addEventListener("click", () => setTimeout(dismiss, 300));
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", showBanner);
  } else {
    showBanner();
  }
})();

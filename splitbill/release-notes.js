// ============================================================
// 更新公告：新版第一次打開時跳出來，設定頁的「最新更新項目」也讀這裡。
//
// 要發公告就在最上面加一筆，version 填這次 version.js 的 APP_VERSION。
// 只是小修、不用特別說的版本不必加——沒有新公告就不會跳。
// 同一個人跳過好幾版時，會把中間每一版的公告合在一起顯示（最新的在上）。
// 三種語言都要寫；某種語言漏寫會改用中文。
// ============================================================
window.SB_RELEASE_NOTES = [
  {
    version: "962",
    date: "2026-11-09",
    "zh-Hant": [
      "修正：按「下載 APK」沒有反應",
      "頁面開啟更快：只載入你使用的語言"
    ],
    "ja": [
      "修正：「APK をダウンロード」を押しても反応しない問題",
      "ページの表示を高速化：使用中の言語だけを読み込むように"
    ],
    "en": [
      "Fixed: tapping “Download APK” did nothing",
      "Faster pages: only your language is loaded"
    ]
  },
  {
    version: "961",
    date: "2026-11-09",
    "zh-Hant": [
      "首頁新增「今天」卡片：要填金額的固定支出、今天會自動記的帳、今天的活動都集中在這裡",
      "活動可以「加入行事曆」，App 會直接打開手機行事曆；結束的活動可以「再辦一次」",
      "固定支出可以依類別看每月花多少，或看接下來 30 天會記哪些",
      "彈出視窗可以用返回鍵、點旁邊或 Esc 關掉；打過字的話會先問一句",
      "按鈕和小字放大，手機上比較好按、好讀",
      "修正：半夜到早上 8 點記帳，日期會變成昨天",
      "修正：結算活動時網路不穩，可能重複記兩筆"
    ],
    "ja": [
      "ホームに「今日」カードを追加：金額入力が必要な固定支出、今日自動記録される支出、今日のイベントをまとめて表示",
      "イベントを「カレンダーに追加」できるように（アプリではスマホのカレンダーが直接開きます）。終わったイベントは「もう一度開催」できます",
      "固定支出をカテゴリ別の月額や、今後 30 日の予定で確認できるように",
      "ポップアップは戻るボタン・外側タップ・Esc で閉じられるように。入力途中なら確認します",
      "ボタンと小さい文字を大きくして、スマホで押しやすく読みやすく",
      "修正：深夜〜朝 8 時に記録すると日付が前日になる問題",
      "修正：イベント精算時に通信が不安定だと二重に記録されることがある問題"
    ],
    "en": [
      "A new “Today” card on Home: fixed costs that need an amount, what gets auto-recorded today, and today’s events",
      "Events can be added to your calendar (the app opens your phone’s calendar directly), and past events can be run again",
      "Fixed costs can be viewed by category with a monthly total, or as a timeline of the next 30 days",
      "Close pop-ups with the back button, a tap outside, or Esc — you’ll be asked first if you typed something",
      "Bigger buttons and small text, easier to tap and read on phones",
      "Fixed: expenses recorded between midnight and 8am got yesterday’s date",
      "Fixed: closing an event on a shaky connection could record it twice"
    ]
  }
];

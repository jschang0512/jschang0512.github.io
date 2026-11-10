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
    version: "976",
    date: "2026-11-11",
    "zh-Hant": [
      "派派一天只完整出現一次，其他時候會變成標題旁的 logo，點一下就能聽它唸",
      "還清欠款時，派派會出來開心一下",
      "記帳時如果還欠別人錢，派派可能會在成功畫面吐槽你（一天最多一次）",
      "設定 → 偏好設定可以把派派調成「溫和」或「關閉」"
    ],
    "ja": [
      "パイパイが全面に出てくるのは 1 日 1 回だけ。それ以外はタイトル横のロゴになり、タップすると話しかけてきます",
      "完済するとパイパイが喜びます",
      "まだ返していないお金があるのに記録すると、完了画面でツッコまれることがあります（1 日 1 回まで）",
      "設定 → 環境設定でパイパイを「やさしめ」や「オフ」にできます"
    ],
    "en": [
      "Pie now shows up in full only once a day; the rest of the time it lives in the logo next to the page title, tap to hear it out",
      "Pay off a debt and Pie celebrates with you",
      "If you still owe someone, Pie may roast you on the saved screen when you log an expense (once a day at most)",
      "In Settings → Preferences you can set Pie to Gentle or turn it off"
    ]
  },
  {
    version: "975",
    date: "2026-11-11",
    "zh-Hant": [
      "派派有 12 種表情了，每句台詞配自己的表情",
      "台詞更兇、情勒句更多，每天換一句",
      "派派看「欠多少」加上「欠多久」決定有多兇：小錢拖很久才出現，大錢很快就翻臉（NT$1,000 大約兩週出現、90 天裂開）"
    ],
    "ja": [
      "パイパイの表情が 12 種類に。セリフごとに顔が変わります",
      "セリフがより辛口に、泣き落としも増えました。毎日入れ替わります",
      "「いくら」と「何日」の両方で怒り具合が決まります。少額はなかなか出てこず、大きな額はすぐ本気に（NT$1,000 なら約 2 週間で登場、90 日で割れます）"
    ],
    "en": [
      "Pie now has 12 expressions, and each line comes with its own face",
      "Sharper lines and more guilt trips, rotating daily",
      "How fierce Pie gets now depends on both how much and how long: small change takes ages, big amounts escalate fast (NT$1,000 shows up after about two weeks and cracks at 90 days)"
    ]
  },
  {
    version: "974",
    date: "2026-11-11",
    "zh-Hant": [
      "新角色「派派」登場：欠人錢超過一週沒還，它就會出來提醒你；拖越久越戲精，60 天會直接裂開",
      "按「現在去還」直接跳到記錄還款；按「明天再說」，它隔天會記得",
      "別人欠你太久，派派也會問要不要幫你催"
    ],
    "ja": [
      "新キャラ「パイパイ」登場：1 週間以上返していないお金があると声をかけてきます。放っておくほど大げさになり、60 日で割れます",
      "「今すぐ返す」で返済の記録へ直行。「また明日」と言うと、翌日ちゃんと覚えています",
      "相手の返済が長く止まっているときは、代わりに催促するか聞いてくれます"
    ],
    "en": [
      "Meet Pie: if you've owed someone for over a week, Pie shows up to remind you, getting more dramatic the longer it waits, and literally cracks at 60 days",
      "“Pay now” jumps straight to recording the repayment; say “Tomorrow” and Pie will remember",
      "When someone has owed you for a while, Pie offers to nudge them for you"
    ]
  },
  {
    version: "972",
    date: "2026-11-10",
    "zh-Hant": [
      "更新更省流量：以後每次更新只下載有改到的部分，不用整個 App 重抓",
      "開啟更快：AI 拆單等到要用時才載入；別人記帳時只更新那一筆，不再整頁重新讀取",
      "修正：通知會在背景重複連線，久開會多耗電"
    ],
    "ja": [
      "アップデートの通信量を削減：今後は変更された部分だけをダウンロード",
      "起動を高速化：AI 解析は使うときに読み込み、他の人が記録したときはその 1 件だけを更新",
      "修正：通知がバックグラウンドで重複接続し、開きっぱなしだと電池を多く使う問題"
    ],
    "en": [
      "Lighter updates: from now on only the parts that changed are downloaded, not the whole app",
      "Faster: AI Splitting loads only when you use it, and when someone else records an expense only that entry is refreshed",
      "Fixed: notifications could open duplicate background connections and drain battery over time"
    ]
  },
  {
    version: "969",
    date: "2026-11-10",
    "zh-Hant": [
      "電腦版左側選單最上面有「＋ 記一筆」，每個幣別旁邊直接顯示你在那個幣別的款項",
      "電腦版幣別的總表／支出／還款／紀錄移進選單，頁首改成靠左的標題",
      "鍵盤快捷鍵：N 記一筆、H 回首頁、1–4 切分頁、/ 搜尋紀錄，按 ? 看全部",
      "平板橫放時左邊有只有圖示的窄選單"
    ],
    "ja": [
      "PC 版の左メニュー上部に「＋ 記録する」、各通貨の横に自分の残高を表示",
      "PC 版では通貨ページの総表／支出／返済／履歴をメニューに移動し、見出しを左寄せに",
      "キーボードショートカット：N 記録、H ホーム、1–4 タブ切替、/ 履歴検索。? で一覧",
      "タブレット横向きではアイコンだけの細いメニューを表示"
    ],
    "en": [
      "The desktop sidebar now starts with “+ New expense”, and each currency shows your balance next to it",
      "On desktop, a currency’s Overview / Expense / Repay / History live in the sidebar, and page titles are left-aligned",
      "Keyboard shortcuts: N new expense, H home, 1–4 switch tabs, / search history — press ? for the list",
      "Tablets in landscape get a slim icon-only sidebar"
    ]
  },
  {
    version: "966",
    date: "2026-11-10",
    "zh-Hant": [
      "電腦版左側選單加上頭像、群組切換、通知、深淺色切換和登出，頁首變得更清爽",
      "固定收支、活動頁也有通知鈴鐺了"
    ],
    "ja": [
      "PC 版の左メニューにアイコン・グループ切替・通知・ダークモード切替・ログアウトを追加し、ヘッダーをすっきり",
      "固定収支・イベントのページにも通知ベルを追加"
    ],
    "en": [
      "The desktop sidebar now holds your avatar, group switcher, notifications, dark-mode toggle and log out, so the header is cleaner",
      "The fixed-cost and events pages now have the notification bell too"
    ]
  },
  {
    version: "965",
    date: "2026-11-10",
    "zh-Hant": [
      "電腦版改版：左側選單一眼看到所有幣別和工具，首頁與總表分成左右兩欄",
      "電腦和平板上表單不再拉得很寬；固定支出、活動卡片排成兩欄",
      "手機上「我的款項」放到最上面，圖表的日期切換和週／月選單合成一行"
    ],
    "ja": [
      "PC 版を刷新：左のメニューで通貨とツールが一目でわかり、ホームと総表は 2 列表示に",
      "PC・タブレットでフォームが横に広がりすぎないように。固定支出とイベントのカードは 2 列に",
      "スマホでは「自分の残高」を一番上に。グラフの期間切替と週／月メニューを 1 行に"
    ],
    "en": [
      "Desktop redesign: a sidebar shows every currency and tool at a glance, and Home and the overview use two columns",
      "Forms no longer stretch across wide screens; fixed-cost and event cards sit in two columns on tablets and computers",
      "On phones, My Balance comes first, and the chart’s date and week/month controls share one row"
    ]
  },
  {
    version: "964",
    date: "2026-11-09",
    "zh-Hant": [
      "彈出視窗關掉時也有動畫；手機上可以往下拖把視窗關掉",
      "動畫改得更平順，切換深色模式時整頁一次換好",
      "金額數字等寬，上下排得更整齊",
      "報名活動後，人數條和頭像會有小動畫"
    ],
    "ja": [
      "ポップアップを閉じるときもアニメーション。スマホでは下にスワイプして閉じられます",
      "アニメーションをよりなめらかに。ダークモード切替時は画面全体が一度に切り替わります",
      "金額の数字を等幅にして、縦にきれいにそろうように",
      "イベントに参加すると、人数バーとアイコンが小さく動きます"
    ],
    "en": [
      "Pop-ups now animate when they close too, and on phones you can swipe them down to close",
      "Smoother animations, and switching dark mode changes the whole page at once",
      "Amounts use even-width digits so they line up neatly",
      "Joining an event gives a small animation on the head count and avatars"
    ]
  },
  {
    version: "963",
    date: "2026-11-09",
    "zh-Hant": [
      "點開兩人的往來明細，可以「複製轉帳資訊」：金額和對方的收款帳戶一次複製，直接貼到聊天室",
      "通知清單改成彈出視窗，手機上從底部滑出，比較好讀"
    ],
    "ja": [
      "2 人の取引明細で「振込情報をコピー」：金額と相手の受取口座をまとめてコピーして、そのままチャットに貼れます",
      "通知一覧をポップアップに変更。スマホでは下から表示されて読みやすく"
    ],
    "en": [
      "In the details between two people, “Copy payment details” copies the amount and their payment account so you can paste it into your chat",
      "Notifications now open in a pop-up — a bottom sheet on phones, easier to read"
    ]
  },
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

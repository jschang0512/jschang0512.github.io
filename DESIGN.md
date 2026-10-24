---
name: 張家菘 · Chia-Sung Chang
description: 個人的學術與生活工具——學術履歷、研究工具、教學與私人生活工具，依用途各有主題
colors:
  paper: "oklch(97% 0.010 145)"
  paper-2: "oklch(94.5% 0.015 145)"
  paper-3: "oklch(91.5% 0.018 145)"
  rule: "oklch(86% 0.016 145)"
  neutral: "oklch(58% 0.016 150)"
  muted: "oklch(44% 0.018 155)"
  ink: "oklch(23% 0.025 160)"
  forest: "oklch(35% 0.060 155)"
  forest-2: "oklch(45% 0.070 155)"
  copper: "oklch(52% 0.115 48)"
  copper-ink: "oklch(98% 0.008 80)"
  copper-soft: "oklch(93% 0.035 60)"
  review: "oklch(45% 0.090 75)"
  review-bg: "oklch(93% 0.040 85)"
typography:
  display:
    fontFamily: "Fraunces, Noto Serif TC, Noto Serif JP, ui-serif, Georgia, serif"
    fontSize: "clamp(2.75rem, 4.5vw + 1rem, 4.5rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.005em"
  headline:
    fontFamily: "Fraunces, Noto Serif TC, Noto Serif JP, ui-serif, Georgia, serif"
    fontSize: "1.9531rem"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Noto Sans TC, Noto Sans JP, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Noto Sans TC, Noto Sans JP, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Noto Sans TC, Noto Sans JP, PingFang TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.5
rounded:
  sm: "4px"
  pill: "999px"
spacing:
  3xs: "0.125rem"
  2xs: "0.25rem"
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2.5rem"
  2xl: "4rem"
  3xl: "6rem"
components:
  button-primary:
    backgroundColor: "{colors.copper}"
    textColor: "{colors.copper-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 1.5rem"
  button-primary-hover:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.paper}"
  button-secondary:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 1.5rem"
  control-pill:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 0.75rem"
  chip:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.75rem"
  chip-review:
    backgroundColor: "{colors.review-bg}"
    textColor: "{colors.review}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.75rem"
  photo:
    backgroundColor: "{colors.paper-3}"
    rounded: "{rounded.sm}"
---

# Design System: 張家菘 · Chia-Sung Chang

## Overview

**Creative North Star: "個人的學術與生活工具"**

這個網站不是一個品牌，而是一個人的工具箱。學術履歷、研究工具、教學、私人生活工具住在同一個網域，各自依用途定主題。它們之所以是一家人，靠的是一套共同的骨架，而不是同一個顏色：
- 同一組字體：Fraunces 展示字搭 Noto Sans TC 內文。
- 同一種分隔語言：紙張底色加細線，而不是一疊卡片。
- 同一套圓角：小圓角、膠囊按鈕。
- 同一個習慣：OKLCH 色票，每頁都支援深淺兩種模式。

每一區依用途有自己的主題，主色只在該區內有效：

| 區域 | 主題 | 用途 | 主題色 |
| --- | --- | --- | --- |
| CV、blog、404 | **學術期刊**（Garden） | 閱讀、建立可信度 | 森林綠＋銅色（本檔 token 即此套） |
| Research Toolkit | **精密工作台**（Cobalt） | 操作：填資料、匯出論文圖表 | 鈷藍 |
| NMA 教學 | **教科書** | 逐步閱讀並照做 | 藍色、程式碼底色 |
| 行程頁 | 各趟旅行自己的顏色 | 旅途中查看 | 每趟的 `theme.css` |
| menu 書籤 | 深夜藍（Midnight） | 私人索引 | 深藍底、青綠 accent |
| 調劑台複習 | 藥局綠 | 執業時手機上複習 | 深綠＋米紙色 |

splitbill 是獨立的公開工具，維持現狀，不受本系統約束。

**Key Characteristics:**
- 紙張底色，絕不用純白或純黑；中性色都帶一點綠、藍等色相。
- 以細線分組，盡量不用卡片；不用卡片包卡片，也不用粗的彩色側邊條。
- 展示字用 Fraunces；中文標題落到 Noto Serif TC，內文一律用 Noto Sans TC。
- 每頁都有深淺兩種模式，並且用同一組 token 名稱互換。
- 工作工具精準而克制；生活工具溫和而親切。

## Colors

CV 這一套是「森林與銅」：深森林綠負責權威感，銅色只負責「這裡可以按」和日期這類標記，其餘交給帶綠調的紙與墨。

### Primary
- **Deep Forest**（forest）：姓名、區塊標題、統計數字、強調文字。CV 的權威感來自它，不來自銅色。
- **Moss Forest**（forest-2）：小標籤、欄位標題、次要的標記文字。

### Secondary
- **Burnished Copper**（copper）：主要按鈕、時間軸上的日期、出版編號、hover 底線、焦點框。它是唯一的強調色，用量要少。
- **Copper Ink**（copper-ink）：銅色底上的文字。
- **Copper Wash**（copper-soft）：極少數需要淡銅底的提示區。

### Tertiary
- **Ochre Review**（review / review-bg）：出版狀態「審查中」的膠囊，只用在狀態標記。

### Neutral
- **Garden Paper**（paper）：頁面底色。
- **Pressed Leaf**（paper-2 / paper-3）：膠囊、照片占位、點擊時的底色。
- **Hairline**（rule）：所有分隔線、按鈕與控制項的邊框。
- **Stem**（neutral）：hover 時的邊框。
- **Bark**（muted）：說明文字、次要資訊。
- **Ink**（ink）：主文字。

深色模式色相不變，只調明度：紙張落在 L 17–23%，墨落在 L 94%，森林綠和銅色各自提亮到 L 84% 與 L 74%。

### Named Rules
**The One Copper Rule.** 銅色只標記「可以按」或「時間點」，一個畫面裡的面積不超過約 5%。標題永遠用森林綠，不用銅色。

**The Room Color Rule.** 每一區只用自己那一區的主題色。Toolkit 不出現森林綠，CV 不出現鈷藍。跨區共用的只有字體、形狀和分隔語言。

**The Tinted Neutral Rule.** 中性色一律帶該區的色相：CV 偏綠，Toolkit 偏藍。不用零彩度的灰。

## Typography

**Display Font:** Fraunces（中文落到 Noto Serif TC，日文落到 Noto Serif JP）
**Body Font:** Noto Sans TC（日文用 Noto Sans JP）

**Character:** Fraunces 粗體帶一點期刊刊頭的分量，Noto Sans TC 讓中英日三語的內文穩定好讀。只有這兩個家族，數字用 tabular-nums 對齊，不另外引入等寬字體當標籤。

### Hierarchy
- **Display**：只用在 CV 的姓名和 404 的「404」。
- **Headline**：區塊標題（研究方向、學經歷、學術著作…），森林綠。
- **Title**：副標、大段導言、出版編號。
- **Body**：內文，段落最寬約 60–65ch。
- **Label**：導覽、日期、標籤、膠囊，粗體小字，不轉大寫也不加字距。

工具頁沿用同一對字體，但密度較高：內文 14px、行高 1.5。工具名稱用 Fraunces 19px，表單區塊標題用 Noto Sans TC 15px 粗體。

### Named Rules
**The Upright Heading Rule.** 標題與展示字一律正體，不用斜體，也不把標題裡的某個字轉成斜體來強調。

**The No Eyebrow Rule.** 不在標題上方或旁邊放大寫加字距的英文小標（例如「TRAVEL LOG」「BLOG」）。標題自己就要能說清楚。

## Layout

- **學術期刊（CV、blog）**：長文件式版面，內容寬 1120px，左右留白 1.5rem。
  - Hero 是左文右照的兩欄（1.55fr : 1fr），≤900px 時收成單欄。
  - 區塊之間用細線分隔，每節開頭只放一個 Fraunces 標題。
  - 時間軸是「日期欄 7.5rem＋內容」的兩欄，≤640px 時日期移到內容上方。
- **精密工作台（Toolkit）**：
  - 首頁是索引清單，一行一個工具：名稱、說明、標籤三欄，≤760px 時堆疊。
  - 工具頁左邊是表單欄（340–460px，RoB 工具放寬到 600px），右邊是固定在畫面上的預覽欄，≤960px 時改成單欄。
  - 手機上用浮動按鈕跳到預覽區。
- **共通規則**：
  - `html, body { overflow-x: clip }`，在 320、375、414、768px 下都不能橫向捲動。
  - 含圖片的 grid 軌道用 `minmax(0, 1fr)`。
  - 大標題要能在長字中間斷行（`overflow-wrap: anywhere`）。
- **間距**：以 4pt 為基礎，依角色命名（3xs 到 3xl）。區塊之間用 2xl–3xl，元件內用 xs–md。

## Elevation & Depth

整體以平面加細線為主：分組靠紙張的明度層次（paper → paper-2 → paper-3）和 1px 細線。陰影允許輕微使用，但只用來表達浮起或狀態，不當裝飾：
- 卡片可以有很淡的環境陰影。
- 浮層（底部彈出面板、地圖彈窗、浮動按鈕）可以有比較明顯的陰影。

深色模式不靠陰影做深度，而是讓抬高的表面更亮（每層 +3% 明度）。

### Shadow Vocabulary
- **Ambient Card**（`box-shadow: 0 1px 2px rgba(36,32,36,.06)`）：生活工具中可以點的卡片，靜止時最多到這個程度。
- **Floating Sheet**（`box-shadow: 0 -8px 30px rgba(0,0,0,.2)`）：從底部滑出的面板。

### Named Rules
**The Light Touch Rule.** 陰影只能輕：模糊不超過 30px，透明度不超過 .2。工作工具的表單區不用陰影，改用細線和底色分組。

## Shapes

形狀語言只有兩種：
- **小圓角（4px）**：照片、程式碼、資訊框這類「物件」。
- **膠囊（999px）**：按鈕、語言切換、標籤、狀態這類「可操作或可篩選」的東西。

工作工具的面板和輸入框用 8px 圓角。生活工具可以放寬到 12–14px，讓它更親切。

邊框一律 1px，不同狀態之間不改變粗細。分組優先用細線，不用整圈的框。

## Components

### Buttons
精準而克制：只換顏色，不跳動、不放大。
- **Shape**：膠囊（999px），高 44px，左右各 1.5rem。
- **Primary**：銅色底、copper-ink 字，粗體。一個畫面只有一個，例如 CV 的「聯絡我」。
- **Hover / Focus**：hover 時底色換成森林綠、字換成紙色，過渡 120ms，使用 ease-out。焦點框是 2px 銅色外框、外推 2px，而且要瞬間出現，不做進場動畫。
- **Secondary**：透明底、1px 細線邊框、墨色字；hover 時邊框換成墨色，按下時底色換成 paper-2。
- **Toolkit Primary**：鈷藍底配 accent-ink 字（深色模式下是深字），圓角 7px，高度比 CV 的按鈕緊湊。

### Chips
- **Style**：paper-2 底、墨色字、膠囊形、粗體小字，不加邊框。
- **State**：狀態膠囊依語意上色，例如「審查中」用赭色。工具首頁的標籤用該區淡主題底配主題色字。

### Cards / Containers
- **Corner Style**：學術頁幾乎不用卡片；聯絡區是用 2px 森林綠上邊線收尾的區塊，不是卡片。
- **Background**：生活工具（行程、調劑台）的卡片底色比紙張略亮。
- **Shadow Strategy**：見 Elevation & Depth 的 Ambient Card。
- **Border**：1px，顏色用 rule。有語意的卡片（危險、要調整）把整圈 1px 邊框換成語意色，不用粗側邊條。
- **Internal Padding**：12–16px。

### Inputs / Fields
- **Style**：panel-2 底、1px 細線邊框、7–8px 圓角，內距 6px 8px。
- **Focus**：2px 主題色外框、外推 1px，邊框粗細不變。
- **Error**：用危險色的邊框加外框；自動算出的值用主題色斜體占位字表示。

### Navigation
- **CV**：齊左的純文字連結，小字，muted 色；hover 時換成墨色並出現銅色底線。右側是分享、深色模式、語言切換這些膠囊控制項，語言切換的選中狀態用墨色邊框加粗體。
- **工具頁**：頂列是「← 工具首頁」文字連結、Fraunces 工具名，以及右側的按鈕列；手機上按鈕列改成可以橫向滑動，不換行。

### Timeline Row
CV 最有辨識度的元件：日期欄（7.5rem，銅色粗體 tabular-nums）配上內容欄（標題、單位、說明），每列之間用 1px 細線分隔。學經歷、獎項、時間相關的清單都用這個形式。

### Tool Index Row
Toolkit 首頁的一行：Fraunces 工具名後面接主題色的「→」（用不斷行空白黏在名稱上），中間是 muted 說明，右側是主題色標籤。列與列之間用細線分隔，不用圖示方塊。

### Named Rules
**The Two Temperaments Rule.** 工作工具（CV、Toolkit、NMA）精準而克制：細邊框、膠囊按鈕、狀態只換顏色。生活工具（行程、調劑台、書籤）溫和而親切：圓角可以放寬到 12–14px、底色更柔和，也可以用輕微的陰影，但仍然不用漸層和 emoji 圖示。

## Do's and Don'ts

### Do:
- **Do** 所有顏色和字體都引用 `:root` 上的具名 token；需要新值時，先加進 token 區再使用。
- **Do** 每頁都同時定義淺色與深色，用同一組 token 名稱互換，並確認文字對比至少 4.5:1。
- **Do** 用細線（1px，rule 色）分組。分隔線比卡片優先。
- **Do** 數字（日期、編號、統計）用 tabular-nums。
- **Do** 過渡效果明確寫出屬性（color、border-color、background-color），使用 ease-out，時間 120–220ms，並且支援 prefers-reduced-motion。

### Don't:
- **Don't** 在標題上用漸層文字，或用漸層膠囊按鈕。
- **Don't** 用粗的彩色側邊條標記卡片，也不要卡片包卡片。
- **Don't** 用 emoji 當主圖示（工具按鈕、功能入口、徽章）。純文字符號例如 ⚠ ✓ ✕ 可以用。
- **Don't** 在標題上下或兩側放大寫加字距的英文小標，或打字機、游標這類裝飾性動效。
- **Don't** 把一區的主題色帶到另一區，例如 CV 出現鈷藍、Toolkit 出現森林綠。
- **Don't** 編造數字、推薦語或使用量。沒有資料的地方留白，或標示待確認。

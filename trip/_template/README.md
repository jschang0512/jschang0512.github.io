# 新增一趟行程

所有行程頁共用同一套程式（`trip/engine/`）。每一趟只需要一個資料夾，裡面放三個檔案：

| 檔案 | 內容 |
| --- | --- |
| `schedule.html` | 頁面外殼，只要改 3 個地方 |
| `data.js` | 這趟的設定和全部行程資料 |
| `theme.css` | 這趟的配色 |

## 步驟

1. 把 `_template` 整個資料夾複製一份，改成英文名稱，例如 `trip/tokyo/`。
   不要以底線開頭：GitHub Pages 不會發布底線開頭的資料夾，所以 `_template` 本身不會出現在網站上。
2. 打開 `schedule.html`，修改標了 `TRIP` 的三個地方：
   - `localStorage` 的 key：要和 `data.js` 裡的 `TRIP.key` 一致，例如 `tokyo-theme` 對應 `key: "tokyo"`。
   - `<title>`
   - `<h1>`：行程確定後，把「尚未定案」那一行刪掉。
3. 打開 `data.js`：
   - 填 `TRIP` 設定：目的地、日期、出發時間、地震範圍等。
   - 填行程：`days`、`INFO`、`COORDS`、`FLIGHTS`、`PACKING`、`WEATHER_CITIES`。
   - 每個地點名稱同時是 `INFO` 和 `COORDS` 的 key，也是 Google 地圖的搜尋字。名稱拼錯就不會出現地圖上的點。
4. 想換顏色就改 `theme.css`。主要是 `--accent`（主色）和 `--accent-text`（文字用的深色版），以及對應的 `--tint*`。
5. 在 `trip/index.html` 加一張卡片，用 `data-start`、`data-end` 標日期，頁面會自動排序並顯示狀態：

   ```html
   <a class="trip-card" href="tokyo/schedule.html" data-start="2027-01-10" data-end="2027-01-11">
     <div class="trip-eyebrow">Tokyo · 2 Days</div>
     <div class="trip-title">東京行程表</div>
     <div class="trip-dates">2027年01月10日 – 01月11日</div>
     <div class="trip-route">淺草・上野</div>
     <div class="trip-cta">查看行程 <span class="arrow">→</span></div>
   </a>
   ```

## 選用功能

功能開關都在 `TRIP` 裡：

- `sun: true`：每天顯示日出、日落時間。
- `food: { city: "福岡" }`：加上美食・伴手禮頁，資料寫在 `FOOD_AREAS`，格式可以參考 `../fukuoka/data.js`。
- `contactsGate: { question, answer }`：打開聯絡資訊前要先答題。
  這只是好玩的小關卡，不是密碼保護，答案就寫在公開的 `data.js` 裡。
- `branch: { fromDay: 5 }`：從第 6 天（索引 5）開始，地圖路線改用 `colors.branch` 的顏色。
- `couponFile`：`INFO` 裡寫了 `coupon` 的景點，會附上這個 PDF 的下載連結。

## 修改共用的版面或功能

改 `trip/engine/trip.css` 或 `trip/engine/trip.js`，所有行程頁會一起更新。

# NTU Water Risk Map｜台大水資源問題地圖

校園互動式地圖 Web App。讓台大師生即時回報淹水、積水、設施漏水、排水不良等水資源問題，並透過儀表板與管理後台追蹤高風險區域。

## 技術堆疊

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS（自訂設計系統）
- React Leaflet / Leaflet（互動地圖）
- Supabase（資料庫 + 圖片儲存，可選；預設 mock）
- Recharts（儀表板圖表）

## 功能

| 路徑 | 說明 |
| --- | --- |
| `/` | 校園地圖首頁，顯示所有 reports，提供 filter、回報、高風險地點排行 |
| `/route` | 雨天路徑規劃：依即時氣象 + 校園積水回報，建議步行/腳踏車路徑 |
| `/dashboard` | 統計圖表、類別分布、近 7 日趨勢、高風險地點排行 |
| `/admin` | 簡易管理後台（密碼登入），可改 status、加 admin_note、刪除、匯出 CSV |

### 雨天路徑規劃（/route）

- 串接 **中央氣象署 OpenData**（觀測 `O-A0003-001`、預報 `F-D0047-061`），抓取大安區即時雨量、降雨機率、氣溫、濕度。沒設定 `CWA_API_KEY` 時自動 fallback 到 mock 資料，零配置即可體驗。
- **真正的校園步行/騎車導航**。系統使用兩層 GeoJSON：
  - `src/data/campus.geojson` — 22 個有名稱的地標（校門口、傅鐘、共教、活大…），給 UI 起終點挑選。
  - `src/data/campus-paths.geojson` — 由 OSM Overpass 抓回的 NTU 校內**完整步行/騎車路網**：6133 個路徑節點、7248 條邊；3MB，只在 server-side 載入。
- 每條邊都有 `covered` / `lowLying` / `bikeAllowed`，從 OSM tags 推論：
  - `indoor=yes` / `tunnel=yes` / `covered=yes` / `highway=corridor` → covered ≈ 0.95（穿越學生活動中心、室內走廊都吃這條）
  - `arcade=yes` → covered ≈ 0.85（騎樓）
  - 還有手動 override 區（椰林大道兩側、行政大樓迴廊、活大周邊…）
  - 易積水區手動標：小椰林道、醉月湖、總圖前廣場、舟山路低處
- **路徑演算法**（`src/lib/denseGraph.ts`）：server-side Dijkstra (二元堆 priority queue)，
  ```
  cost = distance × (1 + 雨勢係數 × (2.4 × (1-covered) + 2.2 × lowLying + 0.8 × 積水回報數))
  ```
  雨大時防雨路徑遮蔽率可達 30%+，但只比最短路徑多走 ~50m。
- 使用者選好兩端 → server snap 到最近的真實 OSM 路徑節點 → Dijkstra → 直接回傳一條沿真實道路的折線（不再需要 OSRM 對齊）。
- 同時顯示「防雨建議」（綠粗線）與「最短路徑」（灰虛線）做對比，並比較遮蔽率／易積水比例／途中積水回報數。
- 會把目前 active 的 `flooding` / `standing_water` 回報納入路網懲罰；用戶在 `/` 新增的回報會即時影響規劃。

#### 重新建構校園路網

```bash
# 重抓 OSM 校園步行/騎車路網（產 campus-paths.geojson 約 3MB）
npm run build-paths

# 用 OSM 校正 campus.geojson 的地標座標（少量資料）
npm run refresh-osm

# 為新增的地標到 Overpass 反查 osm reference 並寫入 campus.geojson
# （anchors 表寫死在 scripts/discover-osm-landmarks.mjs 裡）
npm run discover-osm
```

`campus-paths.geojson` 在 git 裡建議 commit（之後使用者 clone 就不用網路），需要更新時再跑 `npm run build-paths`。
要調整遮蔽 / 易積水的判斷規則，編輯 `scripts/build-dense-graph.mjs` 裡的 `COVERED_AREAS` / `LOW_LYING_AREAS` 多邊形再重跑即可。

## 安裝

```bash
npm install
cp .env.example .env.local
npm run dev
```

開啟 <http://localhost:3000>

> 預設 `NEXT_PUBLIC_USE_MOCK=true`，會用內建假資料。

## 設定 Supabase（選用）

1. 到 <https://supabase.com> 建立專案。
2. 在 SQL Editor 執行 `supabase/migrations/001_create_tables.sql`：

   ```sql
   -- 內容包含 reports、report_confirmations 兩個資料表，以及對應 RLS / 觸發器
   ```

3. 進入 Storage 建立一個 bucket，名稱為 `report-images`（公開讀取）。
4. 在 `.env.local` 填入：

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=report-images
   NEXT_PUBLIC_USE_MOCK=false
   ADMIN_PASSWORD=請改成更強的密碼
   ```

5. 重新 `npm run dev`，即可改為使用 Supabase。

## 設定 CWA 中央氣象署 API（選用，啟用真實氣象）

1. 到 <https://opendata.cwa.gov.tw/userLogin> 註冊（免費）並到「開發者」→ 取得授權碼。
2. 在 `.env.local` 加上：

   ```bash
   CWA_API_KEY=CWA-YOUR-KEY-HERE
   ```

3. 重啟 dev server。`/route` 頁面右上角的氣象徽章會顯示 `CWA 即時`；沒設則顯示 `Mock 模擬`。
4. 取得的資料 server-side 由 `/api/weather` 代理，金鑰不會暴露在 client。

## 部署到 Vercel

> 本專案 10 個 API route 全部需要 Node.js runtime，**不能** 用 GitHub Pages 之類純靜態託管。Vercel 是 Next.js 親兒子，hobby tier 免費就能跑。

```bash
# 1. 把本地 commit push 到 GitHub
git add . && git commit -m "feat: deployment ready"
git push -u origin main
```

```
2. 到 https://vercel.com 用 GitHub 帳號登入 → Import Project → 選你的 repo
3. 在 Settings → Environment Variables 加：
     NEXT_PUBLIC_USE_MOCK = true              # 必填，沒接 Supabase 時用 mock
     ADMIN_PASSWORD       = <你想要的密碼>     # 必填，admin 後台用
     CWA_API_KEY          = <CWA 金鑰>         # 選填，有的話氣象資料即時
4. 點 Deploy，等 1–2 分鐘給你一個 xxx.vercel.app
```

部署設定已寫死在 [vercel.json](vercel.json)：
- `regions: ["hnd1"]` — Tokyo，離台灣最近
- `/api/route` 與 `/api/forecast` 給 30s timeout（要載 3MB GeoJSON + Dijkstra）

> ⚠️ Demo 注意：mock 模式下使用者回報（飲水機、淹水）存在 in-memory store，serverless cold start 會重置。要長期上線需接 Supabase。

## 專案結構

```
src/
  app/
    page.tsx              # 首頁（地圖 + 側欄）
    route/page.tsx        # 雨天路徑規劃
    dashboard/page.tsx    # 儀表板
    admin/page.tsx        # 管理後台
    api/
      reports/route.ts
      reports/[id]/route.ts
      reports/[id]/confirm/route.ts
      stats/route.ts
      weather/route.ts          # CWA 代理 API
      route/route.ts            # 雨天 Dijkstra（server-side）
  components/
    map/                  # CampusMap, ReportMarker, ReportPopup, LocationPicker, RouteMap
    reports/              # ReportForm, ReportFilter, ReportDetailModal, ReportCard
    route/                # RoutePanel, WeatherBadge
    dashboard/            # StatsCards, CategoryChart, TrendChart, RiskRanking
    admin/                # AdminReportTable, StatusBadge, AdminLogin
    ui/                   # Button, Badge, Modal …
  lib/
    supabase.ts           # Supabase / Mock 切換
    types.ts
    risk.ts               # risk_score 計算
    utils.ts
    mockData.ts           # 預設假資料 + in-memory store
    weather.ts            # CWA OpenData 串接 + mock fallback
    campus.ts             # 從 GeoJSON 載入「有名稱的地標」（client + server）
    denseGraph.ts         # server-side: 載入 OSM 密集路網 + Dijkstra
data/
  campus.geojson          # 22 個地標（給 UI start/end 選單）
  campus-paths.geojson    # OSM 抓回的密集步行/騎車路網（server only, ~3MB）
scripts/
  build-dense-graph.mjs   # 重建 campus-paths.geojson
  refresh-campus-osm.mjs  # 用 OSM 校正 campus.geojson 地標座標
supabase/
  migrations/001_create_tables.sql
```

## risk_score 規則

```
risk_score = report_count * 2 + high_severity_count * 3 + recent_7_days_count * 2
score >= 9   → high
score >= 4   → medium
其他        → low
```

## 後續擴充建議

- 為 reports / report_confirmations 加上 RLS 限制（目前 migration 提供範例）
- 接入 NTU SSO 或 Magic Link 驗證
- 在 `/admin` 加入更完整的角色權限
- 將 mock 切換為 Supabase 後，可在 Storage 上開啟 image transformation

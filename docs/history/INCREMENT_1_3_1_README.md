# Increment 1.3.1 — 路線管理 Supabase 整合

版本：2026-10-18。保留既有 v0.5.5 頁面、四個新 Dashboard 樣式及 `js/config.js`；此 ZIP **不包含 config.js**。

## 安裝（務必按順序）

1. **先備份專案，並在 Supabase 建立資料庫備份或還原點**。現有營運資料不應重置。
2. 將本 ZIP 解壓到 `dispatch-system-v0.5.5/` 的**上一層目錄**，合併檔案。這是增量補丁，不需要解壓另一份完整專案。
3. 確認既有 `dispatch-system-v0.5.5/js/config.js` 保持原樣；本補丁未包含金鑰，也不包含任何 service-role secret。
4. 開啟 Supabase SQL Editor，執行 `sql/131_01_route_catalog.sql`。此 SQL 不會清空舊資料，也不會更動舊 `runs`、`trip_executions`、`vehicles` 或 `profiles` 內容。
5. 執行 `sql/131_02_verify_readonly.sql`。確認新表建立成功，原有 `routes` 還在。
6. VS Code Live Server 開啟 `ui-routes.html`。必須用原本的**主管帳號登入**；正式模式的修改會寫入 Supabase。
7. 如要查看滿版展示資料並與核准原型比較，請開啟 `ui-routes.html?demo=1`。此模式使用 21 條虛構路線、6 地區、5 溫層、30 組示範費率，與正式資料完全分離。

## 測試順序

- 以主管登入，查看原有路線。以前建立的路線沒有地區欄，會顯示「未設定」；**不會擅自推測填入**。
- 在「地區與溫層」新增測試地區與溫層。
- 在「費率表」為新組合設定一筆配送費用，刷新後確認持續存在。
- 編輯一條測試路線，設定地區／溫層；注意原有固定起迄時間。存檔、刷新後再次確認。
- 新增測試路線，確認代碼唯一、名稱、地區、溫層、固定時段可保存。
- 在桌面與手機檢查側邊／底部編輯面板；測試 320、375、768、1024、1366、1920px 寬度。
- 切換 `?demo=1`：確認不會向 Supabase 寫入任何展示紀錄。
- 用司機角色造訪 `ui-routes.html`：預期無法編輯路線；最終限制由資料庫 RLS 執行。

## 資料模型與責任界線

- 既有 `public.routes` 添加可為 NULL 的 `delivery_region_id`，**原有路線都保留**。舊 `temperature_zone` 及起迄時段欄位不變。
- `delivery_regions`：配送地區主檔；`delivery_temperature_zones`：可管理的溫層名稱；`delivery_region_zone_rates`：地區 × 溫層的**配送費用**，與司機薪資費率無關。
- `delivery_region_zone_rate_audit`：記錄配送費率變更。此增量並未實作月度歷史配送費用的追溯計算，之後需使用配送日期時的有效價或快照。
- 分類刪除有保護：路線仍使用的地區不會因外鍵而刪除，正在使用的溫層由資料庫 trigger 保護。
- 新的分類與路線修改只允許主管，依舊使用 `private.is_dispatcher()` / `profiles` 與 RLS。
- 本增量不改動另外三個 Dashboard 的示範互動；車輛綁定、共用出勤表正式讀寫、月度計薪仍屬後續增量。
- **未在使用者的線上 Supabase 實際執行 SQL 或真實寫入測試**；已執行前端模擬 API 的互動檢查。資料庫實際部署與登入權限需在使用者環境驗證。

## 注意事項

- 本補丁不包含 service role key、登入密碼或任何真實司機資訊。
- 目前路線 UI 提供固定起迄時間欄位，與舊版路線設定一致。起訖不能相同；跨日路線可結束時間早於開始時間。
- 如果正式模式顯示「無法載入正式資料」，先確認 SQL 已成功執行、原有 `config.js` 存在，以及登入帳號有主管角色。請提供完整錯誤文字，而不要傳送 API 金鑰。
- `ui-routes.html?demo=1` 的操作儲存在瀏覽器 `localStorage`，但不會進 Supabase。其他三個新 Dashboard 目前仍在 prototype/local-only 階段。

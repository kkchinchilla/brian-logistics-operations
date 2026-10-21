> Current version: Increment 1.4.6. Read `INCREMENT_1_4_6_README.md` and the outer `WORK_MODE_HANDOFF_INCREMENT_1_4_6.md` first. The historical instructions below are superseded where they conflict.

# 物流調度整合包 — 安裝說明

此包不包含任何虛構司機、趟次、費率或薪資，不會清空既有 Supabase 資料。

## 安裝（依序）

1. 在 Supabase 建立資料庫備份；保留舊系統資料及已部署版本，以便回復。
2. SQL Editor 執行 `sql/131_01_route_catalog.sql`，**若先前已經成功執行過，不必重跑**。成功後再執行 `sql/132_01_shared_dashboard.sql`。最後執行 `sql/132_02_verify_readonly.sql`。
3. 用自己的原 `js/config.js` 覆蓋整合包 `dispatch-system-v0.5.5/js/config.js`。只使用 Supabase publishable/anon key，絕對不要用 service_role 金鑰。
4. 透過 HTTPS 靜態主機部署 `dispatch-system-v0.5.5/` **整個資料夾內容**。開發機測試可用 VS Code Live Server。部署不是只執行 SQL，還需要將靜態檔案上傳至可存取的站點。
5. 開啟 `index.html`，用既有 Supabase Auth 帳號登入；目前不提供自動註冊新帳號。登入後進入 `ui-attendance.html`。四個頁面透過導覽切換。

## 資料來源與功能

- 路線管理：正式 `routes`、地區、溫層、費率主檔；主管可修改。原有固定時間等欄位保持。
- 車輛管理：正式 `vehicles` 與已存在的 `profiles` 司機。可新增車輛、修改車號、建立帶日期的車輛綁定、修改既有司機顯示名稱。司機帳號仍必須透過 Supabase Auth/管理流程建立。
- 每日出勤：直接顯示原有 `runs` 的原定司機與路線。授權司機可填寫既有趟次的實際車輛與備註，記錄於 `daily_run_observations`，不會覆寫原始 `runs`；主管可結案／重開。按實際趟次數生成溫層欄位，並非固定 4 欄。
- 月度報表：只計入 `trip_executions.review_status='confirmed'` 的趟次、已確認值班，以及車輛綁定判定；加給與懲處寫入正式 `payroll_adjustments`。只有 `profiles.can_manage_finance` 且為 dispatcher 的人能存取。
- 原版 `dispatcher.html`、`driver.html`、`special.html`、`monthly.html` 和 `attendance-board.html` 仍保留，供舊有功能與特殊勤務使用。

## 目前**未完成**，不能宣稱已正式上線的項目

- 新版表格尚不能從空白格直接建立原定趟次、改派其他司機或處理故障接替；此類工作請先沿用舊 `dispatcher.html` 和 `special.html`。
- 月報**不提供可靠的最終薪資總額**：正式薪資公式、值班轉支援與租車補貼尚未完全對接。畫面顯示「待設定」，絕不使用假金額。
- 車輛綁定歷史目前能新增但未提供完整的 UI 修改／提前終止，SQL 可安全保留歷史。
- 日終結案目前只鎖定新增的實際用車回報，舊版 `runs`、特殊勤務等獨立流程還沒有聯動結案鎖定。
- 原型中按「每日出勤 v2」顯示的每個類別表頭與真實 `routes.temperature_zone` 若不同，會按真實溫層顯示；沒有分類映射就不能憑空推測。
- RLS、Trigger 與 Supabase API 的線上驗收需由部署者登入實際環境進行；目前完成靜態與語法檢查，並非已經通過正式端對端驗收。

## 基本驗收

1. 登入頁顯示且主管／司機登入後能開出勤總覽。
2. 正式路線數與資料庫一致，新增一條路線後重新整理仍存在。
3. 車輛管理顯示既有車輛；建立綁定後重新整理仍存在。
4. 日出勤選擇有紀錄的日期，查看正確資料；司機僅能修改自己的現有趟次。
5. 月報用有財務權限的主管檢查歷史月份；沒有已確認的趟次，就顯示空白，不填假數。
6. 在 320、375、768、1024、1366、1920px 檢查橫向表格捲動、對話框、導覽與輸入欄位。

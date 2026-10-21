# UI Parity Pass 2 — 路線管理側邊選單對齊（導航修正）

修正 `ui-routes.html` 的左側選單，讓品牌、四個導覽項目、底部舊版調度工具連結、登出按鈕、選取狀態及手機底部導覽與每日出勤／車輛管理／月度報表一致。

## 更新檔案
- `ui-routes.html`
- `css/ui-routes-nav-unified.css`（新增）
- `js/ui-routes-nav-unified.js`（新增，呼叫原 Supabase auth.signOut）
- `js/ui-routes-live.js`（僅將手機版切換點 900 改成 800px）
- `js/dashboard-shell.js`（僅將手機版切換點 900 改成 800px；目前僅路線頁引用）

**不需執行 SQL、無需清理資料。** 此包不含 `js/config.js`，原本 Supabase 設定必須保留。解壓縮於 `dispatch-system-v0.5.5` 的上一層並覆蓋同名檔案。建議先備份，清除瀏覽器快取後重開四頁。

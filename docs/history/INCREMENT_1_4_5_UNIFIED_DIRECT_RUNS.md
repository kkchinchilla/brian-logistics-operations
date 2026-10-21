# Increment 1.4.5 — 每日出勤單一編輯、直接覆寫趟次

## 已核准的最新規則

- 點每日出勤的路線/車號格，只看到同一個編輯視窗：路線、車號、備註；**沒有**「當日預排／實際出勤」分頁。
- 儲存時直接更新現有的 `runs`，不另外新增實際異動紀錄，也不新增出勤修改 audit。
- 主管可以更改未執行的趟次；司機只可以更改本人尚未完成的趟次。主管可取消尚未開始的趟次。取消屬業務狀態，不是異動歷程。
- **司機編輯本人趟次不需申請或等主管核准**：司機按「儲存」即直接覆寫該趟的路線／車號／備註。其他司機的儲存格唯讀；RPC 綁定 `auth.uid()` 與 `runs.driver_id` 驗證。這不移除結案、已完成／已確認紀錄或車輛衝突的安全保護。
- 新增空白格：主管建立一筆 `runs`；司機仍使用既有的未預排趟次儲存（其轉入正式執行／計薪規則仍待核准）。兩者共享同一套畫面，不以「預排／實際」要求用戶選擇。
- 多使用者版本檢查、結案、休假、時段衝突、特殊勤務關聯、經確認 `trip_executions`、租車自動判斷的既有保護維持不變。

## 資料庫設計

- 新增 1 個安全的 `dashboard_edit_run_direct` RPC；**不新增資料表**。
- 如某個趟次已有舊 `daily_run_observations`，第一次成功修改會將最終選定的路線/車號/備註寫回 `runs`，再刪除該趟的舊 observation（同一交易、失敗整筆回復）。其他尚未修改的舊 observation 保留到日後合併。
- 停止新增 `attendance_schedule_audit` 與 `daily_attendance_change_log` 的排班/出勤編輯紀錄；既有 audit 資料暫不刪除。`attendance_driver_days.revision` 與 `has_plan_exception` 仍保留：這是模板保護與併發控制，不是逐次變更歷史。
- 保留 `execution_review_history` 等已確認執行/特殊勤務必要流程；不以直接修改取代正式薪資審核。
- 舊前端呼叫 `dashboard_save_actual_observation` 將因權限撤銷失敗，升級後請重新整理快取。

## 安裝

1. 請先確認已有 Increment 1.4.4 前端與資料庫 migration。
2. 在 `dispatch-system-dev` 套用 `sql/145_01_direct_run_edits.sql` **一次**，接著執行 `sql/145_02_verify_readonly.sql`。
3. 使用本增量更新包覆蓋相同路徑；不要覆蓋 `js/config.js`。
4. 強制重新整理手機與桌機瀏覽器。請勿在同一帳號仍開著舊版頁面時混用編輯。

## 验收測試

1. 主管：點已安排趟次 → 修改路線、車號、備註 → 儲存；再次開啟只看到修改後的唯一值。
2. 一般司機：自己的趟次可以直接修改；其他司機不可修改。
3. 已有舊 observation 的趟次 → 修改 → 舊 observation 消失，runs 直接更新；不存在新 audit entries。
4. 新增或修改時，車號仍可自動帶入或手改，且租車狀態依司機與車輛綁定自動判定。
5. 主管可以取消未開始趟次，取消後欄位釋放；正在配送、已完成或已確認趟次不准直接取消或覆寫。
6. 已結案／休假／司機或車輛時段衝突全部拒絕。
7. 單日範本可繼續套用多個指定日期；個別已更改日期的覆蓋保護仍在。
8. 320、375、390、768、1024、1366、1920px 橫向捲動、對話框與按鈕不溢出。

## 限制

- 未預排的司機自行回報仍儲存於 `daily_attendance_extra_trips`，不會自行產生薪資或確認配送。這是既有財務安全界限；將臨時趟次納入計薪需另定規則。
- 此增量不更動四個 Dashboard 的全站配色與風格。

## 本次實測（2026-10-20）

- Supabase `dispatch-system-dev` 已成功套用 `increment_145_unified_direct_run_edits`。
- DB read-only 驗證：新 RPC 存在、舊 observation 寫入 RPC 已撤權、出勤 audit trigger 為 0、結案與租車自動判斷 trigger 均保留。
- 使用資料庫 `BEGIN…ROLLBACK` 以已啟用司機身份模擬呼叫 `dashboard_edit_run_direct` 成功，交易回復後 `runs`、observation 及 audit 數量沒有改變。
- 隔離 Chromium：單格編輯 123 項、單日範本 31 項、車輛自動帶入 59 項通過；靜態檢查 141/142 通過。
- 尚未由使用者在真實瀏覽器登入後逐項驗收。

## 司機直接編輯的最後驗收（2026-10-20）

- 一般司機：自己的未完成趟次點選路線／車號任一格，使用同一介面編輯路線、車號、備註，按「儲存」**立即生效，沒有主管審核或申請程序**。
- 其他司機的格子唯讀；不能只靠前端隱藏按鈕。Supabase `dashboard_edit_run_direct` 以 `auth.uid()` 核對 `runs.driver_id`，不是本人即拒絕；`runs` 的 UPDATE RLS 也僅允許本人或主管。
- 主管可以編輯全體司機；司機不可使用主管專屬的範本／批次排班、調整趟數、結案、休假或新增預排入口。
- 保留結案、已完成／經確認、派車時間衝突與版本保護；這些是資料完整性限制，不是「修改須經主管核准」。
- 已於 `dispatch-system-dev` 以 read-only SQL 查證 145 RPC 存在、`authenticated` 可執行、RPC 有本人驗證、舊 observation 寫入 RPC 已撤權、run audit trigger 停用。**同一專案不用再重跑 145 SQL**。如部署另一個 Supabase 專案且缺此 RPC，再依版本順序安裝 `sql/145_01_direct_run_edits.sql`。
- 本次 isolated Chromium 測試：單一編輯器與權限情境 **125/125**、批次排班 **31/31**、車輛綁定 **59/59**；另有 141、142 regression scripts PASS。尚待使用者以真實司機及主管帳號登入驗收。

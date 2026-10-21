# Increment 1.4.3｜司機單日範本、批次排班及休假互斥

**基準**：`dispatch-system-increment-1.4.2-full-no-config.zip`。
**定稿原型**：`prototypes/Daily_Attendance_Dashboard_FINAL_P5.html`（P5；不連線資料庫）。
**程式定位**：實作完成、模擬瀏覽器測試通過；正式 Supabase migration 與多人實際登入 UAT 尚未執行／通過，不可宣稱已正式上線。

## 本次範圍

- 只更新每日出勤 Dashboard 的頁面、JavaScript、CSS，其他三個 Dashboard 不修改。
- 主管建立／修改每名司機的**一日**預排趟次範本；每列手動指定五類出勤類別之一、欄位序號、正式路線主檔、正式車輛主檔與明確租車狀態。路線原定溫層與起迄時間沿用既有路線主檔，不由出勤類別猜測。
- 在月曆中勾選跨月份的**具體日期**，一次套用；可用整月或週一至五做選取快捷鍵，但不創建週期規則。
- 套用後直接點每日出勤表的欄位修改**當日預排**，範本不會變；分開修改實際出勤 observation／臨時實際趟次，不覆寫已確認的紀錄。
- 主管可在「休假」欄設定／取消「休」；已有預排或實際配送不可標「休」，有「休」的日期不能安排預排或新回報。結案日期不可再編輯。
- 保留日別例外；已執行、結案、休假、特殊勤務關聯、臨時實際趟次等記錄不得遭批次套用覆寫。重新套用及版本衝突由 SQL RPC 檢查。
- SQL 留存範本修訂、單日修訂、批次請求冪等識別、變更稽核。**排班不代表完成趟次，不能直接作薪資計算。**
- 正式介面全繁中、深灰＋黃、沒有把 prototype 的演示控制或 localStorage 模擬資料放進正式系統。

## 資料庫新增（Migration 143）

- `driver_day_templates`：每位司機一份單日範本，修訂版次。
- `attendance_driver_days`：每天每司機休假／單日例外／範本套用快照和修訂。
- `attendance_template_batches`：批次套用請求識別及回傳（避免不確定重送導致重複排班）。
- `attendance_schedule_audit`：排班、範本、出勤日狀態的寫入歷史。
- `dashboard_save_day_template`、`dashboard_apply_day_template`、`dashboard_get_schedule_month`、`dashboard_set_driver_leave`、`dashboard_save_day_plan` RPC。
- 含對先前 141/142 slot、actual RPC 的安全性及協作調整；全系統 `runs` 等表掛載寫入序列化鎖、防休假衝突及稽核觸發器。這些更動影響舊功能，需要實際權限及併發驗收。
- `runs` 出勤欄位唯一索引改為僅限制**非取消**趟次；取消資料繼續留存，不自動清除。

## 安裝前（重要）

1. 先確認**實際使用者安裝的版本**至少包含 Increment 1.4.2；若只是取得 ZIP 而未安裝，請先安裝並完成對應 142 migration，勿直接跳過。
2. `dispatch-system-dev` 目前連線可讀且 132/141/142 的表及函數存在，但**未取得可還原的備份證明**；在備份完成、確認目標環境與適當維護時間前，切勿在正式營運環境執行 143 SQL。
3. 使用 Supabase Dashboard 的備份／可還原快照，或從管理端匯出資料庫結構及重要表備份，確認可復原。不要把 Postgres 密碼、service_role key 貼到聊天或放前端。
4. 在 Supabase SQL Editor 執行 `sql/143_00_preflight_readonly.sql`（只讀）。保存輸出，檢查既有 triggers、policies、functions 與型別。
5. 審核 `sql/143_01_day_templates_and_leave.sql` 後，**僅在已備份的測試環境**使用 Supabase migration 工作流程套用。此檔含資料表／函數／trigger／索引更動；若任何先決條件不符合會 rollback。
6. 執行 `sql/143_02_verify_readonly.sql`，驗證表／RPC／RLS／trigger 及欄位唯一性。
7. 用增量包合併覆蓋 `dispatch-system-v0.5.5/`；保留環境特定 `js/config.js`，清除前端快取，確保同版 JS/CSS。

## 驗收清單（真實 Supabase，尚未完成）

- [ ] 主管與一般司機分別登入（不同瀏覽器 session）。主管可建立單日範本、司機無編輯權。
- [ ] 範本含多筆類別與欄號及明確租車狀態，儲存及重新登入後仍存在。
- [ ] 勾選非連續日期及跨月份日期，僅選中日期新增預排；刷新後一致。
- [ ] 按「休假」→「休」後無法建立預排、補報臨時趟次，且批次範本不能覆蓋；取消「休」可恢復空白日期排班。
- [ ] 有既有有效趟次時不能標「休」，不會自動清除或改動趟次。
- [ ] 只改單一日期的預排、車號／路線，其他日期與範本未變；原始預排與實際回報的 snapshot／review 不被誤覆寫。
- [ ] 同時兩位主管修改同日資料：較晚的 stale revision 更新被拒絕；未覆寫已結案資料。
- [ ] 資料庫 RLS：司機只能編輯本人允許的實際出勤；不能直接寫模板／休假／預排；匿名不能存取。
- [ ] 衝突的司機或車輛／固定路線時段會拒絕排班，**不影響**既有特殊勤務例外。
- [ ] 雙擊、網路延遲重試不產生重複趟次；批次部分跳過時畫面顯示原因。
- [ ] 每日欄數可調整，已佔用欄位不可移除；舊報表與其餘三 Dashboard 原功能正常。
- [ ] 320／375／390／768／1024／1366／1920px 手機／桌機實際操作及滾動正常。

## 自動測試（隔離環境）

- `node tests/check_increment_1_4.js`
- `node tests/check_increment_141.js`
- `node tests/check_increment_142.js`
- `python tests/browser_increment_143.py`（需 Playwright/Chromium；使用 `tests/mock_supabase_143.js`，不使用實際憑證）

上述 1.4/141/142 回歸測試與 143 的 30 項 Chromium UI/響應式檢查已通過。**這些結果不包含 Postgres migration 實際執行測試。**

## 復原策略

- 前端復原：恢復原 1.4.2 版本的 `ui-attendance.html`、`js/production-attendance.js` 並停止載入 143 CSS／JS；其他三 Dashboard 不需復原。
- 資料庫：143 修改既有 functions、triggers、index，**不能直接靠 DROP 新增四表完整恢復**；必須先準備備份／受控反向 migration 並在隔離環境測試。請勿直接清除歷史或新排班資料。

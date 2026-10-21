# 配送趟次管理系統 / Dispatch System — v0.5

**Upgrade from the installed and working v0.4.3 project.**

UI: Traditional Chinese (zh-Hant-TW). Development guidance: English.

## What changed

- New supervisor-only **配送路線管理** (`routes.html`) for route code, optional name, **temperature-zone name**, fixed start/end time, active state. Supervisor may add/edit/deactivate routes; route changes are audited in `route_change_history`.
- On **每日派車看板**, the supervisor chooses an active route, driver, vehicle, date, and **是否租車** (per assignment; required). Fixed time and temperature are displayed, not typed by the dispatcher on each run. Overlap checks still use fixed planned time intervals.
- Save **assignment-time snapshots** in `runs`: `route_code_snapshot`, `temperature_zone_snapshot`, `planned_start_time`, `planned_end_time`, `is_rental`. Completion captures route and rental snapshots in `trip_executions`. Changes to route master do not overwrite new-version assignment snapshots.
- **No actual clock-in/out timestamps** are recorded by the v0.5 driver workflow. `開始配送` changes status to in-progress, `完成配送` changes status and adds notes; supervisor can approve it **without** an actual end timestamp. Older timestamp columns are retained (not dropped), for backward compatibility.
- **月出勤報表** now automatically groups each driver's assigned routes into as many temperature-zone rows as necessary. Confirmed-execution count is calculated separately; unconfirmed/cancelled runs don't increase completed totals. Rental is counted separately per confirmed run.
- **匯出動態溫層月報 Excel** generates four draft worksheets (`出勤明細`, `薪資統計`, `停車交通`, `零用金`) plus reconciliation `未對應資料`. Daily dates retain paired **路線編號／車號** cells. If the same driver has multiple confirmed trips in one temperature zone on the same date, extra rows are generated; data are never overwritten. The employee/temperature rows aren't limited to a fixed 45 × 11 layout.
- Removed v0.4's manual driver-slot and route/category mapping controls from the monthly page. Previous `report_*_mappings` tables are **preserved** in Supabase (not dropped); v0.5 no longer relies on them.

## IMPORTANT: Excel output scope

The original August workbook had a **fixed 45-driver × 11-category matrix**. That is incompatible with an arbitrary number of per-driver temperature-zone rows. Accordingly, the new v0.5 Excel generator **recreates its familiar month/day + route/vehicle grid in a dynamic format**, not a byte-for-byte or cell-for-cell copy of the August template. Unlike v0.4, it doesn't read `assets/monthly-template-base.xlsx` and doesn't need `js/template_layout.js`.

In `出勤明細`, **路線編號 is a route identifier**, *not* an approved payroll/attendance work code. No `7H → 7G`, `EG → EG+1`, special salary formula, or payable-unit conversion is assumed. Payroll is still **provisional**; month-end finalization isn't enabled. `未對應資料` contains warnings about historical missing rental facts, pending executions, attendance codes, and unconfirmed payroll.

## Installation — IMPORTANT order

1. **Back up both** your existing VS Code project and your **Supabase development** database. Only run this first in the development project.
2. Supabase SQL Editor: run `sql/05_preflight_read_only.sql` (read-only); check existing route completeness and historical executions.
3. Supabase SQL Editor: run `sql/05_routes_rentals_dynamic_reporting.sql`. This migration contains `BEGIN/COMMIT`; it **does not delete runs, executions, payments, or report mapping tables**. Do **not** rerun SQL migrations 01–04.
4. Replace these local files, retaining their directory structure:
   - `dispatcher.html`, `driver.html`, `monthly.html`
   - `js/dispatcher.js`, `js/driver.js`, `js/attendance.js`, `js/monthly.js`, `js/template_export.js`
   - `css/style.css`
5. Add new files:
   - `routes.html`
   - `js/routes.js`, `js/zone_report.js`
6. **Preserve your existing `js/config.js` unchanged**. It is intentionally NOT included in this ZIP.
7. Your previous `assets/monthly-template-base.xlsx` and `js/template_layout.js` may remain on disk, but are no longer needed by the new dynamic exporter. The old `report_driver_mappings` and `report_route_mappings` database tables remain intact as historical data.
8. With VS Code Live Server (served over HTTP), hard-refresh browser. Log in as a dispatcher.

**Note:** Once SQL 05 is installed, the OLD dispatcher.js may fail to create new runs because it does not send the required rental selection. Update the frontend immediately after running SQL 05.

## Test plan — perform in order

1. **Routes:** Open **每日派車看板 → 配送路線管理**. Enter two test routes with different temperature zones and non-overlapping fixed times. Check adding and editing; confirm only a dispatcher can write. For cross-midnight schedules, a later end time after midnight is accepted.
2. **Assignment:** On **新增配送趟次**, selecting a route should display its fixed temperature and planned time. Select **非租車** or **租車**; leaving it blank must prevent saving. Verify both options are preserved in the daily board. Try assigning the same driver or vehicle to overlapping route intervals; the database should reject a conflict.
3. **Execution:** As the assigned driver, start and finish one **new test** run. No actual clock-in/out timestamps are required or displayed. Sign back in as dispatcher. Check **實際趟次審核** allows **確認** even without `actual_end_time`. The confirmed count should increase by one, with the correct rental status.
4. **Dynamic zones:** On **月出勤報表**, select the test month. The **司機溫層出勤統計** table automatically displays only the zone names that appear in the assigned runs. Add another route with a different zone to see its row appear. A pending run may affect the *assigned count* but cannot affect the confirmed count.
5. **Duplicates:** Complete/confirm two nonoverlapping runs of the same zone on the same date. Export **匯出動態溫層月報 Excel**. Both must be present in separate detail rows, not overwritten.
6. **History:** For a new test assignment, change its route master temperature/time after assignment. Verify the existing run/execution still shows its **assignment-time zone and planned schedule**; later new assignments use the updated values.
7. **Regression:** Verify existing salary-rate, manual-adjustment, parking/transportation/petty-cash entries and finance draft export still work. Open the v0.5 workbook in Microsoft Excel and confirm it opens without repair prompts.

### Legacy data handling

- v0.5 **does not automatically set old `is_rental` values to `false`**. A missing value means **未確認**. Historical executions likewise retain NULL rental because there is no reliable historical source; they appear in review warnings.
- Historical `runs` created before v0.5 might lack snapshots. These are not rewritten, especially when already confirmed. The UI can fall back to current route master metadata for display, **but that historical lookup is not authoritative if the route has changed**. The report flags missing historic snapshots as requiring verification.
- If you need to reclassify historic confirmed runs, plan a supervised correction workflow with an audit trail; don't directly mutate approved records.
- There is no special behavior for contract drivers or two-driver runs beyond the existing prototype. Such production workflows need separate confirmed requirements.

## Data model notes

`routes` owns its current fixed zone/time. `route_change_history` records old/new route changes. Each `runs` row owns rental, and stores an immutable *planned* route snapshot; each `trip_executions` row captures the *actual completion claim* and its rental/zone/code attribution. Approved execution is the only source of completed-run counts. Planned run rows only determine whether a zone section appears.

No production payroll settlement, fixed August work-code mapping, or exact payroll-template reconciliation is approved yet. Do NOT pay staff using this draft calculation or workbook.

## Local tests

```sh
node tests/check_v03.js
node tests/check_v05.js
node --check js/dispatcher.js
node --check js/driver.js
node --check js/routes.js
node --check js/monthly.js
node --check js/template_export.js
```

The local tests are not a substitute for executing SQL 05 on your Supabase development database and opening the exported file in Microsoft Excel.

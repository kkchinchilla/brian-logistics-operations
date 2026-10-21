# Dispatch System v0.5.5 — Increment 1 (special-work records)

**Developer conversation: English. Application interface: Traditional Chinese (zh-Hant-TW).**

## Scope of THIS increment

Built on the actual **v0.5 sources**, using the verified v0.5.2 route title fix and the **v0.5.4** dispatcher/CSS hotfix. This is the **first runnable increment** toward v0.5.5, not final payroll deployment.

- **特殊勤務管理** (`special.html`): dispatcher-only operational page to record and review special work for a selected date.
- **值班待命**: register dated standby blocks with start/end, including overnight shifts. Standby blocks cannot overlap for the same driver. A confirmed *linked* support/replacement event replaces the **whole standby block** for classification; otherwise a confirmed standby block remains standby. Pending-linked support is withheld from standby payroll classification.
- **附屬支援**: separate named support-work record attached to an existing parent run; same driver/vehicle as the parent. Support assignments are not inserted as separate `runs`, so they do not fail the existing v0.5 fixed-route overlap guard and do not inflate the operational delivered-run count.
- **故障接替**: attach replacement driver and different replacement vehicle to original run; explicitly capture attribution **B (replacement-only, default)** or **C (both drivers)**. Conservative DB-level collision checks prevent the replacement driver or vehicle being assigned another overlapping scheduled run; additional regular runs cannot later collide with prior replacement work.
- **跟車**: attach trainee/full-time follower to the original run, with the same vehicle but distinct driver; enforce against overlapping unrelated driver tasks. A supervisor enters a dated **訓練中/正式入職** stage change, with an effective date. A follower record freezes the stage at the original service date. The training pay unit is **one distinct calendar date per trainee**, regardless of route/trip count; full-time follow-along is identified as route-priced. **No pay amount has been guessed.**
- **Supervisor review & audit**: new records enter pending status; supervisor may confirm/reject with recorded actor/time, and rejected records require an explanation. Special work can be **confirmed only after the parent execution is completed and confirmed**. Immutable source facts and audit history are database-enforced; no delete permission for new records.
- **Monthly read-only reconciliation**: the finance page shows special-work classifications and warnings. Drivers with special-work records get **待設定** rather than a misleading partial numeric salary total. Both provisional Excel exporters gain a **特殊勤務待對帳** worksheet when such data exists. No automatic payroll posting or historical rewrite.

## Deliberately NOT implemented in this increment

**Do not pay based on these special-work records yet.** The following are for the next increment, after the record structure is confirmed in the real development system:

1. Explicit standby-rate, trainee **daily fixed** rate, employed-follower **route-specific** rate, and support pay rules (with effective dates and snapshots). Training rate *amount*, work-day combination rules, and support rate are not approved yet.
2. Automatic reassignment of existing `trip_executions` / original driver-route payroll into a replacement-driver B/C ledger. Existing delivery completion still belongs to **one parent run**; the original v0.5 dispatcher monthly counts and export remain based on the **original run driver**, with visible caveats. Do **not** interpret the existing report as correct replacement payroll.
3. Direct driver-facing support acceptance/replacement completion flow, supervisor completion of an interrupted delivery, and production payroll settlement.
4. Support outside a parent run, multiple distinct standby blocks linked to a single support task, or payroll code transformations. Existing August Excel transformations are not presumed approved.

## Upgrade your installed v0.5.4 (recommended)

1. Back up the existing VS Code folder **and the Supabase development database**.
2. In the **development Supabase** SQL Editor, run `sql/06_preflight_read_only.sql` and verify the expected 7/5 column/table rows and counts. If incomplete, stop and resolve the missing v0.5 prerequisites.
3. Run `sql/06_special_work_records.sql` **once**. It is additive and transactional (`BEGIN/COMMIT`); it does not delete/rewrite old runs, confirmed executions, rates, or reports. Do not rerun older 01–05 migrations.
4. Unzip this patch onto the **root** of your existing `dispatch-system` folder, retaining subfolders (`js/`, `css/`, `sql/`, `tests/`). It replaces `dispatcher.html`, `monthly.html`, `css/style.css`, `js/monthly.js`, and `js/template_export.js`; adds new `special.html`, `js/special.js`, `js/special_summary.js`, SQL, and tests. **Your `js/config.js` and `js/dispatcher.js` are NOT part of this patch.**
5. Open **每日派車看板 → 特殊勤務管理** via VS Code Live Server; hard refresh (Cmd+Shift+R / Ctrl+Shift+R). Normal assignments continue on the original dispatcher board.
6. You must use a dispatcher account for special work; a finance-authorized dispatcher account for the monthly report. RLS enforces permissions in Supabase, not only in the UI.

## Acceptance test sequence — development database ONLY

1. Create a driver-stage row with an effective date before the service date. Make a normal v0.5 parent run on that date. Open **特殊勤務管理** and select the date.
2. Register a standby shift 08:00–12:00 for a driver. Verify two overlapping standby blocks for that driver are rejected (including a cross-midnight overlap).
3. Register an **附屬支援** for the parent run, using its driver/vehicle, and a unique description/reference. If the selected driver has standby overlapping the route, select the matching shift. Verify unrelated driver/vehicle selections are rejected by the database.
4. Register **故障接替** for a test parent run, with a **different driver and vehicle**, first with option B. Verify a second assignment with a conflicting driver/vehicle is blocked. Create a separate test case with option C.
5. Register a **跟車** record for a second driver with a valid stage; verify no independent extra parent `runs` row is created, and that an unrelated overlapping driver run is prohibited.
6. Before parent execution is approved, try to confirm special work: **must fail**. Complete and confirm the parent run using the existing driver/supervisor flow, then confirm special work and the standby shift. Verify shift becomes **已轉支援（本班不計值班）**.
7. Add two approved trainee follow-alongs for the same trainee and service date on **nonconflicting** source routes. In **月出勤報表 → 特殊勤務出勤核對**, both details must appear, but they count only **one trainee payable day** (the monetary amount is not implemented).
8. Review the monthly salary: any driver with special work must show **待設定** instead of a numeric total. Excel should include **特殊勤務待對帳**, and the old main-run grid should not duplicate completed delivery tasks.
9. Confirm regular v0.5 workflows still work (routes, independent overlap guard, rental flags, approvals, expenses, Excel opening). The provided Node tests are local static/logic tests, **not a substitute** for this live integration test.

## Local checks

```bash
node tests/check_v03.js
node tests/check_v05.js
node tests/check_v055.js
node --check js/special.js
node --check js/special_summary.js
node --check js/monthly.js
node --check js/template_export.js
```

**SQL 06 has not been executed against your Supabase development project from here.** Do not assume the migration is installed or live integration has passed until you run the steps and report results.

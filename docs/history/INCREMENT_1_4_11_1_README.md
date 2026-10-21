# Increment 1.4.11.1 — simplified attendance duties — awaiting acceptance

Read this document first. This is the correction to delivered Increment 1.4.11 requested by the user on 2026-10-21. Increment 1.4.9.1 was explicitly accepted; the attendance-cell 值班 implementation in 1.4.10 was said to look fine. Do not claim acceptance of 1.4.11 or this correction. Latest user instructions and this handoff supersede conflicting historical documents.

## Current rules and behavior

- The existing attendance cell **路線** dropdown includes **值班、跟車、學習** alongside delivery routes. Selecting any of those three shows **備註**, with no vehicle selector, delivery-run selector or start/end time fields. Blank notes are allowed for ordinary saves; deleting a duty still requires a reason. The date, driver and cell come from the selected board cell.
- 跟車 and 學習 are standalone entries, each paid **per recorded entry**. Several entries for the same driver on one date each earn their configured amount. No main delivery or vehicle needs to exist. They do not infer scheduling conflicts from another driver's run.
- 值班 needs no start/end times and has no temperature restriction. Each recorded standby entry receives the existing fixed allowance, without fabricated hours. All five board display groups support duties; display groups do not set a duty temperature. Duty cells show 不指定 in the board's vehicle column.
- Brian maintains the dated amounts in **月度報表 → 勤務／租車設定**: 值班、跟車、學習 additions and 租車 deductions. Route fees stay on 路線管理. Duties do not add delivery or rental counts. Existing historical standby already linked to support retains the existing no-double-payment rule.
- Every driver addition, edit, deletion or type conversion remains a request until a dispatcher approves. Dispatchers can directly correct open dates, including prior days. Stale requests cannot overwrite newer changes; rejection preserves canonical attendance.
- **結案** remains the sole final confirmation. It closes all unclosed dates through the selected date, inclusive. There is no 完成配送 or 實際趟次確認 prerequisite. Reopening requires a dispatcher reason; reopened dates are excluded from monthly calculations until reclosed. Original closing snapshots remain immutable.
- 月度報表 and 勤務／租車設定 remain Brian-only. Other dispatchers retain the other three dashboards.

## Existing data and compatibility

No existing duty, standby, run, request, audit, rate or closing snapshot was rewritten by this migration. Historical follow run links and standby hours remain in stored history. A notes-only edit preserves those historical details. Changing a duty type uses the existing audited conversion path; removal retires the record and keeps history.

The current form and duty-read endpoint no longer expose or depend on historical follow run/vehicle metadata. A historical main delivery may be changed without changing a standalone duty. Old pending requests containing linked-run targets are not silently translated: approval fails safely, the request becomes stale, and it must be resubmitted from the refreshed form. Existing requests are not modified during installation. The connected project had no attendance_duty_entries before this correction.

New standby entries store NULL for both time fields. Both NULL is valid; a half-specified time pair is invalid. Old timed API callers remain compatible and their existing overlap checks still apply to timed rows. The legacy special-work workflow cannot automatically associate an untimed standby by clock overlap; no hours or association are invented. Existing timed linked records retain their protections. Current dashboard duties remain independent of that older workflow.

Monthly basic-item reconciliation still includes route pay + standby + follow + learning − rental + manual adjustments. Missing rates remain 待設定; zero is valid; blank settings inputs leave rates unchanged. The date-effective rate and closing references remain available. This correction does **not** complete full 應計薪資: the unresolved region/job/special-duty/other payroll and final Excel-template scope remains as documented in the previous payroll decisions. No real pay amounts or operational examples were seeded.

## Database — installed once; do not rerun

Project: `dispatch-system-dev` (`nyizxtaofoynfgazhzsg`). New migration:

`20261021072737_increment_14111_simple_duty_entries.sql`

Only this correction migration was installed. Earlier migrations were not rerun. Before/after full-row hashes match for **all 40 public tables and 132 existing records**. Live checks confirm nullable paired standby times, standalone follow support, RLS and the existing narrow function privileges. No new public endpoints or grants were added. Security advisors are unchanged: 4 preexisting anonymous SECURITY DEFINER findings, 21 authenticated SECURITY DEFINER findings and disabled leaked-password protection. Detailed results: `tests/increment_14111/live-verification.json`.

The first connector attempt returned an expired request-state error without installing the migration. Migration history was checked before retrying. The successful retry installed the migration exactly once, with the timestamp above.

## Verification

**305 local checks passed** against isolated databases and the actual application JavaScript:

- 48 new database/payroll checks, including historical data preservation, notes-only duties, untimed standby, same-day per-entry pay, approval/staleness, conversions, close/reopen and access restrictions.
- 30 form/approval/settings integration checks using Node VM.
- 52 standby database regression checks; the former required-hours case was updated to verify untimed creation and removal.
- 150 earlier database regression checks covering increments 1.4.6–1.4.9.1.
- 25 isolated demonstration checks.

All 35 application JavaScript files pass syntax checks. Eight read-only schema/access invariants passed in the connected project; all inspected RPC/helper privileges remain as intended. No live test records or rates were inserted.

Desktop browser QA was performed on the four-page, network-disabled demo built from the actual source. The attendance editor was visibly checked with 跟車、學習、值班 and a normal delivery selection; the first three show only notes, while delivery restores vehicle/time information. The monthly settings dialog was visibly checked for all four rate fields and per-entry labels. Internal screenshots were inspected. Application-error checks were limited by unrelated browser-extension metadata errors; no application error was observed in the tested views. Mobile layout and authenticated end-to-end writes on the user's hosted frontend still require acceptance after deployment. The VM tests are not browser acceptance.

## Deployment

Deploy the complete **dispatch-system-v0.5.5/** folder to the existing host while preserving its **js/config.js**. Configuration and credentials are intentionally absent from this ZIP. Updated attendance and monthly scripts use `v=14111` cache keys. Hard-refresh after deployment. **The hosted frontend has not been deployed by the assistant.** The database is already updated; do not run this or earlier migrations again.

Use `ACCEPTANCE_CHECKLIST_1_4_11_1.md`. Open `OFFLINE_DEMO_1_4_11_1/index.html` for four isolated fictional dashboards. Duty forms can be tried, but operational saves are blocked in the demo. Settings changes exist only in that page's memory. Do not deploy demo files as the application. Older demo folders and prior increment handoffs are historical.

Do not roll back only the frontend to a version that hides canonical duties. Preserve all attendance, approval, audit and closing history and use a reviewed forward correction if required.

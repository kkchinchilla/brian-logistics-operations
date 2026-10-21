# Increment 1.4.13 — confirmed salary formula

Status: implemented, delivered for acceptance. Continues delivered 1.4.12; no new user acceptance is inferred. Latest user decisions override historical specifications and prototype calculations.

## Current payroll rule — confirmed by the user

**應計薪資 = 配送計酬 + 值班津貼 + 跟車費用 + 學習費用 − 租車費用 + 加給／獎懲**

- No 固定底薪. Do not ask again whether it applies.
- 地區／職務加給, when entered, belongs within existing signed 加給／獎懲; no additional category or automatic rate formula. The obsolete table column has been removed.
- 跟車費用 and 學習費用 are separate components, each paid per recorded entry, including multiple entries on one date. Do not fold them into manual adjustments or charge them twice.
- 結案 records remain the only attendance source. Reopening removes that date until reclosed. There is no extra 完成配送 or 實際趟次確認 requirement.

## Implementation

The existing Brian-only read-only `dashboard_get_calculated_payroll(date)` now returns calculation version 1413, numeric `salary` and `salaryReady` when the six components are complete and there are no unresolved records for that driver. `basicSubtotal` is retained for diagnostics and compatibility. No configuration, rate, operational table, closing snapshot, grant or write workflow was changed.

Current monthly table, driver details, summary CSV, reconciliation CSV, legacy monthly preview and both Excel salary sheets display the same result with separate 跟車／學習 costs. Current monthly assets use `v=1413`; deploy the complete frontend together. The browser validator rejects old or inconsistent responses and never falls back to cached/client payroll.

Missing rates, unknown historical rental status, unresolved legacy support/replacement or attendance-code entries still produce a specific issue for the affected driver. Missing components show 待設定; known subtotal with unresolved records shows 待確認. Other drivers calculate normally. No-record months calculate zero. Negative totals and decimal manual adjustments follow the formula without a new floor or rounding policy. Separate expense records are excluded from wages.

## Verification and installed database

Project: dispatch-system-dev (`nyizxtaofoynfgazhzsg`). New migration **20261021082851_increment_1413_confirmed_salary_formula.sql** is already installed once. Do not rerun it or earlier migrations. Its change is solely a replacement of the read-only payroll function; no test records were written to the connected project.

- **136 automated checks passed:** 75 isolated Postgres workflow/payroll checks (including inherited attendance regression), 27 monthly UI integration checks, 26 offline-demo consistency checks, 8 salary export checks. These are assertions, not 136 separately authored test files.
- All 36 application JavaScript files passed syntax checks.
- Seven live checks passed in a read-only transaction: version, salary consistency, month, Brian/other-dispatcher/driver/anonymous access and invoker privileges as covered by the script.
- All **143 rows across 40 public tables** have identical before/after full-row hashes.
- Desktop monthly table and driver detail visually checked with fictional network-disabled data. Responsive iframe widths 320, 375, 390, 768, 1024, 1366, 1920 passed with no document overflow; actual content viewport is 15 px less due to scrollbar. The 390-wide detail panel was visually checked. Table scroll is internal. No physical-device or authenticated hosted write test is claimed.
- Security finding identities are unchanged: 4 preexisting anon SECURITY DEFINER findings, 21 authenticated findings, disabled leaked-password protection. Observation timestamps differ; no new finding. References: [anon grants](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated grants](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Remaining scope

The six-component ordinary payroll formula is complete. Do not keep all salaries pending for imaginary base/region rules. Actual missing rates must be configured by Brian; unresolved legacy source entries need case-specific clarification. Exact company Excel template reconciliation and immutable paid-month settlement history remain separate unfinished work.

Route rates still come from the current 路線管理 fee; changing them can recalculate earlier months. Effective-dated duty/rental settings use the attendance date. This increment does not freeze paid-month amounts or claim that calculated salary has been paid. Historical documents, prototypes, retired pricing scripts and older test suites retain their old assumptions for reference; use this handoff and the 1413 tests for current behavior.

## Deploy

Upload the complete **dispatch-system-v0.5.5/** application to the existing host, preserving **js/config.js**, then hard-refresh. The configuration is omitted. The hosted frontend has not been deployed by the assistant. Do not deploy OFFLINE_DEMO files as production. Use `ACCEPTANCE_CHECKLIST_1_4_13.md`; the isolated four-dashboard demo is `OFFLINE_DEMO_1_4_13/index.html`.

Corrections should be forward migrations; do not recreate data or rerun historical migrations. Preserve existing attendance approval, cumulative closure/reasoned reopening, vehicle/routing rules and Brian-only access.

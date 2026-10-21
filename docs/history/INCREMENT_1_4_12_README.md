# Increment 1.4.12 — monthly duty columns and server payroll calculation

Status: delivered for acceptance. Continues delivered 1.4.11.1; do not infer user acceptance of that increment or this one. Latest user rules and this document override conflicting historical documents. UI language is Traditional Chinese (Taiwan); preserve the approved four-dashboard design.

## What changed

1. **司機月度統計** now lists **值班、跟車、學習、租車** in that order. 值班／跟車／學習 are finalized entry counts, including multiple entries on one date. Existing per-driver pay details and CSV exports retain the separate monetary amounts. Duties add no delivery count or rental deduction.
2. The monthly dashboard now receives its approved-component payroll calculation from a single Brian-only, read-only Supabase RPC, `dashboard_get_calculated_payroll(date)`. The existing legacy monthly page also uses this same calculation. The previous client engine is retained for historical compatibility, isolated demo simulation and parity testing; it is not a fallback for missing current server results.
3. The new function returns the existing coherent source bundle plus a versioned calculation: per-driver counts, each pay component, basic subtotal, source lines, closing event IDs, rate references and unresolved items. Both current exports refresh this server result first. Missing/malformed results disable exports and settings rather than showing stale payroll.

## Calculation implemented

**Known-component subtotal = route pay + 值班 + 跟車 + 學習 − rental costs + signed manual adjustments.**

- Operational inputs come only from **結案** snapshots. Reopened dates are excluded until reclosed; original snapshots remain retained. 結案 remains the sole attendance final confirmation. No 完成配送 or 實際趟次確認 step was added.
- Delivery pay uses the current 路線管理 region × temperature fee matching the finalized route temperature, as approved in 1.4.9.1. Missing or mismatched rates remain unresolved. There is no duplicate 計價設定 tab.
- 值班、跟車、學習 each use one configured amount per recorded entry. The effective date is the attendance date; the most recent rate for that effective date wins. Explicit zero is valid; no rate is never silently treated as zero. Historically converted standby retains its no-double-payment rule.
- Rental is a deduction per finalized rental delivery. Unknown rental status leaves the deduction and subtotal unresolved.
- Manual allowances/rewards and deductions retain their signed values and monthly treatment. They are monthly finance adjustments, so reopening an attendance date does not erase a separately entered adjustment.
- Numeric arithmetic is performed exactly in Postgres. Inputs with unsupported precision or amounts outside safe browser representation do not become payable values. Decimal manual adjustments are retained without binary floating-point summation drift.
- Only Brian can call the new payroll function. It is SECURITY INVOKER with an explicit finance guard; anonymous/PUBLIC execution is revoked. It adds no table grants, tables, triggers, write path or settlement workflow.

## What remains before full 應計薪資

The user authorized starting payroll completion, but the available approved decisions do not establish every final payroll policy. The personal-context review found the latest per-entry duty decisions and earlier unresolved payroll items; the attached old prototype labels its base/allowance formulas and amounts as examples. Current user decisions override its old daily-training, linked-follow, timed-standby, separate pricing and rental-subsidy assumptions.

Full **應計薪資** therefore remains **待設定**. The server calculates the known subtotal and identifies missing inputs instead of fabricating a final wage. See `PAYROLL_DECISIONS_1_4_12.md` for the concise current decision list. In particular, fixed base salary, per-driver region/job allowance applicability, support/replacement pay and attendance exception treatment still need approved rules. Expense reimbursements remain separate. Final company Excel reconciliation and immutable paid-month settlement handling are not completed by this increment.

The next business decision is whether the regular-work formula above is complete or fixed base salary and 地區／職務加給 must also be included. Do not resurrect retired pricing controls or assume missing items are zero. Once the user supplies the rules, continue implementation; authorization to develop payroll has already been given.

## Preserved behavior

- 跟車／學習 require only notes after choosing the duty; no vehicle, linked run or times. 值班 has no time fields or temperature restriction.
- Every driver add/edit/delete/conversion requires dispatcher approval before canonical changes. Dispatchers can edit open dates across days. Deletions retain audit history and require a reason.
- Cumulative 結案 through the selected date; reasoned reopening; stale-request checks; Brian-only financial settings; approved operational dashboards and CSS.
- Existing records, rate history, audit rows and closing snapshots are untouched. No demo data, actual pay rate or driver was inserted.

## Database status — already installed

Project: **dispatch-system-dev** (`nyizxtaofoynfgazhzsg`).

New migration: **20261021080008_increment_1412_server_payroll_calculation.sql**.

Installed once. Do not rerun it or any earlier migration. Before/after full-row hashes are identical for **40 public tables / 142 existing records**. Seven live checks passed inside a read-only transaction: Brian access and calculation version, final salary remains unset, requested-month consistency, other-dispatcher denial, driver denial, anonymous denial and caller-privilege execution.

Security advisors remain unchanged: 4 preexisting anonymous SECURITY DEFINER findings, 21 authenticated SECURITY DEFINER findings and disabled leaked-password protection. No new finding. Details and the optional read-only verification SQL are in `tests/increment_1412/`.

## Verification

**119 local checks passed:** 72 database/payroll (48 inherited duty/attendance checks plus 24 new server calculation checks), 21 monthly UI integration checks, and 26 offline-demo checks. All **36** application JavaScript files passed syntax checks. The isolated Postgres suite compares all computed component amounts and source lines with the accepted calculator, including date-effective rates, explicit zero, missing inputs, decimal adjustments, reopen/reclose and unresolved special work. No test inserted data into the connected project.

Desktop browser QA confirmed the new table headers and counts, per-driver breakdown and preserved layout using fictional, network-disabled demo data. A browser iframe exercised widths 320, 375, 390, 768, 1024, 1366 and 1920 CSS px; document content widths were 15 px smaller because of the scrollbar, with no page overflow at any width. Desktop and 390-wide screenshots were inspected internally. This is responsive desktop-browser QA, not physical mobile-device testing or an authenticated hosted write test. The preview was stopped after checking.

## Deployment and acceptance

Deploy the complete **dispatch-system-v0.5.5/** folder to the existing host, preserving **js/config.js**, then hard-refresh. The configuration is intentionally omitted from this ZIP. Current monthly scripts use `v=1412`; attendance remains at its accepted current version. **The assistant has not deployed the hosted frontend.** The database migration is already installed.

Use `ACCEPTANCE_CHECKLIST_1_4_12.md`. The current isolated four-page preview is `OFFLINE_DEMO_1_4_12/index.html`. It simulates the server response in memory; production uses Supabase. Demo operational writes are blocked and no network connection is allowed. Do not deploy demo files as the application.

Earlier increment docs and demos are historical. Do not roll back attendance to a frontend that hides recorded duties. If this read-only payroll endpoint needs correction, use a forward migration; keep all operational and financial history.

# Increment 1.4.9 acceptance

The user accepted 1.4.8. This checklist is for 1.4.9 after deploying the complete application folder with the existing configuration. The 149 migration is already installed; do not rerun SQL migrations.

## Isolated demonstration

Open `../OFFLINE_DEMO_1_4_9/index.html`. It has all four dashboards with consistent fictional initial data, five cold-chain runs for one driver, rental, standby, follow-along, allowance and deduction examples. Select October 2026. Reloading or changing pages resets the demonstration. Operational pages are browsing-only; pricing can be tried in memory. No Supabase connection or production credentials are present. Real-browser appearance is not yet verified.

## Brian: pricing and reconciliation

1. Open 月度報表. Check that the accepted navigation, colors, overview counts, drawer and existing adjustment workflow remain usable on desktop and phone.
2. Open 計價設定. Drivers with no configuration show 待設定. Configure a driver using an actual agreed basis and a required reason; reload and verify persistence. Do not use demonstration amounts in the live project.
3. Add an actual agreed fixed-monthly or per-route rate. A per-route rate requires a route. Empty, negative and fractional new amounts are rejected; explicitly entering zero is allowed. Dates and evidence are required.
4. Open the same configuration/rate in two tabs. Save in one, then try saving the stale form in the other. The older form must be rejected and must not overwrite the saved setting.
5. For an agreed rate change, use 設定新費率. Confirm the old amount remains visible and the old end date is the day before the new start. Confirm overlapping periods cannot be saved.
6. Check 結束／停用. Ending a period preserves its historical applicability. Deactivation requires a reason and explicitly warns that the rate leaves all draft monthly calculations. Both actions retain a record and audit trail.
7. Basic reconciliation should use the rate effective on each finalized delivery date. Missing or overlapping rates show unresolved amounts; a month with a fixed-rate change does not automatically prorate. Explicit zeros remain numeric zeros.
8. Open a driver's salary detail. Expand 計薪依據 and verify date, source, closing event, rate ID and basic amount. Rental, standby, special-duty and other unresolved rules must remain visible. 應計薪資 must still say 待設定.
9. Export the original attendance CSV and the new reconciliation CSV. The original uses the overview's current search. The reconciliation export includes all drivers, basic lines/subtotals, unresolved items and separate expenses. No formula text should execute from a driver name, reason or reference field.
10. Reopen a chosen attendance date with a reason, then export again. That date must be absent from finalized delivery lines until reclosed. A network/load failure must prevent stale export and clear pricing controls.

## Other roles and unchanged operations

- Karen/other dispatchers cannot open the monthly dashboard or use the new finance endpoints; the other three boards and approval review remain available.
- Drivers cannot add/edit/delete saved attendance directly; requests remain pending until a dispatcher approves. New pricing work must not alter this accepted flow.
- Closing still includes all unclosed attendance dates through the selected date. No new 完成配送 or 實際趟次確認 prerequisite appears.
- Route and vehicle management, effective vehicle bindings, template/leave functions and existing legacy pages remain unchanged.

## Verification limits

204 automated checks, JavaScript syntax checks and a rolled-back live database test passed. New UI verification used Node VM integration, not a real browser; desktop/mobile visual and end-to-end frontend acceptance remain necessary. The original August workbooks could not be read this turn, so exact Excel parity has not been validated. See `../PAYROLL_DECISIONS_1_4_9.md` for remaining business inputs.

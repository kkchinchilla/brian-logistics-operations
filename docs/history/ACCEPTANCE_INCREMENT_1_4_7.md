# Increment 1.4.7 acceptance checklist

Use the existing development accounts and agreed test dates. The database migration is already installed; deploy the complete frontend with the existing config, then hard-refresh. Avoid altering real data merely to reproduce examples: use intended test dates and restore any deliberately changed test data through normal controls.

1. **Access:** Brian can open 月度報表 and export. Karen/other dispatchers see the three operational boards and cannot access either monthly URL. Drivers cannot access reporting.
2. **Current data:** At verification, October has 4 finalized deliveries: 2 on October 15 and 2 on October 19. October 20 is reopened and excluded. Subsequent user edits/closings can legitimately change this expectation.
3. **Closing is final:** Save a run and an active extra trip on an open test date. Do not press legacy completion/review controls. Before closing they are excluded; after 結案 they appear once each in the monthly totals, daily detail and exports.
4. **Cumulative scope:** Close through a selected test date. All earlier unclosed dates are locked/included; later dates remain open. Previously closed dates remain counted exactly once.
5. **Approval:** A pending driver edit does not change the saved/closing record. An approved edit saved before closing appears in the report. A pending proposal at closing expires without being applied.
6. **Reopening:** A dispatcher must provide a reason. Reload the monthly report: that date is excluded. Make the intended correction and re-close: the new values appear once and the old closing event remains retained.
7. **Record types:** Cancelled runs/void extras are excluded. Support and follow-along do not add another delivery. A replacement delivery has one actual driver/vehicle attribution; B/C compensation is not invented. Converted standby is not counted twice.
8. **History:** Later changes to route/vehicle masters do not alter metadata captured by a new closing. Missing facts in old snapshots display 未設定/未保存/未確認 rather than silently borrowing current master data.
9. **Consistency:** Compare driver totals, temperature/rental counts, detail rows, CSV and legacy Excel. Same-day extra rows remain separate. CSV reloads the source before export, including a date reopened by another dispatcher.
10. **Failure handling:** If the finalized-monthly service cannot load, no stale CSV is produced. Rapid month switching must never display/export records under the wrong month.
11. **Preservation:** Check approved desktop/mobile appearance, other three boards, templates, leave, approval editor, bindings, and manual allowances/deductions. Unapproved salary totals remain 待設定.

Acceptance status: **pending user testing**. Record any defects with account role, selected date/month, steps and expected result. Do not declare 147 an accepted baseline until the user confirms.

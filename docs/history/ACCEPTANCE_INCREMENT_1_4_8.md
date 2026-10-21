# Increment 1.4.8 acceptance checklist

Deploy the complete frontend with the existing config and hard-refresh. The database migration is already installed. Use existing test accounts and intended test dates, with demonstration data isolated from operational reporting.

1. **Add:** As a driver, select an empty cell, choose route/vehicle and submit. The button says 送出審核. The saved cell stays empty and no trip appears in attendance/monthly totals. 我的變更申請 shows 新增趟次・待審核.
2. **Approve add:** As Karen or Brian, open 變更審核. Check date/category/slot and proposed route/vehicle/note. Approve: exactly one trip appears. A repeated action must not duplicate it.
3. **Reject add:** Reject another addition with a reason. No trip is created. The driver sees the result and can submit a fresh request.
4. **Delete scheduled run:** On an assigned test run, the driver chooses 申請刪除此趟 and enters a reason. The saved run remains until approval. Rejection retains it; approval cancels it while retaining history. Existing started/completed/linked-duty restrictions remain.
5. **Delete extra:** Request deletion of an existing extra. It stays active until approval, then becomes void. Adding into that empty slot again requires a fresh approval and must not duplicate the old row.
6. **Edit:** Request a route, vehicle or note change. Saved values remain until approval. Rejection keeps the original. Source changes before review must not be overwritten by the stale request.
7. **Conflict:** Fill a requested slot as dispatcher, mark the date as leave, remove the requested empty slot, or deactivate the proposed route/vehicle before approval. The pending addition must not overwrite or create invalid attendance.
8. **Close:** Leave an addition pending and close through its date. It must expire without creating a trip. After reasoned reopening, a new request can be approved; it enters monthly reporting only after re-closing.
9. **Bypass/access:** Drivers cannot approve requests, alter another driver's schedule, or use the old direct-extra/observation path to apply changes. Karen can approve operational requests but cannot open monthly reporting. Brian retains monthly access.
10. **Regression:** Verify current board appearance on desktop/mobile, templates/leave, bindings/rental facts, special-duty protections, cumulative closing/reopening, monthly CSV and Excel, and allowances/deductions. No new completion/review steps or payroll formulas should appear.

Status: pending user acceptance. Keep all temporary demonstration/test records separate from operational reports; do not insert fabricated Auth UUIDs into Supabase.

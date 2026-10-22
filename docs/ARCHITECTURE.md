# System architecture

The browser loads static HTML and application JavaScript, then uses the public Supabase client to authenticate. Supabase PostgreSQL holds the persistent state and enforces permissions through table RLS and authorized RPCs. There is no separate Node application server or local payroll database in production.

Login checks `profiles.active` and routes dispatcher/driver accounts to daily attendance. Dispatcher controls, driver approval requests, and Brian's finance permissions remain the accepted 1.4.15 behavior. Client-side hiding is a convenience; database permissions remain authoritative.

## Operational flow

1. Dispatchers maintain drivers, vehicle bindings, routes, temperature zones, delivery areas and rates.
2. Daily schedules and actual attendance record deliveries, rental use, leave, 值班、跟車、學習.
3. Driver changes are submitted for dispatcher approval. Revisions prevent stale edits.
4. Cumulative 結案 preserves final attendance snapshots. Reopening requires a reason; reopened dates retain their latest confirmed snapshot in monthly totals. Reclosing atomically replaces the entire date, including additions, edits and deletions; prior snapshots remain in the audit history.
5. Monthly reporting aggregates each date’s latest confirmed attendance. Snapshot `status=finalized` means a saved version is included; separate `attendance_status` and `pending_reclose` fields indicate whether the attendance date is currently open for editing. `dashboard_get_calculated_payroll(date)` returns calculation version 1415; the frontend validates and displays that result.
6. Brian manages rental rates and signed 加給／獎懲. CSV/legacy Excel export uses the same approved three-component payroll contract.

## Boundaries

Duty attendance counts do not produce money. There is no base-salary entry or calculation. Temperature data remains available internally and in applicable exports, without expanding the monthly dashboard into many temperature columns.

Existing legacy tables and old migration files are retained for audit and compatibility. Their presence does not add their categories to the current calculation. Historical base/duty rates remain in the database with app access disabled.

Current rates can recalculate older trial reports. Monthly figures are not a frozen record of payments. Company-specific Excel formatting remains unfinished.

# Increment 1.4.24 — route names throughout the system

Attendance cells, search, route selectors, fixed-day templates, route management and monthly detail/export labels now use 路線名稱. The route-code form field and list column are removed. Route cells have more width and wrap names; the driver's responsive, own-only read-only cards and the supervisor's attendance matrix remain in place.

Routes have always been linked by `routes.id`. This release removes `routes.route_code`, `runs.route_code_snapshot` and `trip_executions.route_code_snapshot`; route, run, execution, template and payroll IDs and foreign keys are unchanged. Names are required (1–60 characters), but are not identity keys. Two same-named routes remain separate records.

The owner explicitly authorized discarding previous route-code values. Migration `20261023133135_increment_1424_route_names.sql` removes the old keys from stored JSON histories and snapshots and backfills name snapshots using existing route IDs/current names. It does not delete business rows or change rates, amounts, statuses, revisions or timestamps. A transaction-scoped checksum verifies preservation of all non-label fields, and the migration restores every affected trigger's original state before committing. Historic SQL migrations and synthetic old-version test fixtures remain archived source, not active database fields.

Historical code-only reports receive the current route name during conversion. Future closeouts capture the actual route's name at confirmation. Renaming the master afterwards does not rewrite a confirmed monthly report. Reopening retains that last confirmed report; closing again captures the latest actual route/name and replaces the previous contribution without duplication.

## Validation

- Isolated PostgreSQL tests exercise the actual migrations with synthetic routes, completed executions, extra trips and closeout history. They cover JSON cleanup, unchanged payroll lines/totals, trigger restoration, name-only creation, same-name routes, invalid names, fixed-day templates, supervisor edits and close/reopen/reclose.
- Driver own-record/read-only restrictions, Brian-only finance access and anonymous denial remain tested.
- UI tests cover named attendance cells, actual-route search, ID-valued name selectors, route creation without codes and confirmed names in payroll details. Excel tests verify saved names and the 路線名稱 heading.
- The complete regression suite, build/asset checks, portable schema restoration and isolated demonstration checks run before publication and again in GitHub Actions.

Deploy the database migration and browser release together. Refresh existing open pages after deployment so cached clients stop asking for removed columns. No Google Play packaging changes are included.

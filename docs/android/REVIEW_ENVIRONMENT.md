# Reviewer environment setup status

Updated 2026-10-28 (Asia/Taipei). **Schema setup verified; Auth and reviewer accounts are pending.**

The user selected the existing Brian organization for the isolated reviewer project.
Supabase quoted $0/month, and huoyitong-review was created in ap-southeast-1.

- Reviewer project: vfnpgecoewtyyzukizgu
- Operational project: nyizxtaofoynfgazhzsg (unchanged)
- Reviewer dashboard: https://supabase.com/dashboard/project/vfnpgecoewtyyzukizgu
- SQL Editor: https://supabase.com/dashboard/project/vfnpgecoewtyyzukizgu/sql/new

The empty-project check passed before installing the portable baseline. No real
company rows or Auth accounts were copied. The local portable-schema restoration
test passed before provisioning. The website, Android configuration and existing
account-admin deployment still target the operational project.

## Installed in the REVIEW project only

| Recorded version | Name |
| --- | --- |
| 20261028073313 | review_baseline_1415 |
| 20261028073358 | increment_1416_preserve_reopened_monthly |
| 20261028073408 | increment_1418_optional_route_times_finance_rates |
| 20261028073418 | increment_1419_account_management |
| 20261028073426 | increment_1421_driver_readonly_attendance |
| 20261028093710 | increment_1424_route_names_verified_after_sql_editor |
| 20261028093723 | increment_1431_shared_duty_rates |
| 20261028093729 | increment_1451_release_access_hardening |

Verification after completion: 42 public tables, all with RLS; zero Auth users;
private.dashboard146_finance_owner() returns NULL. Duty-rate table exists.
Anonymous payroll/driver-rename/trigger-function execution is denied and public
browser roles have no TRUNCATE/TRIGGER table grants. Do not repeat installed SQL.

## Route migration recovery — resolved by verified state

The connector returned `McpServerError: Invalid or expired requestState` twice on
1.4.24, and once on a locally verified empty-only alternative. At that point the
original columns still existed; neither submission was recorded as installed.
The user then ran the checked-in 1.4.24 SQL using the review project's SQL Editor
and reported `42P01: relation "route1424_tables" does not exist`.

The next read-only check nevertheless found the complete target structure. Do not
claim the cause of the editor error is known or that the original script is safe
to rerun. All nine replaced function source hashes match the checked-in migration;
new snapshot columns, removed code columns, NOT NULL/check constraint and route
validation trigger match; the temporary helper is absent and no user triggers are
disabled. The project has no users/routes/runs, so no company history was at risk.

A verification-only migration (version 20261028093710) asserted the function hashes,
columns, constraint and trigger state before recording the reconciled 1.4.24 state.
It did not replay the conversion. The existing 1.4.31 and 1.4.51 migrations then
applied successfully via the connector and were verified.

Security Advisor no longer reports anonymous security-definer grants. Its one
private audit-table no-policy notice is intentional; 16 authenticated definer
notices concern the existing guarded RPC design. These are not proof that a full
reviewer-role end-to-end check passed (there are no reviewer users yet).
References:
- https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## After schema setup

Phone provider/public-signup settings are not configured or independently verified
yet. No reviewer credentials, finance owner, seed records or Edge Function have
been created/deployed here. Configure Auth; create reviewer accounts through the
Auth Admin API (not direct Auth-table inserts); bind the verified reviewer owner;
deploy account-admin; seed only fictional records and verify role boundaries.

The final distributed app must provide reviewers a stable, documented route to
this environment while real users retain operational access. A separate AAB with
only the review backend is not by itself a complete public-release access strategy.
Do not change production configuration or provide Brian's credentials to reviewers.

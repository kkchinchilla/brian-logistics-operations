# Reviewer environment setup status

Updated 2026-10-28 (Asia/Taipei). **Incomplete; not ready for reviewer accounts.**

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

Verification after stopping: 41 public tables, all with RLS; zero Auth users;
private.dashboard146_finance_owner() returns NULL. Runs/routes are empty. Do not
repeat the baseline or the installed migrations.

## Connector blocker

Submitting the existing 1.4.24 route-name migration twice returned
`McpServerError: Invalid or expired requestState` (INVALID_ARGUMENT). A separate
empty-only variant with no backfills or trigger disabling also returned that
error. Its local PGlite comparison matched the original migration's functions,
triggers, constraints and columns, but **it was not applied**. Catalog/history
checks confirmed that neither 1.4.24 variant ran; route_code still exists.

There was no explicit approval-rejection reason in the response. Do not describe
it as a user refusal, SQL failure, or an applied migration. Stop automatic retries.
Use the project's SQL Editor with the user for the existing checked-in migration:
supabase/migrations/20261023133135_increment_1424_route_names.sql. Recheck history
and schema immediately before applying it manually. A SQL Editor run does not
automatically record the same MCP migration history; reconcile the entry afterward
before continuing rather than replaying the SQL.

Then apply the existing 1.4.31 and 1.4.51 migrations, in order, in this REVIEW
project only. The latter provides the grant hardening; security advisories on this
partial baseline still flag three anonymous security-definer grants already fixed
by that migration in the operational project. The private audit-table no-policy
notice is intentional. Authenticated security-definer notices require the existing
guard review, not blanket privilege changes.

Advisor reference:
https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

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

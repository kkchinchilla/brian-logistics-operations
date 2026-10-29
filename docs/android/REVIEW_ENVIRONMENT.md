# Reviewer environment setup status

Updated 2026-10-29 (Asia/Taipei). **Reviewer Auth users, application roles and account-admin are configured. Live credential checks are next.**

The user selected the existing Brian organization for the isolated reviewer project.
Supabase quoted $0/month, and huoyitong-review was created in ap-southeast-1.

- Reviewer project: vfnpgecoewtyyzukizgu
- Operational project: nyizxtaofoynfgazhzsg (unchanged)
- Reviewer dashboard: https://supabase.com/dashboard/project/vfnpgecoewtyyzukizgu
- SQL Editor: https://supabase.com/dashboard/project/vfnpgecoewtyyzukizgu/sql/new

The empty-project check passed before installing the portable baseline. No real
company rows or Auth accounts were copied. The local portable-schema restoration
test passed before provisioning. The website and Android configuration still
target the operational project. It and its account-admin deployment are unchanged;
the reviewer project now has its own account-admin deployment.

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
| 20261029020705 | reviewer_bind_accounts |

Schema verification before account bootstrap: 42 public tables, all with RLS; zero Auth users;
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

The user ran the project-specific Management API command on their Mac and reported
`Phone login enabled: true`, `Public sign-ups disabled: true`, and
`Verified successfully.` on 2026-10-29. The command checked the config again after
PATCHing only `external_phone_enabled`. The Dashboard Phone form required Twilio
credentials even with Confirm phone off, so that form was cancelled. Do not ask
the user to configure Twilio or repeat this completed settings step. A scoped PAT
for this endpoint needs BOTH Auth Config and Project Settings read-write permissions.

The Mac bootstrap has now completed. A subsequent database check found exactly
three confirmed, non-deleted Auth users with the expected fictional phone/role
pairs and one common bootstrap batch. Passwords remain private on the Mac.
The reviewer-only role binding was applied after a full-schema local test.
It resolved generated Auth IDs from the verified batch instead of hardcoding them.
The existing finance-owner function now freezes the resolved owner UUID; runtime
authorization still uses the guarded profile/owner rules, not bootstrap metadata.

Verified profiles: 審查管理員 = active dispatcher + finance owner;
審查主管 = active dispatcher without finance; 審查司機 = active driver without finance.
`account-admin` version 1 is ACTIVE here, with `verify_jwt=true` and the existing
handler's Auth.getUser + live-session owner check. The deployed source matches
`supabase/functions/account-admin/` (33 local handler tests passed). Anonymous
requests to both account-admin and dashboard_get_capabilities returned HTTP 401.

Security Advisor still reports the intentional private audit-table no-policy
notice and 16 guarded authenticated SECURITY DEFINER notices. It also reports
disabled leaked-password protection; that setting has not been changed. The
bootstrap generated random passwords; this does not count as enabling that feature.
Track the finding for release readiness:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

Next: run the private Mac live credential check below, then seed fictional records
and implement stable reviewer access in the distributed app. No live user-password
sign-in or role-based HTTP check is claimed until the user runs the check.

## Private Mac account bootstrap (completed)

The user created a temporary project secret key named `review_account_setup`.
Secret key names accept lowercase letters, digits and underscores. Its value is
not known to the assistant and must never be pasted into chat or committed.

Run `node scripts/create-review-accounts.mjs` on the Mac. It prompts before reading
the clipboard, accepts an `sb_secret_` key, clears the clipboard, and sends it only
to the fixed reviewer project's Auth endpoint. It creates three phone/password
Auth users through the supported admin endpoint, with confirmed fictional numbers
in NANPA's reserved 555-0100–0199 range. No email/SMS is sent, no managed Auth tables
are modified by SQL, and it does not grant application permissions yet.

Random passwords are saved BEFORE creation in
`~/huoyitong-review-private/reviewer-accounts.json` (directory 0700, file 0600),
outside the repo. That private file must be kept and never uploaded or pasted.
The script does not save the secret API key or print passwords. It resumes only
accounts matching the saved batch, phone and role markers; it refuses unknown
accounts or missing saved credentials instead of resetting passwords. Markers
are provisioning receipts, not the application's authorization source.

The local automated test (`node tests/review-account-bootstrap.mjs`) covers
successful creation, reruns, interrupted responses after creation, private file
permissions, fixed endpoint/header use, secret-free logs and refusal of mismatched
accounts. This is not a live reviewer login test. Auth identity verification,
owner/profile binding and reviewer Edge deployment are complete. Revoke the
temporary PAT and `review_account_setup` key once setup/checks are complete;
do not revoke the project's default runtime keys.

## Next manual step: live account-access check

Run `node scripts/check-review-access.mjs` on the same Mac. It reads the existing
private credentials file, uses only the review project's public client key, and
does not ask for or save a secret key. It signs in each account, checks its own
profile and finance capability, checks live-session account administration, and
expects supervisor/driver requests to account management to be denied. Only the
owner should receive the three-account directory. Each obtained test session is
signed out with `scope=local`, including when a permission assertion fails.
No passwords, access/refresh tokens, phone numbers or directory rows are printed.
The check does not create/edit/delete business records or change passwords.

Local tests: `node tests/review-permissions.mjs` restores the real schema and
checks the binding, privilege boundary and replay protection;
`node tests/review-access.mjs` checks the HTTP verification workflow, denials,
credential-free output and session cleanup using mocks. Both passed, but live
password-based HTTP verification still requires the user's Mac credentials.

Reviewer-only SQL is in `supabase/reviewer/migrations/`, deliberately outside the
operational migration chain. Its source filename was generated by CLI migration
new; the installed MCP migration timestamp is recorded separately in the table.
Never apply that directory to the operational project or replay the binding.

References:
- https://supabase.com/docs/reference/javascript/auth-admin-createuser
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/platform/personal-access-tokens
- https://www.nanpa.com/numbering/555-line-numbers

The final distributed app must provide reviewers a stable, documented route to
this environment while real users retain operational access. A separate AAB with
only the review backend is not by itself a complete public-release access strategy.
Do not change production configuration or provide Brian's credentials to reviewers.

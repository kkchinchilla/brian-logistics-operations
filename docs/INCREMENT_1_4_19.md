# Increment 1.4.19 — Account management

Extends accepted 1.4.18, 2026-10-23 (Taiwan). Account management is a fifth dashboard available only to the existing Brian finance-owner identity.

## User behavior

- View/search users; filter drivers, dispatchers, or deleted accounts. Existing users without phones show 「待設定手機」.
- Create a driver or dispatcher with name, phone number and password. No email or SMS is needed. Brian confirms that the supplied phone belongs to the person.
- Edit name and ordinary role. Phone numbers have their own edit control so each credential change is saved independently. Reset passwords with confirmation and show/hide controls.
- Brian can change his own name, phone and password. His administrator role cannot be removed and he cannot delete himself. Own credential changes return him to login.
- Deletion requires typing the selected user's name. The profile becomes inactive, then Supabase Auth soft-deletes the login and its sessions. Historical names, account IDs, attendance and financial references are retained. Deleted accounts are read-only in the history filter.
- If Auth deletion fails, the user remains disabled and the dashboard offers 「重試刪除」. If creation fails before profile provisioning, only the newly created empty Auth account is rolled back.
- Modal focus is contained, Escape/cancel clears credentials, and duplicate submits are blocked. Desktop rows become stacked cards on mobile.

## Server enforcement

`account-admin` verifies the caller with Auth `getUser`, then checks the current Brian capability and an actual non-expired `auth.sessions` record. Only then does it construct a privileged client. Both database RPC grants and an independent actor check restrict account directory/profile administration to that backend. No permissions derive from editable Auth user metadata.

The function is deployed with `verify_jwt=true`. Its CORS allowlist is the existing GitHub Pages origin. Provider keys are read from Supabase runtime environment variables; none are present in static assets. Only the requested phone or password is sent to Auth. Private audit events contain actor, target, action, and timestamp, never credentials. Auth updates are never performed through SQL.

New restrictive policies reject inactive/deleted users even if they present a previously issued, unexpired JWT. Existing row-level permissions still apply to active accounts. Existing dispatcher driver-name editing and finance restrictions remain intact.

## Installation

1. Apply `20261023011345_increment_1419_account_management.sql` once to the existing database.
2. Deploy `supabase/functions/account-admin/index.ts` with `handler.mjs`, retaining JWT verification.
3. Publish the tested static build via the existing GitHub Pages workflow.

This release does not reset, create, or delete any existing live user as part of installation. Normal application use by Brian performs those actions.

## Verification

`npm run test:accounts` exercises the real schema and migration in PGlite, mocked Auth Admin calls through the production Edge handler, and production dashboard code in JSDOM. It covers access denial, live-session enforcement, owner safeguards, phone normalization, duplicates, partial failures, deletion/history retention, password handling and modal interactions. Existing build, payroll, attendance, route, login, portable-schema and offline-demo checks are also required.

These are isolated tests with synthetic identities. No real password is used or changed by the test suite. Browser visual inspection and an authenticated live account-management mutation require a signed-in browser and have not been claimed as verified by these tests.

## Deployment verification — 2026-10-23

- Account-specific automated checks: 23 database, 21 Edge handler, 19 DOM interaction checks passed. Full existing regression suite, build/assets, portable schema restoration and offline demonstrations passed.
- Backend deployed as `account-admin` version 1, status ACTIVE, JWT verification enabled. CORS preflight and unauthenticated denial checked independently.
- Live read-only permission checks: Brian passes the existing owner and live-session checks; the service directory returns all five current profiles. Other dispatchers retain five roster entries and six routes, see no rates, and cannot call privileged account directory/mutation RPCs.
- Pre/post deployment fingerprints of profiles, Auth account metadata, runs, rates and closeouts are unchanged. No live credentials were changed and the new account audit remains empty.
- Security advisor findings for the new protected context RPC (intentional authenticated SECURITY DEFINER with an explicit owner and live-session check) and deny-by-default private audit table were reviewed. No credentials are exposed. Existing unrelated warnings remain.
- Authenticated live credential mutations and visual browser inspection remain unverified; isolated tests do not substitute for Brian’s acceptance testing.

Terminology update (2026-10-23): account role labels and validation wording use 「主管」 for the existing `dispatcher` role. Brian can add a phone to an existing account by selecting 「尚未設定」 in the phone column. This wording update changes no account permissions.

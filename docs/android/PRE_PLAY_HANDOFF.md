# Increment 1.4.51 — preparation before Play Console

Updated 2026-10-28. Prepared, not submitted. No public-release approval.

Current evidence and decisions are recorded in RELEASE_READINESS.md and
retention-plan.md. Historical items below are updated where completed; the
current application increment is listed in README.md.

## Completed in this increment

- Audited live table RLS, security-definer guards, grants and account-admin endpoint.
- Verified driver/ordinary-supervisor finance boundaries with read-only role queries.
- Removed browser roles' TRUNCATE/TRIGGER grants and unnecessary anonymous RPC grants.
  Migration 20261026052350 is already installed and recorded in the connected project.
- Bundled exact Supabase JS 2.118.0 with MIT license and a build-checked SHA-256;
  current dashboards no longer download their authentication SDK from a CDN.
- Added public, offline-readable privacy and account/data-request pages, linked from
  login and all five current dashboards. Logout stays the last footer action.
- Prepared listing copy, disclosure worksheet, reviewer/test plan and release checks.
- Updated the portable-schema restore test to include the latest permission fix.

## Still needs a person or a real device

1. Public sign-up disabled and settings independently verified on 2026-10-26.
   Phone provider remains enabled; user confirmed Brian can sign out/sign in and
   reach attendance. Administrator-created account creation/login/deletion passed.
2. The user selected five-year retention on 2026-10-28, replacing two months, and
   confirmed Brian keeps separate records. See retention-plan.md for the unresolved
   category-specific retention clock, storage assessment and deletion implementation.
   The current Delete user action retains names, payroll and attendance history;
   it must not be represented as erasing all associated data. Public pages describe
   current behavior, not a completed Google policy assessment. Finalize them before
   closed testing. A policy decision is not an implemented purge.
3. Support mailbox test delivery and reply delivery passed, confirmed by the user.
   This does not verify completion of a data-deletion request.
4. Choose/provision an isolated reviewer backend and synthetic accounts. The existing
   backend contains company data and is not an appropriate all-access reviewer demo.
   Do not give reviewers Brian's password, personal phone or live finance access.
5. Dedicated-account phone change passed on the physical phone. The signed release
   emulator smoke test passed on 2026-10-28 (startup/login/attendance/session/share
   chooser). Signed physical-device and Play install/update testing remain open.
6. New signed AAB built Oct 27; structure and manifest reviewed; signer matches
   the private upload key. Version 1.0/code 1 and certificate fingerprint are
   recorded in RELEASE_READINESS.md. Record the final artifact SHA-256 separately.
   Keep the keystore and password private; increment versionCode for each later upload.
7. Capture final screenshots on the release build with synthetic records; approve
   graphics (the current icon can still change). Browser previews are not evidence
   of a signed Android build passing.
8. Complete Google identity/address and any device verification after access returns.

## Small next manual step

The focused release emulator smoke test is complete. Continue the retention
implementation and remaining reviewer/store preparation; do not repeat completed
phone tests while awaiting Google verification. See retention-plan.md.

## Safe Mac update sequence (when prompted)

Keep the installed app and its data. From ~/Projects/brian-logistics-operations:

```sh
git pull --ff-only origin main
npm run build
npx cap sync android
node scripts/configure-android-privacy.mjs --check
```

Then sync/run in Android Studio for debug testing. Do not use Run on the emulator
currently holding the release-signed app: it attempts to install a differently
signed debug build. Native dependencies are now pinned in the repository and npm
ci was verified after 1.4.56; see dependency-maintenance.md. Do not apply old
database migrations or run npm audit fix --force.
If git reports local conflicts, stop and inspect; do not reset/clean the project.
The Mac dependency audit reported zero vulnerabilities after the 1.4.56 sync.

## After verification: Play sequence

Create app → upload signed AAB to internal testing → install through Play → review
pre-launch/device reports and fix issues → finalize listing/App content/reviewer
access → closed test → apply for production access → release review/approval.
For this new personal account, current Google guidance requires 12 testers opted
into the closed test continuously for at least 14 days. Internal testing does not
substitute for that test; production access is an application, not automatic.
Keep real feedback and fixes. Recheck Console requirements at submission time.

Sources checked 2026-10-26:
- https://support.google.com/googleplay/android-developer/answer/14151465
- https://support.google.com/googleplay/android-developer/answer/10787469
- https://support.google.com/googleplay/android-developer/answer/10144311
- https://support.google.com/googleplay/android-developer/answer/13327111

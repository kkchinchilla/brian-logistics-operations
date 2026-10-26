# Increment 1.4.51 — preparation before Play Console

Updated 2026-10-26. Prepared, not submitted. No public-release approval.

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

1. Disable public sign-up in Supabase Auth (not phone login). It was enabled at audit.
   Brian's existing Admin API account creation remains the intended path.
2. Brian must confirm retention periods and a working deletion/anonymization process.
   The current Delete user action retains names, payroll and attendance history;
   it must not be represented as erasing all associated data. Public pages describe
   current behavior, not a completed Google policy assessment. Finalize them before
   closed testing. No arbitrary retention period or legal basis has been invented.
3. Verify Brian can receive and respond using the support mailbox; no test email was
   sent by the assistant. Mailto links require an email app or manual copy/paste.
4. Choose/provision an isolated reviewer backend and synthetic accounts. The existing
   backend contains company data and is not an appropriate all-access reviewer demo.
   Do not give reviewers Brian's password, personal phone or live finance access.
5. Install the updated native build and test phone-number change using a dedicated
   disposable account, then a signed-release restart/network/CSV smoke test.
6. Rebuild the signed AAB after this increment. Existing AAB predates these assets.
   Record its versionCode, versionName, SHA-256 and upload certificate fingerprint.
   Keep the keystore and password private; increment versionCode for each later upload.
7. Capture final screenshots on the release build with synthetic records; approve
   graphics (the current icon can still change). Browser previews are not evidence
   of a signed Android build passing.
8. Complete Google identity/address and any device verification after access returns.

## Small next manual step

In Supabase project dispatch-system-dev, Authentication → Sign In / Providers
(the label may be Providers), disable **Allow new users to sign up** and save.
Do not disable the Phone provider. Then verify the setting and existing login;
create/delete one clearly identified test account through Brian's UI to confirm
administrator-created accounts still work. Guide these as separate steps.

## Safe Mac update sequence (when prompted)

Keep the installed app and its data. From ~/Projects/brian-logistics-operations:

```sh
git pull --ff-only origin main
npm run build
npx cap sync android
node scripts/configure-android-privacy.mjs --check
```

Then sync/run in Android Studio. Do not use npm ci to erase local Capacitor setup,
do not apply old database migrations, and do not run npm audit fix --force.
If git reports local conflicts, stop and inspect; do not reset/clean the project.
The app dependency audit still needs review on the Mac's actual native lockfile.

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

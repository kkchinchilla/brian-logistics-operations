# Reviewer access and remaining tests

No reviewer credentials exist yet. Never commit passwords or give reviewers access
to the operational company backend. Existing automated fixtures are not a live demo.

## Isolated reviewer environment

The user selected the Brian organization and the separate huoyitong-review project
was created at the quoted $0/month on 2026-10-28. Schema setup is verified, with Auth/accounts pending: see
[REVIEW_ENVIRONMENT.md](REVIEW_ENVIRONMENT.md) for installed migrations and
next setup steps before taking any provisioning action. Do not create a duplicate.
Use schema baseline plus later migrations in docs/DATABASE.md, preserve real Supabase
Auth objects, and deploy account-admin to that project. Add synthetic owner, supervisor
and driver accounts via the Admin API. Bind finance to the synthetic owner, not Brian's
production UUID. No SMS/OTP challenge should block supplied review credentials.

Use fictional route names, plates, assignments and amounts. Include delivery and each
duty type, rental and non-rental, adjustment, a closed date and a reopened date. Build
using SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY for the isolated project; verify the
bundle points to that project before distribution. Never switch the public website's
backend just to support a test. A release/reviewer environment strategy must remain
usable through review; it cannot depend on a one-time manual server toggle.

## English reviewer instructions template (complete privately in Console)

App: Huo Yi Tong (貨易通). This is a Traditional Chinese logistics scheduling and
attendance app. Accounts are created by a team administrator. There is no public
registration and no purchase is required to access the supplied review accounts.

Phone: [provide review account privately]
Password: [provide privately; keep working throughout review]

Sign in on the first screen. Enter the supplied phone number in 手機號碼 and the
password in 密碼, then tap 登入. The driver account opens 每日出勤, showing its own
read-only assignments. Select the seeded date [fill date] to see sample runs.
The supervisor account can use 每日出勤, 路線管理 and 車輛管理. The review owner also
has 月度報表, 費率表 and 帳號管理. Use seeded month [fill month] for payroll examples.
CSV export opens the Android share sheet. All review data is fictional. Internet
access is required. Support: tangguanjia.support@gmail.com.

Create separate instructions/credentials for each necessary role in Console. Check
all features with these exact accounts before submission, including pre-launch bots.

## Remaining focused acceptance

| Test | Expected evidence |
| --- | --- |
| Existing account phone change | Old phone rejected, new phone works, same UUID/driver history; use a disposable account and restore/delete only that account |
| Signed build cold start and background/restart | Same valid session; server role rechecked, no stale unauthorized dashboard |
| Signed build network loss/recovery | Friendly recovery, no lost input or duplicate confirmed save |
| Signed build CSV | Both attendance and payroll files open and match the source month |
| Release update | Build N → N+1 signed with same key preserves account/data; debug→release with a different key is not a valid upgrade test |
| Smaller/older Android + fold state | Readable driver cards/tables, keyboard and dialogs accessible, Back closes correct layer |
| Privacy pages and support | Accessible without login and from each role; email request flow works on device |
| Play install | Correct name/icon, install and launch via test link, correct backend, required features work |
| Play pre-launch report | Investigate crashes, ANRs, accessibility and security findings; report is not comprehensive proof |
| Closed testing | Real work scenarios, feedback, fixes and regression evidence from opted-in testers |

Keep versionCode, Android version/device, role, scenario, expected/actual result and
resolution in a private test log. Avoid names, phones and wages in public bug reports.
For a new personal account, recruit at least 12 real testers who can remain opted in
for 14 consecutive days; planning for a few extra testers reduces dropout risk.
Internal-track testing does not satisfy the closed-test requirement. Production access
can be requested only after the required test and is not guaranteed automatically.

Sources:
https://support.google.com/googleplay/android-developer/answer/14151465
https://support.google.com/googleplay/android-developer/answer/15748846
https://support.google.com/googleplay/android-developer/answer/9844487

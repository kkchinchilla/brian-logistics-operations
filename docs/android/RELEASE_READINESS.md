# 貨易通 Android preparation and acceptance tracker

Updated: 2026-10-27 (Asia/Taipei).
Status: development/testing; **not approved for public launch**.
Google developer address verification must be resubmitted and is pending, per the user.
This tracker reflects the current application and supersedes older prototype
assumptions for Android testing. Keep the UI in Traditional Chinese.

## Evidence rules

Record the exact scenario and result. A passing UI check does not prove server
permissions, a debug install does not prove a signed release, and acceptance of
one role does not imply acceptance of the other roles. Do not ask the user to
repeat passed checks without a relevant change or release-build reason. Guide
one focused manual test at a time. Automated tests complement physical tests.

## Confirmed on the physical phone

User confirmations in the current conversation, 2026-10-25:

| Scenario | Result |
| --- | --- |
| 路線管理: 路線列表 → 地區與溫層 → Android Back | Returned to 路線列表 in the same dashboard |
| 新增配送地區 dialog → Back | Closed dialog and kept current tab |
| Keyboard open in the entity dialog → Back twice | Keyboard closed first; dialog closed next without saving |
| 月度報表 driver details → Back | Closed details and kept dashboard/month |
| 月度報表 加給／獎懲 → Back | Closed dialog and kept dashboard/month |
| Disable mobile data and Wi-Fi, then open 車輛管理 | Recovery panel shown; no login redirect after fix |
| Restore internet while on that recovery panel | Dashboard loaded automatically without another login |
| Install launcher icon and run Android app | Branded icon visible on the phone |

Earlier user-confirmed checks include phone login/session persistence, monthly
statistics and salary totals, native CSV saving and contents, and role-specific
screens. These are useful prior evidence, not blanket acceptance of all flows.
Recent authentication changes justify focused role checks below.

## Remaining functional acceptance

| ID | Scenario | Status |
| --- | --- | --- |
| R1 | Sign in as a non-Brian 主管: only 每日出勤、路線管理、車輛管理; no 費率表 | Passed on phone |
| R2 | Driver sign-in: own assignments only; no editing/request-to-change controls or management dashboards | Passed on phone |
| R3 | Brian sign-in: owner dashboards and 費率表 remain available | Passed on phone |
| E1 | Supervisor creates one explicitly identified test assignment; correct driver sees it on phone after refresh | Passed: 10/25 林小美, 7H, APP測試-01 |
| E2 | Edit that test assignment; confirm latest data agrees between web and app | Passed: APP測試-02, one assignment |
| E3 | Close attendance; Brian verifies monthly delivery/duty counts and calculation using known rates | Passed: 2 deliveries / 400 delivery + 100 learning − 100 rental = 400 |
| E4 | Reopen retains last closed figures; re-close overwrites them without duplication | Passed: reopened and edited totals stay 400; reclose rental change gives 300 with 2 trips; restored non-rental and reclosed gives 400 |
| E5 | Export the tested month and compare CSV figures with the verified web/app totals | Passed: phone CSV delivery 400, learning 100, rental 200, salary 300 before restoring non-rental |
| E6 | Remove only test records identified during this scenario; confirm no accidental operational changes | Pending: run 15 remains; rental flag restored to false and finalized |
| A1 | Owner account management: create, password reset, name edit, role changes, delete | Passed on phone/web using dedicated test accounts; phone-number change also passed on 2026-10-27 |
| N1 | Manual retry after network recovery, cold start offline, and connection loss during a save | Cold offline panel passed. 1.4.45 automatic recovery stayed on the panel; manual retry loaded attendance without a password (passed). Passed: automatic cold-start recovery, manual retry, failed save retains input, online retry saves once. Test note restored and reclosed; salary remains 400. |
| N2 | Background/foreground or process restart: session and data recover; incomplete writes are not presented as saved | Pending release-build regression |
| D1 | Release security/access review | 1.4.51 code/live role review and grant hardening completed; see SECURITY_REVIEW_1451.md for remaining settings and limitations |

Use clearly identified test records and accounts. Select the test date and
records before making changes; do not clear historical or operational data.
Do not mark absence of a button as proof that its server endpoint is protected.

Current role/business expectations: drivers have their own read-only attendance
view; supervisors handle attendance/routes/fleet; only Brian has finance/rates
and account management. There is no base salary. Shared per-assignment rates
for 值班、跟車、學習 are included in payroll; rental cost is deducted and
加給／獎懲 applied. Route names are displayed; stable internal IDs identify rows.

## Release preparation, separate from functional acceptance

1. Inspect the native project on the Mac: application ID, app name, version code,
   version name, SDK targets, manifest and required permissions. The repository
   package version is still 1.4.27; do not infer Android release versions from it.
2. Prepare the release signing/upload key on the user's Mac and an appropriate
   backup. Never request passwords, private keys or signing files in chat.
3. Build a signed release bundle and test the release build on a physical phone;
   confirm upgrade behavior and data/session continuity without clearing data.
4. Prepare store screenshots, description, support details, privacy policy,
   data-handling/account-deletion disclosures and reviewer access. Verify current
   Google Play requirements when completing those tasks; do not submit guessed
   disclosures. Support address: tangguanjia.support@gmail.com.
5. When the developer account is available, use Play testing and address required
   feedback and account-specific requirements before requesting production access.
6. Public release requires explicit readiness review and user approval. A complete
   Google identity check or a passing debug test is not a launch decision.

Public signup is now disabled (settings verified); Brian sign-out/sign-in on the phone passed. The 1.4.53 roster fix and administrator creation/login/deletion with public signup disabled passed on the phone. See PRE_PLAY_HANDOFF.md.

## Native privacy and release preparation evidence

User-confirmed since Increment 1.4.49 (2026-10-25/26):

- Privacy installer applied four files, then build/sync and --check passed.
- Android Studio update preserved the signed-in session without reinstalling.
- Attendance CSV saved/opened; salary CSV saved/opened and matched the dashboard.
- Android App info displayed 貨易通.
- App ID io.github.kkchinchilla.huoyitong; native version 1.0/build 1;
  min SDK 24, target/compile SDK 36.
- Release variant sync and processReleaseMainManifest succeeded. Reviewed the
  supplied merged manifest: INTERNET plus the app's signature-protected AndroidX
  receiver permission; correct backup rule references; both providers non-exported;
  launcher activity exported; AndroidX profile receiver guarded by DUMP permission.
- assembleRelease and lintRelease succeeded. This is not evidence of a signed
  release installation, actual backup/transfer behavior, or release readiness.
- Supplied lint HTML contained 21 warnings, no errors. User moved INTERNET before
  application in the source manifest, reran lint and confirmed 20 warnings with
  ManifestOrder removed.
- Supplied normal/round v33 icon definitions both contain monochrome layers.
- Reviewed the full supplied res archive: 11 default Capacitor splash PNGs and
  only one styles.xml. Splash cleanup applied in 1.4.50: one XML written and 11 templates removed.
  Release build/lint succeeded; 17 warnings remain. Branded cold launch and automatic
  sign-in passed on the physical phone.

User created a private upload keystore (alias huoyitong-upload, 25-year validity),
built a signed AAB successfully and confirmed a private backup/password record.
The keystore is outside the repository. Signed physical install/update testing
and a rebuilt AAB containing 1.4.51 remain pending.

See PRE_PLAY_HANDOFF.md for completed preparation and remaining manual decisions. Do not treat the native checks as full application/security approval.

## Test-data correction during payroll acceptance

2026-10-25: run 12 (10/22, 全家測試A線) retained 常溫 while the route
was OC. User confirmed OC was correct. A targeted transaction reopened only
10/22, corrected the run temperature, and reclosed only that date (event 26),
retaining original event 24. No rates or other run fields changed. This was a
data correction, not a general historical rate-resolution change. User confirmed
林小美 salary 400 after refresh. Run 15 is the separate 10/25 test assignment.

## Save error wording (Increment 1.4.48)

During the offline-save test, the shared dialog retained entered text but showed
TypeError: Failed to fetch. Network transport errors in shared save dialogs now
show Traditional Chinese recovery instructions. The message says the save result
cannot be confirmed: a dropped response does not prove the server rejected the
write. Input retention and explicit retry behavior are unchanged. Existing
business validation/conflict messages remain intact. User confirmed the offline
save → online retry → restore original note → reclose scenario with no duplicate
and the original 2 trips / delivery 400 / rental 100 / salary 400 totals.

## Account-management physical acceptance (2026-10-25)

User confirmed these steps with a dedicated account, APP帳號測試, later renamed
APP帳號測試-更新:

- Created from Brian's account; correct phone and driver role appeared in the list.
- Phone login opened the read-only driver view with no management navigation.
- Reset password: old password rejected; new password accepted.
- Name edit appeared correctly in the account list.
- Driver → supervisor after sign-out/sign-in exposed attendance/routes/fleet only,
  without monthly reports, account management or finance rates.
- Supervisor → driver while signed in, followed by app restart, restored driver
  restrictions and removed routes/fleet.
- Deleted only this test account while signed in. After restart the phone returned
  to login, and the deleted credentials were rejected. Test account cleanup passed.

The assistant's earlier disable/reactivate test was incorrect: the current UI has
no reversible disable feature. It was skipped, not passed, and is not planned scope.
The delete operation preserves historical reporting records. Changing an existing
account's phone number passed on 2026-10-27 using APP換號測試: old phone rejected,
new phone accepted with the unchanged password and driver role. The test account
was deleted and disappeared from account and attendance lists. This test had no
assigned attendance and does not prove historical-record preservation. UI observations do not replace
server authorization review. No passwords or phone numbers are recorded here.

User also confirmed the localized 1.4.48 save-error wording works.

## Dependency and preparation follow-up (2026-10-27, Increment 1.4.56)

- Repository now records the six Capacitor packages already used on the Mac,
  pinned to the tested versions, plus targeted ExcelJS/xcode UUID 11.1.1 overrides.
  See dependency-maintenance.md for scope and safe local synchronization.
- User's Mac: npm audit reported zero vulnerabilities; 14-page build, check and
  Capacitor sync passed; assembleRelease and lintRelease succeeded. No new lint
  warning count was supplied. Android Studio Run updated the existing installation;
  automatic sign-in and attendance loading passed. This remains a debug-device
  check, not signed-release installation evidence.
- APP註冊測試: Brian-created driver could sign in while public signup was disabled;
  only the read-only driver view was available; deletion removed the test account
  from account and attendance lists. APP帳號測試-更新's empty roster row was also
  confirmed gone after 1.4.53.
- Privacy page readability and Android Back/session continuity passed. Account/data
  request email action opened the email app/chooser with the support address;
  returning to attendance retained the session. The request page also opened
  without credentials from the login page. Subsequent user tests confirmed a test message arrived in the support mailbox
  and its reply arrived in the original sending account. This verifies email
  delivery in both directions, not completion of a real data-deletion request.

Still open: retention/deletion procedure decisions, isolated reviewer access, final
store screenshots/device coverage, current signed bundle and physical release tests,
Play verification/testing and production-access review. Do not treat this dependency
update as launch approval.

## Large-text mobile corrections (Increment 1.4.57)

- Mac synchronization of 1.4.56 completed with npm ci and zero audit vulnerabilities.
- Brian has not decided retention periods. Leave the retention/deletion procedure
  item open; do not invent a policy or enable automatic deletion.
- User's largest-font test found overlapping bottom navigation, escaped date
  arrows on attendance/monthly, and clipped route region/temperature selectors.
  This is a failed large-text check, not driver-specific acceptance (the reported
  pages include management dashboards).
- Date/month controls now grow with text, have fixed SVG arrows, and use a separate
  date row at widths up to 380px. Route filters have content-sized heights and
  stack at phone widths. Existing text navigation wraps at two-character word
  boundaries; icon replacement remains a future design change.
- All five dashboards reserve the actual navigation height, including safe areas,
  as labels wrap or the bar hides for driver/offline views. Route-specific CSS
  overrides were inspected explicitly.
- Build/check, existing driver UI, monthly Back and release-preparation checks
  passed. Navigation-height tests cover all five pages. Browser geometry and
  screenshot checks use synthetic page content and doubled CSS font sizes; they
  do not reproduce Samsung WebView system-font scaling exactly.
- User confirmed the affected date controls, route filters and bottom navigation
  are now fine on the phone at maximum system font size. No account permissions, payroll calculations or database data changed.

## Account phone styling (Increment 1.4.58)

The user reported the mobile 手機號碼 label and number were too close at maximum
font size and requested an always-visible underline for editable phone numbers.
The account-only stylesheet now adds a 16px horizontal / 8px wrapped-row gap and
underlines the existing edit button at every viewport size. Read-only/deleted
values remain plain text. No edits to account behavior, shared footer links or
route styles. Physical phone confirmation of this adjustment remains pending.

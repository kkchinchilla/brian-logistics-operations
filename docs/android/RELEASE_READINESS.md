# 貨易通 Android preparation and acceptance tracker

Updated: 2026-10-25 (Asia/Taipei).
Status: development/testing; **not approved for public launch**.
Google developer identity verification is still pending, per the user.
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
| A1 | Owner account management: create, password reset, name edit, role changes, delete | Passed on phone/web using the dedicated test account; phone-number change remains untested |
| N1 | Manual retry after network recovery, cold start offline, and connection loss during a save | Cold offline panel passed. 1.4.45 automatic recovery stayed on the panel; manual retry loaded attendance without a password (passed). Passed: automatic cold-start recovery, manual retry, failed save retains input, online retry saves once. Test note restored and reclosed; salary remains 400. |
| N2 | Background/foreground or process restart: session and data recover; incomplete writes are not presented as saved | Pending release-build regression |
| D1 | Review for debug/test-only content, exposed secrets, logging of credentials, unsafe cached authorization and missing server-side role checks | Pending release audit |

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

Next user instruction: apply scripts/configure-android-privacy.mjs on the Mac,
then build/sync and verify with --check before Android Studio Run. See
privacy-settings.md. Native app ID/name, version 1.0/build 1, min SDK 24 and
target/compile SDK 36 were confirmed from user-provided files. Source manifest
and sharing paths reviewed; merged release manifest and native build still pending.

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
account's phone number has not been manually tested. UI observations do not replace
server authorization review. No passwords or phone numbers are recorded here.

User also confirmed the localized 1.4.48 save-error wording works.

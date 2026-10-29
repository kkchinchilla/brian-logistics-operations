# Demonstration login — device acceptance pending

The normal build includes a `reviewer/` directory containing the same application
and bundled assets, with separate public backend configuration. No credentials or
administrative keys are bundled. The company entry and its saved Auth sessions
retain their existing configuration. Each backend uses its own Auth storage key.

On the login screen, choose **展示環境登入** below the login button. Enter the
reviewer phone and password supplied privately. Every demonstration dashboard
shows **展示環境 · 虛構資料**, plus the sample dates and month. The route dashboard
has the same notice, with explicit wrapping and non-shrinking flex styling.

All dashboards, permission checks, account management, exports, Back handling and
relative navigation use the same source as the company app. Switching environments
does not copy a session or business data. The URL selects the environment; no
global environment flag can silently change another open browser tab. Reviewers
can edit the fictional data according to their assigned role.

To return to company login, sign out of the demonstration account, then choose
**返回公司登入**. A company user already signed in must sign out before using the
demonstration entry. A fully restarted Android app opens its normal entry screen;
choose **展示環境登入** again to resume a valid saved reviewer session. Background
and foreground use retain the current page. Test these behaviors on the device.

## Focused acceptance still required

1. Rebuild/sync Android and update the installed app.
2. From login, open the demonstration entry and confirm its label before entering
   the privately saved reviewer credentials.
3. Verify all three roles, sample dates October 27–29, 2026, and October payroll.
   Initial sample salary is 2,900; edits to fixtures can change that expected value.
4. Verify the label, navigation and logout on all five dashboards (including
   路線管理 separately), mobile portrait/landscape and desktop.
5. Check demonstration CSV sharing, dialogs, Back, cold start and network recovery.
6. Sign out, return to company login, and confirm the normal account still works.

Do not upload the private credentials file or put passwords in these instructions.
Complete the private Play Console access instructions with the demonstration-entry
step and the relevant reviewer credentials before submission. This entry does not
complete the remaining Play testing or release-readiness work.

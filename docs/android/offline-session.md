# Offline session recovery (Increment 1.4.43)

A failed Auth or profile request is not evidence that the user has logged out.
All five production dashboards keep their current URL, preserve the saved session,
and block business content with a Traditional Chinese recovery panel when startup
verification cannot complete. Reconnecting triggers one page reload; the manual
「重新載入」 button also works when connectivity detection does not change.

A retry still verifies the current user with Supabase Auth and reads the current
active profile before loading data. No cached profile or user-editable metadata
is used to authorize access. Confirmed invalid authentication returns to login;
a confirmed missing, inactive, or unsupported profile is signed out locally.
Database RLS and owner capabilities are unchanged. This does not add offline
editing, queued writes, or offline access to business records.

Automated checks: `node tests/increment_1443/offline-session.mjs`.

Physical-device acceptance passed (user confirmation, 2026-10-25):
1. While signed in, disable mobile data and Wi-Fi, then open 車輛管理.
2. Expect 「目前無法連線」 and 「重新載入」 on that dashboard, not the login page.
3. Restore the connection. Expect the same dashboard to load without a password;
   Automatic recovery without another login was confirmed. Manual retry is
   covered by automated checks but has not been separately confirmed on device.

Previously passed physical-device Back checks (2026-10-25): route tab navigation,
route entity dialog, keyboard before dialog, monthly driver details, and
加給／獎懲 dialog. These confirmations apply to the scenarios listed above,
not every network or background-resume scenario.

## Cold-start recovery follow-up (Increment 1.4.45)

The user subsequently confirmed the offline panel on a cold start, but restoring
connectivity showed the login page. This distinct scenario failed physical
acceptance even though navigation from an already open dashboard had passed.

Code inspection found that index.html did not load recovery handling and login.js
only attempted session restoration once; temporary errors left the password form
with no reconnect handler. The login page now uses the same recovery panel as
the dashboards, loads that handler before the remote SDK, and hides the form
during initial session verification. Network/profile-request errors preserve the
session and provide retry; confirmed invalid authentication still allows login,
and confirmed inactive/unsupported profiles still sign out locally.

Dashboard startup explicitly calls getSession to refresh saved credentials and
surface refresh errors before getUser and the current profile check. Cached
session contents never authorize access. Returning focus/visibility to an online
blocked screen also retries, covering an online event missed while backgrounded.
All retry events in a page instance share one reload guard.

Automated regression: node tests/increment_1445/cold-start.mjs (38 checks), plus
the existing offline and phone-login suites. No native dependency or database
change. Physical retest is still required; without the phone's logs the exact
device failure cannot be conclusively attributed to one startup branch.

Update on the Mac: git pull origin main && npm run build && npx cap sync android,
then Android Studio Run. Stay signed in, turn off all connectivity, swipe the app
away, reopen, and restore connectivity. Expect automatic attendance loading
without password entry. Do not uninstall/clear app data for this test.

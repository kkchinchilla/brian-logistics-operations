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

## Missing or early connection events (Increment 1.4.46)

Physical retest of 1.4.45: the recovery panel remained after reconnecting, but
manual 重新載入 immediately opened attendance without a password. This confirms
that the saved session survived. Automatic recovery still failed; it is unknown
whether the WebView missed the event or retried before the network was usable.

Recovery now checks the configured Supabase /auth/v1/health endpoint every three
seconds while the panel is visible. It requires an uncached successful GoTrue
response before reloading; online/focus/visibility events request the same check.
Checks do not depend on navigator.onLine and send only the public API key, with
credentials omitted. They neither authorize access nor replay business writes.
After reload the existing Auth/profile/capability checks still apply. The deployed
endpoint was checked read-only: HTTP 200, GoTrue, CORS allowed localhost.

Requests time out after five seconds, never overlap, pause in the background, and
stop on page exit. Automatic reloads are capped at two across page instances in
sessionStorage; successful dashboard startup resets this counter. Manual retry
always remains available and resets only the recovery counter, not Auth storage.
If sessionStorage is unavailable, automatic reloads are disabled to prevent loops.
The login recovery view removes the extra outer card.

Automated regression: node tests/increment_1446/reconnect.mjs (35 checks), plus
the existing offline, cold-start, and application suites. No native dependency
or database change. Physical automatic-recovery retest remains pending.

Endpoint reference: https://supabase.com/kb/troubleshooting/how-do-i-check-gotrueapi-version-of-a-supabase-project-lQAnOR

## Physical acceptance and navigation cleanup (Increment 1.4.47)

User confirmed automatic recovery works on 1.4.46 (2026-10-25). They reported an
unnecessary attendance navigation tab at the bottom of the recovery screen.
The navigation containers sit outside .main, so the original blocked-content
selector did not hide them, and driver role styling may not yet be available.
Recovery CSS now hides both .mobilebar and the route page's .mobile-navbar while
connectionState is blocked, independently of account role. Normal dashboard
navigation is unaffected. No changes to the accepted recovery logic.

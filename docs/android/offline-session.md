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

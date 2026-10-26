# Increment 1.4.51 — pre-Play preparation

The authentication SDK previously loaded an unpinned major version from a CDN.
It is now a bundled, checksum-verified 2.118.0 asset. Login therefore needs only
the app assets and backend, without another CDN dependency. Package/Capacitor
manifests are unchanged so the Mac's local native setup can be preserved.

A live grant review found unnecessary TRUNCATE/TRIGGER grants and anonymous
EXECUTE on three privileged functions. A narrow, recorded migration removes them
without changing business records or the intended supervisor rename action.

Login and all current dashboards now link to privacy/account-data resources.
They describe actual retained history; they do not claim all personal data is
removed by the existing account-delete button. Brian is the confirmed contact.
Store text, draft artwork, reviewer/test instructions and a disclosure worksheet
are prepared under docs/android. No Play submission has been made.

Validation: npm test; build/check (14 pages and SDK checksum); portable-schema
restore; 1.4.31 duty/payroll tests; 1.4.35 CSV tests; 1.4.45 cold-start and 1.4.46
reconnect tests; historical offline demo tests; new bundled-SDK phone sign-in,
session restoration/server verification/logout and privacy-link tests passed.
Live driver/supervisor role checks and post-migration privilege checks passed.
Artwork dimensions were checked and images visually inspected. Browser visual
capture could not run in this environment; mobile layout and signed-app tests
remain explicit physical checks. No screenshots have been fabricated.

See android/PRE_PLAY_HANDOFF.md for the remaining manual steps. These include
public-signup settings, retention/deletion decisions, isolated reviewer accounts,
Mac native dependency audit, a rebuilt signed bundle and physical release checks.
Passing these automated tests is not public-launch approval.

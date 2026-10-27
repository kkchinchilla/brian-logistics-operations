# Android dependencies — Increment 1.4.56

The repository now includes the native tooling previously installed only on the
Mac: Capacitor CLI/core/android 8.5.3, App 8.1.2, Filesystem 8.1.5 and Share 8.0.3.
Versions are pinned to the user's tested installation; package-lock.json records
the resolved graph. The native Android project and private signing key remain on
the Mac; this change does not upload them or change the app ID.

## UUID fix

Targeted npm overrides resolve ExcelJS and xcode's uuid dependencies to 11.1.1,
addressing GHSA-w5hq-g745-h8pq without downgrading ExcelJS 4.4.0 or upgrading
Capacitor. UUID 11.1.1 retains CommonJS support used by these packages.

References:
- https://github.com/advisories/GHSA-w5hq-g745-h8pq
- https://github.com/uuidjs/uuid/releases/tag/v11.1.1

Isolated verification covered ExcelJS conditional-format UUID generation, 1,000
xcode project UUIDs, the Capacitor CLI version and existing workbook export tests.
The Mac then reported zero audit vulnerabilities, successful build/check/sync,
release assemble/lint, and session-preserving debug install/attendance loading.
Audit results are time-dependent and do not establish whole-app security. The
legacy CDN ExcelJS browser bundle is not rewritten by npm overrides.

## Bring the existing Mac checkout onto the shared dependency files

The user's local package.json and package-lock.json contain the earlier manual
Capacitor additions and overrides. Preserve just those files in a named Git stash
before pulling, so local edits cannot block the update:

```sh
cd ~/Projects/brian-logistics-operations
git stash push -m "Mac dependencies before 1.4.56 sync" -- package.json package-lock.json
git pull --ff-only origin main
npm ci
npm audit
```

Run sequentially and stop on any failure. Keep the stash as a backup; do not pop it
onto the updated dependency files. Do not stash all files, reset the checkout,
remove android/, clear app data or move the private signing key. Future installs
can use npm ci because the shared lockfile now includes all six native packages.

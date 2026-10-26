# Android splash cleanup — Increment 1.4.50

The inspected Mac resource archive contains 11 Capacitor template splash PNGs,
showing the blue Capacitor mark on white. The launch theme references
`@drawable/splash`. No alternative styles files were present in that archive.
The release lint report flags inconsistent landscape dp sizes, duplicate default
and landscape-mdpi images, and a bitmap in an unqualified drawable folder.

## Apply on the Mac

```sh
cd ~/Projects/brian-logistics-operations
git pull origin main
node scripts/configure-android-splash.mjs
```

The script checks the inspected launch-theme reference and branded icon
resources, validates all splash variants before changing anything, and backs up
recognized template images under `android/.huoyitong-splash-backup/res/`.
Only images whose path and SHA-256 match the inspected templates are removed.
Custom images, unknown variants, conflicting backups and custom splash.xml files
stop the operation before modification. Keep the backup folder outside the app's
resource folder; it is ignored by Git.

One `res/drawable/splash.xml` replaces the 11 images. It draws a white background
and a centered 96dp square referencing `@mipmap/huoyitong_launcher`. Android's
resource resolution selects the installed icon variant. No logo paths or colors
are duplicated, so later launcher-icon updates also update this drawable.
Launcher icons, manifest, themes, permissions, dependencies, privacy resources,
WebView files and server records are untouched. The native Android 12+ system
splash behavior remains controlled by the existing Theme.SplashScreen theme.

Re-running is idempotent. Verify without writing:

```sh
node scripts/configure-android-splash.mjs --check
node scripts/configure-android-privacy.mjs --check
```

## Validation

Automated tests cover exact-template backup/removal, refusal of modified or
unknown resources, unchanged unrelated files, backup collisions, read-only
checking and repeat application. The installer is also exercised against a
scratch copy of the user's full resource archive before publication.

On the Mac, use Android Studio Run Anything (Control twice):

```text
gradle :app:assembleRelease :app:lintRelease
```

Expected: the three splash bitmap warnings disappear. From the user's current
20-warning report, 17 warnings may remain if no other inputs change. This is an
expectation, not a recorded native test result. Review the new report.

For the next physical test, switch the app build variant back to **debug**, then
Run using the normal app run configuration. Do not uninstall the existing app.
Cold-open the app and check the startup screen and successful dashboard loading.
Check portrait and landscape; an older Android test device/emulator is useful
because Android 12+ provides its own system splash. A successful debug test does
not establish signed-release or upgrade acceptance.

## Remaining warnings

- Two update notices: Gradle wrapper 8.14.3 and AppCompat 1.7.1 in the supplied
  report. Do not upgrade dependencies solely to clear a warning during this fix.
- Two redundant resource version qualifiers: harmless cleanup, retained.
- Eleven unused-resource reports: do not delete blindly. Capacitor can reference
  application resources by name at runtime (including AppTheme.NoActionBar).
- Two monochrome-icon reports point at the v26 files. The supplied v33 files for
  both normal and round icons include monochrome layers. No suppression added.

The manifest-order warning was resolved manually on the Mac and confirmed by a
new 20-warning lint report. These observations are not a complete security audit
or public-release approval.

References: Android [drawable resources](https://developer.android.com/guide/topics/resources/drawable-resource)
and [LayerDrawable](https://developer.android.com/reference/android/graphics/drawable/LayerDrawable).

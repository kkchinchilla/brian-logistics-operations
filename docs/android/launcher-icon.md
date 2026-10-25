# 貨易通 Android launcher icon

The app launcher icon is separate from the web dashboard logo. The native Android
project currently lives on the developer's Mac; this repository supplies a
repeatable installer, not a replacement Android project.

From the project directory, run:

```sh
git pull origin main
node scripts/install-android-icon.mjs
```

Then Run the Android project on the physical phone from Android Studio. Check
that the app drawer shows 貨易通 with the yellow background and white arrow/dot.
No uninstall or clearing app data is needed. `npx cap sync android` alone does
not run the icon installer. Run the installer again after recreating the Android
platform or changing the logo.

The script reads `assets/tangguanjia-logo.svg` and writes eight uniquely named XML
resources into `android/app/src/main/res`. These cover legacy vector icons,
adaptive foreground/background icons for Android 8+, round launcher references,
and an Android 13+ monochrome layer. The operating system can tint the icon if
the user enables themed icons. It updates only the application's icon references
in `AndroidManifest.xml`, preserving permissions, activities and the app name.
Existing files are backed up once to `android/.huoyitong-icon-backup/` before
replacement. Repeat installation is safe and does not replace that backup.

For an Android project in another directory, pass its directory as the optional
argument: `node scripts/install-android-icon.mjs /path/to/android`.

Validation: `node tests/increment_1444/android-icon.mjs`. Native Gradle compilation
and launcher appearance still require the Android project on the Mac and phone.

Reference: https://developer.android.com/develop/ui/compose/system/icon_design_adaptive

Recent device acceptance (2026-10-25): offline navigation recovery screen and
automatic online reload both passed without requiring another login.

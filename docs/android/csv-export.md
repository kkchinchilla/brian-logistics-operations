# Android CSV export

The web application downloads CSV files normally. Android writes UTF-8 CSV files
(including the Excel BOM) to app cache and opens the system share sheet. The user
chooses the destination; opening or dismissing the sheet is not proof of delivery.
Both monthly attendance and payroll reconciliation use this path.

The Android shell is maintained separately from this web repository. In that
project, with Capacitor 8 installed:

```sh
npm install --save-exact @capacitor/filesystem@8.1.5 @capacitor/share@8.0.3
npm run build
npx cap sync android
```

Rebuild and run in Android Studio. Cache sharing uses the default Capacitor
FileProvider configuration; no broad storage permission is needed. Files remain
in app cache for the receiving app to read and may be reclaimed by Android.
An older build without the plugins displays an update-required error.

Device acceptance: test both CSV buttons, select a destination, open the resulting
file, check Traditional Chinese and amounts, cancel a share and retry. Automated
bridge tests do not replace this physical-device check.

# Android backup and CSV sharing (Increment 1.4.49)

The native Android project lives on the user's Mac. Publishing this repository
does not change the manifest or resources in that project until the installer is
run and the app is rebuilt. Do not claim native-device acceptance before that.

## Confirmed input configuration

User-provided settings on 2026-10-25:

- Capacitor appId and Android applicationId/namespace: io.github.kkchinchilla.huoyitong
- Name: 貨易通; webDir: dist
- Android versionName: 1.0; versionCode: 1
- minSdk: 24; targetSdk and compileSdk: 36
- Main source manifest: allowBackup=true; branded icons; Internet permission;
  non-exported AndroidX FileProvider with temporary URI grants and @xml/file_paths.
- file_paths.xml: external-path '.' and cache-path '.', broader than CSV needs.

## Apply on the Mac

From the repository folder:

```sh
git pull origin main
node scripts/configure-android-privacy.mjs
```

Then build/sync, verify the native source configuration, and Run in Android Studio:

```sh
npm run build && npx cap sync android && node scripts/configure-android-privacy.mjs --check
```

The installer uses Node built-ins only. It accepts an optional Android directory,
backs up changed existing files once under android/.huoyitong-privacy-backup/,
validates the inspected manifest/provider shape before writing, and can be rerun.
Resources are installed before the manifest. --check is read-only and reports any
missing/reverted policy files. Unexpected custom BackupAgent/provider settings
stop installation instead of silently overriding their behavior.

## Resulting policy

- allowBackup=false disables Android cloud backup participation.
- fullBackupContent points to exclusions for Android 11 and older.
- dataExtractionRules points to explicit cloud-backup and device-transfer
  exclusions for Android 12 and newer. All nine supported local storage domains
  are excluded, including WebView storage and device-protected storage. This
  avoids relying solely on allowBackup, whose D2D behavior varies by manufacturer.
- FileProvider exposes only cache/payroll-exports/, matching the existing
  ReportExport.csv helper. External storage and unrelated cache files are removed
  from the provider path configuration. Provider export/URI-grant settings,
  launcher icons, application ID, and activities remain unchanged.

These settings control OS-managed backup/transfer of local app state; they do not
delete the current session, change server records, or remove CSVs users explicitly
saved/shared elsewhere. They do not erase backups previously created by another
app version. Nonstandard OEM migration behavior still requires device validation.

## Verification and limits

Automated: node tests/increment_1449/android-privacy.mjs parses XML, checks all
backup domains and both transfer modes, exercises both actual CSV export types
against the restricted path, verifies manifest preservation, one-time backups,
idempotency, --check and invalid-project/custom-config refusal. Existing native
CSV tests also pass. These checks are not a native Android build or transfer test.

Pending on Mac/device, one step at a time:

1. Apply installer and obtain successful --check after cap sync.
2. Android Studio build/Run succeeds without uninstalling or clearing app data.
3. Existing sign-in still works; payroll and attendance CSV sharing still saves
   valid Chinese CSV files through the receiving app.
4. Inspect the merged release manifest/resources for the expected restrictions
   and any additional dependency permissions before signing/release approval.
5. Validate backup/restore behavior on a suitable test device/build; do not factory
   reset the user's personal phone for this task.

References:
- https://developer.android.com/identity/data/autobackup
- https://developer.android.com/privacy-and-security/risks/file-providers
- https://capacitorjs.com/docs/apis/share

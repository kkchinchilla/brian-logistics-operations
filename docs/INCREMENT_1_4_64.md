# Increment 1.4.64 — 緊湊日期導覽與內建字型

Date: 2026-10-30 (Asia/Taipei).

Resumes the user's accepted compact preview from the interrupted “Review Dashboard
Roadmap” conversation, based on committed 1.4.63. No interrupted completion claim
is treated as release evidence.

## Scope

- Daily attendance: driver, supervisor and owner; monthly navigation: authorized owner.
- White 20px date text, 1.2 line height, 2px numeral/unit gap, 12px context with 4px spacing.
- Native date/month picker, previous/next 44px touch targets, and today/current-month reset.
- Existing input IDs and page handlers stay in place. Display refresh follows both user
  navigation and programmatic date changes after template application. Clearing a picker
  restores the last valid selection before any query runs.
- Inter for Latin/numbers and Noto Sans TC for Chinese, bundled locally in every app page,
  including login, public-information pages, the separate route template and reviewer build.
- Font licenses/checksums included. All source Noto codepoints are retained across subsets.
- Routes, vehicles and accounts receive typography only; no page date navigator is added.

No schema migration, account change, operational-data write or payroll rule change.

## Verification

- Interaction suite covers all three attendance roles; day/month/year transitions, leap
  day, empty selection, reset, programmatic changes and unauthorized monthly access.
- Existing application regression suite remains required.
- Build checks cover font hashes and typography links in both environment packages.
- Chromium CI uses actual packaged app assets with fictional responses. All external
  requests are blocked. It checks all five dashboards for permitted roles in company and
  reviewer packages at 320, 390, 844 and 1366px, plus simulated 200% text enlargement.
- Route template checked independently for typography, wrapping and footer decoration.
- Screenshots are retained as the `compact-date-layout-1.4.64` workflow artifact.
- Local Chromium and the connected browser could not start in the recovery environment;
  the separate CI layout job must pass before deployment, alongside the existing verify job.

Physical Android acceptance of this increment is still pending. Desktop Chromium text
enlargement is an approximation, not evidence of Samsung WebView/system-text behavior.

## Release timeline checkpoint

The project remains in release preparation (Stage 5 in the October 29 timeline).
The recovered release sequence is Console setup → fresh signed AAB/internal testing →
Play-delivered checks and release materials → closed testing → production-access/release.
No launch date was promised. Do not restart already completed work.

The user confirmed Google developer verification on October 29 and reported completing
the app-creation form at approximately 22:15 Taiwan time. Verify the current Console screen
when resuming; do not create another app blindly. No recovered evidence confirms an AAB
upload, testing rollout or production approval.

After this UI increment, the next focused manual checkpoint is the refreshed reviewer entry
and compact dates/fonts on the Galaxy Z Flip 5. Then prepare the fresh signed build on the
user's Mac for internal testing. The private signing key stays on that Mac. Current five-year
retention direction still needs category-specific implementation/disclosure work; existing
Excel-layout export and frozen paid-month monetary history remain future work.

## Rollback

Restore the prior HTML/style/script references and the three optional display-refresh hooks.
No data restoration is required. Android versionCode/versionName remain separate and have
not been advanced by the web package's 1.4.64 version.

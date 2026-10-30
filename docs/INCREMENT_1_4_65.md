# Increment 1.4.65 — 單列數字日期導覽

Date: 2026-10-30 (Asia/Taipei).

The user's supplied screenshot replaces the 1.4.64 compact-date design. The
1.4.64 font/layout visual check passed before this new design was requested.

## Interface

- Previous arrow on the left, centered white numeric date, yellow picker chevron,
  next arrow on the right, and one thin bottom divider.
- Daily attendance uses MM/DD/YYYY for driver, supervisor and owner. Monthly
  reports and the batch-scheduling calendar use MM/YYYY.
- After reviewing the first preview, the user requested a significant size reduction.
  Normal-size control is now 33px tall including its divider (previous preview: 53px),
  with 32px targets and no bottom padding. Inter numerals are 16px (previously 24px),
  weight 500. Side arrows are 16px and the yellow chevron is 12px. Desktop width
  reduces from 22em to 18em; mobile controls retain the available width. Enlarged
  text may wrap before the year to remain readable without overlapping the arrows.
- Remove the second context line and the title-side today/current-month/reset
  controls. Any date, including today, remains selectable in the native picker.
- Keep the original input IDs, native picker, arrow handlers, batch-calendar event
  delegation, server requests and access checks. Empty/out-of-range selections
  restore the previous valid value before reaching the page's change handler.
- Company and isolated reviewer builds share the change. Other dashboards retain
  their existing typography and navigation; no date controls are added to them.

No database, payroll, account or operational-data changes.

## Validation and release checkpoint

Build/asset checks, 44 date-navigation interaction checks and the existing application
regression suite passed locally. Chromium CI checks the actual built company/reviewer
assets with fictional responses, covering all permitted dashboards, four viewport
widths, enlarged text, the batch-calendar navigator and route-specific layout.
Screenshots are retained as `compact-date-layout-1.4.65`.

Stage 5 release preparation continues. Physical-phone acceptance of this replacement
design is pending, followed by the reviewer-entry check and a fresh signed Android
bundle for internal testing. Prior 1.4.64 acceptance is not acceptance of this new
layout. Android versionCode/versionName and Play rollout have not been changed.

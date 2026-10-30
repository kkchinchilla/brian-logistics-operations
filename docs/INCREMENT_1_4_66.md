# Increment 1.4.66 — 桌面日期、姓名與操作按鈕對齊

Date: 2026-10-30 (Asia/Taipei).

The user accepted the 1.4.65 mobile layout and requested a desktop-only header
adjustment. Use the existing 800px mobile breakpoint.

- Above 800px, the date/month control and account name share the first row, with
  the name on the right. Header action buttons form a second row aligned to the
  date control's left edge.
- Applies to driver, supervisor and owner attendance and the owner's monthly
  report. The driver date and refresh button move into the desktop header.
- At 800px and below, restore the original controls to their original positions.
  Keep the accepted 16px dates, 33px control, mobile spacing and navigation.
- Move existing elements without cloning them, retaining IDs, values, event
  handlers and focus. Resizing does not request or write business data.
- Batch-calendar navigation is outside this header change. Routes, fleet and
  account management have no date header and keep their existing layouts.

Company and reviewer builds share the change. No database, payroll, account,
Android versionCode or signing changes.

## Verification

The existing date interaction checks remain required. Chromium CI covers all
permitted roles and five dashboards in both environments at 320, 390, 800, 801,
844, 1024 and 1366px. Header checks verify the date/name row and left-aligned
buttons. Desktop/mobile round trips preserve the date and the driver's refresh
handler. Screenshots include desktop, mobile, enlarged text and route-specific
layout. Compare normal mobile screenshots with the accepted 1.4.65 baseline.

## Release progress

The user confirmed the 1.4.65 mobile layout is perfect. This increment changes
desktop presentation only. The project remains in Stage 5 release preparation;
reviewer-entry acceptance and a fresh signed Android bundle are still pending.

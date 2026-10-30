# Increment 1.4.67 — 路線管理手機整頁捲動

Date: 2026-10-30 (Asia/Taipei).

The route dashboard inherited a fixed-height prototype shell. Its header was
outside the independently scrolling workspace, unlike the other four dashboards.

At the existing mobile breakpoint (800px and below), the route shell now grows
with its content and the document scrolls the header, statistics and workspace
together. Bottom navigation remains fixed, with footer clearance preserved.
Horizontal table scrolling is retained.

Route editors, overlays, nested category dialogs, rate dialogs and toast messages
stay anchored to the viewport after page scrolling. Opening an editing layer locks
background scrolling; closing it restores scrolling at the current page position.
Desktop scroll containers and all business/permission behavior are unchanged.

The user's standing requirement to check 路線管理's separate styling template is
reinforced in AGENTS.md, including page scrolling, editor layers, large text,
breakpoints and cross-dashboard consistency. Conversation language is English;
the product UI remains Traditional Chinese (Taiwan).

## Validation

Build/asset checks and the existing verification suite remain required. Chromium
checks all permitted roles and dashboards in company/reviewer builds, with actual
mobile scrolling across the five dashboards. Route checks additionally cover
320/390/800px widths, fixed navigation, horizontal table movement, editor/overlay
placement after scrolling, background locking, nested-dialog cancellation and the
owner's rate dialog. No business data is saved by these checks.

## Release progress

This is a mobile presentation correction following the accepted 1.4.66 desktop
alignment. Stage 5 release preparation continues. Reviewer-entry acceptance and
a fresh signed Android bundle remain pending; this change does not alter Android
versionCode, signing or Play rollout.

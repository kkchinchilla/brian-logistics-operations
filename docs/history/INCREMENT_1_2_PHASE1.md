# Increment 1.2 — Phase 1: Shared Attendance UI (frontend-only)

UI language: Traditional Chinese. Development notes: English.

## Added

- `attendance-board.html` — shared attendance UI, responsive desktop/mobile, horizontally scrollable grid, sticky driver names, two-level grouped headers and flat charcoal/yellow palette.
- `css/attendance-board.css` — standalone styles, deliberately does **not** change existing `css/style.css`.
- `js/attendance-board.js` — Supabase **read-only** projection of existing `runs`; search, calendar, and mock local-edit interaction.
- Entry links on both `dispatcher.html` and `driver.html` to the new page.

## Start

1. Unzip the patch into your **existing v0.5.5 folder** (preserve other files).
2. Keep the original `js/config.js` unchanged. The patch deliberately excludes it.
3. Open your app through VS Code Live Server; log in as usual, then follow **每日出勤總覽（新版）**.
4. To explore the fully populated design without affecting Supabase, open `attendance-board.html?demo=1`. The demo uses synthetic names and assignments and has a local-only dispatcher close/reopen demonstration.
5. To exit the new view, choose **原有工作看板** (desktop navigation or mobile menu).

## Working now

- **Real connected read view** of available `profiles` and scheduled `runs` for the chosen date using the current authenticated session. Paginated queries avoid the default 1,000-row PostgREST limit.
- Preserves 16 standard route/vehicle paired columns across 日配 / OC / 鮮二 / 冷凍 / 低鮮.
- Strictly maps a run to a named slot only when its route code unambiguously equals a slot code (e.g., `OC1`, `日2`). All other routes appear in *其他路線*, never silently dropped or guessed from temperature zone.
- Exposes cancelled or incomplete run data in a collapsible list rather than treating cancelled runs as active attendance.
- Searches driver, route, vehicle; supports date change and refresh.
- Cell edits are **in-memory visual previews only**; no database update occurs. The page is intentionally labelled as frontend Phase 1.
- In demo mode, switch Driver/Dispatcher, test restricted editing, and simulate day close/reopen. Only the dispatcher can close the demo day.

## NOT delivered until later phases (do not misinterpret this page as production-ready)

1. No persistent `actual` attendance changes, cross-driver replacements, leave editing, special duty or approval writes. Do not use the preview board for real attendance reporting.
2. No all-company RLS migration yet. Existing DB permissions may restrict driver access to only their own runs/profiles. The app surfaces this limitation instead of fabricating coworker data. **Full-company read access** for drivers must be implemented with a carefully scoped Supabase RLS policy or secure RPC, after confirming privacy requirements.
3. No authoritative route → column mapping exists in the uploaded source. A new mapping design is needed. A route's temperature zone alone is **not sufficient** to infer an Excel column, and `runs` must not be rewritten merely to make the UI fit.
4. No daily lock, write concurrency protection, audit trail, or merger with the existing `trip_executions` approval flow yet. Demo closeout does not touch Supabase.
5. Existing dispatcher/driver/special/monthly workflows remain the operational source of truth and must be regression-tested after overlaying.

## Safety / no migration

This is a non-destructive frontend-only overlay. The uploaded ZIP did **not** include SQL migration files. There is therefore no new SQL to execute in Phase 1. Do not run old migrations again.

## Development checks

```
node --check js/attendance-board.js
node tests/check_v03.js
node tests/check_v05.js
node tests/check_v055.js
node tests/check_v05511.js
```

## Next planned work

- Approve deterministic slot mappings for the 16 categories (including overflow handling and route codes such as `UAT-01`).
- Scope secure organization-wide **read-only** roster visibility for drivers, keeping payroll and private HR information hidden.
- Implement planned vs. actual persistence, server-enforced own-record edit rights, audited cross-driver change workflow, optimistic concurrency, realtime updates and day-end closeout.

## UI 原型增補

詳見 `INCREMENT_1_2_DYNAMIC_TRIPS.md`：出勤各類別欄位數已支援按日期動態調整（包含四趟以上），後端仍為唯讀，未新增任何資料庫寫入或 migration。

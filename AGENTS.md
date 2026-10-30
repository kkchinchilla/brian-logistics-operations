# Project UI requirements

Keep the product UI in Traditional Chinese (Taiwan).
Communicate with the user in English unless they explicitly request another language.

## Cross-dashboard styling: always check 路線管理 separately

User requirement, 2026-10-27: 路線管理 originated from a different template
than the other four dashboards. Whenever adding, changing or removing elements,
styles or layouts shared across dashboards, inspect the route dashboard's own
markup, CSS cascade and responsive overrides explicitly. Do not assume a change
verified on attendance also works on routes.

Reconfirmed by the user on 2026-10-30: this is a standing project requirement for
every future visual change. Keep 路線管理 aligned with the other four dashboards,
including scrolling behavior. On mobile, its page header must scroll with the
document; do not retain a fixed-height prototype shell with only the workspace
scrolling underneath it. The bottom navigation remains fixed.

Check shared elements across all five dashboards, permitted account roles and
mobile/desktop widths. Pay particular attention to link decoration, typography,
spacing, container sizing, page/header scrolling, footer alignment and mobile navigation. Define shared
component styles explicitly where the route template lacks the other pages' base
reset. Preserve intended interactions and permissions.
When changing scroll containers, also check route editors, overlays, nested
dialogs, horizontal table scrolling, large text and the desktop/mobile breakpoint.

Privacy and account/data-request links belong below 登出 on dashboards and below
登入 on the login page. Dashboard footer links must have no underline; retain
visible keyboard-focus styling.

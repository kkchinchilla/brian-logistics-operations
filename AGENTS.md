# Project UI requirements

Keep the product UI in Traditional Chinese (Taiwan).

## Cross-dashboard styling: always check 路線管理 separately

User requirement, 2026-10-27: 路線管理 originated from a different template
than the other four dashboards. Whenever adding, changing or removing elements,
styles or layouts shared across dashboards, inspect the route dashboard's own
markup, CSS cascade and responsive overrides explicitly. Do not assume a change
verified on attendance also works on routes.

Check shared elements across all five dashboards, permitted account roles and
mobile/desktop widths. Pay particular attention to link decoration, typography,
spacing, container sizing, footer alignment and mobile navigation. Define shared
component styles explicitly where the route template lacks the other pages' base
reset. Preserve intended interactions and permissions.

Privacy and account/data-request links belong below 登出 on dashboards and below
登入 on the login page. Dashboard footer links must have no underline; retain
visible keyboard-focus styling.

# Increment 1.4.23 — route names and logout styling

Driver delivery cards now use 路線名稱 as their main heading. 路線編號 is neither fetched nor displayed by the driver card view, and the duplicate route-name subtitle is removed. A missing or blank name displays 未設定路線名稱. 值班、跟車、學習 retain their existing duty headings. Temperature values keep the approved #FFC533 yellow.

Logout uses the same gray secondary-button appearance as 結案. The common dashboards inherit their existing button rules; the route dashboard matches those rules despite its separate base stylesheet. Desktop and mobile logout still share the existing sign-out handler.

This release needs no database migration. Existing records, calculations, supervisor tools and driver read-only permissions are unchanged. Google Play packaging remains paused.

## Verification

- The complete regression suite, portable schema restoration and all 26 offline demonstration checks passed, including sign-out concurrency and failure recovery.
- Browser inspection used fictional data with production scripts and styles at 320, 390 and 1280 pixels. Driver pages had no horizontal overflow; card headings showed route names without route codes or duplicate subtitles.
- At phone width, computed logout and 結案 styles matched for background, text color, border, radius, padding, font size/weight, line height and height. The route dashboard's mobile logout matched the same values.
- The GitHub Actions workflow runs build, asset validation, complete regression tests, schema restoration and offline demonstration checks before publishing.

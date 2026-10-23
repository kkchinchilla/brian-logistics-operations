# Increment 1.4.26 — Mobile dashboard logo

All five dashboards show the approved 貨易通 SVG beside the page title at the top left when the viewport is 800px or narrower. The mobile header displays only the logo, with an accessible brand label, and no visible app name. The 32px logo shares the title row to keep the header compact. Desktop continues to use its existing sidebar branding.

The route header can wrap its actions on narrow phones. Driver attendance retains its own title, read-only cards and logout control. The shared brand stylesheet URL is refreshed on each dashboard so returning users load the update.

Validation: build and deployment-asset checks; 66 existing attendance, route and account UI checks; and 26 isolated demonstration checks passed. Browser checks covered all five dashboards, both driver and supervisor attendance, at 320, 800, 801 and 1280px. Logos loaded at mobile widths, title and logout bounds remained inside the viewport without overlap, and the extra logo was hidden at desktop widths. The driver layout was also visually reviewed at 390px; the narrow route header wrapped correctly at 320px. Account browser QA covered the static header; its account actions were exercised by the existing isolated UI checks. All preview data was fictional.

This is a frontend layout release. GitHub Actions runs the complete regression suite and schema checks before publishing to GitHub Pages.

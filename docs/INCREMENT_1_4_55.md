# Increment 1.4.55 — route footer link consistency

Other dashboards load production.css, which resets anchor underlines. Routes uses
its own template and does not inherit that reset. The shared privacy-links style
now explicitly sets text-decoration:none, and all five dashboards use cache version
1455 of the shared stylesheet. Keyboard focus styling is retained.

The user's requirement to check the route template separately for every shared UI
change is recorded in root AGENTS.md. No functional or permission changes.
Validation: build/asset checks and computed footer-link styles across five pages.

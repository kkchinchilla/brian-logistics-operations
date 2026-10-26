# Increment 1.4.52 — approved logo revision

The attached logistics-dispatch-logo(4).svg replaces the shared logo unchanged.
The white arrow and dot are smaller; the yellow remains #ffc533. Login, all five
current dashboards, favicons and privacy/support pages use the same asset with
cache version 1452. Draft Play icon and feature artwork are regenerated from it.

The Android icon installer already derives its paths from this SVG. Its eight
resources, including adaptive and monochrome layers, use the new mark when run
on the Mac. The splash uses the same native launcher reference. The phone must
receive a rebuilt app before its launcher/splash changes.

Validation: exact source comparison, build/asset checks, existing native icon
installer tests and splash tests. Store artwork visually inspected. No business
logic, database settings or operational data changed. The pending public-signup
setting and other pre-Play gates from 1.4.51 remain pending.

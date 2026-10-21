# Increment 1.4.10 verification

Run `npm ci` then `npm test` in this directory (Node 24 used). PGlite 0.5.10 is pinned. It uses an isolated in-memory PostgreSQL fixture with artificial users, never the connected Supabase project.

`database.mjs` applies the pre-146 fixture followed by all migrations through 1410; it checks 52 new cases. The four regression runners apply the same latest schema and check 150 existing cases. `attendance-integration.cjs` executes the production attendance/approval scripts in a minimal Node VM DOM harness (31 checks). It is not a browser/layout test. `demo.cjs` checks the shared fictional fixture and four offline packages (18 checks).

Rebuild the offline pages with `python3 build_demo.py` from any working directory. Demo code is only loaded into separate offline pages, never production HTML. These pages contain a restrictive CSP and no external script/config references. Operational writes are blocked.

`live-verification.json` records the installed migration, six live authorization/input checks using existing profiles, unchanged data hashes for 39 tables / 92 records, and unchanged security advisor findings. It contains no raw company record values or credentials. No operational test rows were added to the connected project.

All 251 local checks passed, plus six live checks and syntax validation of all 35 application JS files. Browser visual QA remains pending because the supported browser capability is unavailable.

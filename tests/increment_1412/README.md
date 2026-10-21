# 1.4.12 verification

From this directory run `npm ci` then `npm test`. PGlite 0.5.10 is pinned. Tests construct isolated databases from the historical fixture and local migrations; they never connect to Supabase or seed the development project. Run `python3 build_demo.py` after changing source/fixtures before running demo.cjs.

72 database/payroll checks (48 inherited + 24 new), 21 monthly VM integration checks and 26 demo checks passed. Browser QA is documented separately. 36 application JS files passed syntax checks. The old UI tests in historical increment directories retain old UI expectations and should not be treated as current acceptance.

`live-readonly-checks.sql` was executed once inside a read-only transaction to verify current permissions and output. It contains no seeds or persistent role changes. Do not rerun the migration in the connected project. `live-verification.json` records before/after table hashes and unchanged security advisors.

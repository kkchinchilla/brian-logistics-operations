# 1.4.14 verification

From this directory run npm ci, then npm test. Node 18+ is required. The suite uses an isolated PGlite database and fictional fixtures. It does not contact the connected Supabase project.

Expected: 41 database assertions, 31 monthly UI integration assertions and 16 vehicle editor assertions (88 total). Historical suites retain earlier assumptions and are not the current payroll acceptance gate.

Build the four network-disabled demos with python3 build_demo.py. Browser inspection was separate from these tests. live-verification.json records the read-only connected-project checks and existing-table preservation comparison; it contains no operational row payloads.

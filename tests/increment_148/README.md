# Isolated verification for Increment 1.4.8

Run `npm ci` in this directory, then `npm test`. The database suite creates an in-memory PostgreSQL fixture and applies migrations 146, 147 and 148 there; it does not connect to Supabase.

For browser tests, install a compatible Chromium (`npx playwright install chromium`) and run `npm run test:browser`, or set CHROMIUM_PATH to your local executable. Responses/data are mocked and explicitly isolated from production. The clock is fixed for repeatability. Screenshots are for local inspection, not included in the deliverable.

For existing regression suites, run `npm ci` separately in `tests/increment_146` and `tests/increment_147`, then their scripts. The 147 database runner applies migrations through 148 and runs prior scenarios; historical direct-add assertions are updated to the current approval requirement.

Recorded results: 30 new + 50 prior database scenarios; 42 new + 70 operational + 43 monthly browser assertions; 10 export checks; 31 application JavaScript syntax checks. No fake Auth identities or demonstration records are created persistently in the live project.

# Isolated verification — Increment 1.4.7

`npm ci` in this directory, then `npm test`. The database suite applies the preserved pre-146 fixture, 146 and 147 in memory; it never connects to Supabase. Synthetic identities/records are confined to this fixture. The live installation is not recreated.

For browser tests, install Chromium with `npx playwright install chromium` and run `npm run test:browser`. Alternatively set `CHROMIUM_PATH` to an existing compatible browser. The supplied @sparticuz/chromium flags are used for the hosted test environment. All Supabase responses are mocked; no real credentials are used.

Run the 146 browser regression from its directory after its own `npm ci`. Its fixture is updated to understand the new finalized-monthly RPC. Do not interpret superseded older tests that require direct driver edits or execution review as the current acceptance specification.

Recorded results: 29 existing + 21 new database scenarios, 43 monthly + 70 existing browser assertions, 10 export/aggregation checks. Screenshots and node_modules are excluded from the deliverable.

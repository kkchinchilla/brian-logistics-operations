# Increment 1.4.6 verification

These tests are local only. **Never execute `baseline_fixture.sql` against Supabase.** It reconstructs the inspected pre-146 schema in a fresh in-memory PGlite database and creates synthetic Auth identities there. It contains schema definitions, not operational data or credentials.

From this directory, with Node.js 20 or later:

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
```

An existing Chromium executable can be selected with `CHROMIUM_PATH=/absolute/path/to/chromium`. The browser suite uses mocked Supabase responses and a local Traditional Chinese font for layout verification. It never loads the environment `js/config.js` or contacts Supabase. Screenshots are internal QA output under `_screenshots/`; do not deploy them.

`database.mjs` applies only the supplied 146 migration to the isolated pre-146 schema and runs 29 integration scenarios, including role-based access, rejection, duplicate actions, stale revisions, completed-execution corrections, conflicts, special-duty protection, extra-trip approval, cumulative closure, historical inserts, reopening and finance access.

`browser.mjs` checks 70 assertions across seven viewport widths, the editor/inbox flow, closing controls, failure behavior, all four dashboards' navigation, and new/legacy monthly access. Database enforcement is tested separately; mocked browser responses alone are not security proof.

`verification_summary.json`, `database-results.txt`, and `browser-results.txt` record this delivery's results. The live Supabase rollback test used real existing profile IDs, left no request/closeout records, and did not create Auth users. It was not a signed-in end-to-end browser UAT.

Historical tests are preserved. Seven applicable static/mock scripts pass. The three old checks referencing missing SQL files and the old manual-rental-selector assertion already failed on the accepted baseline; they are not 146 regressions. Older browser assertions requiring immediate driver edits are explicitly superseded by this suite.

# Increment 1.4.11 verification

Run `npm ci` and then `npm test` from this directory. Dependency: pinned `@electric-sql/pglite` 0.5.10. Tests reconstruct the supplied baseline fixture and apply migration files **only to fresh isolated in-memory databases**. No Supabase credentials or network database access are required. Run database suites sequentially to limit memory use.

The current result set contains 367 checks plus 35 JavaScript syntax checks. `live-verification.json` records the separately completed eight non-mutating live permission checks and the before/after hash comparison of all existing tables.

The UI tests execute actual application scripts in a Node VM with a minimal DOM harness. They verify form state, payloads, validation, rendering, approvals and settings access; they are **not browser or visual/layout tests**. Browser acceptance is still required on the existing host.

Run `python build_demo.py` to rebuild the four self-contained `OFFLINE_DEMO_1_4_11` pages. The fixtures are fictional and network-disabled; operational saving is blocked, with duty settings trialled in page memory. Do not load fixture scripts into production pages.

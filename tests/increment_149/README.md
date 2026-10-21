# Verification for 1.4.9

Install the pinned test dependencies with `npm ci` in this directory; no tests connect to production automatically. The provided `baseline_fixture.sql` used by database tests is **only for isolated PGlite** and contains fake Auth identities. Never execute it in Supabase.

Run:

```sh
node reconciliation.cjs
node monthly-integration.cjs
node database.mjs
node demo.cjs
```

Recorded results: 43 calculation checks, 20 Node VM integration checks, 38 new database checks, 13 isolated demo checks. Existing 147 database tests include 29 prior closing/approval regressions and 21 finalized-report scenarios; existing 148 adds 30 universal-driver-approval scenarios. Existing Excel tests add 10. Total 204 automated checks.

The 146/147/148 database runners in this package apply migration 149 to the isolated baseline before exercising their cases. Earlier browser harnesses remain historical and require the new 149 bundle fixture before rerunning monthly-page cases; their older result files are not new browser verification.

Browser/visual checks were not run this increment because the supported browser capability was unavailable. Node VM tests use lightweight DOM interfaces and do not prove layout, mobile behavior, browser accessibility or actual click flow. Use the real acceptance checklist after deployment.

`live-verification.json` records the separately executed, rolled-back Supabase integration check and the unchanged comparison across all 38 public tables. No credentials or live row contents are included.

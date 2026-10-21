# 1.4.9.1 verification

Use Node with the existing pinned verification dependencies: `@electric-sql/pglite` 0.5.10 and `exceljs` 4.4.0. No test here connects to Supabase. The baseline fixture contains artificial identities for isolated PGlite only; never run that fixture on a connected database.

From the application root:

```sh
node tests/increment_1491/database.mjs
node tests/increment_1491/reconciliation.cjs
node tests/increment_1491/monthly-integration.cjs
node tests/increment_1491/legacy-exports.cjs
node tests/increment_1491/demo.cjs
node tests/increment_147/database.mjs
node tests/increment_148/database.mjs
node tests/increment_149/database.mjs
node tests/increment_147/exports.mjs
```

The older database runners now include the additive 1491 migration. Historical 149 monthly UI integration tests describe the superseded pricing tab; use the 1491 integration tests for the current page. The 147 database runner includes 29 earlier 146 cases plus 21 cases of its own; count those 29 only once.

Recorded total: 236 automated checks, 35 JavaScript syntax checks, and separate rolled-back live verification. See `verification-summary.json`. Tests use PostgreSQL isolation, pure calculations, Node VM interfaces, and actual Excel workbook round-trips. They do not substitute for browser layout/interaction testing, which was unavailable.

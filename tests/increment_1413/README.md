# 1.4.13 verification

Install pinned test dependencies with npm ci, then npm test. This runs PGlite only; it never connects to the hosted database. Historical migrations are applied only inside the isolated in-memory test database. Never run test fixtures against Supabase.

Tests: database.mjs (75), monthly-integration.cjs (27), demo.cjs (26), exports.cjs (8). UI integration uses Node VM, not a browser. Excel tests serialize/reopen the workbook and also exercise actual legacy render/export row expressions. Browser verification is separately documented. The retained 1412 suite is historical: its old salary-null expectations no longer define current behavior.

Rebuild the network-disabled preview with python3 build_demo.py. live-readonly-checks.sql is optional read-only verification, not a migration; it was already run. Do not rerun installed migrations.

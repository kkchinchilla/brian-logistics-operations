# Focused verification

Run npm ci in this directory, then npm test and node demo.cjs. Dependencies are pinned in package-lock.json. The local development node_modules link is not included in the package.

These tests use an isolated PGlite database or Node VM/ExcelJS fixtures. They do not write to Supabase. Historical migration files are applied only inside the isolated fixture. Never rerun them in the connected project.

The current rules are in the root WORK_MODE_HANDOFF_INCREMENT_1_4_15.md. Earlier test suites intentionally represent historical payroll contracts and are not acceptance criteria for this version.

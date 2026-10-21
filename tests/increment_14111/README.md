# Increment 1.4.11.1 verification

Run from this directory: `npm ci`, then `npm test`. Node.js and pinned @electric-sql/pglite 0.5.10 are required. No Supabase secrets or live connection are used. Each database suite builds an isolated PGlite database from the historical fixture and migrations in the package. No historical migration is executed on the connected project.

The eight suites contain 305 checks. `database.mjs` includes old linked/timed entries before applying the correction, then checks preservation and the new behavior. Historical suites are adapted to load the new migration. Old increment UI suites that asserted mandatory time/run selectors are historical, superseded by the current form tests.

Rebuild the offline demo from the application source using `python3 build_demo.py` before running demo.cjs after source edits. Browser QA separately verified desktop forms from that build, not live operational writes or mobile emulation. See browser-verification.md. The root handoff describes remaining hosted acceptance.

The results files are from 2026-10-21. Live verification is read-only except the single authorized schema migration. It confirms identical full-row hashes across 40 tables / 132 rows, unchanged advisors and retained permissions. Synthetic data and pay amounts exist only in isolated tests/demo files.

# Increment 1.4.9 — pricing and reconciliation

Based on the user's accepted 1.4.8. Adds editable existing salary bases, effective-dated fixed/per-route rates, basic-item reconciliation, source/closing/rate traceability and a reconciliation CSV to Brian's monthly dashboard. Full payable salary remains 待設定 until the remaining payroll policies are approved.

Migration `20261020073916_increment_149_payroll_reconciliation` is **already installed** in `dispatch-system-dev`. It adds four protected invoker functions and strengthens the existing overlap guard; it inserts no rates, creates no business tables and does not change saved attendance. Do not rerun migrations.

Deploy this whole application folder using the existing `js/config.js`; do not mix increment patches. No hosted frontend deployment was performed. Start with `ACCEPTANCE_INCREMENT_1_4_9.md` after deployment. For recovery, restore the complete accepted 1.4.8 frontend; the additive database changes are compatible and entered rates should be retained.

Read the package-level `WORK_MODE_HANDOFF_INCREMENT_1_4_9.md` and `PAYROLL_DECISIONS_1_4_9.md` before continuing development. Demo values are isolated, fictional and must not be imported into Supabase.

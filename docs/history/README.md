# Latest: Increment 1.4.12

Read **INCREMENT_1_4_12_README.md** and package-root **WORK_MODE_HANDOFF_INCREMENT_1_4_12.md** first. The database migration is installed; deploy the full frontend while preserving `js/config.js`. Earlier entries below are historical.

# Latest: Increment 1.4.11.1

Read **INCREMENT_1_4_11_1_README.md** and package-root **WORK_MODE_HANDOFF_INCREMENT_1_4_11_1.md** first. The database correction is already installed. Preserve the host's `js/config.js` and do not rerun migrations. Older instructions below are historical and may conflict with the current notes-only duty rules.

# Latest: Increment 1.4.11

Read **INCREMENT_1_4_11_README.md** and the package root **WORK_MODE_HANDOFF_INCREMENT_1_4_11.md** before using older instructions below. The 1.4.11 migration is already installed; preserve your existing `js/config.js`.

> Accepted baseline: Increment 1.4.9.1 (user confirmed 2026-10-20, 16:46 Asia/Taipei). Read `../WORK_MODE_HANDOFF_INCREMENT_1_4_9_1.md` before older material. The new migration is already installed on dispatch-system-dev.

# Logistics Dispatch Management System — Increment 1.4.9

Accepted baseline: **1.4.8**, confirmed by the user on 2026-10-20. Current delivery: **1.4.9 pricing and reconciliation**, pending user acceptance.

Read `INCREMENT_1_4_9_README.md` and the package-level `WORK_MODE_HANDOFF_INCREMENT_1_4_9.md` first. They supersede older handoff/status instructions. Read `ACCEPTANCE_INCREMENT_1_4_9.md` after deploying the complete folder with the existing `js/config.js`.

Supabase project: `dispatch-system-dev`. Migration `20261020073916_increment_149_payroll_reconciliation` is already installed. Do not rerun existing migrations. No hosted frontend deployment was performed here.

The new monthly pricing controls and basic-item reconciliation reuse existing finance tables. Full payable salary remains 待設定 until the policies in `../PAYROLL_DECISIONS_1_4_9.md` are established. All accepted attendance approvals, cumulative closing, reasoned reopening and Brian-only financial access are preserved.

The offline demo is separate from the operational folder and uses fictional data only. Older README/UAT documents remain historical records; a previous test result is not evidence of current frontend acceptance.

# Increment 1.4.7 — 月度報表以結案紀錄為準

Read `../WORK_MODE_HANDOFF_INCREMENT_1_4_7.md` first. It supersedes conflicting older instructions.

- 「結案」是最終確認；不需要「完成配送」或「實際趟次確認」。
- 月報、司機明細、CSV 與舊版 Excel 都使用已結案快照。
- 重新開啟的日期暫不計入月報；重新結案後，以新快照列入，保留舊快照。
- 已結案的有效加趟一併計入；取消／作廢不計入。支援、跟車不重複計成配送趟次。
- 月報僅 Brian 可查看。既有駕駛變更審核與調度員重開原因規則不變。
- 未核准薪資公式仍顯示「待設定」。

## Deploy the supplied frontend

The development database already has `20261020053837_increment_147_finalized_monthly_reporting` installed. **Do not run it or older migrations again.**

1. Retain your existing frontend backup and its `js/config.js`.
2. Deploy the complete contents of this source directory to your existing static host, preserving that config file.
3. Hard-refresh and sign in with existing accounts. Do not create demonstration data or Auth users.
4. Follow `ACCEPTANCE_INCREMENT_1_4_7.md` before accepting this increment.

No hosted frontend deployment was performed as part of this delivery. The package intentionally excludes credentials and config.js. Historical SQL/docs are preserved for reference, not as current deployment instructions.

Source changes: `js/finalized-monthly-147.js`, current/legacy monthly modules and entry pages, shared export/reconciliation modules, and the one 147 migration. Approved dashboard layouts and unrelated operational code are preserved.

# Increment 1.4.15 — frontend acceptance

The database is already updated. Upload the application folder, preserve js/config.js and hard-refresh first.

1. 車輛管理 → 司機名單: no 底薪, salary month, or salary-setting button. The top 編輯司機 still opens name editing; no row 編輯姓名 appears.
2. 月度報表: 值班、跟車、學習 counts remain. No 底薪 column. The settings button says 租車費用設定 and offers only a rental amount, effective date and reason.
3. Open driver details: only 配送計酬、租車費用（扣款）、加給／獎懲 and 應計薪資 amounts appear. Check the total equals delivery minus rental plus signed adjustments.
4. Attendance-only duties do not add pay or require a rate. They do not increase delivery trip counts.
5. Both CSV exports and legacy Excel salary sheets omit 底薪、值班津貼、跟車費用、學習費用. Attendance counts remain in the attendance CSV.
6. Missing delivery/rental rates or genuinely unresolved existing records still show their specific pending reason. Removed pay settings must never cause 待設定.
7. Other dispatchers retain normal attendance/vehicle access and do not gain financial access.

Do not enter real payroll amounts solely to test. The OFFLINE_DEMO_1_4_15 folder contains fictional examples; page-memory changes reset on navigation/reload.

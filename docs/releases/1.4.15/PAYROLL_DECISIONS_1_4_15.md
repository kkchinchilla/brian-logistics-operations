# Current payroll scope — 2026-10-21

The user discussed simplification with Brian and removed the requirement to know or record 底薪. The system also no longer needs to know or show pay for 值班、跟車、學習. Items and rules seen in 台11508.xls that were not already implemented are outside scope.

Current formula: 應計薪資 = 配送計酬 − 租車費用 + 加給／獎懲.

Attendance records and monthly counts for 值班、跟車、學習 remain. They do not create pay lines, require rates, or prevent a salary total. 底薪 settings are removed from the app. The old salary and duty-rate rows are retained as inaccessible historical data; no data deletion was requested for this change.

Delivery rates, per-run rental deductions, signed adjustments, Brian-only finance access, driver approvals, cumulative 結案 and reasoned reopening retain their existing behavior. Temperature data remains internal/export data and does not add dashboard columns. The top 編輯司機 button remains; no row 編輯姓名 is restored.

Do not implement the workbook's fixed-pay packages, workload quotas, fines, taxes, insurance, financing/installment rules or customer billing without a new explicit requirement. The earlier workbook analysis is evidence about the company files, not an implementation mandate.

Existing CSV and generic Excel exports were aligned with the simplified calculation. Exact company-template Excel export is still a separate task.

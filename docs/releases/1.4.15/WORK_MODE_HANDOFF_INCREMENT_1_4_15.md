# Increment 1.4.15 — simplified payroll

Implemented on 2026-10-21. Database installed in dispatch-system-dev (nyizxtaofoynfgazhzsg); frontend package ready for the user's existing host. Frontend deployment and user acceptance have not been claimed.

## Authoritative scope

**應計薪資 = 配送計酬 − 租車費用 + 加給／獎懲**

This explicitly supersedes the base-salary requirement of 1.4.14 and the duty-pay rules of earlier increments. Brian wants a simpler system. No app entry, read, column, amount or calculation dependency remains for 底薪. 值班、跟車、學習 remain attendance categories and counts only. Additional 台11508.xls rules are out of scope.

## Implementation

- Database dashboard_get_calculated_payroll(date) returns calculation version 1415, containing only variable, rentalDeduction and adjustment monetary components. Duty counts are still returned. Removed pay fields and lines are absent, not zero-filled.
- dashboard_get_route_payroll(date) returns rental settings only. The new finance-only invoker dashboard_save_rental_rate(date,numeric,text,bigint) retains effective dates, explicit zero, latest revision checks, audit triggers and the existing transaction lock.
- App access to driver_base_salaries, its sequence and its save RPC is revoked. The prior seven-argument duty-rate save RPC is revoked. Existing supplement RLS permits only rental reads/inserts. Historical rows remain byte-for-byte unchanged.
- The driver roster contains name, bound plates and vehicle count, with the top 編輯司機 control. There is no base-salary input or row name-edit button.
- 月度報表 uses 租車費用設定, three-component details and the existing duty-count columns. Both CSV exports and both legacy Excel paths exclude retired pay columns. Attendance help and the legacy special-work summary no longer claim duty pay requires rates.
- The production client requires database version 1415, validates counts/totals and rejects obsolete pay components. It never falls back to client-computed pay.
- Original attendance workflow, driver approvals, 結案/reopen behavior, route lookup, rental sign, signed adjustments and finance permissions are retained. Reopened days are excluded until closed again.

## Installed migration

`supabase/migrations/20261021130506_increment_1415_simplified_payroll.sql` was created with the existing Supabase CLI and installed using the migration name `increment_1415_simplified_payroll`. Do not rerun it or previous migrations. Use forward migrations for future corrections.

## Verification

- 113 automated assertions passed: 36 isolated database, 33 monthly integration, 10 roster UI, 8 Excel/legacy export, 26 offline-demo checks. 36 application JavaScript files passed syntax checks.
- Database fixtures included existing nonzero base/duty rates, attendance-only duties, rental costs, signed adjustments, zero/missing/future rental rates, stale edits, forbidden retired writes, finance restrictions and reopen/reclose behavior.
- Browser review used fictional, network-disabled data. Monthly report and driver roster had no document overflow at 320, 375, 390, 768, 1024, 1366 and 1920px iframe viewports. Inspected mobile salary detail and rental-only settings. A page-memory rental update changed the fictional driver's total from 1,640 to 1,600. This is not a hosted authenticated test or physical-device test.
- Live finance-context read returned version 1415, passed the actual production decoder, and produced ready totals for all three current drivers. Global unclosed-date notices remain; no removed-pay setting issue remains.
- Read-only hashes of all 41 public tables before and after installation match. No attendance, adjustment, historical salary/rate or other operational row was modified or deleted.
- Security advisor finding identities are unchanged: 4 existing anonymous definer findings, 21 authenticated definer findings and leaked-password protection disabled. No new finding was introduced. Existing remediation references: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable ; https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable ; https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

## Delivery and remaining work

Upload the complete application folder while preserving js/config.js, then hard-refresh. Old frontend code requires version 1414 and will reject the updated response, so replace the frontend files together. Only the frontend upload remains; no SQL is needed.

The new demonstration is OFFLINE_DEMO_1_4_15/index.html. It uses fictional data and blocks external connections. Do not publish demonstrations as the operational application.

Company-layout Excel export remains unfinished and is not implied by these generic export changes. Current route fees can still recalculate earlier trial reports; paid-month monetary freezing is not implemented. Do not describe these figures as paid or frozen. Keep the simplified scope while discussing future CSV/Excel work.

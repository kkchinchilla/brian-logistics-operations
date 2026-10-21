> Historical 1.4.11 record. Read the 1.4.11.1 handoff first: linked follow selection and timed standby requirements below are superseded.

# Increment 1.4.11 — 跟車／學習按筆計酬 — awaiting acceptance

Read this first. This increment continues the delivered 1.4.10 attendance-cell 值班 feature, which the user said looked fine. Increment 1.4.9.1 was explicitly accepted earlier. This handoff and the latest user decisions override older specifications and historical handoffs. Do not claim 1.4.11 acceptance until the user confirms it.

## Latest approved rules

- Add **跟車** and **學習** to the existing attendance cell's **路線** dropdown, alongside 值班 and the actual routes. All five display groups support these duties; the groups do not define a duty's temperature.
- **Both 跟車 and 學習 are paid per recorded entry.** Multiple entries for one driver on the same date are each payable. This explicitly supersedes older daily training-pay aggregation and the older trainee/employed rate distinction for these monthly duty calculations.
- Rename the monthly settings button/dialog **勤務／租車設定**. Brian maintains separate dated rates for 值班、跟車、學習 and 租車. Existing 值班 remains per period; 租車 remains a deduction per rental delivery. Route pay remains on 路線管理.
- Every driver addition, edit, removal or duty conversion remains a request until dispatcher approval. Dispatchers may directly correct open attendance dates across multiple days.
- **結案 is the sole final attendance confirmation.** It closes all unclosed attendance dates through the selected date, inclusive. No 完成配送 or 實際趟次確認 step. Reopening requires a dispatcher reason; reopened dates are excluded from monthly calculations until reclosed. Original closing events remain unchanged.
- Only Brian accesses 月度報表 and 勤務／租車設定. Other dispatchers retain the three operational dashboards.

## Resulting behavior

跟車 preserves the existing association with an existing main `runs` delivery and its shared vehicle. Selecting 跟車 reveals a 同車配送趟次 selector showing the main driver, route, plate and run ID. Own runs and cancelled runs are not selectable. One driver cannot duplicate the same main run in another follow entry; different main runs on the same day can each have one entry. Scheduling checks preserve the prohibition on following while independently driving or performing another overlapping follow/replacement duty. Resolve active follow entries before cancelling or reassigning their main run. Pending follow requests become stale when the referenced run changes. The historical main-run association is retained; this increment does not add follow linkage to the separate unplanned-extra-trip table.

學習 is a standalone attendance entry with 不指定 vehicle. Neither new duty requires invented start/end hours, creates a delivery run, contributes to temperature trip totals, or adds a rental deduction. The board shows each duty in its chosen cell and lists separate follow/learning counts. Open entries can be edited or removed with an audit trail; removing an entry requires a reason and retires it rather than deleting history.

The unified cell editor supports corrections between these duties, 值班 and eligible delivery records atomically. A started/executed planned run cannot silently become a duty. Linked standby restrictions remain intact. Leave, slot reduction, other writers and template overwrite cannot hide or replace active duties. Existing ordinary route and standby-only operations keep their accepted RPC paths.

Each finalized duty contributes exactly one fee selected by its attendance date. Missing rates stay 待設定; explicit zero is valid; blank inputs leave an existing component unchanged. Dated changes retain all earlier rate versions and require a reason. Backdated settings can change the monthly trial calculation, as in 1.4.9.1; they do not rewrite attendance snapshots. Existing finalized legacy follow records also use the confirmed per-entry follow rate rather than the obsolete daily/stage rule. New canonical duties do not require a separate employment-stage setup.

The monthly salary drawer shows follow and learning amounts separately in 基本項目對帳, their source and closing/rate versions, and their records under 每日出勤. Both CSV exports include the new duties: attendance CSV has counts, reconciliation CSV has one amount line per entry. The approved main dashboard table and CSS are preserved.

**This is not the completion of full payroll.** The basic subtotal now includes route pay + standby + follow + learning − rental + manual adjustments. Full 應計薪資 remains 待設定 pending the previously unresolved region/job/special-duty/other payroll and final Excel-template rules. No real pay amounts or operational example records were seeded.

## Database — already installed; do not rerun

Project `dispatch-system-dev` (`nyizxtaofoynfgazhzsg`). Installed migration:

`20261021050817_increment_1411_follow_learning_duties.sql`

Only this new migration was applied once. All 39 existing tables and their 132 records retained identical full-row hashes. No prior migration was rerun and no closing snapshot, existing rate, attendance record or audit entry was rewritten.

- Adds `attendance_duty_entries` with RLS, immutable identity, revisions, retained void records, audit triggers, scheduling locks, active cell uniqueness and shared-run follow uniqueness. Raw authenticated access is read-only; writes use the approval-aware API.
- Adds `request_kind='duty'` to existing attendance requests without changing their old forms. Before/after cell snapshots include duty history and linked-run state. Approval rechecks canonical and linked state; failures roll back the conversion and mark stale requests. Duplicate identical pending retries return the same request.
- New public SECURITY INVOKER endpoints: `dashboard_get_attendance_duties(date)`, `dashboard_save_attendance_duty(date,uuid,text,integer,jsonb,jsonb)`, and `dashboard_save_duty_supplements(date,numeric,numeric,numeric,numeric,text,bigint)`.
- Privileged helpers live in `private` with fixed empty search paths. PUBLIC/anon execution is revoked. Authenticated access is limited to the actor-checked read/submit helpers and invoker endpoints.
- Extends the shared cell/guard/review/template checks. Closing freezes whole duty rows in `snapshot.duty_entries`; normalization adds prefixed duty IDs to `monthly_report.special_work`, including linked route/vehicle metadata, per-entry basis and finalization. Existing snapshot version 147 and monthly bundle 1491 remain compatible. Old snapshots are not backfilled.
- Extends append-only `payroll_supplement_rates` with `follow_along` and `learning`. The old save endpoint remains compatible; the new four-component endpoint validates and saves atomically under the existing revision lock.

Security advisors remain unchanged: 4 preexisting anonymous SECURITY DEFINER warnings, 21 preexisting authenticated SECURITY DEFINER warnings, and disabled leaked-password protection. No new findings. References are retained in `tests/increment_1411/live-verification.json`; do not broaden this increment into unrelated security changes.

## Verification and deployment

367 local checks passed: 81 database/payroll, 30 new UI VM, 52 standby database regressions, 31 standby UI regressions, 150 earlier database regressions, and 23 demo checks. All 35 application JavaScript files passed syntax checks. Eight live role/permission checks passed without canonical writes. Tests run against isolated PGlite databases, never by seeding the connected project. Results and a portable pinned test package are in `tests/increment_1411/`.

Browser/visual QA was not run: the Sites skill requires the supported browser capability, which is unavailable in this managed environment. VM checks do not replace browser acceptance. Confirm desktop/mobile forms and the preserved dashboards on the existing host.

Deploy the complete `dispatch-system-v0.5.5/` folder to the existing host while preserving the host's **js/config.js**. Configuration and credentials are intentionally absent from this package. Updated scripts have `v=1411` cache keys. Hard-refresh after deployment. **The hosted frontend has not been deployed by the assistant.** Do not deploy offline demo files as the real application.

Use `ACCEPTANCE_CHECKLIST_1_4_11.md`. The current `OFFLINE_DEMO_1_4_11/index.html` provides four network-disabled fictional previews, including multiple same-day learning entries and a follow entry. Duty forms may be tried but operational saving is blocked; settings can be tried in page memory. Refresh resets those fictional changes.

Do not roll back only frontend files after new duties have been recorded: the older attendance UI will hide them and the older monthly engine will not calculate them correctly. Preserve duty, approval, audit and closing history and use a reviewed forward fix if needed.

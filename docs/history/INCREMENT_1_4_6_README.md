# Increment 1.4.6 — approval, cumulative closing and Brian-only reports

Current handoff: `../WORK_MODE_HANDOFF_INCREMENT_1_4_6.md`. It and the user's latest decisions supersede conflicting older README rules.

Implemented changes:

- Driver route/vehicle/note edits and existing extra-trip edits/voids require dispatcher approval before changing saved records.
- Open dates remain editable across days, including ordinary completed/confirmed run corrections. Existing execution identity/review status and special-duty safeguards are preserved.
- 結案 records and locks all unclosed dates through the selected date, inclusive. Reasoned dispatcher reopening affects one date and preserves the earlier closing snapshot.
- Monthly reports are Brian-only, including legacy URLs and finance-table access. Other dispatchers retain the three operational boards.

The accepted unified editor and dashboard layouts remain. New request details use the existing modal pattern. No payroll rules were added.

## Deployment

The single 146 migration is **already installed** on `dispatch-system-dev` as version `20261020044533`. Do not rerun it or earlier migrations.

Deploy this complete source directory to the existing frontend, keeping that environment's `js/config.js`. Only public/publishable browser credentials belong there. No environment configuration is included in this package. Reload clients after replacing files; the server now rejects direct driver edits from cached 145 code.

No hosted frontend was deployed during this delivery. The user acceptance checklist is `ACCEPTANCE_INCREMENT_1_4_6.md`. Implementation is not user-accepted until that checklist is confirmed.

## Change log

| Area | Change |
|---|---|
| Attendance UI | Submission and review inbox; old/new comparison; reasoned rejection; completed-run edit eligibility; cumulative close/reopen dialog. |
| Access UI | Server capability query, hidden finance navigation until authorized, and current/legacy monthly gates. |
| Database | Request and closing-event history tables with RLS, guarded atomic RPCs, cumulative date locks on ten attendance-related tables, execution correction compatibility, pinned Brian finance identity. |
| Verification | 29 PostgreSQL integration scenarios, 70 responsive browser assertions, live rollback checks, operational-table checksum comparison. |

Read-only database inspection: `sql/146_02_verify_readonly.sql`. Reproducible local suites and results: `tests/increment_146/`. Roadmap: `../REVIEW_AND_ROADMAP_1_4_6.md`.

Existing legacy operational pages remain because some delivery-completion, review and special-duty workflows still depend on them. The recommended 1.4.7 scope is integration of those delivery lifecycle operations into the current attendance board, subject to agreement.

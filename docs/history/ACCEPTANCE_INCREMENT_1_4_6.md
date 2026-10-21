# Increment 1.4.6 acceptance checklist

Status: implementation and automated checks complete; user acceptance pending.

The development database migration is already installed. Deploy the complete frontend from this package with your existing `js/config.js`, then refresh the browser so the 146 scripts load. Do not rerun migration files. Keep the accepted 145 package as the historical baseline; its direct-driver editor is no longer compatible with the new approval rule.

Use the existing Brian, other dispatcher (Karen), and driver accounts. No new Auth users or operational demo data were created. Choose attendance records suitable for acceptance testing. The closing confirmation explicitly covers every unclosed date through the selected date.

| Test | Expected result |
|---|---|
| Driver edits their own route, vehicle or note | The same single editor appears. `送出審核` creates a pending request. The saved board values remain unchanged. Other drivers' rows remain read-only. |
| Driver opens that run again before review | The submitted comparison and waiting status appear; no duplicate pending edit is made. |
| Dispatcher opens `變更審核` | Pending requests from all dates are listed. The selected request shows its date, driver, old values and proposal. |
| Dispatcher approves | The saved run and board update once. Existing conflict, vehicle-binding, leave and special-duty safeguards still apply. |
| Dispatcher rejects | A reason is required. The original run remains unchanged, and the driver can read the reason. |
| Another dispatcher edits the source before approval | The older request cannot overwrite the newer record. It becomes `需重新送審` when reviewed. |
| Edit an older, still-open date | The date remains editable even several days later. A driver still needs approval. |
| Correct an ordinary completed/confirmed run on an open date | The correction succeeds through dispatcher approval/direct correction, updating the same execution consistently. Its completion/review state is retained; no extra trip is counted. Linked special-duty assignment changes remain protected. |
| Edit or void an existing driver-created extra trip | The driver submits for approval. Creation of a new extra trip keeps its existing separate, unconfirmed behavior. |
| Select date D and press 結案 | The dialog explicitly includes D and all earlier unclosed dates. After confirmation, those records are locked and closing snapshots are saved. Later dates remain open. |
| Close while proposals are pending | The dialog explains that current saved records are retained. Unapproved proposals are not applied; they become stale. |
| Try a late/backdated insert into an earlier empty date | The database rejects it until that date is explicitly reopened. |
| Dispatcher reopens D | A nonblank reason is required. Only D opens; adjacent closed dates stay locked. Previous closing records remain saved. |
| Close through D again | Any reopened dates at or before D are included in the new closing event. |
| Brian logs in | All four boards remain accessible; monthly data and export controls are available. |
| Karen logs in | Only the other three boards are shown. Direct URLs to `ui-monthly.html` and `monthly.html` are blocked. Operational editing and approval remain available. |
| Driver logs in | Company attendance remains readable; only their own editable records can be submitted. Monthly reports remain unavailable. |
| Phone and desktop review | Tables scroll inside their panel, the driver column stays fixed, modal actions remain usable, and the charcoal/yellow design remains consistent. |

Acceptance does not certify payroll formulas or final company Excel parity; those remain deferred. Report any failing step with the account role, attendance date, run/request ID, browser width and displayed error. Confirm acceptance explicitly before replacing the accepted baseline with 1.4.6.

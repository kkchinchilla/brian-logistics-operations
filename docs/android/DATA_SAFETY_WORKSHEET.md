# Data Safety worksheet — NOT final Console answers

Reviewed against current source and live settings on 2026-10-26. Complete the form
only after the operator confirms actual retention, recipients and service settings.
The app is a WebView app; web traffic and backend collection still count.

| Data | Evidence / purpose | Proposed category; items to confirm |
| --- | --- | --- |
| Name, phone, Auth UUID, role | Profiles/Auth; login and access control | Personal info: name, phone number, user IDs; required for a working account |
| Legacy email identifiers | Auth can retain older email accounts; current UI uses phone | Email address: inspect actual supported accounts/provider behavior before answering |
| Attendance, assignments, duty/leave, edits, notes | Runs/duties/closeouts/audit; scheduling and audit | App activity/other actions, and other user content for free text; map to Console definitions |
| Rates, rental costs, payroll adjustments, calculated pay | Finance-owner tables/RPCs | Financial info: other financial info; no card/bank-payment feature |
| Vehicle plates and binding to drivers | Fleet management | Personal info/other info where attributable; confirm exact Console category |
| IP/request/security logs | Supabase Auth/API/Edge and GitHub hosting | Confirm provider logs, retention and derived data; do not assert no device/network data |
| Support emails and request attachments supplied voluntarily | Gmail support contact | Email and user-provided message content; optional support flow |
| Exported CSV | Generated in local app cache, then user-selected Share destination | User-initiated transfer; review sharing exception criteria rather than assuming all exports count or none count |

App function and account management are evidenced purposes. No ads/marketing or
analytics SDK is present in inspected app code. Do not claim a security certification,
independent security review, end-to-end encryption, or zero collection.

## Recipients and security

- Supabase: Auth, PostgreSQL and account-admin Edge Function; database region Singapore.
- GitHub Pages: website/static hosting and associated technical request handling.
- Gmail: support correspondence, Brian handles requests.
- Authorized company personnel: role-based work and payroll information.
- User-selected apps/services: CSV exports. No automated social/media sharing.
- HTTPS in transit; local session persists. Android backup exclusions configured;
  actual OEM transfer behavior has not been tested. Android may reclaim CSV cache.

Google's service-provider and user-initiated-transfer exceptions may affect the
form's "shared" answer. Confirm that contracts and actual use meet those exceptions;
use of a provider does not mean data was not collected. Do not automatically select
"no sharing" from this table.

## Open blockers before final disclosure

- Public signup currently enabled at audit; disable while retaining phone sign-in
  and administrator account creation. Recheck after the user changes settings.
- Existing Delete user retains personal work/payroll history and Auth soft-delete
  metadata. Define retention periods, exceptions, backup/log handling and a verified
  deletion/anonymization procedure before claiming compliant full deletion.
- Admin-created accounts and in-app account creation must be explained accurately
  in Console. Do not assume exemption solely because a driver cannot self-register.
- Confirm Brian's support mailbox access and operational handling of requests.
- Confirm optional note practices, provider logs/retention, and any processing outside
  this codebase. Do not place operational personal data in screenshots/reviewer seed.
- Verify the final native dependencies and build do not introduce new data flows.

Public privacy pages currently disclose what the system does. Publishing them alone
is not proof that every Google User Data requirement is satisfied.

Sources:
https://support.google.com/googleplay/android-developer/answer/10787469
https://support.google.com/googleplay/android-developer/answer/10144311
https://support.google.com/googleplay/android-developer/answer/13327111

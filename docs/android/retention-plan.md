# Retention decision and implementation boundary

Updated 2026-10-28 (Asia/Taipei). Planning only; no purge enabled or records deleted.

## Confirmed user decisions

- Brian keeps a separate archive of attendance and payroll records. This is a
  user confirmation, not verification of its contents or statutory sufficiency.
- The initial preference was two months after account deletion. The user then
  replaced that with five years after learning of Taiwan's recordkeeping rules.
- The user suggested two years if storage becomes a concern. Do not implement
  that fallback for records that legally require a longer period. Measure actual
  storage and growth before proposing storage changes; no cost estimate was made.

## Legal distinction to preserve

For workers covered by Taiwan's Labor Standards Act, Article 23 requires five-year
payroll-register retention and Article 30 requires five-year attendance-record
retention. These are recordkeeping duties, not a rule that every personal field
must be retained for five years after login deletion. Account deletion and
employment termination must not be assumed to be the same event.

The discussion began with retention after account deletion. Before implementing
expiry, explicitly establish the clock for each record category with the operator
and their accountant/legal adviser. Do not silently interpret five years as either
five years after deletion or five years from record creation for all categories.

Official sources checked 2026-10-28:
- https://laws.mol.gov.tw/flaw/FLAWDOC01.aspx?flno=23&id=FL014930
- https://laws.gov.taipei/Law/LawSearch/LawChapterArticle/FL014930?chapterno=4

## Current behavior and remaining implementation

The current account deletion action ends access and preserves historical names,
attendance, payroll and change records. No automatic expiry is implemented.
privacy.html and account-data.html describe that current behavior; do not promise
a five-year automatic purge before the mechanism exists and is tested.

Before changing public disclosures or enabling deletion:

1. Map data categories and dependencies: profile/contact data, assignments, duties,
   closeout snapshots, financial adjustments, audit records, authentication metadata,
   provider logs/backups and independently exported archives. Record-specific legal
   retention and handling of disputes may differ; a blanket cascade is unsuitable.
2. Measure current data/index storage and expected growth. Identify the protected
   records and exact retention clock; preserve applicable obligations even if
   archive/storage arrangements change.
3. Implement a reviewable deletion/anonymization procedure with explicit scope,
   protections for other drivers and shared reporting, and documented handling of
   retained archives, backups and any exceptions. Do not assume removing a name
   alone makes linked data anonymous.
4. Test expiry boundaries and historical-report consistency using synthetic data,
   then update public pages and Console disclosures to match actual behavior.

No deletion job, reminder/automation, live database change or archive transfer was
authorized or performed as part of recording this decision.

# Fictional reviewer sample

Prepared 2026-10-29 (Asia/Taipei). This fixture is installed only in the isolated
reviewer environment. All route names, vehicles, assignments and amounts are
fictional. It contains no company records or copied operational credentials.

## Scenarios

| Date | Attendance state | Example |
| --- | --- | --- |
| 2026-10-27 | Closed | Two deliveries, one owned vehicle and one rental; one standby and one follow-along assignment; allowance |
| 2026-10-28 | Reopened | One rental delivery and one learning assignment; deduction; last confirmed snapshot remains in payroll |
| 2026-10-29 | Open | One owned-vehicle delivery, visible in attendance but excluded from confirmed payroll |

There are three routes (ambient, chilled, frozen), two vehicles, four runs, and
one assignment of each duty type. Route names and vehicle labels include 示範.
The sample month is October 2026. Future review instructions must specify these
dates rather than imply that the fixture automatically follows the current day.

## Expected payroll for the sample driver

| Component | Amount |
| --- | ---: |
| Delivery pay: 600 + 800 + 1,000 | 2,400 |
| Standby: one assignment | 200 |
| Follow-along: one assignment | 150 |
| Learning: one assignment | 100 |
| Rental deduction: two × 100 | −200 |
| Allowance / deduction: +300 −50 | 250 |
| Total | **2,900** |

Three confirmed deliveries enter payroll. Reopening October 28 retains its
confirmed snapshot. The October 29 open delivery does not enter this total.
Required rates are set; the sample driver's calculated summary has no issues.

## Evidence and next check

- The full-schema local test passed the expected salary, rental counts,
  reopened snapshot preservation, open-day exclusion, role denials and replay guard.
- An independent database read after installation returned the same 2,900 total,
  three counted deliveries, two rentals, and the expected date states.
- Live user-session sample-data verification is still pending. On the Mac run
  `node scripts/check-review-sample.mjs`. It uses the private reviewer credential
  file, checks the owner's payroll and driver's assignments, and signs out its
  temporary sessions. It does not change business data or print credentials.

The seed SQL in `supabase/reviewer/seed-demo.sql` refuses to run over existing
business data. Do not replay it or use it against an operational database.
The web/Android app still needs a stable, clearly labelled demonstration entry;
the backend sample alone does not complete reviewer UI or release readiness.

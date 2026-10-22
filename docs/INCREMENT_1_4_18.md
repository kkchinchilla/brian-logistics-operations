# Increment 1.4.18 — route form and rate access

Requested on 2026-10-22, extending the deployed 1.4.17 phone-login release.

## Behavior

- The route creation/edit drawer collects route code, name, delivery region and temperature zone. It has no delivery-cost preview or start/end-time inputs. The fixed-time column and schedule-template time caption are removed.
- New routes can have no times. They can be dispatched directly, saved in templates, applied to dates, confirmed and included in monthly payroll without placeholder hours.
- Existing route time values and dispatch/report snapshots are preserved. Editing a route's ordinary fields does not rewrite its historical time values. Overlap checks evaluate known periods only: without route times, the system cannot infer time overlaps. Driver, vehicle, slot, leave, approval and closeout protections otherwise remain in effect.
- Only the existing finance owner can open 費率表. Permission comes from the same server capability used for monthly reporting, not a display name or client-supplied role.
- Other dispatchers retain route/category management. They do not fetch or display rate amounts, including route-list prices and the average-rate card. Rate data and rate audit are protected by database policies. Category deletion cannot indirectly delete a rate through a foreign-key cascade; Brian can remove an unused priced category. Category renaming preserves the existing rate amount.
- The existing payroll formula and phone-login behavior are unchanged.

## Database rollout

Apply only `20261022110304_increment_1418_optional_route_times_finance_rates.sql` to the existing project. Do not replay older migrations. This migration changes validation, nullable-period handling and access policies; it does not delete or update existing operational records, rates or Auth accounts.

For a new empty project, restore the 1.4.15 schema snapshot and apply the 1.4.16 and 1.4.18 migrations once, in order. Finance binding still defaults closed in the portable schema.

## Verification

- 25 isolated database checks cover untimed routes, direct dispatch, template application, known historical overlaps, finalized monthly inclusion and payroll, preserved snapshots, and rate permissions for the owner, another dispatcher, a driver, an inactive owner and anonymous access.
- 19 route UI checks cover the simplified form, operational-only write payloads, capability-based fetching/rendering, guarded rate events, and fail-closed capability errors.
- The existing regression suite, build, asset/syntax checks, portable-schema restore and isolated demonstrations remain release gates.
- Live verification after migration confirmed six rate rows visible to the finance owner and zero rate/audit rows visible to the other dispatcher, while all six routes remain visible. Route, run and rate row counts and content fingerprints were unchanged by the migration.
- The security advisor reported no new findings for this release's functions. Existing findings on other privileged RPCs and password protection remain outside this change.
- Browser visual verification was unavailable: no local browser binary was installed, and the browser download failed. UI behavior was tested with synthetic DOM/Auth fixtures; this is not a signed-in live user acceptance test.

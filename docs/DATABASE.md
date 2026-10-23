# Database structure and setup

## Existing project

The connected Supabase project already has the 1.4.16 migration that retains confirmed monthly snapshots during reopening. Increment 1.4.18 adds `20261022110304_increment_1418_optional_route_times_finance_rates.sql` for routes without times and finance-owner rate access. Apply only this new migration to the existing project; do not replay old migrations. Operational rows and Auth accounts are not included in this repository.

`supabase/migrations/` preserves the delivered migration source. Earlier SQL is in `sql/`. Some source timestamps differ from installation timestamps: 1.4.14 was installed as `20261021095329`, 1.4.15 as `20261021131300`, 1.4.16 as `20261022034735`, and 1.4.18 as `20261022111521`. Do not run an indiscriminate `supabase db push` against the existing project; reconcile its installed migration history before introducing future migrations.

## Phone login rollout (1.4.17)

No SQL migration is required for phone login. Supabase Auth provider configuration and phone identifiers must be prepared before the phone-only frontend is deployed; see [PHONE_LOGIN.md](PHONE_LOGIN.md). Existing Auth UUIDs and profile associations must be preserved.

## Complete schema snapshot

`supabase/schema/catalog-1.4.15.json` was read from the existing PostgreSQL catalogs on 2026-10-21. It contains 41 tables, 127 functions, 234 constraints, 38 additional indexes, 81 RLS policies, 100 triggers and explicit object grants. It contains no operational table rows, Auth identities, passwords or secret API keys.

The only deliberate portability change is `private.dashboard146_finance_owner()`: its return value is NULL in the snapshot, so a fresh project grants nobody finance access by default. The connected project retains its existing binding and was not modified.

`npm run schema:generate` builds `supabase/schema/1.4.15.sql` from the catalog. `npm run test:schema` restores it into an isolated PGlite database using a minimal test-only Auth shim, applies the 1.4.16 and 1.4.18 migrations, and verifies the current functions and basic access boundaries. The snapshot expects a real Supabase project to supply its managed Auth schema and platform roles. It is not a Supabase platform or data backup.

## A new empty Supabase project

1. Create the project and configure phone/password authentication through Supabase, following `PHONE_LOGIN.md`. Do not apply this snapshot over existing application tables.
2. Review and apply `supabase/schema/1.4.15.sql` once as the database administrator. Then apply the 1.4.16 and 1.4.18 migration files in order. Do not replay the 1.4.15 or earlier migrations on top of the baseline snapshot.
3. Create real accounts using Supabase Auth. Add their matching `profiles` rows with accurate roles and `can_manage_finance=false` initially.
4. Confirm Brian's actual Auth UUID with the owner. An administrator must bind `private.dashboard146_finance_owner()` to that UUID and grant finance on his active dispatcher profile. This is a privileged setup step; never infer identity from a display name or embed an arbitrary UUID.
5. Enter approved route/rate/vehicle settings through the application and update browser configuration for the new project. Never import the synthetic test fixture into Supabase.

The standalone test fixture `tests/increment_146/baseline_fixture.sql` creates fake users and mock Auth functions. It exists only for isolated tests and must never be used as the production bootstrap.

## Increment 1.4.19

After 1.4.16 and 1.4.18, apply `20261023011345_increment_1419_account_management.sql` once. It adds a private action-only account audit, a Brian/live-session permission RPC, service-only directory/profile RPCs, and restrictive active-account policies on existing public RLS tables. It makes no changes to existing users or operational records. Supabase Auth schema and session tables are read only; credentials are mutated only through the Admin API in `account-admin`.

Portable restoration requires the normal Supabase Auth schema (including users and sessions). The baseline remains immutable; `test:schema` restores the baseline and then all three later migrations.

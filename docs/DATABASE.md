# Database structure and setup

## Existing project

The connected Supabase project already contains accepted 1.4.15. **No database migration is needed for this frontend deployment.** Operational rows and Auth accounts are not included in this repository.

`supabase/migrations/` preserves the delivered migration source. Earlier SQL is in `sql/`. Some source timestamps differ from installation timestamps: the 1.4.14 source was installed as `20261021095329`, and 1.4.15 as `20261021131300`. Do not run an indiscriminate `supabase db push` against the existing project; reconcile its installed migration history before introducing future migrations.

## Complete schema snapshot

`supabase/schema/catalog-1.4.15.json` was read from the existing PostgreSQL catalogs on 2026-10-21. It contains 41 tables, 127 functions, 234 constraints, 38 additional indexes, 81 RLS policies, 100 triggers and explicit object grants. It contains no operational table rows, Auth identities, passwords or secret API keys.

The only deliberate portability change is `private.dashboard146_finance_owner()`: its return value is NULL in the snapshot, so a fresh project grants nobody finance access by default. The connected project retains its existing binding and was not modified.

`npm run schema:generate` builds `supabase/schema/1.4.15.sql` from the catalog. `npm run test:schema` restores it into an isolated PGlite database using a minimal test-only Auth shim and verifies basic access boundaries. The snapshot expects a real Supabase project to supply its managed Auth schema and platform roles. It is not a Supabase platform or data backup.

## A new empty Supabase project

1. Create the project and configure email/password authentication through Supabase. Do not apply this snapshot over existing application tables.
2. Review and apply `supabase/schema/1.4.15.sql` once as the database administrator. Do not also replay old migrations on top of this current snapshot.
3. Create real accounts using Supabase Auth. Add their matching `profiles` rows with accurate roles and `can_manage_finance=false` initially.
4. Confirm Brian's actual Auth UUID with the owner. An administrator must bind `private.dashboard146_finance_owner()` to that UUID and grant finance on his active dispatcher profile. This is a privileged setup step; never infer identity from a display name or embed an arbitrary UUID.
5. Enter approved route/rate/vehicle settings through the application and update browser configuration for the new project. Never import the synthetic test fixture into Supabase.

The standalone test fixture `tests/increment_146/baseline_fixture.sql` creates fake users and mock Auth functions. It exists only for isolated tests and must never be used as the production bootstrap.

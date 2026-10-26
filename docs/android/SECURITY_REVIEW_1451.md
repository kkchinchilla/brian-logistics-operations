# Release security review evidence — 2026-10-26

Scoped engineering review, not a certification or proof of absence of vulnerabilities.

## Live checks

42 public tables have RLS enabled; no public views/materialized views. Privileged
public functions have a fixed search_path. Relevant policies combine permissive and
restrictive rules; grants alone were not treated as evidence of row exposure.

Transaction-local driver impersonation with real DB policy evaluation returned zero
other-driver runs/duties, company closeouts, finance rates, duty rates and adjustments;
finance capability false. Ordinary supervisor finance reads/capability were also
restricted. Transactions were rolled back, with no business-row edits.

Account-admin validates the JWT and a live owner session before constructing the
privileged admin client. Roles/owner identity are verified from server data rather
than user-editable metadata. CORS lists the website and Capacitor localhost origins.
No request bodies, phone numbers or credentials are logged by the handler.

## Fixed

Six public tables retained authenticated TRUNCATE grants (one also anonymous).
TRUNCATE bypasses row policies, so browser roles now lack TRUNCATE/TRIGGER on all
public tables. Removed direct browser EXECUTE on two trigger-only functions and
anonymous EXECUTE on the guarded driver-rename RPC. Supervisor rename is preserved.
Migration 20261026052350_increment_1451_release_access_hardening is already applied
and recorded. No operational records were changed. Post-checks found zero unsafe
table grants and zero anonymous executable public SECURITY DEFINER functions.
Synthetic role tests exercise normal supervisor mutation and trigger behavior.

Bundled Supabase JS 2.118.0 with checksum/license to avoid unpinned CDN runtime changes.
The legacy monthly tool still uses pinned ExcelJS 4.4.0 from a CDN; current dashboard
CSV export does not use it. This review does not claim all legacy assets are offline.

## Outstanding observations

- Public signup enabled at audit; manual Auth setting change pending.
- Leaked-password protection disabled; Supabase documents it as a Pro-plan feature.
  No plan upgrade or paid service has been enabled. Review the plan/security choice.
- Advisor still reports authenticated-executable SECURITY DEFINER functions. These
  are intentionally callable, guarded RPCs, not automatically vulnerabilities; 16
  remain after this change. Keep reviewing guards when new endpoints are added.
- Private account audit has no RLS policy (service-only access); informational finding.
- No Storage buckets. Region Singapore, PostgreSQL 17.11.0.002. No ltree/btree_gist.
- Supabase announced removal of CBC TLS1.2 ciphers from 2026-11-10. Test the actual
  supported Android/WebView range; do not infer old-device success from one phone.
- Mac native dependency audit has four moderate findings in user output. Exact
  Mac lockfile/path analysis remains pending; do not use forced breaking upgrades.
- Account deletion preserves reporting history; retention/anonymization needs an
  operator decision and implementation before final Play disclosures.
- Portable schema restore tests are not a production-data backup/restore rehearsal.
- No changes made to credentials, company records, billing or public release state.

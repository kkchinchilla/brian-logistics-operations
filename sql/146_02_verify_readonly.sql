-- READ ONLY. Safe inspection after Increment 1.4.6 installation.
SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version;

SELECT p.display_name,p.role,p.active,p.can_manage_finance,
 p.id=private.dashboard146_finance_owner() AS is_pinned_finance_owner
FROM public.profiles p ORDER BY p.display_name;

SELECT c.relname,c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('attendance_change_requests','attendance_closeout_events');

SELECT c.relname AS table_name,t.tgname,t.tgenabled
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
WHERE t.tgname='aab_dashboard146_date_guard' ORDER BY c.relname;

SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS args,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
 'dashboard_get_capabilities','dashboard_get_attendance_day_state','dashboard_request_attendance_change',
 'dashboard_review_attendance_change','dashboard_close_attendance_through','dashboard_reopen_attendance_date',
 'dashboard_edit_run_direct') ORDER BY p.proname;

SELECT table_name,privilege_type,grantee FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name IN ('attendance_change_requests','attendance_closeout_events','daily_attendance_closeouts')
 AND grantee IN ('anon','authenticated') ORDER BY table_name,grantee,privilege_type;

SELECT 'runs' AS table_name,count(*) AS rows FROM public.runs
UNION ALL SELECT 'trip_executions',count(*) FROM public.trip_executions
UNION ALL SELECT 'observations',count(*) FROM public.daily_run_observations
UNION ALL SELECT 'requests',count(*) FROM public.attendance_change_requests
UNION ALL SELECT 'closing_events',count(*) FROM public.attendance_closeout_events;

-- READ ONLY. Save all result grids before applying 143_01.
-- No INSERT/UPDATE/DELETE/DDL, no secrets or auth credentials returned.
SELECT current_database() AS database_name,current_setting('server_version') AS postgres_version;
SELECT prerequisite, to_regclass(prerequisite) IS NOT NULL AS installed FROM unnest(ARRAY[
 'public.profiles','public.routes','public.vehicles','public.runs','public.trip_executions',
 'public.daily_run_observations','public.daily_attendance_closeouts',
 'public.daily_attendance_slot_counts','public.daily_attendance_extra_trips']) AS prerequisite;
SELECT prerequisite,to_regprocedure(prerequisite) IS NOT NULL AS installed FROM unnest(ARRAY[
 'private.is_dispatcher()',
 'public.dashboard_set_attendance_slot_counts(date,jsonb)',
 'public.dashboard_save_actual_observation(bigint,bigint,bigint,text,integer)',
 'public.dashboard_save_extra_actual_trip(date,uuid,text,integer,bigint,bigint,boolean,text,integer,boolean)']) AS prerequisite;
SELECT table_name,column_name,data_type,is_nullable FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN('profiles','routes','vehicles','runs','trip_executions','daily_run_observations','daily_attendance_extra_trips')
 ORDER BY table_name,ordinal_position;
SELECT c.relname AS table_name,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) AS definition,
 pg_get_functiondef(t.tgfoid) AS function_definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE t.tgrelid IN (to_regclass('public.runs'),to_regclass('public.trip_executions'),to_regclass('public.daily_run_observations')) AND NOT t.tgisinternal ORDER BY c.relname,t.tgname;
SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public'
 AND tablename IN('runs','profiles','trip_executions','daily_run_observations','daily_attendance_extra_trips','daily_attendance_closeouts');
SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants
 WHERE table_schema='public' AND table_name IN('runs','profiles','trip_executions') ORDER BY table_name,grantee;

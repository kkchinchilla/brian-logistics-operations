-- Increment 1.4.2 verification: safe SELECT-only checks (no mutations).
SELECT column_name,data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name='runs' AND column_name='dashboard_schedule_revision';
SELECT column_name,data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name='daily_run_observations'
 AND column_name IN ('actual_route_id','revision') ORDER BY column_name;
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' AND table_name IN ('daily_attendance_extra_trips','daily_attendance_change_log');
SELECT routine_name FROM information_schema.routines
 WHERE routine_schema='public' AND routine_name IN
 ('dashboard_save_actual_observation','dashboard_save_extra_actual_trip');
SELECT relname,relrowsecurity FROM pg_class
 WHERE oid IN('public.daily_attendance_extra_trips'::regclass,'public.daily_attendance_change_log'::regclass);
SELECT tgname FROM pg_trigger WHERE tgrelid IN
 ('public.daily_run_observations'::regclass,'public.daily_attendance_extra_trips'::regclass,
  'public.daily_attendance_closeouts'::regclass,'public.runs'::regclass)
 AND NOT tgisinternal AND tgname LIKE 'dashboard_%' ORDER BY tgname;

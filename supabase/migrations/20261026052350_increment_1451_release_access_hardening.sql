-- Increment 1.4.51: reduce unnecessary API-role privileges. No business rows change.
BEGIN;
-- PostgreSQL does not apply row policies to TRUNCATE. Browser roles never need
-- to truncate tables or create triggers; normal SELECT/INSERT/UPDATE/DELETE remain.
REVOKE TRUNCATE, TRIGGER ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
-- Trigger execution itself does not require the invoking client to hold EXECUTE.
REVOKE ALL ON FUNCTION public.dashboard_log_attendance_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_run_assignment() FROM PUBLIC, anon, authenticated;
-- Retain the validated supervisor rename endpoint, but do not expose it to anon.
REVOKE ALL ON FUNCTION public.dashboard_rename_driver(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_rename_driver(uuid,text) TO authenticated;
COMMIT;

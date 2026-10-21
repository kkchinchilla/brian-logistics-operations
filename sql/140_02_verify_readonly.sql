-- After applying 140_01 (read only).
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgrelid='public.runs'::regclass AND tgname='dashboard_closed_run_day_guard';
SELECT count(*) AS closed_days FROM public.daily_attendance_closeouts WHERE closed_at IS NOT NULL;

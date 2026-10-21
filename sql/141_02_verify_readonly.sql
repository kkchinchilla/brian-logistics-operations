-- Increment 1.4.1 validation: READ ONLY.
SELECT column_name,data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name='runs'
 AND column_name IN ('attendance_category','attendance_slot_index');
SELECT to_regclass('public.daily_attendance_slot_counts') AS slot_count_table;
SELECT tgname,tgenabled FROM pg_trigger
 WHERE tgrelid='public.runs'::regclass AND tgname='dashboard_attendance_run_slot_guard';
SELECT tgname,tgenabled FROM pg_trigger
 WHERE tgrelid='public.daily_attendance_slot_counts'::regclass
 AND tgname='dashboard_attendance_slot_counts_guard';
SELECT p.proname FROM pg_proc p WHERE p.proname='dashboard_set_attendance_slot_counts';
SELECT attendance_category,COUNT(*) FROM public.runs GROUP BY attendance_category ORDER BY attendance_category;

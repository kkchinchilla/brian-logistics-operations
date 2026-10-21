-- Increment 1.4.4 verification (read-only): do not modify data.
SELECT 'multi-driver binding pair-uniqueness' AS check_name,
       count(*)=1 AS passed FROM pg_constraint WHERE conrelid='public.vehicle_owner_bindings'::regclass
       AND conname='vehicle_owner_bindings_pair_from_key';
SELECT 'auto rental trigger on runs' AS check_name,count(*)=1 AS passed FROM pg_trigger
       WHERE tgrelid='public.runs'::regclass AND tgname='aaa_dashboard144_rental_run' AND tgenabled<>'D';
SELECT 'auto rental trigger on execution' AS check_name,count(*)=1 AS passed FROM pg_trigger
       WHERE tgrelid='public.trip_executions'::regclass AND tgname='aaa_dashboard144_rental_execution' AND tgenabled<>'D';
SELECT 'auto rental trigger on extra actual' AS check_name,count(*)=1 AS passed FROM pg_trigger
       WHERE tgrelid='public.daily_attendance_extra_trips'::regclass AND tgname='aaa_dashboard144_rental_extra' AND tgenabled<>'D';
SELECT 'template contains no old rental flag' AS check_name,
 NOT EXISTS(SELECT 1 FROM public.driver_day_templates t, jsonb_array_elements(t.rows) x WHERE x ? 'is_rental') AS passed;
SELECT (SELECT count(*) FROM public.runs) AS preserved_runs,
       (SELECT count(*) FROM public.trip_executions) AS preserved_executions,
       (SELECT count(*) FROM public.vehicle_owner_bindings) AS preserved_bindings;

-- Increment 1.4.3 read-only verification, does not create demonstration records.
SELECT to_regclass('public.driver_day_templates') IS NOT NULL AS template_table,
       to_regclass('public.attendance_driver_days') IS NOT NULL AS driver_day_table,
       to_regclass('public.attendance_template_batches') IS NOT NULL AS batch_history_table,
       to_regclass('public.attendance_schedule_audit') IS NOT NULL AS audit_table;
SELECT to_regprocedure('public.dashboard_save_day_template(uuid,jsonb,integer)') IS NOT NULL AS save_template,
       to_regprocedure('public.dashboard_set_driver_leave(date,uuid,boolean,integer)') IS NOT NULL AS set_leave,
       to_regprocedure('public.dashboard_get_schedule_month(uuid,date)') IS NOT NULL AS get_month,
       to_regprocedure('public.dashboard_save_day_plan(date,uuid,text,integer,bigint,bigint,boolean,text,bigint,integer,integer)') IS NOT NULL AS edit_plan,
       to_regprocedure('public.dashboard_apply_day_template(uuid,integer,date[],jsonb,boolean,uuid)') IS NOT NULL AS apply_template;
SELECT tablename,policyname,cmd,roles FROM pg_policies WHERE schemaname='public'
 AND tablename IN('driver_day_templates','attendance_driver_days','attendance_template_batches','attendance_schedule_audit')
 ORDER BY tablename,policyname;
SELECT c.relname table_name,t.tgname trigger_name,t.tgenabled
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
 WHERE NOT t.tgisinternal AND t.tgname LIKE '%dashboard143%'
 ORDER BY c.relname,t.tgname;
SELECT service_date,driver_id,attendance_category,attendance_slot_index,count(*) duplicate_count
 FROM public.runs WHERE attendance_category IS NOT NULL AND status<>'cancelled'
 GROUP BY 1,2,3,4 HAVING count(*)>1 ORDER BY 1,2,3,4 LIMIT 30;
-- Expected: first two queries all true; no duplicate slots. Verify output before any real-data UAT.

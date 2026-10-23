-- Increment 1.4.21: drivers have an own-schedule, read-only attendance view.
-- Supervisors retain scheduling, closing/reopening and finance workflows.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
SELECT private.dashboard143_lock();
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.attendance_change_requests WHERE status='pending') THEN
  RAISE EXCEPTION '請先處理待審變更，再停用司機變更流程';
 END IF;
END $$;

-- Restrictive policies also constrain future permissive board policies.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['runs','daily_run_observations','daily_attendance_extra_trips','attendance_driver_days'] LOOP
  EXECUTE format('CREATE POLICY attendance1421_own_read ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT private.is_dispatcher()) OR driver_id=(SELECT auth.uid()))',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['runs','daily_run_observations'] LOOP
  EXECUTE format('CREATE POLICY attendance1421_update_supervisor ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING ((SELECT private.is_dispatcher())) WITH CHECK ((SELECT private.is_dispatcher()))',t);
 END LOOP;
END $$;
CREATE POLICY attendance1421_insert_supervisor ON public.daily_run_observations AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_dispatcher()));
CREATE POLICY attendance1421_snapshot_supervisor ON public.daily_attendance_closeouts AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT private.is_dispatcher()));
CREATE POLICY attendance1421_history_supervisor ON public.attendance_change_requests AS RESTRICTIVE FOR SELECT TO authenticated USING ((SELECT private.is_dispatcher()));

-- TRUNCATE bypasses RLS; browser roles never need table-level administration.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['runs','daily_run_observations','daily_attendance_extra_trips','attendance_driver_days','attendance_duty_entries','v055_standby_shifts','trip_executions','v055_run_work','v055_driver_work_completions','daily_attendance_closeouts','attendance_closeout_events','attendance_change_requests','daily_attendance_slot_counts','attendance_schedule_audit','attendance_template_batches','daily_attendance_change_log'] LOOP
  EXECUTE format('REVOKE TRUNCATE, TRIGGER ON public.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $$;

-- Table guards cover legacy RPCs that run as their owner and bypass RLS.
CREATE OR REPLACE FUNCTION private.dashboard148_guard_driver_schedule() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT private.is_dispatcher() THEN
  RAISE EXCEPTION '司機僅可查看自己的班表；如需調整請聯絡主管' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.dashboard148_guard_driver_schedule() FROM PUBLIC,anon,authenticated;
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['attendance_change_requests','attendance_driver_days','attendance_duty_entries','v055_standby_shifts','trip_executions','v055_run_work','v055_driver_work_completions'] LOOP
  EXECUTE format('CREATE TRIGGER aac_attendance1421_readonly BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.dashboard148_guard_driver_schedule()',t);
 END LOOP;
END $$;

-- Stop request submission/review from cached clients; history remains intact.
REVOKE EXECUTE ON FUNCTION public.dashboard_request_attendance_change(bigint,bigint,bigint,bigint,text,integer,integer,boolean) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.dashboard_request_attendance_add(date,text,integer,bigint,bigint,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION private.dashboard148_request_add(date,text,integer,bigint,bigint,text,integer) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.dashboard_review_attendance_change(bigint,integer,boolean,text) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.v055_submit_special_completion(bigint,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.dashboard1410_submit(p_date date,p_driver uuid,p_category text,p_slot integer,p_source jsonb,p_target jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE base jsonb;
BEGIN
 PERFORM private.dashboard143_require_dispatcher();
 PERFORM private.dashboard143_lock();
 PERFORM private.dashboard143_open_day(p_date);
 base:=private.dashboard1410_cell(p_date,p_driver,p_category,p_slot);
 IF p_source IS DISTINCT FROM base->'source' THEN RAISE EXCEPTION '原紀錄已變更，請重新整理後再儲存';END IF;
 PERFORM private.dashboard1410_validate(p_date,p_driver,p_category,p_slot,base,p_target);
 RETURN private.dashboard1410_apply(p_date,p_driver,p_category,p_slot,base,p_target);
END $$;

CREATE OR REPLACE FUNCTION private.dashboard1411_submit(p_date date,p_driver uuid,p_category text,p_slot integer,p_source jsonb,p_target jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE base jsonb;
BEGIN
 PERFORM private.dashboard143_require_dispatcher();
 PERFORM private.dashboard143_lock();
 PERFORM private.dashboard143_open_day(p_date);
 base:=private.dashboard1410_cell(p_date,p_driver,p_category,p_slot);
 IF p_source IS DISTINCT FROM base->'source' THEN RAISE EXCEPTION '原紀錄已變更，請重新整理後再儲存';END IF;
 PERFORM private.dashboard1411_validate(p_date,p_driver,p_category,p_slot,base,p_target);
 RETURN private.dashboard1411_apply(p_date,p_driver,p_category,p_slot,base,p_target);
END $$;

CREATE OR REPLACE FUNCTION private.dashboard1410_read(p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT (private.is_dispatcher() OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND role='driver'))
 THEN RAISE EXCEPTION '沒有權限讀取出勤資料';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'service_date',service_date,'driver_id',driver_id,
  'attendance_category',attendance_category,'attendance_slot_index',attendance_slot_index,'start_time',start_time,'end_time',end_time,'note',note,'revision',revision) ORDER BY id)
  FROM public.v055_standby_shifts WHERE service_date=p_date AND (private.is_dispatcher() OR driver_id=auth.uid()) AND review_status<>'rejected'),'[]');
END;$function$
;

CREATE OR REPLACE FUNCTION private.dashboard1411_read(p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT (private.is_dispatcher() OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND role='driver')) THEN RAISE EXCEPTION '沒有權限讀取出勤資料';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'service_date',d.service_date,'driver_id',d.driver_id,'kind',d.kind,
 'attendance_category',d.attendance_category,'attendance_slot_index',d.attendance_slot_index,'note',d.note,'revision',d.revision) ORDER BY d.id)
 FROM public.attendance_duty_entries d WHERE service_date=p_date AND (private.is_dispatcher() OR d.driver_id=auth.uid()) AND status='active'),'[]');
END;$function$
;

CREATE OR REPLACE FUNCTION public.dashboard_get_attendance_day_state(p_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb; closed boolean;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active)
 THEN RAISE EXCEPTION '請先登入' USING ERRCODE='42501';END IF;
 IF p_date IS NULL THEN RAISE EXCEPTION '請指定日期';END IF;
 closed:=private.dashboard146_is_closed(p_date);
 IF NOT private.is_dispatcher() THEN
  RETURN jsonb_build_object('service_date',p_date,'closed',closed);
 END IF;
 SELECT to_jsonb(c) INTO result FROM public.daily_attendance_closeouts c WHERE service_date=p_date;
 result:=coalesce(result,jsonb_build_object('service_date',p_date));
 IF closed THEN
  result:=result||jsonb_build_object('closed_at',coalesce(
   (SELECT happened_at FROM public.attendance_closeout_events WHERE action='close' AND through_date>=p_date ORDER BY id DESC LIMIT 1),
   (SELECT closed_at FROM public.daily_attendance_closeouts WHERE service_date=p_date)));
 ELSE result:=result||jsonb_build_object('closed_at',NULL);END IF;
 RETURN result||jsonb_build_object('closed',closed);
END;$function$
;
COMMIT;


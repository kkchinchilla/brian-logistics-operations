-- Increment 1.4.8: every driver addition, removal and edit is a request first.
-- Existing operational records, prior requests and closing snapshots are retained.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
ALTER TABLE public.attendance_change_requests
 ADD COLUMN request_kind text NOT NULL DEFAULT 'change' CHECK(request_kind IN ('change','add')),
 ADD COLUMN attendance_category text,
 ADD COLUMN attendance_slot_index integer,
 ADD COLUMN result_extra_trip_id bigint REFERENCES public.daily_attendance_extra_trips(id) ON DELETE RESTRICT;
-- Replace only the two old shape constraints; retain all FKs/status/revision checks.
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.attendance_change_requests'::regclass AND contype='c'
  AND (pg_get_constraintdef(oid) LIKE '%num_nonnulls%' OR pg_get_constraintdef(oid) LIKE '%NOT proposed_void%') LOOP
  EXECUTE format('ALTER TABLE public.attendance_change_requests DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
ALTER TABLE public.attendance_change_requests ADD CONSTRAINT attendance_request148_shape CHECK(
 (request_kind='change' AND num_nonnulls(run_id,extra_trip_id)=1 AND attendance_category IS NULL AND attendance_slot_index IS NULL AND result_extra_trip_id IS NULL)
 OR (request_kind='add' AND run_id IS NULL AND extra_trip_id IS NULL AND NOT proposed_void AND attendance_category IS NOT NULL
  AND attendance_category IN ('日配','OC','鮮二','冷凍','低鮮') AND attendance_slot_index IS NOT NULL AND attendance_slot_index BETWEEN 1 AND 30));
CREATE UNIQUE INDEX attendance_request148_pending_add ON public.attendance_change_requests(service_date,driver_id,attendance_category,attendance_slot_index)
 WHERE request_kind='add' AND status='pending';
CREATE INDEX attendance_request148_result_extra ON public.attendance_change_requests(result_extra_trip_id) WHERE result_extra_trip_id IS NOT NULL;

-- Authorization at the table boundary protects cached/legacy clients too.
CREATE FUNCTION private.dashboard148_guard_driver_schedule() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT private.is_dispatcher() THEN
  IF TG_TABLE_NAME<>'runs' OR TG_OP<>'UPDATE' THEN
   RAISE EXCEPTION '司機新增、刪除或修改趟次須先送出申請，經調度員核准後生效' USING ERRCODE='42501';
  END IF;
  -- Legacy start/completion signals are not assignment edits and do not gate monthly reporting.
  IF (to_jsonb(NEW)-ARRAY['status','actual_start_time','actual_end_time']) IS DISTINCT FROM
     (to_jsonb(OLD)-ARRAY['status','actual_start_time','actual_end_time']) THEN
   RAISE EXCEPTION '司機修改趟次或備註須先送出申請，經調度員核准後生效' USING ERRCODE='42501';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.dashboard148_guard_driver_schedule() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER aac_dashboard148_driver_approval BEFORE INSERT OR UPDATE OR DELETE ON public.runs
 FOR EACH ROW EXECUTE FUNCTION private.dashboard148_guard_driver_schedule();
CREATE TRIGGER aac_dashboard148_driver_approval BEFORE INSERT OR UPDATE OR DELETE ON public.daily_run_observations
 FOR EACH ROW EXECUTE FUNCTION private.dashboard148_guard_driver_schedule();
CREATE TRIGGER aac_dashboard148_driver_approval BEFORE INSERT OR UPDATE OR DELETE ON public.daily_attendance_extra_trips
 FOR EACH ROW EXECUTE FUNCTION private.dashboard148_guard_driver_schedule();

CREATE FUNCTION private.dashboard148_add_problem(p_date date,p_driver uuid,p_category text,p_slot integer,p_source_revision integer,p_route bigint,p_vehicle bigint)
RETURNS text LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE slots integer;x public.daily_attendance_extra_trips%ROWTYPE;
BEGIN
 IF p_date IS NULL OR p_category IS NULL OR p_category NOT IN ('日配','OC','鮮二','冷凍','低鮮') OR p_slot IS NULL OR p_slot NOT BETWEEN 1 AND 30
  OR p_source_revision IS NULL OR p_source_revision<0 THEN RETURN '出勤日期、類別、欄位或版本無效';END IF;
 IF private.dashboard146_is_closed(p_date) THEN RETURN '此日期已結案，請先由調度員填寫原因重新開啟';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_driver AND active AND role='driver') THEN RETURN '司機帳號未啟用';END IF;
 IF EXISTS(SELECT 1 FROM public.attendance_driver_days WHERE service_date=p_date AND driver_id=p_driver AND is_leave) THEN RETURN '此司機當日休假';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.routes WHERE id=p_route AND active) OR NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=p_vehicle AND active)
  THEN RETURN '路線或車輛已變更／停用，請重新送審';END IF;
 SELECT coalesce((SELECT slot_count FROM public.daily_attendance_slot_counts WHERE service_date=p_date AND category=p_category),public.dashboard_attendance_slot_base(p_category)) INTO slots;
 IF p_slot>slots THEN RETURN '此欄位已被移除，請重新整理';END IF;
 IF EXISTS(SELECT 1 FROM public.runs r WHERE service_date=p_date AND driver_id=p_driver AND attendance_category=p_category AND attendance_slot_index=p_slot
  AND (status<>'cancelled' OR EXISTS(SELECT 1 FROM public.daily_run_observations o WHERE o.run_id=r.id))) THEN RETURN '此欄位已有預排趟次，新增申請未套用';END IF;
 SELECT * INTO x FROM public.daily_attendance_extra_trips WHERE service_date=p_date AND driver_id=p_driver AND attendance_category=p_category AND attendance_slot_index=p_slot;
 IF x.status='active' OR coalesce(x.revision,0)<>p_source_revision THEN RETURN '此欄位的趟次已變更，請重新整理';END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.dashboard148_add_problem(date,uuid,text,integer,integer,bigint,bigint) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.dashboard148_request_add(p_service_date date,p_category text,p_slot_index integer,p_route_id bigint,p_vehicle_id bigint,p_note text,p_expected_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.attendance_change_requests%ROWTYPE;problem text;x public.daily_attendance_extra_trips%ROWTYPE;
BEGIN
 PERFORM private.dashboard143_lock();
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND role='driver')
 THEN RAISE EXCEPTION '只有司機可送出本人新增趟次申請' USING ERRCODE='42501';END IF;
 IF length(coalesce(p_note,''))>1000 THEN RAISE EXCEPTION '備註不可超過 1000 字';END IF;
 problem:=private.dashboard148_add_problem(p_service_date,auth.uid(),p_category,p_slot_index,p_expected_revision,p_route_id,p_vehicle_id);
 IF problem IS NOT NULL THEN RAISE EXCEPTION '%',problem;END IF;
 SELECT * INTO q FROM public.attendance_change_requests WHERE request_kind='add' AND status='pending' AND service_date=p_service_date
  AND driver_id=auth.uid() AND attendance_category=p_category AND attendance_slot_index=p_slot_index FOR UPDATE;
 IF FOUND THEN
  IF q.source_revision=p_expected_revision AND q.proposed_route_id=p_route_id AND q.proposed_vehicle_id=p_vehicle_id AND q.proposed_note=coalesce(p_note,'')
  THEN RETURN jsonb_build_object('id',q.id,'status',q.status,'revision',q.revision);END IF;
  RAISE EXCEPTION '此欄位已有待審核新增申請，請先等待調度員處理';
 END IF;
 SELECT * INTO x FROM public.daily_attendance_extra_trips WHERE service_date=p_service_date AND driver_id=auth.uid() AND attendance_category=p_category AND attendance_slot_index=p_slot_index;
 INSERT INTO public.attendance_change_requests(request_kind,service_date,driver_id,source_revision,base_record,proposed_route_id,proposed_vehicle_id,proposed_note,
 requested_by,attendance_category,attendance_slot_index)
 VALUES('add',p_service_date,auth.uid(),p_expected_revision,jsonb_build_object('status','empty','previous_extra_id',x.id),p_route_id,p_vehicle_id,coalesce(p_note,''),auth.uid(),p_category,p_slot_index)
 RETURNING * INTO q;
 RETURN jsonb_build_object('id',q.id,'status',q.status,'revision',q.revision);
END $$;
REVOKE ALL ON FUNCTION private.dashboard148_request_add(date,text,integer,bigint,bigint,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.dashboard148_request_add(date,text,integer,bigint,bigint,text,integer) TO authenticated;
CREATE FUNCTION public.dashboard_request_attendance_add(p_service_date date,p_category text,p_slot_index integer,p_route_id bigint,p_vehicle_id bigint,p_note text,p_expected_revision integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT private.dashboard148_request_add(p_service_date,p_category,p_slot_index,p_route_id,p_vehicle_id,p_note,p_expected_revision);
$$;
REVOKE ALL ON FUNCTION public.dashboard_request_attendance_add(date,text,integer,bigint,bigint,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dashboard_request_attendance_add(date,text,integer,bigint,bigint,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.dashboard_request_attendance_change(
 p_run_id bigint,p_extra_trip_id bigint,p_route_id bigint,p_vehicle_id bigint,p_note text,
 p_expected_revision integer,p_expected_observation_revision integer DEFAULT 0,p_void boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.runs%ROWTYPE;x public.daily_attendance_extra_trips%ROWTYPE;o public.daily_run_observations%ROWTYPE;
 d date;owner_id uuid;base jsonb;execution jsonb;request_row public.attendance_change_requests%ROWTYPE;
BEGIN
 PERFORM private.dashboard143_lock();
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND role='driver')
 THEN RAISE EXCEPTION '只有司機可送出本人趟次變更' USING ERRCODE='42501';END IF;
 IF num_nonnulls(p_run_id,p_extra_trip_id)<>1 THEN RAISE EXCEPTION '請指定一筆配送紀錄';END IF;
 IF p_run_id IS NOT NULL THEN
  SELECT * INTO r FROM public.runs WHERE id=p_run_id FOR UPDATE;
  IF NOT FOUND OR r.driver_id<>auth.uid() THEN RAISE EXCEPTION '只能修改本人的趟次' USING ERRCODE='42501';END IF;
  IF r.status NOT IN ('assigned','in_progress','completed') THEN RAISE EXCEPTION '此趟次不能送出變更';END IF;
  IF coalesce(p_void,false) AND (r.status<>'assigned' OR EXISTS(SELECT 1 FROM public.trip_executions WHERE run_id=r.id))
  THEN RAISE EXCEPTION '只能申請取消尚未開始且沒有執行紀錄的趟次';END IF;
  SELECT * INTO o FROM public.daily_run_observations WHERE run_id=r.id;
  IF p_expected_revision IS NULL OR r.dashboard_schedule_revision<>p_expected_revision
   OR p_expected_observation_revision IS NULL OR coalesce(o.revision,0)<>p_expected_observation_revision
  THEN RAISE EXCEPTION '出勤資料已被更新，請重新整理';END IF;
  d:=r.service_date;owner_id:=r.driver_id;
  base:=jsonb_build_object('route_id',coalesce(o.actual_route_id,r.route_id),'vehicle_id',coalesce(o.actual_vehicle_id,r.vehicle_id),
   'note',coalesce(o.actual_note,r.dispatcher_notes,''),'status',r.status);
  SELECT to_jsonb(e) INTO execution FROM public.trip_executions e WHERE run_id=r.id;
 ELSE
  SELECT * INTO x FROM public.daily_attendance_extra_trips WHERE id=p_extra_trip_id FOR UPDATE;
  IF NOT FOUND OR x.driver_id<>auth.uid() THEN RAISE EXCEPTION '只能修改本人的趟次' USING ERRCODE='42501';END IF;
  IF x.status<>'active' OR p_expected_revision IS NULL OR x.revision<>p_expected_revision
  THEN RAISE EXCEPTION '臨時趟次已被更新，請重新整理';END IF;
  d:=x.service_date;owner_id:=x.driver_id;
  base:=jsonb_build_object('route_id',x.actual_route_id,'vehicle_id',x.actual_vehicle_id,'note',x.actual_note,'status',x.status);
 END IF;
 PERFORM private.dashboard143_open_day(d);
 IF NOT coalesce(p_void,false) AND (NOT EXISTS(SELECT 1 FROM public.routes WHERE id=p_route_id AND (active OR id=(base->>'route_id')::bigint))
  OR NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=p_vehicle_id AND (active OR id=(base->>'vehicle_id')::bigint)))
 THEN RAISE EXCEPTION '請選擇有效的路線與車輛';END IF;
 IF length(coalesce(p_note,''))>1000 OR (coalesce(p_void,false) AND nullif(btrim(coalesce(p_note,'')),'') IS NULL)
 THEN RAISE EXCEPTION '備註不可超過 1000 字；撤銷時需填寫原因';END IF;
 SELECT * INTO request_row FROM public.attendance_change_requests WHERE status='pending'
 AND ((p_run_id IS NOT NULL AND run_id=p_run_id) OR (p_extra_trip_id IS NOT NULL AND extra_trip_id=p_extra_trip_id)) FOR UPDATE;
 IF FOUND THEN
  IF request_row.source_revision=p_expected_revision AND request_row.observation_revision=coalesce(p_expected_observation_revision,0)
   AND request_row.proposed_route_id IS NOT DISTINCT FROM p_route_id AND request_row.proposed_vehicle_id IS NOT DISTINCT FROM p_vehicle_id
   AND request_row.proposed_note=coalesce(p_note,'') AND request_row.proposed_void=coalesce(p_void,false)
  THEN RETURN jsonb_build_object('id',request_row.id,'status','pending','revision',request_row.revision);END IF;
  RAISE EXCEPTION '此趟已有待審核變更，請先等待主管處理';
 END IF;
 INSERT INTO public.attendance_change_requests(run_id,extra_trip_id,service_date,driver_id,source_revision,observation_revision,
 base_record,base_execution,proposed_route_id,proposed_vehicle_id,proposed_note,proposed_void,requested_by)
 VALUES(p_run_id,p_extra_trip_id,d,owner_id,p_expected_revision,coalesce(p_expected_observation_revision,0),base,execution,
 p_route_id,p_vehicle_id,coalesce(p_note,''),coalesce(p_void,false),auth.uid()) RETURNING * INTO request_row;
 RETURN jsonb_build_object('id',request_row.id,'status','pending','revision',request_row.revision);
END;$$;


CREATE OR REPLACE FUNCTION public.dashboard_review_attendance_change(p_request_id bigint,p_expected_revision integer,p_approve boolean,p_reason text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE q public.attendance_change_requests%ROWTYPE;r public.runs%ROWTYPE;x public.daily_attendance_extra_trips%ROWTYPE;
 observation_version integer;execution jsonb;stale boolean:=false;problem text;result_id bigint;slot_extra_id bigint;
BEGIN
 PERFORM private.dashboard143_lock();PERFORM private.dashboard143_require_dispatcher();
 SELECT * INTO q FROM public.attendance_change_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到變更申請';END IF;
 IF q.status<>'pending' THEN RETURN jsonb_build_object('id',q.id,'status',q.status,'already_reviewed',true);END IF;
 IF p_expected_revision IS NULL OR q.revision<>p_expected_revision THEN RAISE EXCEPTION '申請已被更新，請重新整理';END IF;
 IF p_approve IS NULL OR length(coalesce(p_reason,''))>1000 THEN RAISE EXCEPTION '審核內容不正確';END IF;
 PERFORM private.dashboard143_open_day(q.service_date);
 IF NOT p_approve AND nullif(btrim(coalesce(p_reason,'')),'') IS NULL THEN RAISE EXCEPTION '退回時請填寫原因';END IF;
 IF p_approve THEN
  IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=q.driver_id AND active AND role='driver') THEN
   stale:=true;
  ELSIF q.request_kind='add' THEN
   problem:=private.dashboard148_add_problem(q.service_date,q.driver_id,q.attendance_category,q.attendance_slot_index,q.source_revision,q.proposed_route_id,q.proposed_vehicle_id);
   SELECT id INTO slot_extra_id FROM public.daily_attendance_extra_trips WHERE service_date=q.service_date AND driver_id=q.driver_id AND attendance_category=q.attendance_category AND attendance_slot_index=q.attendance_slot_index;
   stale:=problem IS NOT NULL OR slot_extra_id IS DISTINCT FROM (q.base_record->>'previous_extra_id')::bigint;
   IF NOT stale THEN
    PERFORM public.dashboard_save_extra_actual_trip(q.service_date,q.driver_id,q.attendance_category,q.attendance_slot_index,q.proposed_route_id,q.proposed_vehicle_id,
     private.dashboard144_rental(q.service_date,q.driver_id,q.proposed_vehicle_id),q.proposed_note,q.source_revision,false);
    SELECT id INTO result_id FROM public.daily_attendance_extra_trips WHERE service_date=q.service_date AND driver_id=q.driver_id
     AND attendance_category=q.attendance_category AND attendance_slot_index=q.attendance_slot_index;
   END IF;
  ELSIF q.run_id IS NOT NULL THEN
   SELECT * INTO r FROM public.runs WHERE id=q.run_id FOR UPDATE;
   SELECT coalesce(max(revision),0) INTO observation_version FROM public.daily_run_observations WHERE run_id=q.run_id;
   SELECT to_jsonb(e) INTO execution FROM public.trip_executions e WHERE run_id=q.run_id;
   stale:=r.id IS NULL OR r.driver_id<>q.driver_id OR r.service_date<>q.service_date OR r.status NOT IN ('assigned','in_progress','completed')
    OR r.dashboard_schedule_revision<>q.source_revision OR observation_version<>q.observation_revision OR execution IS DISTINCT FROM q.base_execution
    OR (q.proposed_void AND (r.status<>'assigned' OR execution IS NOT NULL));
   IF NOT stale THEN PERFORM public.dashboard_edit_run_direct(q.run_id,q.proposed_route_id,q.proposed_vehicle_id,q.proposed_note,q.source_revision,q.observation_revision,q.proposed_void);END IF;
  ELSE
   SELECT * INTO x FROM public.daily_attendance_extra_trips WHERE id=q.extra_trip_id FOR UPDATE;
   stale:=x.id IS NULL OR x.driver_id<>q.driver_id OR x.service_date<>q.service_date OR x.revision<>q.source_revision OR x.status<>'active';
   IF NOT stale THEN PERFORM public.dashboard_save_extra_actual_trip(x.service_date,x.driver_id,x.attendance_category,x.attendance_slot_index,
    q.proposed_route_id,q.proposed_vehicle_id,private.dashboard144_rental(x.service_date,x.driver_id,q.proposed_vehicle_id),
    q.proposed_note,q.source_revision,q.proposed_void);END IF;
  END IF;
 END IF;
 UPDATE public.attendance_change_requests SET status=CASE WHEN stale THEN 'stale' WHEN p_approve THEN 'approved' ELSE 'rejected' END,
 result_extra_trip_id=coalesce(result_id,result_extra_trip_id),revision=revision+1,reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),
 review_reason=CASE WHEN stale THEN coalesce(problem,'原紀錄已變更；本次申請未套用，請重新送審') ELSE btrim(coalesce(p_reason,'')) END
 WHERE id=q.id RETURNING * INTO q;
 RETURN jsonb_build_object('id',q.id,'status',q.status,'reason',q.review_reason,'result_extra_trip_id',q.result_extra_trip_id);
END;$$;


CREATE OR REPLACE FUNCTION public.dashboard_save_extra_actual_trip(p_service_date date, p_driver_id uuid, p_category text, p_slot_index integer, p_route_id bigint, p_vehicle_id bigint, p_is_rental boolean, p_note text, p_expected_revision integer, p_void boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE old_rec public.daily_attendance_extra_trips%ROWTYPE; n integer; resulting_revision integer;
BEGIN
 PERFORM private.dashboard143_lock();
 IF NOT private.is_dispatcher() THEN RAISE EXCEPTION '司機新增、刪除或修改趟次須先送出申請，經調度員核准後生效' USING ERRCODE='42501';END IF;
 PERFORM private.dashboard143_open_day(p_service_date);
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.active)
 THEN RAISE EXCEPTION '請使用有效帳號登入';END IF;
 IF NOT (SELECT private.is_dispatcher()) AND auth.uid()<>p_driver_id
 THEN RAISE EXCEPTION '只可填寫自己的出勤資料';END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_driver_id AND active AND role='driver')
 THEN RAISE EXCEPTION '此司機帳號不存在或未啟用';END IF;
 IF p_service_date IS NULL OR p_category IS NULL OR p_category NOT IN ('日配','OC','鮮二','冷凍','低鮮')
    OR p_slot_index IS NULL OR p_slot_index NOT BETWEEN 1 AND 30
 THEN RAISE EXCEPTION '出勤類別或欄位錯誤';END IF;
 IF p_expected_revision IS NULL OR p_expected_revision<0 THEN RAISE EXCEPTION '編輯版本無效';END IF;
 IF length(COALESCE(p_note,''))>1000 THEN RAISE EXCEPTION '備註不可超過 1000 字';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(20261019,pg_catalog.hashtext(p_service_date::text));
 IF EXISTS (SELECT 1 FROM public.daily_attendance_closeouts
   WHERE service_date=p_service_date AND closed_at IS NOT NULL)
 THEN RAISE EXCEPTION '此出勤日期已結案';END IF;
 SELECT COALESCE((SELECT slot_count FROM public.daily_attendance_slot_counts
    WHERE service_date=p_service_date AND category=p_category),
    public.dashboard_attendance_slot_base(p_category)) INTO n;
 IF p_slot_index>n THEN RAISE EXCEPTION '此欄位已被移除，請重新整理';END IF;
 IF EXISTS(SELECT 1 FROM public.runs
   WHERE service_date=p_service_date AND driver_id=p_driver_id
     AND attendance_category=p_category AND attendance_slot_index=p_slot_index
     AND (status::text<>'cancelled' OR EXISTS(SELECT 1 FROM public.daily_run_observations o WHERE o.run_id=public.runs.id)))
 THEN RAISE EXCEPTION '此欄位已有預排趟次，不能建立臨時趟次';END IF;
 SELECT * INTO old_rec FROM public.daily_attendance_extra_trips
  WHERE service_date=p_service_date AND driver_id=p_driver_id AND attendance_category=p_category
   AND attendance_slot_index=p_slot_index FOR UPDATE;
 IF p_expected_revision<>COALESCE(old_rec.revision,0)
 THEN RAISE EXCEPTION '資料已被其他人更新，請重新整理再編輯';END IF;
 IF old_rec.id IS NOT NULL AND NOT private.is_dispatcher()
 THEN RAISE EXCEPTION '司機修改既有趟次必須先送出變更申請，經主管核准後生效';END IF;
 IF COALESCE(p_void,false) AND old_rec.id IS NULL THEN RAISE EXCEPTION '找不到可撤銷的臨時趟次';END IF;
 IF COALESCE(p_void,false) AND NULLIF(btrim(COALESCE(p_note,'')),'') IS NULL
 THEN RAISE EXCEPTION '撤銷臨時趟次需填寫原因';END IF;
 IF NOT COALESCE(p_void,false) THEN
   IF p_route_id IS NULL OR p_vehicle_id IS NULL OR p_is_rental IS NULL
   THEN RAISE EXCEPTION '臨時趟次請填寫實際路線、車號及租車狀態';END IF;
   IF NOT EXISTS(SELECT 1 FROM public.routes WHERE id=p_route_id)
    OR NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=p_vehicle_id)
   THEN RAISE EXCEPTION '實際路線或車輛不存在';END IF;
 END IF;
 IF old_rec.id IS NULL THEN
  INSERT INTO public.daily_attendance_extra_trips
   (service_date,driver_id,attendance_category,attendance_slot_index,actual_route_id,
    actual_vehicle_id,is_rental,actual_note,status,created_by,updated_by)
  VALUES(p_service_date,p_driver_id,p_category,p_slot_index,p_route_id,p_vehicle_id,p_is_rental,
    COALESCE(p_note,''),'active',auth.uid(),auth.uid()) RETURNING revision INTO resulting_revision;
 ELSE
  UPDATE public.daily_attendance_extra_trips SET
    actual_route_id=CASE WHEN p_void THEN actual_route_id ELSE p_route_id END,
    actual_vehicle_id=CASE WHEN p_void THEN actual_vehicle_id ELSE p_vehicle_id END,
    is_rental=CASE WHEN p_void THEN is_rental ELSE p_is_rental END,
    actual_note=COALESCE(p_note,''),status=CASE WHEN p_void THEN 'void' ELSE 'active' END,
    revision=old_rec.revision+1,updated_at=now(),updated_by=auth.uid()
  WHERE id=old_rec.id RETURNING revision INTO resulting_revision;
 END IF;
 RETURN resulting_revision;
END;$function$

;

CREATE OR REPLACE FUNCTION public.dashboard_save_actual_observation(p_run_id bigint, p_actual_route_id bigint, p_actual_vehicle_id bigint, p_note text, p_expected_revision integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE assigned public.runs%ROWTYPE; existing_revision integer; out_revision integer;
BEGIN
 PERFORM private.dashboard143_lock();
 IF NOT private.is_dispatcher() THEN RAISE EXCEPTION '司機修改趟次須先送出申請，經調度員核准後生效' USING ERRCODE='42501';END IF;
 IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.active)
 THEN RAISE EXCEPTION '請使用有效帳號登入';END IF;
 IF p_expected_revision IS NULL OR p_expected_revision<0 THEN RAISE EXCEPTION '編輯版本無效';END IF;
 SELECT * INTO assigned FROM public.runs WHERE id=p_run_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到配送趟次，請重新整理';END IF;
 IF NOT (SELECT private.is_dispatcher()) AND assigned.driver_id<>auth.uid()
 THEN RAISE EXCEPTION '無權修改其他司機的出勤';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(20261019,pg_catalog.hashtext(assigned.service_date::text));
 IF EXISTS (SELECT 1 FROM public.daily_attendance_closeouts
  WHERE service_date=assigned.service_date AND closed_at IS NOT NULL)
 THEN RAISE EXCEPTION '此出勤日期已結案';END IF;
 IF p_actual_route_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.routes WHERE id=p_actual_route_id)
 THEN RAISE EXCEPTION '找不到實際配送路線';END IF;
 IF p_actual_vehicle_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vehicles WHERE id=p_actual_vehicle_id)
 THEN RAISE EXCEPTION '找不到實際使用車輛';END IF;
 IF length(COALESCE(p_note,''))>1000 THEN RAISE EXCEPTION '備註不可超過 1000 字';END IF;
 IF EXISTS (SELECT 1 FROM public.trip_executions e WHERE e.run_id=p_run_id AND e.review_status='confirmed')
 THEN RAISE EXCEPTION '此配送趟次已確認，須透過正式更正流程處理';END IF;
 SELECT revision INTO existing_revision FROM public.daily_run_observations WHERE run_id=p_run_id FOR UPDATE;
 IF p_expected_revision<>COALESCE(existing_revision,0) THEN RAISE EXCEPTION '資料已被其他人更新，請重新整理再編輯';END IF;
 IF existing_revision IS NULL THEN
   INSERT INTO public.daily_run_observations(run_id,driver_id,actual_route_id,actual_vehicle_id,actual_note,revision,updated_by)
    VALUES(p_run_id,assigned.driver_id,p_actual_route_id,p_actual_vehicle_id,COALESCE(p_note,''),1,auth.uid())
    RETURNING revision INTO out_revision;
 ELSE
   UPDATE public.daily_run_observations
   SET actual_route_id=p_actual_route_id,actual_vehicle_id=p_actual_vehicle_id,
       actual_note=COALESCE(p_note,''),revision=existing_revision+1,updated_by=auth.uid()
   WHERE run_id=p_run_id RETURNING revision INTO out_revision;
 END IF;
 RETURN out_revision;
END;$function$
;

COMMENT ON FUNCTION public.dashboard_request_attendance_add(date,text,integer,bigint,bigint,text,integer) IS '1.4.8: own-driver proposal only; canonical extra trip is created atomically after dispatcher approval.';
NOTIFY pgrst,'reload schema';
COMMIT;

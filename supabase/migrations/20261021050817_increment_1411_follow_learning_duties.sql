-- Increment 1.4.11: per-entry 跟車 / 學習 and Brian-only duty rates.
-- No operational records, rates, users or historical snapshots are changed.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
CREATE TABLE public.attendance_duty_entries (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 service_date date NOT NULL, driver_id uuid NOT NULL REFERENCES public.profiles(id),
 attendance_category text NOT NULL CHECK(attendance_category IN ('日配','OC','鮮二','冷凍','低鮮')),
 attendance_slot_index integer NOT NULL CHECK(attendance_slot_index BETWEEN 1 AND 30),
 kind text NOT NULL CHECK(kind IN ('follow_along','learning')),
 linked_run_id bigint REFERENCES public.runs(id),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=1000),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','void')),
 void_reason text, revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 recorded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT duty1411_link CHECK((kind='follow_along' AND linked_run_id IS NOT NULL) OR (kind='learning' AND linked_run_id IS NULL)),
 CONSTRAINT duty1411_void_reason CHECK(status<>'void' OR length(btrim(void_reason)) BETWEEN 1 AND 1000)
);
CREATE UNIQUE INDEX duty1411_cell ON public.attendance_duty_entries(service_date,driver_id,attendance_category,attendance_slot_index) WHERE status='active';
CREATE UNIQUE INDEX duty1411_follow ON public.attendance_duty_entries(linked_run_id,driver_id) WHERE status='active' AND kind='follow_along';
CREATE INDEX duty1411_driver ON public.attendance_duty_entries(driver_id,service_date);
CREATE INDEX duty1411_actor ON public.attendance_duty_entries(recorded_by);
CREATE INDEX duty1411_run ON public.attendance_duty_entries(linked_run_id);
ALTER TABLE public.attendance_duty_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_duty_entries FROM PUBLIC,anon,authenticated;
-- Raw access is read-only. All mutations go through the approval-aware cell RPC.
GRANT SELECT ON public.attendance_duty_entries TO authenticated;
CREATE POLICY duty1411_read ON public.attendance_duty_entries FOR SELECT TO authenticated
 USING((SELECT private.is_dispatcher()) OR driver_id=(SELECT auth.uid()));

ALTER TABLE public.attendance_change_requests DROP CONSTRAINT attendance_request1410_kind;
ALTER TABLE public.attendance_change_requests DROP CONSTRAINT attendance_request1410_shape;
ALTER TABLE public.attendance_change_requests
 ADD CONSTRAINT attendance_request1411_kind CHECK(request_kind IN ('change','add','standby','duty')),
 ADD CONSTRAINT attendance_request1411_shape CHECK(
 (request_kind='change' AND num_nonnulls(run_id,extra_trip_id)=1 AND attendance_category IS NULL AND attendance_slot_index IS NULL AND result_extra_trip_id IS NULL AND proposed_cell IS NULL)
 OR (request_kind='add' AND run_id IS NULL AND extra_trip_id IS NULL AND NOT proposed_void AND attendance_category IS NOT NULL AND attendance_category IN ('日配','OC','鮮二','冷凍','低鮮') AND attendance_slot_index IS NOT NULL AND attendance_slot_index BETWEEN 1 AND 30 AND proposed_cell IS NULL)
 OR (request_kind IN ('standby','duty') AND run_id IS NULL AND extra_trip_id IS NULL AND attendance_category IS NOT NULL AND attendance_category IN ('日配','OC','鮮二','冷凍','低鮮') AND attendance_slot_index IS NOT NULL AND attendance_slot_index BETWEEN 1 AND 30 AND proposed_cell IS NOT NULL AND jsonb_typeof(proposed_cell)='object' AND proposed_cell->>'kind' IS NOT NULL
 AND ((request_kind='standby' AND proposed_cell->>'kind' IN ('standby','route','delete')) OR (request_kind='duty' AND proposed_cell->>'kind' IN ('follow_along','learning','standby','route','delete')))));
CREATE UNIQUE INDEX attendance_request1411_duty_pending ON public.attendance_change_requests(service_date,driver_id,attendance_category,attendance_slot_index) WHERE request_kind='duty' AND status='pending';

CREATE FUNCTION private.dashboard1411_main(p_run bigint) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',r.id,'service_date',r.service_date,'driver_id',r.driver_id,'status',r.status,
  'route_id',coalesce(o.actual_route_id,r.route_id),'vehicle_id',coalesce(o.actual_vehicle_id,r.vehicle_id),
  'revision',r.dashboard_schedule_revision,'observation_revision',coalesce(o.revision,0),
  'start_time',r.planned_start_time,'end_time',r.planned_end_time)
 FROM public.runs r LEFT JOIN public.daily_run_observations o ON o.run_id=r.id WHERE r.id=p_run;
$$;
CREATE OR REPLACE FUNCTION private.dashboard1410_cell(p_date date,p_driver uuid,p_category text,p_slot integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.runs%ROWTYPE;x public.daily_attendance_extra_trips%ROWTYPE;s public.v055_standby_shifts%ROWTYPE;
 o public.daily_run_observations%ROWTYPE;v jsonb;history jsonb;
BEGIN
 SELECT * INTO r FROM public.runs WHERE service_date=p_date AND driver_id=p_driver AND attendance_category=p_category
  AND attendance_slot_index=p_slot AND (status<>'cancelled' OR EXISTS(SELECT 1 FROM public.daily_run_observations WHERE run_id=public.runs.id));
 SELECT * INTO x FROM public.daily_attendance_extra_trips WHERE service_date=p_date AND driver_id=p_driver
  AND attendance_category=p_category AND attendance_slot_index=p_slot AND status='active';
 SELECT * INTO s FROM public.v055_standby_shifts WHERE service_date=p_date AND driver_id=p_driver
  AND attendance_category=p_category AND attendance_slot_index=p_slot AND review_status<>'rejected';
 IF num_nonnulls(r.id,x.id,s.id)>1 THEN RAISE EXCEPTION '此欄位有重複勤務，請先檢查原紀錄';END IF;
 IF r.id IS NOT NULL THEN
  SELECT * INTO o FROM public.daily_run_observations WHERE run_id=r.id;
  v:=jsonb_build_object('source',jsonb_build_object('kind','run','id',r.id,'revision',r.dashboard_schedule_revision,'observation_revision',coalesce(o.revision,0)),
   'route_id',coalesce(o.actual_route_id,r.route_id),'vehicle_id',coalesce(o.actual_vehicle_id,r.vehicle_id),
   'note',coalesce(o.actual_note,r.dispatcher_notes,''),'status',r.status,
   'execution',(SELECT to_jsonb(e) FROM public.trip_executions e WHERE e.run_id=r.id));
 ELSIF x.id IS NOT NULL THEN
  v:=jsonb_build_object('source',jsonb_build_object('kind','extra','id',x.id,'revision',x.revision,'observation_revision',0),
   'route_id',x.actual_route_id,'vehicle_id',x.actual_vehicle_id,'note',x.actual_note);
 ELSIF s.id IS NOT NULL THEN
  v:=jsonb_build_object('source',jsonb_build_object('kind','standby','id',s.id,'revision',s.revision,'observation_revision',0),
   'start_time',s.start_time,'end_time',s.end_time,'note',s.note);
 ELSE
  v:=jsonb_build_object('source',jsonb_build_object('kind','empty','id',NULL,'revision',0,'observation_revision',0));
 END IF;
 -- Include retired rows, so an add followed by removal still invalidates a pending request.
 SELECT jsonb_agg(z.value ORDER BY z.value::text) INTO history FROM (
  SELECT jsonb_build_array('run',id,dashboard_schedule_revision) value FROM public.runs
   WHERE service_date=p_date AND driver_id=p_driver AND attendance_category=p_category AND attendance_slot_index=p_slot
  UNION ALL SELECT jsonb_build_array('extra',id,revision) FROM public.daily_attendance_extra_trips
   WHERE service_date=p_date AND driver_id=p_driver AND attendance_category=p_category AND attendance_slot_index=p_slot
  UNION ALL SELECT jsonb_build_array('standby',id,revision) FROM public.v055_standby_shifts
   WHERE service_date=p_date AND driver_id=p_driver AND attendance_category=p_category AND attendance_slot_index=p_slot
 ) z;
 
 IF EXISTS(SELECT 1 FROM public.attendance_duty_entries WHERE service_date=p_date AND driver_id=p_driver AND attendance_category=p_category AND attendance_slot_index=p_slot AND status='active') THEN
  IF v->'source'->>'kind'<>'empty' THEN RAISE EXCEPTION '此欄位有重複勤務，請先檢查原紀錄';END IF;
  SELECT jsonb_build_object('source',jsonb_build_object('kind','duty','id',d.id,'revision',d.revision,'observation_revision',0),
   'kind',d.kind,'linked_run_id',d.linked_run_id,'linked_run',private.dashboard1411_main(d.linked_run_id),'note',d.note)
  INTO v FROM public.attendance_duty_entries d WHERE service_date=p_date AND driver_id=p_driver AND attendance_category=p_category AND attendance_slot_index=p_slot AND status='active';
 END IF;
 SELECT coalesce(history,'[]')||coalesce(jsonb_agg(jsonb_build_array('duty',id,revision) ORDER BY id),'[]') INTO history
 FROM public.attendance_duty_entries WHERE service_date=p_date AND driver_id=p_driver AND attendance_category=p_category AND attendance_slot_index=p_slot;
 RETURN v||jsonb_build_object('history',coalesce(history,'[]'));
END;$$;

CREATE FUNCTION private.dashboard1411_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j jsonb:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 d date:=(j->>'service_date')::date;u uuid:=(j->>'driver_id')::uuid; t1 time;t2 time;parent public.runs%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='attendance_driver_days' THEN
  IF NEW.is_leave AND EXISTS(SELECT 1 FROM public.attendance_duty_entries WHERE service_date=d AND driver_id=u AND status='active') THEN RAISE EXCEPTION '此日已有跟車／學習，無法標示休假';END IF;
 ELSIF TG_TABLE_NAME='daily_attendance_slot_counts' THEN
  IF EXISTS(SELECT 1 FROM public.attendance_duty_entries WHERE service_date=d AND attendance_category=NEW.category AND status='active' AND attendance_slot_index>NEW.slot_count) THEN RAISE EXCEPTION '最後欄位已有跟車／學習，不可減少欄位';END IF;
 ELSIF TG_TABLE_NAME='v055_run_work' THEN
  IF NEW.kind='follow_along' AND NEW.review_status<>'rejected' AND EXISTS(SELECT 1 FROM public.attendance_duty_entries WHERE linked_run_id=NEW.run_id AND driver_id=NEW.driver_id AND status='active') THEN RAISE EXCEPTION '此司機已有同趟跟車紀錄';END IF;
  IF NEW.kind IN ('follow_along','breakdown_replacement') AND NEW.review_status<>'rejected' THEN
   SELECT * INTO parent FROM public.runs WHERE id=NEW.run_id;
   PERFORM private.dashboard1411_check_follow_conflict(parent.service_date,NEW.driver_id,parent.planned_start_time,parent.planned_end_time);
  END IF;
 ELSIF TG_TABLE_NAME='daily_run_observations' THEN
  SELECT * INTO parent FROM public.runs WHERE id=NEW.run_id;
  IF EXISTS(SELECT 1 FROM public.attendance_duty_entries WHERE linked_run_id=NEW.run_id AND status='active')
   AND (coalesce(NEW.actual_route_id,parent.route_id),coalesce(NEW.actual_vehicle_id,parent.vehicle_id)) IS DISTINCT FROM
    (coalesce((to_jsonb(OLD)->>'actual_route_id')::bigint,parent.route_id),coalesce((to_jsonb(OLD)->>'actual_vehicle_id')::bigint,parent.vehicle_id)) THEN RAISE EXCEPTION '此趟已有跟車，請先調整跟車紀錄';END IF;
  SELECT default_start_time,default_end_time INTO t1,t2 FROM public.routes WHERE id=coalesce(NEW.actual_route_id,parent.route_id);
  PERFORM private.dashboard1411_check_follow_conflict(parent.service_date,parent.driver_id,t1,t2);
 ELSE
  IF TG_TABLE_NAME='runs' AND (TG_OP='DELETE' OR j->>'status'='cancelled' OR (TG_OP='UPDATE' AND jsonb_build_array(j->'service_date',j->'driver_id',j->'route_id',j->'vehicle_id',j->'planned_start_time',j->'planned_end_time') IS DISTINCT FROM jsonb_build_array(to_jsonb(OLD)->'service_date',to_jsonb(OLD)->'driver_id',to_jsonb(OLD)->'route_id',to_jsonb(OLD)->'vehicle_id',to_jsonb(OLD)->'planned_start_time',to_jsonb(OLD)->'planned_end_time')))
   AND EXISTS(SELECT 1 FROM public.attendance_duty_entries WHERE linked_run_id=(j->>'id')::bigint AND status='active') THEN RAISE EXCEPTION '此趟已有跟車，請先調整跟車紀錄';END IF;
  IF TG_OP='DELETE' THEN RETURN OLD;END IF;
  IF (TG_TABLE_NAME='runs' AND j->>'status'='cancelled') OR (TG_TABLE_NAME='daily_attendance_extra_trips' AND j->>'status'<>'active') OR (TG_TABLE_NAME='v055_standby_shifts' AND j->>'review_status'='rejected') THEN RETURN NEW;END IF;
  IF EXISTS(SELECT 1 FROM public.attendance_duty_entries WHERE service_date=d AND driver_id=u AND attendance_category=j->>'attendance_category' AND attendance_slot_index=(j->>'attendance_slot_index')::integer AND status='active') THEN RAISE EXCEPTION '此欄位已有跟車／學習，請從出勤儲存格調整';END IF;
  IF TG_TABLE_NAME IN ('runs','daily_attendance_extra_trips') THEN
   SELECT coalesce((j->>'planned_start_time')::time,r.default_start_time),coalesce((j->>'planned_end_time')::time,r.default_end_time) INTO t1,t2 FROM public.routes r WHERE r.id=coalesce((j->>'actual_route_id')::bigint,(j->>'route_id')::bigint);
   PERFORM private.dashboard1411_check_follow_conflict(d,u,t1,t2);
  END IF;
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER duty1411_guard BEFORE INSERT OR UPDATE OR DELETE ON public.runs FOR EACH ROW EXECUTE FUNCTION private.dashboard1411_guard();
CREATE TRIGGER duty1411_guard BEFORE INSERT OR UPDATE ON public.daily_attendance_extra_trips FOR EACH ROW EXECUTE FUNCTION private.dashboard1411_guard();
CREATE TRIGGER duty1411_guard BEFORE INSERT OR UPDATE ON public.v055_standby_shifts FOR EACH ROW EXECUTE FUNCTION private.dashboard1411_guard();
CREATE TRIGGER duty1411_guard BEFORE INSERT OR UPDATE ON public.attendance_driver_days FOR EACH ROW EXECUTE FUNCTION private.dashboard1411_guard();
CREATE TRIGGER duty1411_guard BEFORE INSERT OR UPDATE ON public.daily_attendance_slot_counts FOR EACH ROW EXECUTE FUNCTION private.dashboard1411_guard();
CREATE TRIGGER duty1411_guard BEFORE INSERT OR UPDATE ON public.v055_run_work FOR EACH ROW EXECUTE FUNCTION private.dashboard1411_guard();
CREATE TRIGGER duty1411_guard BEFORE INSERT OR UPDATE ON public.daily_run_observations FOR EACH ROW EXECUTE FUNCTION private.dashboard1411_guard();

CREATE FUNCTION private.dashboard1411_check_follow_conflict(p_date date,p_driver uuid,p_start time,p_end time) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_start IS NULL OR p_end IS NULL THEN RETURN;END IF;
 IF EXISTS(SELECT 1 FROM public.attendance_duty_entries w JOIN public.runs r ON r.id=w.linked_run_id WHERE w.driver_id=p_driver AND w.status='active'
  AND tsrange(r.service_date+r.planned_start_time,r.service_date+r.planned_end_time+CASE WHEN r.planned_end_time<r.planned_start_time THEN interval '1 day' ELSE interval '0 day' END,'[)')
   && tsrange(p_date+p_start,p_date+p_end+CASE WHEN p_end<p_start THEN interval '1 day' ELSE interval '0 day' END,'[)')) THEN RAISE EXCEPTION '司機已有重疊跟車勤務';END IF;
END;$$;

CREATE FUNCTION private.dashboard1411_stamp() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM private.dashboard143_require_dispatcher();
 IF TG_OP='DELETE' THEN RAISE EXCEPTION '勤務須撤銷並保留歷史，不可刪除原紀錄';END IF;
 PERFORM private.dashboard143_open_day(NEW.service_date);
 IF TG_OP='UPDATE' THEN
  IF (NEW.id,NEW.service_date,NEW.driver_id,NEW.attendance_category,NEW.attendance_slot_index,NEW.recorded_by,NEW.created_at) IS DISTINCT FROM
   (OLD.id,OLD.service_date,OLD.driver_id,OLD.attendance_category,OLD.attendance_slot_index,OLD.recorded_by,OLD.created_at) THEN RAISE EXCEPTION '不可變更勤務的司機、日期、欄位或建立資訊';END IF;
  IF OLD.status='void' THEN RAISE EXCEPTION '已撤銷勤務不可重新啟用';END IF;
  NEW.revision:=OLD.revision+1;
 ELSE
  IF NEW.status<>'active' THEN RAISE EXCEPTION '新勤務狀態不正確';END IF;
  NEW.recorded_by:=auth.uid();NEW.created_at:=clock_timestamp();NEW.revision:=1;
 END IF;
 NEW.updated_at:=clock_timestamp();
 RETURN NEW;
END;$$;
CREATE TRIGGER aaa_dashboard143_statement_lock BEFORE INSERT OR UPDATE OR DELETE ON public.attendance_duty_entries FOR EACH STATEMENT EXECUTE FUNCTION private.dashboard143_statement_lock();
CREATE TRIGGER duty1411_stamp BEFORE INSERT OR UPDATE OR DELETE ON public.attendance_duty_entries FOR EACH ROW EXECUTE FUNCTION private.dashboard1411_stamp();
CREATE TRIGGER duty1411_touch AFTER INSERT OR UPDATE ON public.attendance_duty_entries FOR EACH ROW EXECUTE FUNCTION private.dashboard143_touch_actual();
CREATE TRIGGER duty1411_audit AFTER INSERT OR UPDATE ON public.attendance_duty_entries FOR EACH ROW EXECUTE FUNCTION private.v055_audit_work();

CREATE FUNCTION private.dashboard1411_read(p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (private.is_dispatcher() OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND role='driver')) THEN RAISE EXCEPTION '沒有權限讀取出勤資料';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'service_date',d.service_date,'driver_id',d.driver_id,'kind',d.kind,
 'attendance_category',d.attendance_category,'attendance_slot_index',d.attendance_slot_index,'linked_run_id',d.linked_run_id,
 'linked_run',private.dashboard1411_main(d.linked_run_id),'note',d.note,'revision',d.revision) ORDER BY d.id)
 FROM public.attendance_duty_entries d WHERE service_date=p_date AND status='active'),'[]');
END;$$;
CREATE FUNCTION public.dashboard_get_attendance_duties(p_date date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.dashboard1411_read(p_date); $$;

CREATE FUNCTION private.dashboard1411_validate(p_date date,p_driver uuid,p_category text,p_slot integer,p_base jsonb,p_target jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k text:=p_target->>'kind';sk text:=p_base->'source'->>'kind';lim integer;m jsonb;period tsrange;t1 time;t2 time;
BEGIN
 PERFORM private.dashboard143_open_day(p_date);PERFORM private.dashboard143_require_driver(p_driver);
 IF p_category IS NULL OR p_category NOT IN ('日配','OC','鮮二','冷凍','低鮮') OR p_slot IS NULL OR p_slot NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION '請選擇有效出勤欄位';END IF;
 SELECT coalesce((SELECT slot_count FROM public.daily_attendance_slot_counts WHERE service_date=p_date AND category=p_category),public.dashboard_attendance_slot_base(p_category)) INTO lim;
 IF p_slot>lim THEN RAISE EXCEPTION '出勤欄位已變更，請重新整理';END IF;
 IF EXISTS(SELECT 1 FROM public.attendance_driver_days WHERE service_date=p_date AND driver_id=p_driver AND is_leave) THEN RAISE EXCEPTION '此司機當日休假';END IF;
 IF k IS NULL OR k NOT IN ('follow_along','learning','standby','route','delete') OR (k NOT IN ('follow_along','learning') AND sk<>'duty') THEN RAISE EXCEPTION '請使用對應的勤務編輯方式';END IF;
 IF length(coalesce(p_target->>'note',''))>1000 THEN RAISE EXCEPTION '備註不可超過 1000 字';END IF;
 IF k='delete' AND nullif(btrim(p_target->>'note'),'') IS NULL THEN RAISE EXCEPTION '刪除勤務請填寫原因';END IF;
 IF sk='run' AND (p_base->>'status'<>'assigned' OR p_base->'execution'<>'null'::jsonb) THEN RAISE EXCEPTION '只有尚未開始且沒有執行紀錄的趟次可改為勤務';END IF;
 IF k IN ('standby','route') THEN
  PERFORM private.dashboard1410_validate(p_date,p_driver,p_category,p_slot,jsonb_set(p_base,'{source}',jsonb_build_object('kind','standby','id',-1)),p_target);
 ELSIF k IN ('follow_along','learning') THEN
  IF nullif(p_target->>'vehicle_id','') IS NOT NULL OR nullif(p_target->>'route_id','') IS NOT NULL OR nullif(p_target->>'start_time','') IS NOT NULL OR nullif(p_target->>'end_time','') IS NOT NULL THEN RAISE EXCEPTION '跟車／學習按筆記錄，不另設定配送路線、車輛或班段';END IF;
  IF k='follow_along' THEN
   m:=private.dashboard1411_main((p_target->>'linked_run_id')::bigint);
   IF m IS NULL OR m->>'service_date'<>p_date::text OR m->>'status'='cancelled' OR m->>'driver_id'=p_driver::text THEN RAISE EXCEPTION '請選擇當日其他司機的有效配送趟次';END IF;
   IF p_target->'linked_source' IS DISTINCT FROM jsonb_build_object('revision',m->'revision','observation_revision',m->'observation_revision') THEN RAISE EXCEPTION '跟車關聯趟次已變更，請重新整理後再送出';END IF;
   t1:=(m->>'start_time')::time;t2:=(m->>'end_time')::time;
   IF t1 IS NULL OR t2 IS NULL OR t1=t2 THEN RAISE EXCEPTION '跟車趟次缺少有效固定時段';END IF;
   period:=tsrange(p_date+t1,p_date+t2+CASE WHEN t2<t1 THEN interval '1 day' ELSE interval '0 day' END,'[)');
   IF EXISTS(SELECT 1 FROM public.attendance_duty_entries WHERE linked_run_id=(m->>'id')::bigint AND driver_id=p_driver AND status='active' AND id<>CASE WHEN sk='duty' THEN (p_base->'source'->>'id')::bigint ELSE -1 END)
    OR EXISTS(SELECT 1 FROM public.v055_run_work WHERE run_id=(m->>'id')::bigint AND driver_id=p_driver AND kind='follow_along' AND review_status<>'rejected') THEN RAISE EXCEPTION '此司機已有同趟跟車紀錄';END IF;
   IF EXISTS(SELECT 1 FROM public.runs r LEFT JOIN public.daily_run_observations o ON o.run_id=r.id JOIN public.routes rt ON rt.id=coalesce(o.actual_route_id,r.route_id)
    WHERE r.driver_id=p_driver AND (r.status<>'cancelled' OR o.id IS NOT NULL) AND r.id<>CASE WHEN sk='run' THEN (p_base->'source'->>'id')::bigint ELSE -1 END
    AND tsrange(r.service_date+coalesce(CASE WHEN o.actual_route_id IS NULL THEN r.planned_start_time END,rt.default_start_time),r.service_date+coalesce(CASE WHEN o.actual_route_id IS NULL THEN r.planned_end_time END,rt.default_end_time)+CASE WHEN coalesce(CASE WHEN o.actual_route_id IS NULL THEN r.planned_end_time END,rt.default_end_time)<coalesce(CASE WHEN o.actual_route_id IS NULL THEN r.planned_start_time END,rt.default_start_time) THEN interval '1 day' ELSE interval '0 day' END,'[)') && period)
   OR EXISTS(SELECT 1 FROM public.daily_attendance_extra_trips x JOIN public.routes r ON r.id=x.actual_route_id WHERE x.driver_id=p_driver AND x.status='active' AND x.id<>CASE WHEN sk='extra' THEN (p_base->'source'->>'id')::bigint ELSE -1 END AND tsrange(x.service_date+r.default_start_time,x.service_date+r.default_end_time+CASE WHEN r.default_end_time<r.default_start_time THEN interval '1 day' ELSE interval '0 day' END,'[)') && period)
   OR EXISTS(SELECT 1 FROM public.attendance_duty_entries w JOIN public.runs r ON r.id=w.linked_run_id WHERE w.driver_id=p_driver AND w.status='active' AND w.id<>CASE WHEN sk='duty' THEN (p_base->'source'->>'id')::bigint ELSE -1 END AND tsrange(r.service_date+r.planned_start_time,r.service_date+r.planned_end_time+CASE WHEN r.planned_end_time<r.planned_start_time THEN interval '1 day' ELSE interval '0 day' END,'[)') && period)
   OR EXISTS(SELECT 1 FROM public.v055_run_work w JOIN public.runs r ON r.id=w.run_id WHERE w.driver_id=p_driver AND w.kind IN ('follow_along','breakdown_replacement') AND w.review_status<>'rejected' AND tsrange(r.service_date+r.planned_start_time,r.service_date+r.planned_end_time+CASE WHEN r.planned_end_time<r.planned_start_time THEN interval '1 day' ELSE interval '0 day' END,'[)') && period)
   THEN RAISE EXCEPTION '司機已有重疊配送／跟車／接替勤務';END IF;
  ELSIF nullif(p_target->>'linked_run_id','') IS NOT NULL THEN RAISE EXCEPTION '學習不設定跟車關聯';END IF;
 END IF;
END;$$;

CREATE FUNCTION private.dashboard1411_apply(p_date date,p_driver uuid,p_category text,p_slot integer,p_base jsonb,p_target jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sk text:=p_base->'source'->>'kind';k text:=p_target->>'kind';sid bigint:=(p_base->'source'->>'id')::bigint;
 n text:=coalesce(p_target->>'note','');result_id bigint;v integer;
BEGIN
 PERFORM private.dashboard143_require_dispatcher();
 PERFORM private.dashboard1411_validate(p_date,p_driver,p_category,p_slot,p_base,p_target);
 IF p_base IS DISTINCT FROM private.dashboard1410_cell(p_date,p_driver,p_category,p_slot) THEN RAISE EXCEPTION '原紀錄已變更，請重新整理後再送出';END IF;
 IF sk='run' THEN
  PERFORM public.dashboard_edit_run_direct(sid,NULL,NULL,coalesce(nullif(n,''),'改為跟車／學習'),(p_base->'source'->>'revision')::integer,(p_base->'source'->>'observation_revision')::integer,true);
 ELSIF sk='extra' THEN
  PERFORM public.dashboard_save_extra_actual_trip(p_date,p_driver,p_category,p_slot,NULL,NULL,NULL,coalesce(nullif(n,''),'改為跟車／學習'),(p_base->'source'->>'revision')::integer,true);
 ELSIF sk='standby' THEN
  UPDATE public.v055_standby_shifts SET review_status='rejected',review_note=coalesce(nullif(n,''),'改為跟車／學習') WHERE id=sid;
 ELSIF sk='duty' AND k NOT IN ('follow_along','learning') THEN
  UPDATE public.attendance_duty_entries SET status='void',void_reason=coalesce(nullif(n,''),'更正勤務類型') WHERE id=sid;
 END IF;
 IF k IN ('follow_along','learning') THEN
  IF sk='duty' THEN
   UPDATE public.attendance_duty_entries SET kind=k,linked_run_id=(p_target->>'linked_run_id')::bigint,note=n WHERE id=sid RETURNING id INTO result_id;
  ELSE
   INSERT INTO public.attendance_duty_entries(service_date,driver_id,attendance_category,attendance_slot_index,kind,linked_run_id,note)
   VALUES(p_date,p_driver,p_category,p_slot,k,(p_target->>'linked_run_id')::bigint,n) RETURNING id INTO result_id;
  END IF;
 ELSIF k='standby' THEN
  PERFORM private.dashboard1410_apply(p_date,p_driver,p_category,p_slot,private.dashboard1410_cell(p_date,p_driver,p_category,p_slot),p_target);
 ELSIF k='route' THEN
  SELECT coalesce(max(revision),0) INTO v FROM public.daily_attendance_extra_trips WHERE service_date=p_date AND driver_id=p_driver AND attendance_category=p_category AND attendance_slot_index=p_slot;
  PERFORM public.dashboard_save_extra_actual_trip(p_date,p_driver,p_category,p_slot,(p_target->>'route_id')::bigint,(p_target->>'vehicle_id')::bigint,private.dashboard144_rental(p_date,p_driver,(p_target->>'vehicle_id')::bigint),n,v,false);
 END IF;
 RETURN jsonb_build_object('kind',k,'id',result_id,'status','applied');
END;$$;
CREATE FUNCTION private.dashboard1411_submit(p_date date,p_driver uuid,p_category text,p_slot integer,p_source jsonb,p_target jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE base jsonb;q public.attendance_change_requests%ROWTYPE;
BEGIN
 PERFORM private.dashboard143_lock();
 IF auth.uid() IS NULL OR NOT (private.is_dispatcher() OR (p_driver=auth.uid() AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND role='driver')))
 THEN RAISE EXCEPTION '沒有權限修改此司機的出勤';END IF;
 PERFORM private.dashboard143_open_day(p_date);
 base:=private.dashboard1410_cell(p_date,p_driver,p_category,p_slot);
 IF p_source IS DISTINCT FROM base->'source' THEN RAISE EXCEPTION '原紀錄已變更，請重新整理後再送出';END IF;
 PERFORM private.dashboard1411_validate(p_date,p_driver,p_category,p_slot,base,p_target);
 IF private.is_dispatcher() THEN RETURN private.dashboard1411_apply(p_date,p_driver,p_category,p_slot,base,p_target);END IF;
 SELECT * INTO q FROM public.attendance_change_requests WHERE status='pending' AND driver_id=p_driver AND service_date=p_date
  AND ((attendance_category=p_category AND attendance_slot_index=p_slot)
   OR (base->'source'->>'kind'='run' AND run_id=(base->'source'->>'id')::bigint)
   OR (base->'source'->>'kind'='extra' AND extra_trip_id=(base->'source'->>'id')::bigint)) LIMIT 1;
 IF FOUND THEN
  IF q.request_kind='duty' AND q.base_record=base AND q.proposed_cell=p_target THEN RETURN to_jsonb(q);END IF;
  RAISE EXCEPTION '此欄位已有待審申請，請先完成審核';
 END IF;
 INSERT INTO public.attendance_change_requests(request_kind,service_date,driver_id,source_revision,base_record,proposed_note,proposed_void,
  proposed_route_id,proposed_vehicle_id,attendance_category,attendance_slot_index,proposed_cell,requested_by)
 VALUES('duty',p_date,p_driver,(p_source->>'revision')::integer,base,coalesce(p_target->>'note',''),p_target->>'kind'='delete',
  (p_target->>'route_id')::bigint,(p_target->>'vehicle_id')::bigint,p_category,p_slot,p_target,auth.uid()) RETURNING * INTO q;
 RETURN to_jsonb(q);
END;$$;
CREATE FUNCTION public.dashboard_save_attendance_duty(p_service_date date,p_driver_id uuid,p_category text,p_slot_index integer,p_source jsonb,p_target jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.dashboard1411_submit(p_service_date,p_driver_id,p_category,p_slot_index,p_source,p_target); $$;
CREATE FUNCTION private.dashboard1411_review(q public.attendance_change_requests,p_approve boolean,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE problem text;
BEGIN
 PERFORM private.dashboard143_require_dispatcher();
 IF p_approve THEN
  BEGIN
   PERFORM private.dashboard1411_apply(q.service_date,q.driver_id,q.attendance_category,q.attendance_slot_index,q.base_record,q.proposed_cell);
  EXCEPTION WHEN raise_exception OR check_violation OR unique_violation THEN problem:=SQLERRM;
  END;
 END IF;
 UPDATE public.attendance_change_requests SET status=CASE WHEN problem IS NOT NULL THEN 'stale' WHEN p_approve THEN 'approved' ELSE 'rejected' END,
  revision=revision+1,reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_reason=coalesce(problem,btrim(coalesce(p_reason,'')))
 WHERE id=q.id RETURNING * INTO q;
 RETURN jsonb_build_object('id',q.id,'status',q.status,'reason',q.review_reason);
END;$$;
DO $$ DECLARE f text;needle text; BEGIN
 f:=pg_get_functiondef('public.dashboard_review_attendance_change(bigint,integer,boolean,text)'::regprocedure);
 needle:=' IF q.request_kind=''standby'' THEN';
 IF position(needle IN f)=0 THEN RAISE EXCEPTION '1410 review baseline mismatch';END IF;
 EXECUTE replace(f,needle,E' IF q.request_kind=''duty'' THEN RETURN private.dashboard1411_review(q,p_approve,p_reason);END IF;\n'||needle);
 f:=pg_get_functiondef('public.dashboard_apply_day_template(uuid,integer,date[],jsonb,boolean,uuid)'::regprocedure);
 needle:='  ELSIF coalesce(s.is_leave,false) THEN why:=''休假'';';
 IF position(needle IN f)=0 THEN RAISE EXCEPTION '143 template baseline mismatch';END IF;
 EXECUTE replace(f,needle,needle||E'\n  ELSIF EXISTS(SELECT 1 FROM public.attendance_duty_entries WHERE service_date=d AND driver_id=p_driver_id AND status=''active'') THEN why:=''保留跟車／學習，請從出勤表調整'';');
 f:=pg_get_functiondef('private.dashboard148_add_problem(date,uuid,text,integer,integer,bigint,bigint)'::regprocedure);
 EXECUTE replace(f,'BEGIN',E'BEGIN\n IF EXISTS(SELECT 1 FROM public.attendance_duty_entries WHERE service_date=p_date AND driver_id=p_driver AND attendance_category=p_category AND attendance_slot_index=p_slot AND status=''active'') THEN RETURN ''此欄位已有跟車／學習'';END IF;');
 f:=pg_get_functiondef('public.dashboard_close_attendance_through(date,text)'::regprocedure);
 needle:='  UNION SELECT service_date FROM public.daily_attendance_closeouts';
 IF position(needle IN f)=0 THEN RAISE EXCEPTION '147 close dates baseline mismatch';END IF;
 f:=replace(f,needle,E'  UNION SELECT service_date FROM public.attendance_duty_entries\n'||needle);
 needle:='  ''standby'',coalesce(';
 IF position(needle IN f)=0 THEN RAISE EXCEPTION '147 close snapshot baseline mismatch';END IF;
 f:=replace(f,needle,E'  ''duty_entries'',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.attendance_duty_entries r WHERE service_date=ANY(dates)),''[]''::jsonb),\n'||needle);
 EXECUTE f;
 f:=pg_get_functiondef('private.dashboard147_normalize_snapshot(jsonb,boolean)'::regprocedure);
 needle:=' RETURN jsonb_build_object(''version'',147';
 IF position(needle IN f)=0 THEN RAISE EXCEPTION '147 normalizer baseline mismatch';END IF;
 f:=replace(f,needle,$patch$
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_snapshot->'duty_entries','[]')) WHERE value->>'status'='active' LOOP
  SELECT value INTO r FROM jsonb_array_elements(delivery) WHERE value->>'run_id'=x->>'linked_run_id' LIMIT 1;
  work_rows:=work_rows||jsonb_build_array(x||jsonb_build_object('id','duty:'||(x->>'id'),'source_type','attendance_duty',
   'run_id',x->'linked_run_id','vehicle_id',r->'vehicle_id','plate_snapshot',r->'plate_snapshot','route_code_snapshot',r->'route_code_snapshot',
   'pay_basis','per_entry','finalized',true));
 END LOOP;
$patch$||needle);
 EXECUTE f;
END;$$;

ALTER TABLE public.payroll_supplement_rates DROP CONSTRAINT payroll_supplement_rates_component_check;
ALTER TABLE public.payroll_supplement_rates ADD CONSTRAINT payroll_supplement_rates_component_check CHECK(component IN ('standby','rental','follow_along','learning'));
CREATE FUNCTION public.dashboard_save_duty_supplements(p_effective_from date,p_standby_amount numeric,p_rental_amount numeric,p_follow_along_amount numeric,p_learning_amount numeric,p_reason text,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE revision bigint;c text;a numeric;
BEGIN
 IF NOT coalesce(private.can_manage_finance(),false) THEN RAISE EXCEPTION '僅 Brian 可設定勤務／租車';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(1491,1);
 SELECT coalesce(max(id),0) INTO revision FROM public.payroll_supplement_rates;
 IF p_expected_revision IS DISTINCT FROM revision THEN RAISE EXCEPTION '設定已變更，請重新整理後再操作';END IF;
 IF p_effective_from IS NULL OR p_effective_from NOT BETWEEN '1900-01-01' AND '9998-12-31' THEN RAISE EXCEPTION '請選擇有效生效日';END IF;
 IF coalesce(length(btrim(p_reason)),0)=0 OR length(p_reason)>2000 THEN RAISE EXCEPTION '請填寫 1 至 2000 字的變更原因';END IF;
 IF num_nonnulls(p_standby_amount,p_rental_amount,p_follow_along_amount,p_learning_amount)=0 THEN RAISE EXCEPTION '請至少填寫一項金額';END IF;
 FOR c,a IN SELECT * FROM (VALUES('standby',p_standby_amount),('rental',p_rental_amount),('follow_along',p_follow_along_amount),('learning',p_learning_amount)) v(component,amount) LOOP
  IF a IS NULL THEN CONTINUE;END IF;
  IF a<0 OR a>10000000 OR a<>trunc(a) THEN RAISE EXCEPTION '金額請輸入 0 至 10,000,000 的整數';END IF;
  INSERT INTO public.payroll_supplement_rates(component,amount,effective_from,reason) VALUES(c,a,p_effective_from,p_reason);
 END LOOP;
 RETURN jsonb_build_object('revision',(SELECT max(id) FROM public.payroll_supplement_rates));
END;$$;
-- All new implementation functions are private and non-callable except two
-- authenticated, actor-checked read/submit helpers used by invoker RPCs.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private' AND p.proname LIKE 'dashboard1411_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);
 END LOOP;
END;$$;
REVOKE ALL ON FUNCTION public.dashboard_get_attendance_duties(date),public.dashboard_save_attendance_duty(date,uuid,text,integer,jsonb,jsonb),public.dashboard_save_duty_supplements(date,numeric,numeric,numeric,numeric,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.dashboard1411_read(date),private.dashboard1411_submit(date,uuid,text,integer,jsonb,jsonb),public.dashboard_get_attendance_duties(date),public.dashboard_save_attendance_duty(date,uuid,text,integer,jsonb,jsonb),public.dashboard_save_duty_supplements(date,numeric,numeric,numeric,numeric,text,bigint) TO authenticated;
COMMENT ON TABLE public.attendance_duty_entries IS '1.4.11 attendance-cell 跟車 and 學習: per recorded entry, approved driver requests, finalized only by 結案; never a delivery or rental trip.';
NOTIFY pgrst,'reload schema';
COMMIT;

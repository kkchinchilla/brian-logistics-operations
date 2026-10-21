-- Increment 1.4.10: standby periods in the accepted attendance-cell editor.
-- No route/vehicle/rate seeds. Existing finalized snapshots are not rewritten.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
ALTER TABLE public.v055_standby_shifts
 ADD COLUMN attendance_category text,
 ADD COLUMN attendance_slot_index integer,
 ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 ADD CONSTRAINT standby1410_slot CHECK (
  (attendance_category IS NULL AND attendance_slot_index IS NULL) OR
  (attendance_category IS NOT NULL AND attendance_category IN ('日配','OC','鮮二','冷凍','低鮮')
   AND attendance_slot_index IS NOT NULL AND attendance_slot_index BETWEEN 1 AND 30));
CREATE UNIQUE INDEX standby1410_active_cell ON public.v055_standby_shifts
 (service_date,driver_id,attendance_category,attendance_slot_index)
 WHERE review_status<>'rejected' AND attendance_category IS NOT NULL;

ALTER TABLE public.attendance_change_requests ADD COLUMN proposed_cell jsonb;
ALTER TABLE public.attendance_change_requests DROP CONSTRAINT attendance_request148_shape;
-- Replace the request-kind check by its discovered name (148 installs a named check).
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_catalog.pg_constraint
 WHERE conrelid='public.attendance_change_requests'::regclass AND contype='c'
 AND pg_get_constraintdef(oid) LIKE '%request_kind%' LOOP
  EXECUTE format('ALTER TABLE public.attendance_change_requests DROP CONSTRAINT %I',c.conname);
 END LOOP;
END;$$;
ALTER TABLE public.attendance_change_requests
 ADD CONSTRAINT attendance_request1410_kind CHECK (request_kind IN ('change','add','standby')),
 ADD CONSTRAINT attendance_request1410_shape CHECK (
  (request_kind='change' AND num_nonnulls(run_id,extra_trip_id)=1
   AND attendance_category IS NULL AND attendance_slot_index IS NULL AND result_extra_trip_id IS NULL AND proposed_cell IS NULL)
  OR (request_kind='add' AND run_id IS NULL AND extra_trip_id IS NULL AND NOT proposed_void
   AND attendance_category IS NOT NULL AND attendance_category IN ('日配','OC','鮮二','冷凍','低鮮')
   AND attendance_slot_index IS NOT NULL AND attendance_slot_index BETWEEN 1 AND 30 AND proposed_cell IS NULL)
  OR (request_kind='standby' AND run_id IS NULL AND extra_trip_id IS NULL
   AND attendance_category IS NOT NULL AND attendance_category IN ('日配','OC','鮮二','冷凍','低鮮')
   AND attendance_slot_index IS NOT NULL AND attendance_slot_index BETWEEN 1 AND 30
   AND proposed_cell IS NOT NULL AND jsonb_typeof(proposed_cell)='object'
   AND proposed_cell->>'kind' IS NOT NULL AND proposed_cell->>'kind' IN ('standby','route','delete')));
CREATE UNIQUE INDEX attendance1410_pending_standby ON public.attendance_change_requests
 (service_date,driver_id,attendance_category,attendance_slot_index) WHERE request_kind='standby' AND status='pending';

CREATE FUNCTION private.dashboard1410_cell(p_date date,p_driver uuid,p_category text,p_slot integer)
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
 RETURN v||jsonb_build_object('history',coalesce(history,'[]'));
END;$$;

CREATE OR REPLACE FUNCTION private.v055_validate_shift()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE conflict_id bigint;lim integer;
BEGIN
 PERFORM private.dashboard143_require_dispatcher();
 PERFORM private.dashboard143_open_day(NEW.service_date);
 IF TG_OP='UPDATE' THEN
  IF (NEW.id,NEW.service_date,NEW.driver_id,NEW.recorded_by,NEW.created_at,NEW.attendance_category,NEW.attendance_slot_index)
   IS DISTINCT FROM (OLD.id,OLD.service_date,OLD.driver_id,OLD.recorded_by,OLD.created_at,OLD.attendance_category,OLD.attendance_slot_index)
  THEN RAISE EXCEPTION '不可變更值班紀錄的司機、日期、欄位或建立資訊';END IF;
  IF OLD.review_status='rejected' THEN RAISE EXCEPTION '已撤銷值班不可重新啟用，請新增勤務';END IF;
  IF (NEW.start_time,NEW.end_time,NEW.review_status='rejected') IS DISTINCT FROM (OLD.start_time,OLD.end_time,OLD.review_status='rejected')
   AND EXISTS(SELECT 1 FROM public.v055_run_work WHERE standby_shift_id=OLD.id AND review_status<>'rejected')
  THEN RAISE EXCEPTION '此值班已有特殊勤務關聯，請先處理關聯紀錄再調整時段或撤銷';END IF;
  NEW.revision:=OLD.revision+1;
  IF NEW.review_status IS DISTINCT FROM OLD.review_status THEN NEW.reviewed_by:=auth.uid();NEW.reviewed_at:=clock_timestamp();
  ELSE NEW.reviewed_by:=OLD.reviewed_by;NEW.reviewed_at:=OLD.reviewed_at;END IF;
 ELSE
  IF NEW.review_status<>'pending' OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL
  THEN RAISE EXCEPTION '新值班紀錄狀態不正確';END IF;
  NEW.recorded_by:=auth.uid();NEW.created_at:=clock_timestamp();NEW.revision:=1;
 END IF;
 NEW.updated_at:=clock_timestamp();
 IF length(NEW.note)>1000 THEN RAISE EXCEPTION '備註不可超過 1000 字';END IF;
 IF NEW.review_status='rejected' THEN RETURN NEW;END IF;
 PERFORM private.dashboard143_require_driver(NEW.driver_id);
 IF EXISTS(SELECT 1 FROM public.attendance_driver_days WHERE service_date=NEW.service_date AND driver_id=NEW.driver_id AND is_leave)
 THEN RAISE EXCEPTION '此司機當日休假';END IF;
 IF NEW.attendance_category IS NOT NULL THEN
  SELECT coalesce((SELECT slot_count FROM public.daily_attendance_slot_counts WHERE service_date=NEW.service_date AND category=NEW.attendance_category),public.dashboard_attendance_slot_base(NEW.attendance_category)) INTO lim;
  IF NEW.attendance_slot_index>lim THEN RAISE EXCEPTION '出勤欄位已變更，請重新整理';END IF;
  IF EXISTS(SELECT 1 FROM public.runs WHERE service_date=NEW.service_date AND driver_id=NEW.driver_id
    AND attendance_category=NEW.attendance_category AND attendance_slot_index=NEW.attendance_slot_index
    AND (status<>'cancelled' OR EXISTS(SELECT 1 FROM public.daily_run_observations WHERE run_id=public.runs.id)))
   OR EXISTS(SELECT 1 FROM public.daily_attendance_extra_trips WHERE service_date=NEW.service_date AND driver_id=NEW.driver_id
    AND attendance_category=NEW.attendance_category AND attendance_slot_index=NEW.attendance_slot_index AND status='active')
  THEN RAISE EXCEPTION '此欄位已有配送紀錄';END IF;
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('v055-shift-'||NEW.driver_id::text,0));
 SELECT id INTO conflict_id FROM public.v055_standby_shifts s WHERE s.id<>NEW.id AND s.driver_id=NEW.driver_id AND s.review_status<>'rejected'
  AND tsrange(s.service_date+s.start_time,s.service_date+s.end_time+CASE WHEN s.end_time<s.start_time THEN interval '1 day' ELSE interval '0 day' END,'[)')
   && tsrange(NEW.service_date+NEW.start_time,NEW.service_date+NEW.end_time+CASE WHEN NEW.end_time<NEW.start_time THEN interval '1 day' ELSE interval '0 day' END,'[)') LIMIT 1;
 IF conflict_id IS NOT NULL THEN RAISE EXCEPTION '司機值班時段重疊：班段 #%',conflict_id;END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER dashboard1410_touch_standby AFTER INSERT OR UPDATE ON public.v055_standby_shifts
 FOR EACH ROW EXECUTE FUNCTION private.dashboard143_touch_actual();

CREATE FUNCTION private.dashboard1410_guard_cell() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j jsonb:=to_jsonb(NEW);d date:=(j->>'service_date')::date;u uuid:=(j->>'driver_id')::uuid;
BEGIN
 IF TG_TABLE_NAME='attendance_driver_days' THEN
  IF NEW.is_leave AND EXISTS(SELECT 1 FROM public.v055_standby_shifts WHERE service_date=d AND driver_id=u AND review_status<>'rejected')
  THEN RAISE EXCEPTION '此日已有值班，無法標示休假；系統不會自動刪除';END IF;
 ELSIF TG_TABLE_NAME='daily_attendance_slot_counts' THEN
  IF EXISTS(SELECT 1 FROM public.v055_standby_shifts WHERE service_date=d AND attendance_category=NEW.category
   AND review_status<>'rejected' AND attendance_slot_index>NEW.slot_count)
  THEN RAISE EXCEPTION '最後欄位已有值班，不可減少欄位';END IF;
 ELSE
  IF (TG_TABLE_NAME='runs' AND j->>'status'='cancelled') OR (TG_TABLE_NAME='daily_attendance_extra_trips' AND j->>'status'<>'active') THEN RETURN NEW;END IF;
  IF EXISTS(SELECT 1 FROM public.v055_standby_shifts WHERE service_date=d AND driver_id=u AND attendance_category=j->>'attendance_category'
   AND attendance_slot_index=(j->>'attendance_slot_index')::integer AND review_status<>'rejected')
  THEN RAISE EXCEPTION '此欄位已有值班，請從出勤儲存格調整';END IF;
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER dashboard1410_guard_standby BEFORE INSERT OR UPDATE ON public.runs FOR EACH ROW EXECUTE FUNCTION private.dashboard1410_guard_cell();
CREATE TRIGGER dashboard1410_guard_standby BEFORE INSERT OR UPDATE ON public.daily_attendance_extra_trips FOR EACH ROW EXECUTE FUNCTION private.dashboard1410_guard_cell();
CREATE TRIGGER dashboard1410_guard_standby BEFORE INSERT OR UPDATE ON public.attendance_driver_days FOR EACH ROW EXECUTE FUNCTION private.dashboard1410_guard_cell();
CREATE TRIGGER dashboard1410_guard_standby BEFORE INSERT OR UPDATE ON public.daily_attendance_slot_counts FOR EACH ROW EXECUTE FUNCTION private.dashboard1410_guard_cell();

CREATE FUNCTION private.dashboard1410_read(p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (private.is_dispatcher() OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND role='driver'))
 THEN RAISE EXCEPTION '沒有權限讀取出勤資料';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'service_date',service_date,'driver_id',driver_id,
  'attendance_category',attendance_category,'attendance_slot_index',attendance_slot_index,'start_time',start_time,'end_time',end_time,'note',note,'revision',revision) ORDER BY id)
  FROM public.v055_standby_shifts WHERE service_date=p_date AND review_status<>'rejected'),'[]');
END;$$;
CREATE FUNCTION public.dashboard_get_attendance_standby(p_date date) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT private.dashboard1410_read(p_date); $$;

CREATE FUNCTION private.dashboard1410_validate(p_date date,p_driver uuid,p_category text,p_slot integer,p_base jsonb,p_target jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k text:=p_target->>'kind';source_kind text:=p_base->'source'->>'kind';t1 time;t2 time;lim integer;sid bigint;
BEGIN
 PERFORM private.dashboard143_open_day(p_date);PERFORM private.dashboard143_require_driver(p_driver);
 IF p_category IS NULL OR p_category NOT IN ('日配','OC','鮮二','冷凍','低鮮') OR p_slot IS NULL OR p_slot NOT BETWEEN 1 AND 30
 THEN RAISE EXCEPTION '請選擇有效出勤欄位';END IF;
 SELECT coalesce((SELECT slot_count FROM public.daily_attendance_slot_counts WHERE service_date=p_date AND category=p_category),public.dashboard_attendance_slot_base(p_category)) INTO lim;
 IF p_slot>lim THEN RAISE EXCEPTION '出勤欄位已變更，請重新整理';END IF;
 IF EXISTS(SELECT 1 FROM public.attendance_driver_days WHERE service_date=p_date AND driver_id=p_driver AND is_leave) THEN RAISE EXCEPTION '此司機當日休假';END IF;
 IF k IS NULL OR k NOT IN ('standby','route','delete') OR (k<>'standby' AND source_kind<>'standby')
 THEN RAISE EXCEPTION '請使用對應的勤務編輯方式';END IF;
 IF length(coalesce(p_target->>'note',''))>1000 THEN RAISE EXCEPTION '備註不可超過 1000 字';END IF;
 IF k='delete' AND nullif(btrim(coalesce(p_target->>'note','')),'') IS NULL THEN RAISE EXCEPTION '刪除值班請填寫原因';END IF;
 IF source_kind='run' AND (p_base->>'status'<>'assigned' OR p_base->'execution'<>'null'::jsonb)
 THEN RAISE EXCEPTION '只有尚未開始且沒有執行紀錄的趟次可改為值班';END IF;
 IF source_kind='standby' THEN sid:=(p_base->'source'->>'id')::bigint;END IF;
 IF k='standby' THEN
  IF nullif(p_target->>'start_time','') IS NULL OR nullif(p_target->>'end_time','') IS NULL THEN RAISE EXCEPTION '請填寫值班開始與結束時間';END IF;
  t1:=(p_target->>'start_time')::time;t2:=(p_target->>'end_time')::time;
  IF t1=t2 THEN RAISE EXCEPTION '值班開始與結束時間不可相同';END IF;
  IF nullif(p_target->>'vehicle_id','') IS NOT NULL OR nullif(p_target->>'route_id','') IS NOT NULL
  THEN RAISE EXCEPTION '值班車號為不指定，且不設定配送路線或溫層';END IF;
  IF EXISTS(SELECT 1 FROM public.v055_standby_shifts s WHERE s.driver_id=p_driver AND s.review_status<>'rejected' AND s.id<>coalesce(sid,-1)
   AND tsrange(s.service_date+s.start_time,s.service_date+s.end_time+CASE WHEN s.end_time<s.start_time THEN interval '1 day' ELSE interval '0 day' END,'[)')
    && tsrange(p_date+t1,p_date+t2+CASE WHEN t2<t1 THEN interval '1 day' ELSE interval '0 day' END,'[)'))
  THEN RAISE EXCEPTION '司機值班時段重疊';END IF;
 ELSIF k='route' THEN
  IF NOT EXISTS(SELECT 1 FROM public.routes WHERE id=(p_target->>'route_id')::bigint AND active)
   OR NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=(p_target->>'vehicle_id')::bigint AND active)
  THEN RAISE EXCEPTION '請選擇有效的路線與車輛';END IF;
 END IF;
END;$$;

CREATE FUNCTION private.dashboard1410_apply(p_date date,p_driver uuid,p_category text,p_slot integer,p_base jsonb,p_target jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source_kind text:=p_base->'source'->>'kind';k text:=p_target->>'kind';sid bigint:=(p_base->'source'->>'id')::bigint;
 v_note text:=coalesce(p_target->>'note','');result_id bigint;v integer;
BEGIN
 PERFORM private.dashboard143_require_dispatcher();
 PERFORM private.dashboard1410_validate(p_date,p_driver,p_category,p_slot,p_base,p_target);
 IF p_base IS DISTINCT FROM private.dashboard1410_cell(p_date,p_driver,p_category,p_slot) THEN RAISE EXCEPTION '原紀錄已變更，請重新整理後再送出';END IF;
 IF source_kind='run' THEN
  PERFORM public.dashboard_edit_run_direct(sid,NULL,NULL,coalesce(nullif(v_note,''),'改為值班'),(p_base->'source'->>'revision')::integer,(p_base->'source'->>'observation_revision')::integer,true);
 ELSIF source_kind='extra' THEN
  PERFORM public.dashboard_save_extra_actual_trip(p_date,p_driver,p_category,p_slot,NULL,NULL,NULL,coalesce(nullif(v_note,''),'改為值班'),(p_base->'source'->>'revision')::integer,true);
 ELSIF source_kind='standby' AND k<>'standby' THEN
  UPDATE public.v055_standby_shifts SET review_status='rejected',review_note=coalesce(nullif(v_note,''),'改為配送趟次') WHERE id=sid;
 END IF;
 IF k='standby' THEN
  IF source_kind='standby' THEN
   UPDATE public.v055_standby_shifts SET start_time=(p_target->>'start_time')::time,end_time=(p_target->>'end_time')::time,note=v_note WHERE id=sid;
   result_id:=sid;
  ELSE
   INSERT INTO public.v055_standby_shifts(service_date,driver_id,attendance_category,attendance_slot_index,start_time,end_time,note)
   VALUES(p_date,p_driver,p_category,p_slot,(p_target->>'start_time')::time,(p_target->>'end_time')::time,v_note) RETURNING id INTO result_id;
  END IF;
 ELSIF k='route' THEN
  SELECT coalesce(max(revision),0) INTO v FROM public.daily_attendance_extra_trips WHERE service_date=p_date AND driver_id=p_driver AND attendance_category=p_category AND attendance_slot_index=p_slot;
  PERFORM public.dashboard_save_extra_actual_trip(p_date,p_driver,p_category,p_slot,(p_target->>'route_id')::bigint,(p_target->>'vehicle_id')::bigint,private.dashboard144_rental(p_date,p_driver,(p_target->>'vehicle_id')::bigint),v_note,v,false);
  SELECT id INTO result_id FROM public.daily_attendance_extra_trips WHERE service_date=p_date AND driver_id=p_driver AND attendance_category=p_category AND attendance_slot_index=p_slot;
 END IF;
 RETURN jsonb_build_object('kind',k,'id',result_id,'status','applied');
END;$$;

CREATE FUNCTION private.dashboard1410_submit(p_date date,p_driver uuid,p_category text,p_slot integer,p_source jsonb,p_target jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE base jsonb;q public.attendance_change_requests%ROWTYPE;
BEGIN
 PERFORM private.dashboard143_lock();
 IF auth.uid() IS NULL OR NOT (private.is_dispatcher() OR (p_driver=auth.uid() AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND role='driver')))
 THEN RAISE EXCEPTION '沒有權限修改此司機的出勤';END IF;
 PERFORM private.dashboard143_open_day(p_date);
 base:=private.dashboard1410_cell(p_date,p_driver,p_category,p_slot);
 IF p_source IS DISTINCT FROM base->'source' THEN RAISE EXCEPTION '原紀錄已變更，請重新整理後再送出';END IF;
 PERFORM private.dashboard1410_validate(p_date,p_driver,p_category,p_slot,base,p_target);
 IF private.is_dispatcher() THEN RETURN private.dashboard1410_apply(p_date,p_driver,p_category,p_slot,base,p_target);END IF;
 SELECT * INTO q FROM public.attendance_change_requests WHERE status='pending' AND driver_id=p_driver AND service_date=p_date
  AND ((attendance_category=p_category AND attendance_slot_index=p_slot)
   OR (base->'source'->>'kind'='run' AND run_id=(base->'source'->>'id')::bigint)
   OR (base->'source'->>'kind'='extra' AND extra_trip_id=(base->'source'->>'id')::bigint)) LIMIT 1;
 IF FOUND THEN
  IF q.request_kind='standby' AND q.base_record=base AND q.proposed_cell=p_target THEN RETURN to_jsonb(q);END IF;
  RAISE EXCEPTION '此欄位已有待審申請，請先完成審核';
 END IF;
 INSERT INTO public.attendance_change_requests(request_kind,service_date,driver_id,source_revision,base_record,proposed_note,proposed_void,
  proposed_route_id,proposed_vehicle_id,attendance_category,attendance_slot_index,proposed_cell,requested_by)
 VALUES('standby',p_date,p_driver,(p_source->>'revision')::integer,base,coalesce(p_target->>'note',''),p_target->>'kind'='delete',
  (p_target->>'route_id')::bigint,(p_target->>'vehicle_id')::bigint,p_category,p_slot,p_target,auth.uid()) RETURNING * INTO q;
 RETURN to_jsonb(q);
END;$$;
CREATE FUNCTION public.dashboard_save_attendance_standby(p_service_date date,p_driver_id uuid,p_category text,p_slot_index integer,p_source jsonb,p_target jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT private.dashboard1410_submit(p_service_date,p_driver_id,p_category,p_slot_index,p_source,p_target);
$$;

CREATE FUNCTION private.dashboard1410_review(q public.attendance_change_requests,p_approve boolean,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE problem text;
BEGIN
 PERFORM private.dashboard143_require_dispatcher();
 IF p_approve THEN
  BEGIN
   PERFORM private.dashboard1410_apply(q.service_date,q.driver_id,q.attendance_category,q.attendance_slot_index,q.base_record,q.proposed_cell);
  EXCEPTION WHEN raise_exception OR check_violation OR unique_violation THEN problem:=SQLERRM;
  END;
 END IF;
 UPDATE public.attendance_change_requests SET status=CASE WHEN problem IS NOT NULL THEN 'stale' WHEN p_approve THEN 'approved' ELSE 'rejected' END,
  revision=revision+1,reviewed_by=auth.uid(),reviewed_at=clock_timestamp(),review_reason=coalesce(problem,btrim(coalesce(p_reason,'')))
 WHERE id=q.id RETURNING * INTO q;
 RETURN jsonb_build_object('id',q.id,'status',q.status,'reason',q.review_reason);
END;$$;

-- Small, asserted modifications preserve the installed 143/148 business logic.
DO $$ DECLARE f text;needle text; BEGIN
 f:=pg_get_functiondef('public.dashboard_review_attendance_change(bigint,integer,boolean,text)'::regprocedure);
 needle:=' IF p_approve THEN';
 IF position(needle IN f)=0 THEN RAISE EXCEPTION '148 review function does not match expected baseline';END IF;
 f:=replace(f,needle,E' IF q.request_kind=''standby'' THEN RETURN private.dashboard1410_review(q,p_approve,p_reason);END IF;\n'||needle);
 EXECUTE f;
 f:=pg_get_functiondef('public.dashboard_apply_day_template(uuid,integer,date[],jsonb,boolean,uuid)'::regprocedure);
 needle:='  ELSIF coalesce(s.is_leave,false) THEN why:=''休假'';';
 IF position(needle IN f)=0 THEN RAISE EXCEPTION '143 template function does not match expected baseline';END IF;
 f:=replace(f,needle,needle||E'\n  ELSIF EXISTS(SELECT 1 FROM public.v055_standby_shifts WHERE service_date=d AND driver_id=p_driver_id AND review_status<>''rejected'') THEN why:=''保留值班，請從出勤表調整'';');
 EXECUTE f;
 f:=pg_get_functiondef('private.dashboard148_add_problem(date,uuid,text,integer,integer,bigint,bigint)'::regprocedure);
 needle:='BEGIN';
 f:=replace(f,needle,needle||E'\n IF EXISTS(SELECT 1 FROM public.v055_standby_shifts WHERE service_date=p_date AND driver_id=p_driver AND attendance_category=p_category AND attendance_slot_index=p_slot AND review_status<>''rejected'') THEN RETURN ''此欄位已有值班'';END IF;');
 EXECUTE f;
END;$$;

REVOKE ALL ON FUNCTION private.dashboard1410_cell(date,uuid,text,integer),private.dashboard1410_guard_cell(),private.dashboard1410_read(date),
 private.dashboard1410_validate(date,uuid,text,integer,jsonb,jsonb),private.dashboard1410_apply(date,uuid,text,integer,jsonb,jsonb),
 private.dashboard1410_submit(date,uuid,text,integer,jsonb,jsonb),private.dashboard1410_review(public.attendance_change_requests,boolean,text),
 public.dashboard_get_attendance_standby(date),public.dashboard_save_attendance_standby(date,uuid,text,integer,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.dashboard1410_read(date),private.dashboard1410_submit(date,uuid,text,integer,jsonb,jsonb),
 public.dashboard_get_attendance_standby(date),public.dashboard_save_attendance_standby(date,uuid,text,integer,jsonb,jsonb) TO authenticated;
COMMENT ON COLUMN public.v055_standby_shifts.attendance_category IS 'Attendance display position only; standby has no route temperature or vehicle.';
NOTIFY pgrst,'reload schema';
COMMIT;

-- Increment 1.4.11.1: notes-only 跟車 / 學習 and untimed 值班.
-- Preserve all existing rows, historical links, times, audits and closing snapshots.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
ALTER TABLE public.attendance_duty_entries DROP CONSTRAINT duty1411_link;
ALTER TABLE public.attendance_duty_entries ADD CONSTRAINT duty14111_link CHECK(kind='follow_along' OR linked_run_id IS NULL);
ALTER TABLE public.v055_standby_shifts ALTER COLUMN start_time DROP NOT NULL,ALTER COLUMN end_time DROP NOT NULL;
ALTER TABLE public.v055_standby_shifts ADD CONSTRAINT standby14111_optional_time CHECK(
 (start_time IS NULL AND end_time IS NULL) OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time<>end_time));
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
   'kind',d.kind,'linked_run_id',d.linked_run_id,'linked_run',NULL,'note',d.note)
  INTO v FROM public.attendance_duty_entries d WHERE service_date=p_date AND driver_id=p_driver AND attendance_category=p_category AND attendance_slot_index=p_slot AND status='active';
 END IF;
 SELECT coalesce(history,'[]')||coalesce(jsonb_agg(jsonb_build_array('duty',id,revision) ORDER BY id),'[]') INTO history
 FROM public.attendance_duty_entries WHERE service_date=p_date AND driver_id=p_driver AND attendance_category=p_category AND attendance_slot_index=p_slot;
 RETURN v||jsonb_build_object('history',coalesce(history,'[]'));
END;$$;
CREATE OR REPLACE FUNCTION private.dashboard1411_read(p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (private.is_dispatcher() OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND active AND role='driver')) THEN RAISE EXCEPTION '沒有權限讀取出勤資料';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'service_date',d.service_date,'driver_id',d.driver_id,'kind',d.kind,
 'attendance_category',d.attendance_category,'attendance_slot_index',d.attendance_slot_index,'note',d.note,'revision',d.revision) ORDER BY d.id)
 FROM public.attendance_duty_entries d WHERE service_date=p_date AND status='active'),'[]');
END;$$;
CREATE OR REPLACE FUNCTION private.dashboard1411_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j jsonb:=to_jsonb(NEW);d date:=(j->>'service_date')::date;u uuid:=(j->>'driver_id')::uuid;
BEGIN
 IF TG_TABLE_NAME='attendance_driver_days' THEN
  IF NEW.is_leave AND EXISTS(SELECT 1 FROM public.attendance_duty_entries WHERE service_date=d AND driver_id=u AND status='active')
  THEN RAISE EXCEPTION '此日已有跟車／學習，無法標示休假；系統不會自動刪除';END IF;
 ELSIF TG_TABLE_NAME='daily_attendance_slot_counts' THEN
  IF EXISTS(SELECT 1 FROM public.attendance_duty_entries WHERE service_date=d AND attendance_category=NEW.category
   AND status='active' AND attendance_slot_index>NEW.slot_count)
  THEN RAISE EXCEPTION '最後欄位已有跟車／學習，不可減少欄位';END IF;
 ELSE
  IF TG_OP='DELETE' THEN RETURN OLD;END IF;
  IF TG_TABLE_NAME='v055_standby_shifts' AND j->>'review_status'='rejected' THEN RETURN NEW;END IF;
  IF (TG_TABLE_NAME='runs' AND j->>'status'='cancelled') OR (TG_TABLE_NAME='daily_attendance_extra_trips' AND j->>'status'<>'active') THEN RETURN NEW;END IF;
  IF EXISTS(SELECT 1 FROM public.attendance_duty_entries WHERE service_date=d AND driver_id=u AND attendance_category=j->>'attendance_category'
   AND attendance_slot_index=(j->>'attendance_slot_index')::integer AND status='active')
  THEN RAISE EXCEPTION '此欄位已有跟車／學習，請從出勤儲存格調整';END IF;
 END IF;
 RETURN NEW;
END;$$;
DROP TRIGGER duty1411_guard ON public.v055_run_work;
DROP TRIGGER duty1411_guard ON public.daily_run_observations;
CREATE OR REPLACE FUNCTION private.dashboard1411_validate(p_date date,p_driver uuid,p_category text,p_slot integer,p_base jsonb,p_target jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE k text:=p_target->>'kind';sk text:=p_base->'source'->>'kind';lim integer;
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
  IF nullif(p_target->>'vehicle_id','') IS NOT NULL OR nullif(p_target->>'route_id','') IS NOT NULL OR nullif(p_target->>'linked_run_id','') IS NOT NULL OR p_target->'linked_source' IS NOT NULL
   OR nullif(p_target->>'start_time','') IS NOT NULL OR nullif(p_target->>'end_time','') IS NOT NULL THEN RAISE EXCEPTION '跟車／學習已簡化為備註，不需車輛、趟次或時間；請重新整理後送出';END IF;
 END IF;
END;$$;
CREATE OR REPLACE FUNCTION private.dashboard1411_apply(p_date date,p_driver uuid,p_category text,p_slot integer,p_base jsonb,p_target jsonb)
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
   UPDATE public.attendance_duty_entries SET kind=k,linked_run_id=CASE WHEN kind=k THEN linked_run_id ELSE NULL END,note=n WHERE id=sid RETURNING id INTO result_id;
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
CREATE OR REPLACE FUNCTION private.dashboard1410_validate(p_date date,p_driver uuid,p_category text,p_slot integer,p_base jsonb,p_target jsonb)
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
  IF (nullif(p_target->>'start_time','') IS NULL)<>(nullif(p_target->>'end_time','') IS NULL) THEN RAISE EXCEPTION '舊式時段資料須同時提供開始與結束時間，或全部留空';END IF;
  t1:=(p_target->>'start_time')::time;t2:=(p_target->>'end_time')::time;
  IF t1=t2 THEN RAISE EXCEPTION '值班開始與結束時間不可相同';END IF;
  IF nullif(p_target->>'vehicle_id','') IS NOT NULL OR nullif(p_target->>'route_id','') IS NOT NULL
  THEN RAISE EXCEPTION '值班車號為不指定，且不設定配送路線或溫層';END IF;
  IF t1 IS NOT NULL AND t2 IS NOT NULL AND EXISTS(SELECT 1 FROM public.v055_standby_shifts s WHERE s.start_time IS NOT NULL AND s.end_time IS NOT NULL AND s.driver_id=p_driver AND s.review_status<>'rejected' AND s.id<>coalesce(sid,-1)
   AND tsrange(s.service_date+s.start_time,s.service_date+s.end_time+CASE WHEN s.end_time<s.start_time THEN interval '1 day' ELSE interval '0 day' END,'[)')
    && tsrange(p_date+t1,p_date+t2+CASE WHEN t2<t1 THEN interval '1 day' ELSE interval '0 day' END,'[)'))
  THEN RAISE EXCEPTION '司機值班時段重疊';END IF;
 ELSIF k='route' THEN
  IF NOT EXISTS(SELECT 1 FROM public.routes WHERE id=(p_target->>'route_id')::bigint AND active)
   OR NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=(p_target->>'vehicle_id')::bigint AND active)
  THEN RAISE EXCEPTION '請選擇有效的路線與車輛';END IF;
 END IF;
END;$$;
CREATE OR REPLACE FUNCTION private.dashboard1410_apply(p_date date,p_driver uuid,p_category text,p_slot integer,p_base jsonb,p_target jsonb)
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
   UPDATE public.v055_standby_shifts SET start_time=CASE WHEN p_target ? 'start_time' THEN (p_target->>'start_time')::time ELSE start_time END,end_time=CASE WHEN p_target ? 'end_time' THEN (p_target->>'end_time')::time ELSE end_time END,note=v_note WHERE id=sid;
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
 IF NEW.start_time IS NULL AND NEW.end_time IS NULL THEN RETURN NEW;END IF;
 SELECT id INTO conflict_id FROM public.v055_standby_shifts s WHERE s.start_time IS NOT NULL AND s.end_time IS NOT NULL AND s.id<>NEW.id AND s.driver_id=NEW.driver_id AND s.review_status<>'rejected'
  AND tsrange(s.service_date+s.start_time,s.service_date+s.end_time+CASE WHEN s.end_time<s.start_time THEN interval '1 day' ELSE interval '0 day' END,'[)')
   && tsrange(NEW.service_date+NEW.start_time,NEW.service_date+NEW.end_time+CASE WHEN NEW.end_time<NEW.start_time THEN interval '1 day' ELSE interval '0 day' END,'[)') LIMIT 1;
 IF conflict_id IS NOT NULL THEN RAISE EXCEPTION '司機值班時段重疊：班段 #%',conflict_id;END IF;
 RETURN NEW;
END;$$;
DO $$ DECLARE f text;needle text; BEGIN
 f:=pg_get_functiondef('private.v055_validate_run_work()'::regprocedure);
 needle:='where s.driver_id=new.driver_id and s.review_status<>''rejected''';
 IF position(needle IN f)=0 THEN RAISE EXCEPTION 'Legacy standby overlap baseline mismatch';END IF;
 f:=replace(f,needle,needle||' and s.start_time is not null and s.end_time is not null');
 needle:='where s.id=new.standby_shift_id and s.driver_id=new.driver_id';
 IF position(needle IN f)=0 THEN RAISE EXCEPTION 'Legacy standby association baseline mismatch';END IF;
 f:=replace(f,needle,needle||' and s.start_time is not null and s.end_time is not null');
 EXECUTE f;
END;$$;
COMMENT ON COLUMN public.v055_standby_shifts.start_time IS 'Optional historical time. Current attendance 值班 needs only a note; no fabricated default hours.';
COMMENT ON COLUMN public.attendance_duty_entries.linked_run_id IS 'Historical provenance only. Current 跟車 and 學習 are standalone notes-only entries; no run or vehicle selection.';
NOTIFY pgrst,'reload schema';
COMMIT;

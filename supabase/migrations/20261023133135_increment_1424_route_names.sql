-- Increment 1.4.24: names are the only route labels; IDs remain the keys.
-- The owner explicitly authorized discarding all previous route-code values.
-- No route/attendance/payroll rows are deleted. Historical names that were not
-- captured are backfilled from the current master, never from the old code.
BEGIN;
SET LOCAL lock_timeout = '10s';

-- This temporary helper also gives a label-independent preservation checksum.
CREATE FUNCTION private.dashboard1424_labels(j jsonb, strip_labels boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE answer jsonb; k text; v jsonb; route_label text; route_key text;
BEGIN
 IF j IS NULL THEN RETURN NULL; END IF;
 IF jsonb_typeof(j)='array' THEN
  SELECT coalesce(jsonb_agg(private.dashboard1424_labels(value,strip_labels) ORDER BY ord),'[]') INTO answer
  FROM jsonb_array_elements(j) WITH ORDINALITY AS a(value,ord);
  RETURN answer;
 ELSIF jsonb_typeof(j)<>'object' THEN RETURN j; END IF;
 answer:='{}';
 FOR k,v IN SELECT * FROM jsonb_each(j) LOOP
  IF k IN ('route_code','route_code_snapshot','routeCode') THEN CONTINUE; END IF;
  IF strip_labels AND k IN ('route_name','route_name_snapshot','routeName') THEN CONTINUE; END IF;
  answer:=answer||jsonb_build_object(k,private.dashboard1424_labels(v,strip_labels));
 END LOOP;
 IF strip_labels THEN RETURN answer; END IF;
 IF j ?| ARRAY['route_code','route_code_snapshot','routeCode'] THEN
  route_key:=coalesce(j->>'route_id',j->>'actual_route_id',j->>'routeId',CASE WHEN j ? 'route_code' THEN j->>'id' END);
  SELECT r.route_name INTO route_label FROM public.routes r WHERE r.id::text=route_key;
  IF route_label IS NULL THEN
   SELECT r.route_name INTO route_label FROM public.routes r
   WHERE r.route_code=coalesce(j->>'route_code_snapshot',j->>'route_code',j->>'routeCode');
  END IF;
  IF j ? 'route_code' AND NOT j ? 'route_name' THEN
   answer:=answer||jsonb_build_object('route_name',route_label);
  END IF;
  IF j ? 'route_code_snapshot' AND NOT j ? 'route_name_snapshot' THEN
   answer:=answer||jsonb_build_object('route_name_snapshot',route_label);
  END IF;
  IF j ? 'routeCode' AND NOT j ? 'routeName' THEN
   answer:=answer||jsonb_build_object('routeName',coalesce(route_label,''));
  END IF;
 END IF;
 RETURN answer;
END $$;
REVOKE ALL ON FUNCTION private.dashboard1424_labels(jsonb,boolean) FROM PUBLIC,anon,authenticated;

-- Lock the affected tables before recording fingerprints. Disable only their
-- user triggers for the label backfill, restoring each original enabled state
-- in this same transaction. This avoids changing revisions, timestamps, audit
-- entries or closed-day business data during a schema-only conversion.
CREATE TEMP TABLE route1424_tables(name text PRIMARY KEY, fingerprint text) ON COMMIT DROP;
INSERT INTO route1424_tables(name)
 SELECT DISTINCT table_name FROM information_schema.columns
 WHERE table_schema='public' AND data_type IN ('json','jsonb')
 UNION SELECT unnest(ARRAY['routes','runs','trip_executions']);
DO $$ DECLARE t record; f text; BEGIN
 FOR t IN SELECT name FROM route1424_tables ORDER BY name LOOP
  EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE',t.name);
  EXECUTE format('SELECT md5(coalesce(jsonb_agg(x ORDER BY x)::text,''[]'')) FROM (SELECT private.dashboard1424_labels(to_jsonb(r),true) AS x FROM public.%I r) q',t.name) INTO f;
  UPDATE route1424_tables SET fingerprint=f WHERE name=t.name;
 END LOOP;
END $$;
CREATE TEMP TABLE route1424_triggers ON COMMIT DROP AS
 SELECT c.relname AS table_name,t.tgname,t.tgenabled
 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname IN (SELECT name FROM route1424_tables);
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT * FROM route1424_triggers WHERE tgenabled<>'D' LOOP
  EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER %I',t.table_name,t.tgname);
 END LOOP;
END $$;

ALTER TABLE public.runs ADD COLUMN route_name_snapshot text;
ALTER TABLE public.trip_executions ADD COLUMN route_name_snapshot text;
UPDATE public.runs r SET route_name_snapshot=t.route_name FROM public.routes t WHERE t.id=r.route_id;
UPDATE public.trip_executions e SET route_name_snapshot=t.route_name FROM public.routes t WHERE t.id=e.route_id;
DO $$ DECLARE c record; BEGIN
 FOR c IN SELECT table_name,column_name FROM information_schema.columns
          WHERE table_schema='public' AND data_type IN ('json','jsonb') LOOP
  EXECUTE format('UPDATE public.%I SET %I=private.dashboard1424_labels(%I::jsonb) WHERE %I::jsonb IS DISTINCT FROM private.dashboard1424_labels(%I::jsonb)',c.table_name,c.column_name,c.column_name,c.column_name,c.column_name);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.capture_completed_run()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actual_driver uuid;
  actual_vehicle bigint;
  linked_replacement public.v055_run_work%rowtype;
begin
  if new.status='completed' and old.status is distinct from 'completed' then
    actual_driver:=new.driver_id;actual_vehicle:=new.vehicle_id;
    select * into linked_replacement from public.v055_run_work w
      where w.run_id=new.id and w.kind='breakdown_replacement'
        and w.review_status<>'rejected';
    if found then
      if not exists (
        select 1 from public.v055_driver_work_completions c
        where c.work_id=linked_replacement.id and c.driver_id=linked_replacement.driver_id
      ) then
        raise exception '接替司機未回報，不能完成主線';
      end if;
      actual_driver:=linked_replacement.driver_id;
      actual_vehicle:=linked_replacement.vehicle_id;
    end if;
    insert into public.trip_executions(
      run_id,service_date,driver_id,vehicle_id,route_id,
      route_temperature_zone,route_start_time,route_end_time,
      is_rental,route_name_snapshot,driver_notes
    )
    select new.id,new.service_date,actual_driver,actual_vehicle,new.route_id,
      coalesce(new.temperature_zone_snapshot,r.temperature_zone),
      coalesce(new.planned_start_time,r.default_start_time),
      coalesce(new.planned_end_time,r.default_end_time),
      new.is_rental,coalesce(new.route_name_snapshot,r.route_name),new.driver_notes
    from public.routes r where r.id=new.route_id
    on conflict(run_id) do nothing;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.guard_run_route_facts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_dispatcher() and not private.dashboard145_direct_edit_allowed(old.id)
      and row(new.is_rental,new.route_name_snapshot,new.temperature_zone_snapshot,new.planned_start_time,new.planned_end_time)
          is distinct from
          row(old.is_rental,old.route_name_snapshot,old.temperature_zone_snapshot,old.planned_start_time,old.planned_end_time) then
    raise exception '只有主管可以修改派車分類資料';
  end if;
  -- Once an execution exists, its source date/driver/vehicle/route/rental
  -- are no longer editable; otherwise monthly attendance could diverge.
  if row(new.service_date,new.route_id,new.driver_id,new.vehicle_id,new.is_rental)
     is distinct from row(old.service_date,old.route_id,old.driver_id,old.vehicle_id,old.is_rental)
     and exists(select 1 from public.trip_executions e where e.run_id=old.id)
     and not private.dashboard146_write_allowed(old.id) then
    raise exception '此趟次已有實際執行紀錄，不可直接修改日期、路線、司機、車輛或租車狀態';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_route_and_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_dispatcher() then raise exception '只有主管可以修改配送路線'; end if;
  if tg_op='UPDATE' and new.active=false and old.active is distinct from new.active
      and row(new.route_name,new.temperature_zone,new.default_start_time,new.default_end_time)
         is not distinct from
          row(old.route_name,old.temperature_zone,old.default_start_time,old.default_end_time) then
    return new; -- Allow the supervisor to deactivate a legacy/incomplete route.
  end if;
  new.route_name := nullif(btrim(coalesce(new.route_name,'')),'');
  new.temperature_zone := nullif(btrim(coalesce(new.temperature_zone,'')),'');
  if new.route_name is null or length(new.route_name)>60 then raise exception '路線名稱須為 1 至 60 個字'; end if;
  if new.temperature_zone is null then raise exception '必須設定溫層'; end if;
  if (new.default_start_time is null) <> (new.default_end_time is null)
      or new.default_start_time = new.default_end_time then
    raise exception '歷史路線時段須同時提供不同的開始與結束時間，或全部留空';
  end if;
  return new;
end;
$function$;

DROP FUNCTION public.v055_my_special_assignments(date);
CREATE OR REPLACE FUNCTION public.v055_my_special_assignments(p_day date)
 RETURNS TABLE(work_id bigint, run_id bigint, service_date date, kind text, support_reference text, work_note text, review_status text, follow_stage_snapshot text, replacement_payee text, route_name text, temperature_zone text, planned_start_time time without time zone, planned_end_time time without time zone, plate_number text, vehicle_label text, parent_status text, submitted_at timestamp with time zone, submission_note text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not exists (
       select 1 from public.profiles p
       where p.id=auth.uid() and p.role='driver' and p.active
  ) then raise exception '此帳號沒有司機勤務查詢權限'; end if;
  if p_day is null then raise exception '請先選擇日期'; end if;
  return query
    select w.id,w.run_id,w.service_date,w.kind,w.support_reference,w.note,
      w.review_status,w.follow_stage_snapshot,w.replacement_payee,
      coalesce(parent.route_name_snapshot,r.route_name)::text,
      coalesce(parent.temperature_zone_snapshot,r.temperature_zone)::text,
      parent.planned_start_time,parent.planned_end_time,
      v.plate_number::text,v.label::text,parent.status::text,c.completed_at,c.completion_note::text
    from public.v055_run_work w
    join public.runs parent on parent.id=w.run_id
    join public.routes r on r.id=parent.route_id
    left join public.vehicles v on v.id=w.vehicle_id
    left join public.v055_driver_work_completions c on c.work_id=w.id
    where w.driver_id=auth.uid() and w.service_date=p_day
      and w.review_status<>'rejected'
    order by parent.planned_start_time,w.id;
end $function$;

REVOKE ALL ON FUNCTION public.v055_my_special_assignments(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.v055_my_special_assignments(date) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION private.prevent_run_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  start_t time; end_t time; zone_t text; name_t text;
  start_at timestamp; end_at timestamp;
  conflicting_driver bigint; conflicting_vehicle bigint;
  d_lock bigint; v_lock bigint;
begin
  if tg_op='INSERT' then
    if new.is_rental is null then raise exception '請選擇此趟次是否租車'; end if;
  elsif new.is_rental is distinct from old.is_rental and not private.is_dispatcher() and not private.dashboard145_direct_edit_allowed(old.id) then
    raise exception '只有主管可以修改租車狀態';
  end if;
  if tg_op='INSERT' or new.route_id is distinct from old.route_id then
    select r.default_start_time,r.default_end_time,r.temperature_zone,r.route_name
      into start_t,end_t,zone_t,name_t from public.routes r where r.id=new.route_id;
    if nullif(btrim(coalesce(zone_t,'')),'') is null then
      raise exception '路線缺少有效的溫層，請先至路線管理設定';
    end if;
    new.planned_start_time := start_t;
    new.planned_end_time := end_t;
    new.temperature_zone_snapshot := zone_t;
    new.route_name_snapshot := name_t;
  else
    -- Source snapshots are immutable even if the client attempts to edit them.
    new.planned_start_time := old.planned_start_time;
    new.planned_end_time := old.planned_end_time;
    new.temperature_zone_snapshot := old.temperature_zone_snapshot;
    new.route_name_snapshot := old.route_name_snapshot;
    -- Legacy assignments may lack snapshots; do not backfill them implicitly
    -- during a driver's status update. Keep existing historic assignments usable.
  end if;
  new.scheduled_time := coalesce(new.planned_start_time,new.scheduled_time);
  if new.status='cancelled' then return new; end if;
  if tg_op='UPDATE' and new.status is distinct from old.status
      and new.status in ('in_progress','completed')
      and row(new.service_date,new.route_id,new.driver_id,new.vehicle_id)
      is not distinct from row(old.service_date,old.route_id,old.driver_id,old.vehicle_id) then
    return new;
  end if;
  start_t := new.planned_start_time;
  end_t := new.planned_end_time;
  if start_t is null or end_t is null then
    select r.default_start_time,r.default_end_time into start_t,end_t
    from public.routes r where r.id=new.route_id;
  end if;
  -- No time was supplied for this route. Do not invent a period or treat NULL as infinity.
  -- Date, driver, vehicle, attendance-slot and closeout guards still apply separately.
  if start_t is null or end_t is null then return new; end if;
  if start_t=end_t then raise exception '歷史路線時段的開始與結束時間不可相同'; end if;
  start_at := new.service_date + start_t;
  end_at := new.service_date + end_t;
  if end_t < start_t then end_at:=end_at+interval '1 day'; end if;

  d_lock:=pg_catalog.hashtextextended('dispatch-driver-'||new.driver_id::text,0);
  v_lock:=pg_catalog.hashtextextended('dispatch-vehicle-'||new.vehicle_id::text,0);
  perform pg_catalog.pg_advisory_xact_lock(least(d_lock,v_lock));
  if d_lock<>v_lock then perform pg_catalog.pg_advisory_xact_lock(greatest(d_lock,v_lock)); end if;

  select q.id into conflicting_driver
  from public.runs q join public.routes r on r.id=q.route_id
  where q.id is distinct from new.id and q.driver_id=new.driver_id and q.status<>'cancelled'
    and coalesce(q.planned_start_time,r.default_start_time) is not null
    and coalesce(q.planned_end_time,r.default_end_time) is not null
    and coalesce(q.planned_start_time,r.default_start_time)<>coalesce(q.planned_end_time,r.default_end_time)
    and tsrange(q.service_date+coalesce(q.planned_start_time,r.default_start_time),
      q.service_date+coalesce(q.planned_end_time,r.default_end_time)+
      case when coalesce(q.planned_end_time,r.default_end_time)<coalesce(q.planned_start_time,r.default_start_time)
           then interval '1 day' else interval '0 days' end,'[)')
      && tsrange(start_at,end_at,'[)')
  limit 1;
  if conflicting_driver is not null then raise exception '司機時間衝突：趟次 #%',conflicting_driver; end if;

  select q.id into conflicting_vehicle
  from public.runs q join public.routes r on r.id=q.route_id
  where q.id is distinct from new.id and q.vehicle_id=new.vehicle_id and q.status<>'cancelled'
    and coalesce(q.planned_start_time,r.default_start_time) is not null
    and coalesce(q.planned_end_time,r.default_end_time) is not null
    and coalesce(q.planned_start_time,r.default_start_time)<>coalesce(q.planned_end_time,r.default_end_time)
    and tsrange(q.service_date+coalesce(q.planned_start_time,r.default_start_time),
      q.service_date+coalesce(q.planned_end_time,r.default_end_time)+
      case when coalesce(q.planned_end_time,r.default_end_time)<coalesce(q.planned_start_time,r.default_start_time)
           then interval '1 day' else interval '0 days' end,'[)')
      && tsrange(start_at,end_at,'[)')
  limit 1;
  if conflicting_vehicle is not null then raise exception '車輛時間衝突：趟次 #%',conflicting_vehicle; end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.dashboard_edit_run_direct(p_run_id bigint, p_route_id bigint, p_vehicle_id bigint, p_note text, p_expected_run_revision integer, p_expected_observation_revision integer DEFAULT 0, p_cancel boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r public.runs%ROWTYPE;o public.daily_run_observations%ROWTYPE;n integer;
BEGIN
 PERFORM private.dashboard143_lock();PERFORM private.dashboard143_require_dispatcher();
 SELECT * INTO r FROM public.runs WHERE id=p_run_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到配送趟次';END IF;
 PERFORM private.dashboard143_open_day(r.service_date);
 IF p_expected_run_revision IS NULL OR r.dashboard_schedule_revision<>p_expected_run_revision
 THEN RAISE EXCEPTION '趟次已被更新，請重新整理';END IF;
 IF EXISTS(SELECT 1 FROM public.attendance_driver_days WHERE service_date=r.service_date AND driver_id=r.driver_id AND is_leave)
 THEN RAISE EXCEPTION '此司機當日休假';END IF;
 IF r.status NOT IN ('assigned','in_progress','completed') THEN RAISE EXCEPTION '已取消趟次不可修改';END IF;
 IF coalesce(p_cancel,false) AND (r.status<>'assigned' OR EXISTS(SELECT 1 FROM public.trip_executions WHERE run_id=r.id))
 THEN RAISE EXCEPTION '只能取消尚未開始且沒有執行紀錄的趟次';END IF;
 IF NOT coalesce(p_cancel,false) AND (
  NOT EXISTS(SELECT 1 FROM public.routes WHERE id=p_route_id AND (active OR id=r.route_id))
  OR NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=p_vehicle_id AND (active OR id=r.vehicle_id)))
 THEN RAISE EXCEPTION '請選擇有效的路線與車輛';END IF;
 IF length(coalesce(p_note,''))>1000 THEN RAISE EXCEPTION '備註不可超過 1000 字';END IF;
 SELECT * INTO o FROM public.daily_run_observations WHERE run_id=r.id FOR UPDATE;
 IF p_expected_observation_revision IS NULL OR coalesce(o.revision,0)<>p_expected_observation_revision
 THEN RAISE EXCEPTION '出勤資料已被更新，請重新整理';END IF;
 PERFORM pg_catalog.set_config('app.dashboard146_run',auth.uid()::text||':'||r.id::text,true);
 IF o.id IS NOT NULL THEN DELETE FROM public.daily_run_observations WHERE id=o.id;END IF;
 IF coalesce(p_cancel,false) THEN
  UPDATE public.runs SET status='cancelled',dispatcher_notes=nullif(btrim(coalesce(p_note,'')),'')
  WHERE id=r.id RETURNING dashboard_schedule_revision INTO n;
 ELSE
  UPDATE public.runs SET route_id=p_route_id,vehicle_id=p_vehicle_id,dispatcher_notes=nullif(btrim(coalesce(p_note,'')),'')
  WHERE id=r.id RETURNING dashboard_schedule_revision INTO n;
  -- Keep actual execution identity, review status and completion notes. Ordinary
  -- route/vehicle corrections update the same execution; never add a second trip.
  UPDATE public.trip_executions e SET route_id=s.route_id,vehicle_id=s.vehicle_id,
   route_temperature_zone=s.temperature_zone_snapshot,route_start_time=s.planned_start_time,
   route_end_time=s.planned_end_time,route_name_snapshot=s.route_name_snapshot,
   updated_at=clock_timestamp()
  FROM public.runs s WHERE s.id=r.id AND e.run_id=s.id AND e.driver_id=s.driver_id
   AND ROW(e.route_id,e.vehicle_id,e.route_temperature_zone,e.route_start_time,e.route_end_time,e.route_name_snapshot)
    IS DISTINCT FROM ROW(s.route_id,s.vehicle_id,s.temperature_zone_snapshot,s.planned_start_time,s.planned_end_time,s.route_name_snapshot);
 END IF;
 PERFORM pg_catalog.set_config('app.dashboard146_run','',true);
 RETURN jsonb_build_object('run_id',r.id,'revision',n,'cancelled',coalesce(p_cancel,false));
END;$function$;

CREATE OR REPLACE FUNCTION private.guard_execution_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  source_status text;
  active_replacement public.v055_run_work%rowtype;
begin
  if not private.is_dispatcher() then
    raise exception '只有調度人員可審核實際趟次';
  end if;
  IF private.dashboard146_write_allowed(old.run_id) THEN
    IF row(new.id,new.run_id,new.service_date,new.driver_id,new.actual_start_time,new.actual_end_time,
       new.driver_notes,new.created_at,new.review_status,new.review_note,new.reviewed_by,new.reviewed_at)
       IS DISTINCT FROM row(old.id,old.run_id,old.service_date,old.driver_id,old.actual_start_time,old.actual_end_time,
       old.driver_notes,old.created_at,old.review_status,old.review_note,old.reviewed_by,old.reviewed_at)
    THEN RAISE EXCEPTION '出勤變更只能更新路線與車輛來源欄位';END IF;
    new.updated_at:=clock_timestamp();RETURN new;
  END IF;
  if row(new.run_id,new.service_date,new.route_id,new.route_temperature_zone,
      new.route_start_time,new.route_end_time,new.is_rental,new.route_name_snapshot,
      new.actual_start_time,new.actual_end_time,new.driver_notes,new.created_at)
     is distinct from
     row(old.run_id,old.service_date,old.route_id,old.route_temperature_zone,
      old.route_start_time,old.route_end_time,old.is_rental,old.route_name_snapshot,
      old.actual_start_time,old.actual_end_time,old.driver_notes,old.created_at)
  then raise exception '不可修改實際趟次不可變來源資料'; end if;

  if row(new.driver_id,new.vehicle_id) is distinct from row(old.driver_id,old.vehicle_id) then
    if new.review_status is distinct from old.review_status or
       new.review_note is distinct from old.review_note or
       not exists (
         select 1 from public.v05512_execution_attribution_corrections c
         where c.execution_id=old.id
           and c.original_driver_id=old.driver_id and c.original_vehicle_id=old.vehicle_id
           and c.corrected_driver_id=new.driver_id and c.corrected_vehicle_id=new.vehicle_id
           and c.corrected_by=auth.uid()
           and c.correction_transaction_id=txid_current()
       ) then
      raise exception '實際司機／車輛只能透過主管稽核校正功能調整';
    end if;
  end if;
  if new.review_status='rejected' and nullif(btrim(coalesce(new.review_note,'')),'') is null then
    raise exception '退回實際趟次時必須填寫原因';
  end if;
  if new.review_status='confirmed' then
    select status into source_status from public.runs where id=new.run_id;
    if source_status is distinct from 'completed' then
      raise exception '派車任務不是已完成狀態，無法核准';
    end if;
    select * into active_replacement from public.v055_run_work w
      where w.run_id=new.run_id and w.kind='breakdown_replacement'
        and w.review_status<>'rejected';
    if found then
      if new.driver_id is distinct from active_replacement.driver_id
         or new.vehicle_id is distinct from active_replacement.vehicle_id then
        raise exception '故障接替實際司機／車輛未校正；請先至特殊勤務管理核對接替紀錄';
      end if;
      if not exists (
        select 1 from public.v055_driver_work_completions c
        where c.work_id=active_replacement.id and c.driver_id=active_replacement.driver_id
      ) then raise exception '接替司機尚未回報完成，不可確認主線實際趟次'; end if;
    end if;
  end if;
  if new.review_status is distinct from old.review_status
     or new.review_note is distinct from old.review_note then
    new.reviewed_by:=auth.uid();new.reviewed_at:=clock_timestamp();
  else
    new.reviewed_by:=old.reviewed_by;new.reviewed_at:=old.reviewed_at;
  end if;
  new.updated_at:=clock_timestamp();
  return new;
end $function$;

CREATE OR REPLACE FUNCTION private.dashboard147_normalize_snapshot(p_snapshot jsonb, p_enrich boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
<<normalize>>
DECLARE
 r jsonb; o jsonb; w jsonb; x jsonb; item jsonb;
 delivery jsonb := '[]'; work_rows jsonb := '[]'; shift_rows jsonb := '[]'; attendance_rows jsonb := '[]';
 route_id bigint; vehicle_id bigint; driver_id uuid; route_name text; zone text; plate text; rental boolean;
BEGIN
 FOR r IN SELECT value FROM jsonb_array_elements(coalesce(p_snapshot->'runs','[]')) LOOP
  IF r->>'status' IN ('cancelled','void') THEN CONTINUE; END IF;
  SELECT value INTO o FROM jsonb_array_elements(coalesce(p_snapshot->'observations','[]')) WHERE value->>'run_id'=r->>'id' LIMIT 1;
  SELECT value INTO w FROM jsonb_array_elements(coalesce(p_snapshot->'special_work','[]'))
   WHERE value->>'run_id'=r->>'id' AND value->>'kind'='breakdown_replacement' AND value->>'review_status'<>'rejected' LIMIT 1;
  route_id:=coalesce((o->>'actual_route_id')::bigint,(r->>'route_id')::bigint);
  vehicle_id:=coalesce((w->>'vehicle_id')::bigint,(o->>'actual_vehicle_id')::bigint,(r->>'vehicle_id')::bigint);
  driver_id:=coalesce((w->>'driver_id')::uuid,(r->>'driver_id')::uuid);
  route_name:=CASE WHEN route_id=(r->>'route_id')::bigint THEN r->>'route_name_snapshot' END;
  zone:=CASE WHEN route_id=(r->>'route_id')::bigint THEN r->>'temperature_zone_snapshot' END;
  rental:=CASE WHEN vehicle_id=(r->>'vehicle_id')::bigint AND driver_id=(r->>'driver_id')::uuid THEN (r->>'is_rental')::boolean END;
  plate:=NULL;
  IF p_enrich THEN
   SELECT t.route_name,coalesce(normalize.zone,t.temperature_zone) INTO route_name,zone FROM public.routes t WHERE t.id=route_id;
   SELECT v.plate_number INTO plate FROM public.vehicles v WHERE v.id=vehicle_id;
   IF vehicle_id IS DISTINCT FROM (r->>'vehicle_id')::bigint OR driver_id IS DISTINCT FROM (r->>'driver_id')::uuid THEN
    rental:=private.dashboard144_rental((r->>'service_date')::date,driver_id,vehicle_id);
   END IF;
  END IF;
  item:=r||jsonb_build_object('id','run:'||(r->>'id'),'source_type','run','run_id',r->'id','extra_trip_id',NULL,
   'driver_id',driver_id,'vehicle_id',vehicle_id,'route_id',route_id,'route_name_snapshot',route_name,
   'route_temperature_zone',zone,'temperature_zone_snapshot',zone,'plate_snapshot',plate,'is_rental',rental,
   'driver_notes',coalesce(o->>'actual_note',r->>'dispatcher_notes',r->>'driver_notes',r->>'notes',''),
   'replacement_work_id',w->'id','original_driver_id',r->'driver_id','finalized',true);
  delivery:=delivery||jsonb_build_array(item);
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_snapshot->'extra_trips','[]')) WHERE value->>'status'='active' LOOP
  route_name:=NULL;zone:=NULL;plate:=NULL;
  IF p_enrich THEN
   SELECT t.route_name,t.temperature_zone INTO route_name,zone FROM public.routes t WHERE t.id=(x->>'actual_route_id')::bigint;
   SELECT v.plate_number INTO plate FROM public.vehicles v WHERE v.id=(x->>'actual_vehicle_id')::bigint;
  END IF;
  delivery:=delivery||jsonb_build_array(x||jsonb_build_object('id','extra:'||(x->>'id'),'source_type','extra','run_id',NULL,'extra_trip_id',x->'id',
   'route_id',x->'actual_route_id','vehicle_id',x->'actual_vehicle_id','route_name_snapshot',route_name,'route_temperature_zone',zone,
   'temperature_zone_snapshot',zone,'plate_snapshot',plate,'driver_notes',x->'actual_note','finalized',true));
 END LOOP;
 FOR w IN SELECT value FROM jsonb_array_elements(coalesce(p_snapshot->'special_work','[]')) WHERE value->>'review_status'<>'rejected' LOOP
  -- Linked work is retained for reconciliation; it never creates a second delivery.
  work_rows:=work_rows||jsonb_build_array(w||jsonb_build_object('finalized',true));
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_snapshot->'standby','[]')) WHERE value->>'review_status'<>'rejected' LOOP
  shift_rows:=shift_rows||jsonb_build_array(x||jsonb_build_object('finalized',true,'converted_to_support',EXISTS(
   SELECT 1 FROM jsonb_array_elements(work_rows) a WHERE a->>'standby_shift_id'=x->>'id' AND a->>'kind' IN ('attached_support','breakdown_replacement'))));
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_snapshot->'attendance_records','[]')) WHERE value->>'review_status'<>'rejected' LOOP
  attendance_rows:=attendance_rows||jsonb_build_array(x||jsonb_build_object('finalized',true));
 END LOOP;

 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_snapshot->'duty_entries','[]')) WHERE value->>'status'='active' LOOP
  SELECT value INTO r FROM jsonb_array_elements(delivery) WHERE value->>'run_id'=x->>'linked_run_id' LIMIT 1;
  work_rows:=work_rows||jsonb_build_array(x||jsonb_build_object('id','duty:'||(x->>'id'),'source_type','attendance_duty',
   'run_id',x->'linked_run_id','vehicle_id',r->'vehicle_id','plate_snapshot',r->'plate_snapshot','route_name_snapshot',r->'route_name_snapshot',
   'pay_basis','per_entry','finalized',true));
 END LOOP;
 RETURN jsonb_build_object('version',147,'deliveries',delivery,'special_work',work_rows,'standby',shift_rows,'attendance_records',attendance_rows);
END $function$;

CREATE OR REPLACE FUNCTION public.dashboard_get_calculated_payroll(p_month date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
DECLARE b jsonb;f jsonb;d record;x record;r jsonb;rate jsonb;parts jsonb;line jsonb;
 lines jsonb:='[]';issues jsonb:='[]';driver_issues jsonb;summaries jsonb:='[]';counts jsonb;
 amount numeric;subtotal numeric;valid boolean;code text;message text;label text;k text;date_text text;
BEGIN
 IF NOT coalesce(private.can_manage_finance(),false) THEN RAISE EXCEPTION '僅 Brian 可查看月度報表';END IF;
 -- Existing RPC validates month, enforces Brian-only RLS and reads 結案 snapshots.
 b:=public.dashboard_get_route_payroll(p_month);f:=b->'finalized';
 IF f->>'version'<>'147' OR f->>'month'<>p_month::text THEN RAISE EXCEPTION '結案月報資料版本不正確';END IF;
 FOREACH k IN ARRAY ARRAY['deliveries','standby','special_work','attendance_records'] LOOP
  IF jsonb_typeof(f->k)<>'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements(f->k) q WHERE q->>'finalized' IS DISTINCT FROM 'true'
   OR q->>'id' IS NULL OR q->>'driver_id' IS NULL OR q->>'close_event_id' IS NULL
   OR (q->>'service_date')::date<p_month OR (q->>'service_date')::date>=(p_month+interval '1 month')::date
   OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'dates') z WHERE z->>'status'='finalized' AND z->>'service_date'=q->>'service_date'))
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(f->k) q GROUP BY q->>'id' HAVING count(*)>1)
  THEN RAISE EXCEPTION '結案對帳來源不一致';END IF;
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(f->'dates') WHERE value->>'status'<>'finalized' LOOP
  issues:=issues||jsonb_build_array(jsonb_build_object('code','date_unfinalized','driverId','','date',r->>'service_date','source','',
   'message',CASE WHEN r->>'status'='reopened' THEN '日期已重新開啟，未計入本次對帳' ELSE '日期尚未結案或缺少結案快照，未計入本次對帳' END));
 END LOOP;
 FOR d IN
  WITH ids AS (
   SELECT id::text id FROM public.profiles WHERE role='driver'
   UNION SELECT q->>'driver_id' FROM jsonb_array_elements((b->'adjustments')||(f->'deliveries')||(f->'standby')||(f->'special_work')||(f->'attendance_records')) q
   UNION SELECT o->>'driver_id' FROM jsonb_array_elements(f->'original_runs') o JOIN jsonb_array_elements(f->'special_work') w ON w->>'kind'='breakdown_replacement' AND w->>'run_id'=o->>'id'
   UNION SELECT o->>'original_driver_id' FROM jsonb_array_elements(f->'deliveries') o JOIN jsonb_array_elements(f->'special_work') w ON w->>'kind'='breakdown_replacement' AND w->>'run_id'=o->>'run_id'
  ) SELECT ids.id,coalesce(p.display_name,'未列於司機名冊') name FROM ids LEFT JOIN public.profiles p ON p.id::text=ids.id WHERE ids.id IS NOT NULL ORDER BY ids.id
 LOOP
  parts:='{"per_run":0,"rental":0,"adjustment":0}';driver_issues:='[]';
  FOR x IN
   SELECT 'per_run' kind,q item,q->>'id' source FROM jsonb_array_elements(f->'deliveries') q WHERE q->>'driver_id'=d.id
   UNION ALL SELECT 'rental',q,q->>'id' FROM jsonb_array_elements(f->'deliveries') q WHERE q->>'driver_id'=d.id AND q->>'is_rental'='true'
   UNION ALL SELECT 'adjustment',q,'adjustment:'||(q->>'id') FROM jsonb_array_elements(b->'adjustments') q WHERE q->>'driver_id'=d.id
  LOOP
   rate:=NULL;code:=NULL;message:=NULL;date_text:=x.item->>'service_date';
   label:='租車費用';
   IF x.kind='per_run' THEN
    SELECT q INTO rate FROM jsonb_array_elements(b->'route_rates') q WHERE q->>'route_id'=x.item->>'route_id';
    amount:=(rate->>'amount')::numeric;
    valid:=coalesce(amount>=0 AND amount=trunc(amount,2) AND abs(amount)*100<=9007199254740991 AND rate->>'region_id' IS NOT NULL
     AND nullif(x.item->>'route_temperature_zone','') IS NOT NULL AND rate->>'zone_name'=x.item->>'route_temperature_zone',false);
    IF NOT valid THEN code:='route_rate_missing';message:='路線管理費率未設定，或目前溫層與結案紀錄不符';END IF;
    line:=jsonb_build_object('routeId',x.item->'route_id','routeName',coalesce(x.item->>'route_name_snapshot',''),'temperatureZone',coalesce(x.item->>'route_temperature_zone',''),
     'ruleId',CASE WHEN valid THEN 'route:'||(rate->>'region_id')||':'||(rate->>'zone_name') END,'rateUpdatedAt',rate->'updated_at',
     'status',CASE WHEN valid THEN '路線管理目前費率（試算）' ELSE '待設定' END);
   ELSIF x.kind='adjustment' THEN
    amount:=(x.item->>'amount')::numeric;
    valid:=coalesce(amount=trunc(amount,2) AND abs(amount)*100<=9007199254740991 AND date_text::date>=p_month AND date_text::date<(p_month+interval '1 month')::date,false);
    IF NOT valid THEN code:='adjustment_invalid';message:='調整金額或月份無效';END IF;
    line:=jsonb_build_object('ruleId',NULL,'status','月報人工調整');
   ELSE
    SELECT q INTO rate FROM jsonb_array_elements(b->'supplements') q WHERE q->>'component'=x.kind AND q->>'effective_from'<=date_text ORDER BY q->>'effective_from' DESC,(q->>'id')::bigint DESC LIMIT 1;
    amount:=(rate->>'amount')::numeric;
    valid:=coalesce(amount>=0 AND amount=trunc(amount,2) AND abs(amount)*100<=9007199254740991,false);
    IF NOT valid THEN code:=x.kind||'_rate_missing';message:=CASE WHEN x.kind='rental' THEN '租車費用尚未設定，扣款待確認' ELSE label||'尚未設定' END;END IF;
    IF x.kind='rental' THEN amount:=-amount;END IF;
    line:=jsonb_build_object('ruleId',rate->'id','status',CASE WHEN NOT valid THEN '待設定' WHEN x.kind='rental' THEN '自薪資扣除' ELSE '加入薪資' END);
   END IF;
   IF NOT valid THEN amount:=NULL;END IF;
   parts:=jsonb_set(parts,ARRAY[x.kind],coalesce(to_jsonb((parts->>x.kind)::numeric+amount),'null'::jsonb));
   lines:=lines||jsonb_build_array(line||jsonb_build_object('driverId',d.id,'date',date_text,'source',x.source,'kind',x.kind,'quantity',1,
    'amount',amount,'closeEventId',CASE WHEN x.kind='adjustment' THEN NULL ELSE x.item->'close_event_id' END));
   IF code IS NOT NULL THEN driver_issues:=driver_issues||jsonb_build_array(jsonb_build_object('code',code,'driverId',d.id,'date',date_text,'source',x.source,'message',message));END IF;
  END LOOP;
  FOR r IN SELECT q FROM jsonb_array_elements(f->'deliveries') q WHERE q->>'driver_id'=d.id AND (q->>'is_rental' IS NULL OR q->>'is_rental' NOT IN ('true','false')) LOOP
   parts:=jsonb_set(parts,'{rental}','null');
   driver_issues:=driver_issues||jsonb_build_array(jsonb_build_object('code','rental_unknown','driverId',d.id,'date',r->>'service_date','source',r->>'id','message','結案快照的租車狀態未確認，扣款待確認'));
  END LOOP;
  FOR r IN SELECT q FROM jsonb_array_elements(f->'special_work') q WHERE q->>'kind' NOT IN ('follow_along','learning') AND
   (q->>'driver_id'=d.id OR (q->>'kind'='breakdown_replacement' AND (
    EXISTS(SELECT 1 FROM jsonb_array_elements(f->'original_runs') o WHERE o->>'id'=q->>'run_id' AND o->>'driver_id'=d.id)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(f->'deliveries') o WHERE o->>'run_id'=q->>'run_id' AND o->>'original_driver_id'=d.id)))) LOOP
   label:=CASE r->>'kind' WHEN 'attached_support' THEN '附屬支援' WHEN 'breakdown_replacement' THEN '故障接替' ELSE '特殊勤務' END;
   driver_issues:=driver_issues||jsonb_build_array(jsonb_build_object('code','special_pay','driverId',d.id,'date',r->>'service_date','source','special:'||(r->>'id'),'message',label||'計酬歸屬與金額待確認；不另增加配送總趟次'));
   lines:=lines||jsonb_build_array(jsonb_build_object('driverId',d.id,'date',r->>'service_date','source','special:'||(r->>'id'),'kind',r->>'kind','quantity',NULL,'ruleId',NULL,'amount',NULL,'closeEventId',r->'close_event_id','status',label||'待對帳'));
  END LOOP;
  FOR r IN SELECT q FROM jsonb_array_elements(f->'attendance_records') q WHERE q->>'driver_id'=d.id LOOP
   driver_issues:=driver_issues||jsonb_build_array(jsonb_build_object('code','attendance_exception','driverId',d.id,'date',r->>'service_date','source','attendance:'||(r->>'id'),'message','出勤例外／原始代碼對薪資的影響待確認'));
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_each_text(parts) WHERE abs(value::numeric)*100>9007199254740991) THEN RAISE EXCEPTION '對帳金額超出安全計算範圍';END IF;
  SELECT CASE WHEN count(value)=3 THEN sum(value::numeric) END INTO subtotal FROM jsonb_each_text(parts);
  IF abs(subtotal)*100>9007199254740991 THEN RAISE EXCEPTION '對帳金額超出安全計算範圍';END IF;
  SELECT jsonb_build_object(
   'count',(SELECT count(*) FROM jsonb_array_elements(f->'deliveries') q WHERE q->>'driver_id'=d.id),
   'standbyCount',(SELECT count(*) FROM jsonb_array_elements(f->'standby') q WHERE q->>'driver_id'=d.id AND NOT coalesce((q->>'converted_to_support')::boolean,false)),
   'followAlongCount',(SELECT count(*) FROM jsonb_array_elements(f->'special_work') q WHERE q->>'driver_id'=d.id AND q->>'kind'='follow_along'),
   'learningCount',(SELECT count(*) FROM jsonb_array_elements(f->'special_work') q WHERE q->>'driver_id'=d.id AND q->>'kind'='learning'),
   'rentalCount',(SELECT count(*) FROM jsonb_array_elements(f->'deliveries') q WHERE q->>'driver_id'=d.id AND q->>'is_rental'='true'),
   'unknownRentalCount',(SELECT count(*) FROM jsonb_array_elements(f->'deliveries') q WHERE q->>'driver_id'=d.id AND q->>'is_rental' IS NULL)) INTO counts;
  summaries:=summaries||jsonb_build_array(counts||jsonb_build_object('driverId',d.id,'name',d.name,'basis','route_management',
   'variable',parts->'per_run',
   'rentalDeduction',parts->'rental','adjustment',parts->'adjustment','basicSubtotal',subtotal,'salary',CASE WHEN subtotal IS NOT NULL AND jsonb_array_length(driver_issues)=0 THEN subtotal END,'salaryReady',subtotal IS NOT NULL AND jsonb_array_length(driver_issues)=0,'knownItemsReady',subtotal IS NOT NULL,'issues',driver_issues));
  issues:=issues||driver_issues;
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(b->'expenses') LOOP
  issues:=issues||jsonb_build_array(jsonb_build_object('code','expense_treatment','driverId',coalesce(r->>'driver_id',''),'date',r->>'service_date','source','expense:'||(r->>'id'),'message','停車交通／零用金列為獨立費用；不自動併入薪資'));
 END LOOP;
 RETURN b||jsonb_build_object('calculation',jsonb_build_object('version',1415,'engine','database','month',to_char(p_month,'YYYY-MM'),
  'summaries',summaries,'lines',lines,'issues',issues,'expenses',b->'expenses','dates',f->'dates'));
END $function$;

-- Remove the trigger's column dependency explicitly; DROP COLUMN is RESTRICT.
DROP TRIGGER route_validate_v05 ON public.routes;
CREATE TRIGGER route_validate_v05 BEFORE INSERT OR UPDATE OF
 route_name,temperature_zone,default_start_time,default_end_time,active ON public.routes
 FOR EACH ROW EXECUTE FUNCTION private.validate_route_and_log();
ALTER TABLE public.routes DISABLE TRIGGER route_validate_v05;
ALTER TABLE public.routes ALTER COLUMN route_name SET NOT NULL;
ALTER TABLE public.routes ADD CONSTRAINT routes_name_present CHECK (length(btrim(route_name)) BETWEEN 1 AND 60);
ALTER TABLE public.routes DROP COLUMN route_code;
ALTER TABLE public.runs DROP COLUMN route_code_snapshot;
ALTER TABLE public.trip_executions DROP COLUMN route_code_snapshot;

-- Assert preservation of every field except the explicitly replaced labels.
DO $$ DECLARE t record; f text; BEGIN
 FOR t IN SELECT * FROM route1424_tables LOOP
  EXECUTE format('SELECT md5(coalesce(jsonb_agg(x ORDER BY x)::text,''[]'')) FROM (SELECT private.dashboard1424_labels(to_jsonb(r),true) AS x FROM public.%I r) q',t.name) INTO f;
  IF f IS DISTINCT FROM t.fingerprint THEN RAISE EXCEPTION 'Route-name migration changed business data in %',t.name; END IF;
 END LOOP;
 FOR t IN SELECT * FROM route1424_triggers LOOP
  EXECUTE format('ALTER TABLE public.%I %s TRIGGER %I',t.table_name,
   CASE t.tgenabled WHEN 'D' THEN 'DISABLE' WHEN 'A' THEN 'ENABLE ALWAYS' WHEN 'R' THEN 'ENABLE REPLICA' ELSE 'ENABLE' END,t.tgname);
 END LOOP;
END $$;
DROP FUNCTION private.dashboard1424_labels(jsonb,boolean);
NOTIFY pgrst, 'reload schema';
COMMIT;

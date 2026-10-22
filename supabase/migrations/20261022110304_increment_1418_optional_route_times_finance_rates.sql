-- 1.4.18: optional route times and finance-owner-only delivery rates.
-- Keep existing routes, time snapshots, prices and confirmed attendance intact.
BEGIN;

CREATE FUNCTION private.dashboard1418_known_period(p_start timestamp, p_end timestamp, p_bounds text)
RETURNS tsrange LANGUAGE sql IMMUTABLE STRICT SET search_path = ''
AS $$ SELECT pg_catalog.tsrange(p_start,p_end,p_bounds) $$;
REVOKE ALL ON FUNCTION private.dashboard1418_known_period(timestamp,timestamp,text) FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION private.dashboard1418_known_period(timestamp,timestamp,text)
IS 'Unknown route times have no known overlap interval; NULL must never become an unbounded tsrange.';

CREATE OR REPLACE FUNCTION private.dashboard1411_check_follow_conflict(p_date date, p_driver uuid, p_start time without time zone, p_end time without time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF p_start IS NULL OR p_end IS NULL THEN RETURN;END IF;
 IF EXISTS(SELECT 1 FROM public.attendance_duty_entries w JOIN public.runs r ON r.id=w.linked_run_id WHERE w.driver_id=p_driver AND w.status='active'
  AND private.dashboard1418_known_period(r.service_date+r.planned_start_time,r.service_date+r.planned_end_time+CASE WHEN r.planned_end_time<r.planned_start_time THEN interval '1 day' ELSE interval '0 day' END,'[)')
   && private.dashboard1418_known_period(p_date+p_start,p_date+p_end+CASE WHEN p_end<p_start THEN interval '1 day' ELSE interval '0 day' END,'[)')) THEN RAISE EXCEPTION '司機已有重疊跟車勤務';END IF;
END;$function$
;

CREATE OR REPLACE FUNCTION private.dashboard143_check_conflict(p_date date, p_driver uuid, p_vehicle bigint, p_route bigint, p_ignore bigint DEFAULT NULL::bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE r public.routes%ROWTYPE;hit bigint;
BEGIN
 SELECT * INTO r FROM public.routes WHERE id=p_route;
 SELECT q.id INTO hit FROM public.runs q JOIN public.routes qr ON qr.id=q.route_id
 WHERE q.id IS DISTINCT FROM p_ignore AND q.status::text<>'cancelled'
  AND (q.driver_id=p_driver OR q.vehicle_id=p_vehicle) AND q.service_date BETWEEN p_date-1 AND p_date+1
  AND private.dashboard1418_known_period(p_date+r.default_start_time,p_date+r.default_end_time+CASE WHEN r.default_end_time<r.default_start_time THEN interval '1 day' ELSE interval '0 day' END,'[)')
  && private.dashboard1418_known_period(q.service_date+coalesce(q.planned_start_time,qr.default_start_time),q.service_date+coalesce(q.planned_end_time,qr.default_end_time)
   +CASE WHEN coalesce(q.planned_end_time,qr.default_end_time)<coalesce(q.planned_start_time,qr.default_start_time) THEN interval '1 day' ELSE interval '0 day' END,'[)') LIMIT 1;
 IF hit IS NOT NULL THEN RAISE EXCEPTION '日期 % 的司機或車輛時段與趟次 #% 重疊（含跨日）',p_date,hit;END IF;
END;$function$
;

CREATE OR REPLACE FUNCTION private.dashboard143_normalize_rows(p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE x jsonb;outrows jsonb:='[]'::jsonb;k text;keys text[]:='{}';r public.routes%ROWTYPE;
 c text;n integer;rid bigint;vid bigint;
BEGIN
 IF p_rows IS NULL OR jsonb_typeof(p_rows)<>'array' OR jsonb_array_length(p_rows) NOT BETWEEN 1 AND 150
 THEN RAISE EXCEPTION '請建立 1 至 150 筆完整的單日預排趟次';END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
  c:=x->>'category';
  IF jsonb_typeof(x)<>'object' OR c IS NULL OR c NOT IN ('日配','OC','鮮二','冷凍','低鮮')
   OR coalesce(x->>'slot_index','')!~'^[0-9]{1,2}$'
   OR coalesce(x->>'route_id','')!~'^[1-9][0-9]*$' OR coalesce(x->>'vehicle_id','')!~'^[1-9][0-9]*$'
  THEN RAISE EXCEPTION '每趟需指定出勤類別、欄位、路線及車號';END IF;
  n:=(x->>'slot_index')::integer;rid:=(x->>'route_id')::bigint;vid:=(x->>'vehicle_id')::bigint;
  IF n NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION '出勤欄位序號須為 1–30';END IF;
  k:=c||':'||n;
  IF k=ANY(keys) THEN RAISE EXCEPTION '%第%趟重複',c,n;END IF;keys:=array_append(keys,k);
  SELECT * INTO r FROM public.routes WHERE id=rid AND active FOR SHARE;
  IF NOT FOUND OR nullif(btrim(r.temperature_zone),'') IS NULL
   THEN RAISE EXCEPTION '路線 % 未啟用或缺少溫層',rid;END IF;
  IF NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=vid AND active) THEN RAISE EXCEPTION '車輛 % 不存在或未啟用',vid;END IF;
  outrows:=outrows||jsonb_build_array(jsonb_build_object('category',c,'slot_index',n,'route_id',rid,'vehicle_id',vid));
 END LOOP;
 -- One driver cannot run two independent regular routes at the same time.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(outrows) WITH ORDINALITY a(x,i)
 JOIN jsonb_array_elements(outrows) WITH ORDINALITY b(x,i) ON a.i<b.i
 JOIN public.routes ar ON ar.id=(a.x->>'route_id')::bigint
 JOIN public.routes br ON br.id=(b.x->>'route_id')::bigint
 WHERE private.dashboard1418_known_period(date '2000-01-01'+ar.default_start_time,date '2000-01-01'+ar.default_end_time+CASE WHEN ar.default_end_time<ar.default_start_time THEN interval '1 day' ELSE interval '0 day' END,'[)')
 && private.dashboard1418_known_period(date '2000-01-01'+br.default_start_time,date '2000-01-01'+br.default_end_time+CASE WHEN br.default_end_time<br.default_start_time THEN interval '1 day' ELSE interval '0 day' END,'[)'))
 THEN RAISE EXCEPTION '單日範本包含重疊的固定路線時段';END IF;
 RETURN outrows;
END;$function$
;

CREATE OR REPLACE FUNCTION private.prevent_run_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  start_t time; end_t time; zone_t text; code_t text;
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
    select r.default_start_time,r.default_end_time,r.temperature_zone,r.route_code
      into start_t,end_t,zone_t,code_t from public.routes r where r.id=new.route_id;
    if nullif(btrim(coalesce(zone_t,'')),'') is null then
      raise exception '路線缺少有效的溫層，請先至路線管理設定';
    end if;
    new.planned_start_time := start_t;
    new.planned_end_time := end_t;
    new.temperature_zone_snapshot := zone_t;
    new.route_code_snapshot := code_t;
  else
    -- Source snapshots are immutable even if the client attempts to edit them.
    new.planned_start_time := old.planned_start_time;
    new.planned_end_time := old.planned_end_time;
    new.temperature_zone_snapshot := old.temperature_zone_snapshot;
    new.route_code_snapshot := old.route_code_snapshot;
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
$function$
;

CREATE OR REPLACE FUNCTION private.validate_route_and_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_dispatcher() then raise exception '只有主管可以修改配送路線'; end if;
  new.route_code := btrim(new.route_code);
  if tg_op='UPDATE' and new.active=false and old.active is distinct from new.active
      and row(new.route_code,new.route_name,new.temperature_zone,new.default_start_time,new.default_end_time)
         is not distinct from
          row(old.route_code,old.route_name,old.temperature_zone,old.default_start_time,old.default_end_time) then
    return new; -- Allow the supervisor to deactivate a legacy/incomplete route.
  end if;
  new.route_name := nullif(btrim(coalesce(new.route_name,'')),'');
  new.temperature_zone := nullif(btrim(coalesce(new.temperature_zone,'')),'');
  if new.route_code = '' then raise exception '必須填寫路線編號'; end if;
  if new.temperature_zone is null then raise exception '必須設定溫層'; end if;
  if (new.default_start_time is null) <> (new.default_end_time is null)
      or new.default_start_time = new.default_end_time then
    raise exception '歷史路線時段須同時提供不同的開始與結束時間，或全部留空';
  end if;
  return new;
end;
$function$
;

ALTER POLICY drz_select ON public.delivery_region_zone_rates
 USING ((SELECT private.can_manage_finance()));
ALTER POLICY drz_write ON public.delivery_region_zone_rates
 USING ((SELECT private.can_manage_finance()))
 WITH CHECK ((SELECT private.can_manage_finance()));
ALTER POLICY drza_read ON public.delivery_region_zone_rate_audit
 USING ((SELECT private.can_manage_finance()));
-- Trigger execution remains available; this audit trigger is not a public RPC.
REVOKE ALL ON FUNCTION public.route_catalog_rate_audit() FROM PUBLIC,anon,authenticated;

-- FK cascades bypass child-table RLS. Keep category deletion from becoming
-- an indirect way for another dispatcher to delete the owner's rates.
CREATE FUNCTION private.dashboard1418_protect_priced_category()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF coalesce(private.can_manage_finance(),false) THEN RETURN OLD;END IF;
 IF TG_TABLE_NAME='delivery_regions' THEN
  IF EXISTS(SELECT 1 FROM public.delivery_region_zone_rates WHERE region_id=OLD.id)
   THEN RAISE EXCEPTION '此地區已有費率，僅 Brian 可移除';END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.delivery_region_zone_rates WHERE zone_name=OLD.name)
   THEN RAISE EXCEPTION '此溫層已有費率，僅 Brian 可移除';END IF;
 END IF;
 RETURN OLD;
END;$$;
REVOKE ALL ON FUNCTION private.dashboard1418_protect_priced_category() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER dashboard1418_protect_priced_region BEFORE DELETE ON public.delivery_regions
FOR EACH ROW EXECUTE FUNCTION private.dashboard1418_protect_priced_category();
CREATE TRIGGER dashboard1418_protect_priced_zone BEFORE DELETE ON public.delivery_temperature_zones
FOR EACH ROW EXECUTE FUNCTION private.dashboard1418_protect_priced_category();
COMMIT;


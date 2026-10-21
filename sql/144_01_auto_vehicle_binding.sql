-- Increment 1.4.4: persistent many-to-many driver/vehicle bindings, rental derived at assignment time.
-- Preserve historic run, execution and financial snapshots. New assignments use dated binding.
-- No data deletion. Rollback requires a new migration; do not silently recreate old uniqueness.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
DO $preflight$
BEGIN
 IF to_regclass('public.vehicle_owner_bindings') IS NULL OR to_regclass('public.runs') IS NULL
    OR to_regclass('public.trip_executions') IS NULL OR to_regclass('public.daily_attendance_extra_trips') IS NULL
    OR to_regclass('public.driver_day_templates') IS NULL
 THEN RAISE EXCEPTION '請先部署 Increment 1.4.3 及既有派車資料表'; END IF;
 IF to_regprocedure('private.dashboard143_normalize_rows(jsonb)') IS NULL
 THEN RAISE EXCEPTION '缺少 1.4.3 範本驗證函式'; END IF;
END;$preflight$;

-- Vehicle <-> driver is many-to-many; prevent overlap of the *same pair* only.
-- Existing dates remain meaningful: NULL effective_to = open-ended until dispatcher edits it.
ALTER TABLE public.vehicle_owner_bindings
 DROP CONSTRAINT IF EXISTS vehicle_owner_bindings_vehicle_id_effective_from_key;
ALTER TABLE public.vehicle_owner_bindings
 ADD CONSTRAINT vehicle_owner_bindings_pair_from_key UNIQUE(vehicle_id,driver_id,effective_from);
CREATE OR REPLACE FUNCTION public.guard_vehicle_binding_overlap()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $func$
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
   'vehicle-driver-pair:'||NEW.vehicle_id::text||'/'||NEW.driver_id::text,0));
 IF EXISTS(SELECT 1 FROM public.vehicle_owner_bindings b
  WHERE b.vehicle_id=NEW.vehicle_id AND b.driver_id=NEW.driver_id
   AND b.id<>COALESCE(NEW.id,-1)
   AND daterange(b.effective_from,coalesce(b.effective_to,'infinity'::date),'[]')
    && daterange(NEW.effective_from,coalesce(NEW.effective_to,'infinity'::date),'[]'))
 THEN RAISE EXCEPTION '同一位司機與同一車輛的綁定生效期間不得重疊'; END IF;
 RETURN NEW;
END;$func$;

CREATE OR REPLACE FUNCTION private.dashboard144_rental(p_date date,p_driver uuid,p_vehicle bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $sql$
 SELECT NOT EXISTS (SELECT 1 FROM public.vehicle_owner_bindings b
  WHERE b.driver_id=p_driver AND b.vehicle_id=p_vehicle
   AND b.effective_from<=p_date AND (b.effective_to IS NULL OR b.effective_to>=p_date));
$sql$;
REVOKE ALL ON FUNCTION private.dashboard144_rental(date,uuid,bigint) FROM PUBLIC,anon,authenticated;

-- Runs: compute from the date and pairing on assignment insert/change.
-- Do not reclassify old runs during an unrelated status/note change.
CREATE OR REPLACE FUNCTION private.dashboard144_rental_run()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $func$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.is_rental:=private.dashboard144_rental(NEW.service_date,NEW.driver_id,NEW.vehicle_id);
 ELSIF (NEW.service_date,NEW.driver_id,NEW.vehicle_id) IS DISTINCT FROM
   (OLD.service_date,OLD.driver_id,OLD.vehicle_id) THEN
  NEW.is_rental:=private.dashboard144_rental(NEW.service_date,NEW.driver_id,NEW.vehicle_id);
 ELSE NEW.is_rental:=OLD.is_rental; END IF;
 RETURN NEW;
END;$func$;
DROP TRIGGER IF EXISTS aaa_dashboard144_rental_run ON public.runs;
-- Must fire before dispatch_route_overlap_guard, which requires a non-NULL rental value.
CREATE TRIGGER aaa_dashboard144_rental_run
 BEFORE INSERT OR UPDATE OF service_date,driver_id,vehicle_id,is_rental ON public.runs
 FOR EACH ROW EXECUTE FUNCTION private.dashboard144_rental_run();

-- Confirmed execution rows are historical snapshots; never retroactively rewrite them.
-- New execution rows derive rental from the *actual* driver/vehicle captured by the completion flow.
CREATE OR REPLACE FUNCTION private.dashboard144_rental_execution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $func$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.is_rental:=private.dashboard144_rental(NEW.service_date,NEW.driver_id,NEW.vehicle_id);
 ELSIF (NEW.service_date,NEW.driver_id,NEW.vehicle_id) IS DISTINCT FROM (OLD.service_date,OLD.driver_id,OLD.vehicle_id)
       AND OLD.review_status<>'confirmed' THEN
  NEW.is_rental:=private.dashboard144_rental(NEW.service_date,NEW.driver_id,NEW.vehicle_id);
 ELSE NEW.is_rental:=OLD.is_rental; END IF;
 RETURN NEW;
END;$func$;
DROP TRIGGER IF EXISTS aaa_dashboard144_rental_execution ON public.trip_executions;
CREATE TRIGGER aaa_dashboard144_rental_execution
 BEFORE INSERT OR UPDATE OF service_date,driver_id,vehicle_id,is_rental ON public.trip_executions
 FOR EACH ROW EXECUTE FUNCTION private.dashboard144_rental_execution();

-- Extra actual trips: preserve last snapshot on void, recalculate on reactivation or change.
CREATE OR REPLACE FUNCTION private.dashboard144_rental_extra()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $func$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.is_rental:=private.dashboard144_rental(NEW.service_date,NEW.driver_id,NEW.actual_vehicle_id);
 ELSIF NEW.status='active' AND
   (NEW.service_date,NEW.driver_id,NEW.actual_vehicle_id,NEW.status) IS DISTINCT FROM
   (OLD.service_date,OLD.driver_id,OLD.actual_vehicle_id,OLD.status) THEN
  NEW.is_rental:=private.dashboard144_rental(NEW.service_date,NEW.driver_id,NEW.actual_vehicle_id);
 ELSE NEW.is_rental:=OLD.is_rental; END IF;
 RETURN NEW;
END;$func$;
DROP TRIGGER IF EXISTS aaa_dashboard144_rental_extra ON public.daily_attendance_extra_trips;
CREATE TRIGGER aaa_dashboard144_rental_extra
 BEFORE INSERT OR UPDATE OF service_date,driver_id,actual_vehicle_id,is_rental,status ON public.daily_attendance_extra_trips
 FOR EACH ROW EXECUTE FUNCTION private.dashboard144_rental_extra();

-- Day templates are date-less: store route/vehicle, NEVER a timeless rental flag.
CREATE OR REPLACE FUNCTION private.dashboard143_normalize_rows(p_rows jsonb) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
  IF NOT FOUND OR r.temperature_zone IS NULL OR r.default_start_time IS NULL OR r.default_end_time IS NULL
   OR r.default_start_time=r.default_end_time THEN RAISE EXCEPTION '路線 % 未啟用或缺少固定溫層／時段',rid;END IF;
  IF NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=vid AND active) THEN RAISE EXCEPTION '車輛 % 不存在或未啟用',vid;END IF;
  outrows:=outrows||jsonb_build_array(jsonb_build_object('category',c,'slot_index',n,'route_id',rid,'vehicle_id',vid));
 END LOOP;
 -- One driver cannot run two independent regular routes at the same time.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(outrows) WITH ORDINALITY a(x,i)
 JOIN jsonb_array_elements(outrows) WITH ORDINALITY b(x,i) ON a.i<b.i
 JOIN public.routes ar ON ar.id=(a.x->>'route_id')::bigint
 JOIN public.routes br ON br.id=(b.x->>'route_id')::bigint
 WHERE tsrange(date '2000-01-01'+ar.default_start_time,date '2000-01-01'+ar.default_end_time+CASE WHEN ar.default_end_time<ar.default_start_time THEN interval '1 day' ELSE interval '0 day' END,'[)')
 && tsrange(date '2000-01-01'+br.default_start_time,date '2000-01-01'+br.default_end_time+CASE WHEN br.default_end_time<br.default_start_time THEN interval '1 day' ELSE interval '0 day' END,'[)'))
 THEN RAISE EXCEPTION '單日範本包含重疊的固定路線時段';END IF;
 RETURN outrows;
END;$$;


-- Strip obsolete manual flags from the current template only (no scheduled runs altered).
-- Bump revision so a stale editor cannot overwrite this cleanup.
UPDATE public.driver_day_templates t
SET rows=(SELECT jsonb_agg(a.value-'is_rental' ORDER BY a.ordinality)
          FROM jsonb_array_elements(t.rows) WITH ORDINALITY AS a(value,ordinality)),
    revision=t.revision+1,
    updated_at=now()
WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(t.rows) AS rowobj(value) WHERE rowobj.value ? 'is_rental');
COMMIT;

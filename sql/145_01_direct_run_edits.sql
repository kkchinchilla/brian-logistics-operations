-- Increment 1.4.5: one editable run, one canonical record. No new run-edit audits.
-- Existing confirmed/completed execution data, payroll, special duties and leave protections remain intact.
-- Existing observations are merged into the run on the NEXT successful edit of that run.
-- No mass overwrite or deletion of operational records. Apply once after 144.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';

DO $preflight$
DECLARE f text;
BEGIN
 FOREACH f IN ARRAY ARRAY[
  'public.runs','public.daily_run_observations','public.trip_executions',
  'public.attendance_driver_days','public.daily_attendance_closeouts'
 ] LOOP
  IF to_regclass(f) IS NULL THEN RAISE EXCEPTION '缺少先決資料表 %',f; END IF;
 END LOOP;
 FOREACH f IN ARRAY ARRAY[
  'private.dashboard143_lock()','private.dashboard143_open_day(date)',
  'public.protect_run_assignment()','private.guard_run_route_facts()',
  'private.prevent_run_overlap()','private.dashboard144_rental(date,uuid,bigint)'
 ] LOOP
  IF to_regprocedure(f) IS NULL THEN RAISE EXCEPTION '缺少先決函式 %',f; END IF;
 END LOOP;
END $preflight$;

-- Only a trusted, authorization-checked RPC may enable its own narrow run edit.
-- Browser clients cannot arbitrarily update another driver's assignment.
CREATE OR REPLACE FUNCTION private.dashboard145_direct_edit_allowed(p_run_id bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT auth.uid() IS NOT NULL
  AND current_setting('app.dashboard145_direct_run',true)=(auth.uid()::text||':'||p_run_id::text);
$fn$;
REVOKE ALL ON FUNCTION private.dashboard145_direct_edit_allowed(bigint) FROM PUBLIC,anon,authenticated;

-- Preserve legacy trigger implementations and modify ONLY the three exact
-- guard expressions needed to allow trusted driver edits. Fail if their source
-- does not match the inspected baseline instead of silently weakening security.
DO $patch$
DECLARE definition text; target regprocedure;
BEGIN
 target:='public.protect_run_assignment()'::regprocedure;
 definition:=pg_get_functiondef(target);
 IF position('    -- Drivers cannot change assignment information' in definition)=0
    OR position('    -- Drivers may only edit their own run' in definition)=0
 THEN RAISE EXCEPTION 'protect_run_assignment 與已審查版本不同，停止';END IF;
 definition:=replace(definition,'    -- Drivers cannot change assignment information',
 $inject$    -- One narrow direct-edit path, issued only by dashboard_edit_run_direct.
    IF private.dashboard145_direct_edit_allowed(old.id)
       AND old.driver_id=auth.uid()
       AND old.status::text IN ('assigned','in_progress')
       AND row(new.driver_id,new.service_date,new.status,new.attendance_category,new.attendance_slot_index)
         IS NOT DISTINCT FROM
         row(old.driver_id,old.service_date,old.status,old.attendance_category,old.attendance_slot_index)
    THEN RETURN new;END IF;

    -- Drivers cannot change assignment information$inject$);
 EXECUTE definition;

 target:='private.guard_run_route_facts()'::regprocedure;
 definition:=pg_get_functiondef(target);
 IF position('if not private.is_dispatcher()' in definition)=0 THEN
  RAISE EXCEPTION 'guard_run_route_facts 與已審查版本不同，停止';END IF;
 definition:=replace(definition,'if not private.is_dispatcher()',
 'if not private.is_dispatcher() and not private.dashboard145_direct_edit_allowed(old.id)');
 EXECUTE definition;

 target:='private.prevent_run_overlap()'::regprocedure;
 definition:=pg_get_functiondef(target);
 IF position('and not private.is_dispatcher() then' in definition)=0 THEN
  RAISE EXCEPTION 'prevent_run_overlap 與已審查版本不同，停止';END IF;
 definition:=replace(definition,'and not private.is_dispatcher() then',
 'and not private.is_dispatcher() and not private.dashboard145_direct_edit_allowed(old.id) then');
 EXECUTE definition;
END $patch$;

-- A single user-facing change overwrites the current route, vehicle and note.
-- Legacy observation values are read as the editor's initial values and then
-- consolidated, not appended as a second record. Revision checks detect races.
CREATE OR REPLACE FUNCTION public.dashboard_edit_run_direct(
 p_run_id bigint,p_route_id bigint,p_vehicle_id bigint,p_note text,
 p_expected_run_revision integer,p_expected_observation_revision integer DEFAULT 0,
 p_cancel boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE r public.runs%ROWTYPE; o public.daily_run_observations%ROWTYPE;
 actor uuid; is_supervisor boolean; next_revision integer;
BEGIN
 PERFORM private.dashboard143_lock();
 actor:=auth.uid();
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=actor AND p.active)
 THEN RAISE EXCEPTION '請使用有效帳號登入' USING ERRCODE='42501';END IF;
 is_supervisor:=private.is_dispatcher();
 IF p_run_id IS NULL OR p_expected_run_revision IS NULL OR p_expected_observation_revision IS NULL
 THEN RAISE EXCEPTION '缺少趟次版本資料，請重新整理';END IF;
 SELECT * INTO r FROM public.runs WHERE id=p_run_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到此趟次';END IF;
 IF NOT is_supervisor AND r.driver_id<>actor
 THEN RAISE EXCEPTION '只能修改本人的配送資料' USING ERRCODE='42501';END IF;
 PERFORM private.dashboard143_open_day(r.service_date);
 IF EXISTS(SELECT 1 FROM public.attendance_driver_days
           WHERE service_date=r.service_date AND driver_id=r.driver_id AND is_leave)
 THEN RAISE EXCEPTION '此司機當日休假，不可修改配送';END IF;
 IF r.dashboard_schedule_revision<>p_expected_run_revision
 THEN RAISE EXCEPTION '趟次已被其他人更新，請重新整理';END IF;
 IF (coalesce(p_cancel,false) AND (NOT is_supervisor OR r.status::text<>'assigned'))
 THEN RAISE EXCEPTION '只有主管可以取消尚未開始的趟次';END IF;
 IF r.status::text NOT IN ('assigned','in_progress')
 THEN RAISE EXCEPTION '已完成或取消的趟次，請使用既有更正流程';END IF;
 IF EXISTS(SELECT 1 FROM public.trip_executions WHERE run_id=r.id)
 THEN RAISE EXCEPTION '已有實際執行紀錄，不可直接修改';END IF;
 SELECT * INTO o FROM public.daily_run_observations WHERE run_id=r.id FOR UPDATE;
 IF coalesce(o.revision,0)<>p_expected_observation_revision
 THEN RAISE EXCEPTION '配送資料已被其他人更新，請重新整理';END IF;
 IF NOT coalesce(p_cancel,false) AND (p_route_id IS NULL OR p_vehicle_id IS NULL)
 THEN RAISE EXCEPTION '請同時選擇路線與車號；取消趟次請使用取消功能';END IF;
 IF NOT coalesce(p_cancel,false) AND
   (NOT EXISTS(SELECT 1 FROM public.routes WHERE id=p_route_id AND active)
    OR NOT EXISTS(SELECT 1 FROM public.vehicles WHERE id=p_vehicle_id AND active))
 THEN RAISE EXCEPTION '路線或車輛不存在、未啟用';END IF;
 IF length(coalesce(p_note,''))>1000 THEN RAISE EXCEPTION '備註不能超過 1000 字';END IF;
 -- The transaction rolls back all changes if a dispatch conflict or guard fails.
 PERFORM pg_catalog.set_config('app.dashboard145_direct_run',actor::text||':'||r.id::text,true);
 IF o.id IS NOT NULL THEN
   DELETE FROM public.daily_run_observations WHERE id=o.id;
 END IF;
 IF coalesce(p_cancel,false) THEN
   UPDATE public.runs SET status='cancelled',
    dispatcher_notes=nullif(btrim(coalesce(p_note,'')),'')
   WHERE id=r.id RETURNING dashboard_schedule_revision INTO next_revision;
 ELSE
   UPDATE public.runs SET route_id=p_route_id,vehicle_id=p_vehicle_id,
    dispatcher_notes=nullif(btrim(coalesce(p_note,'')),'')
   WHERE id=r.id RETURNING dashboard_schedule_revision INTO next_revision;
 END IF;
 PERFORM pg_catalog.set_config('app.dashboard145_direct_run','',true);
 RETURN jsonb_build_object('run_id',r.id,'revision',next_revision,'cancelled',coalesce(p_cancel,false));
END $fn$;
REVOKE ALL ON FUNCTION public.dashboard_edit_run_direct(bigint,bigint,bigint,text,integer,integer,boolean)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_edit_run_direct(bigint,bigint,bigint,text,integer,integer,boolean)
 TO authenticated;

-- No new observation writes: older cached frontends must hard refresh.
REVOKE ALL ON FUNCTION public.dashboard_save_actual_observation(bigint,bigint,bigint,text,integer)
 FROM PUBLIC,anon,authenticated;

-- Do not append run/schedule/extra-trip edit snapshots to history tables.
-- Keep previous audit tables/data for now; no user-facing audit interface is needed.
DROP TRIGGER IF EXISTS zzz_dashboard143_audit ON public.runs;
DROP TRIGGER IF EXISTS zzz_dashboard143_audit ON public.attendance_driver_days;
DROP TRIGGER IF EXISTS zzz_dashboard143_audit ON public.driver_day_templates;
DROP TRIGGER IF EXISTS dashboard_log_daily_observation ON public.daily_run_observations;
DROP TRIGGER IF EXISTS dashboard_log_extra_trip ON public.daily_attendance_extra_trips;
COMMIT;

-- Increment 1.4.7: monthly attendance is finalized by 結案 only.
-- No historical events, runs, executions, approvals or payroll rules are rewritten.
BEGIN;
CREATE OR REPLACE FUNCTION private.dashboard147_normalize_snapshot(p_snapshot jsonb, p_enrich boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
<<normalize>>
DECLARE
 r jsonb; o jsonb; w jsonb; x jsonb; item jsonb;
 delivery jsonb := '[]'; work_rows jsonb := '[]'; shift_rows jsonb := '[]'; attendance_rows jsonb := '[]';
 route_id bigint; vehicle_id bigint; driver_id uuid; route_code text; zone text; plate text; rental boolean;
BEGIN
 FOR r IN SELECT value FROM jsonb_array_elements(coalesce(p_snapshot->'runs','[]')) LOOP
  IF r->>'status' IN ('cancelled','void') THEN CONTINUE; END IF;
  SELECT value INTO o FROM jsonb_array_elements(coalesce(p_snapshot->'observations','[]')) WHERE value->>'run_id'=r->>'id' LIMIT 1;
  SELECT value INTO w FROM jsonb_array_elements(coalesce(p_snapshot->'special_work','[]'))
   WHERE value->>'run_id'=r->>'id' AND value->>'kind'='breakdown_replacement' AND value->>'review_status'<>'rejected' LIMIT 1;
  route_id:=coalesce((o->>'actual_route_id')::bigint,(r->>'route_id')::bigint);
  vehicle_id:=coalesce((w->>'vehicle_id')::bigint,(o->>'actual_vehicle_id')::bigint,(r->>'vehicle_id')::bigint);
  driver_id:=coalesce((w->>'driver_id')::uuid,(r->>'driver_id')::uuid);
  route_code:=CASE WHEN route_id=(r->>'route_id')::bigint THEN r->>'route_code_snapshot' END;
  zone:=CASE WHEN route_id=(r->>'route_id')::bigint THEN r->>'temperature_zone_snapshot' END;
  rental:=CASE WHEN vehicle_id=(r->>'vehicle_id')::bigint AND driver_id=(r->>'driver_id')::uuid THEN (r->>'is_rental')::boolean END;
  plate:=NULL;
  IF p_enrich THEN
   SELECT coalesce(normalize.route_code,t.route_code),coalesce(normalize.zone,t.temperature_zone) INTO route_code,zone FROM public.routes t WHERE t.id=route_id;
   SELECT v.plate_number INTO plate FROM public.vehicles v WHERE v.id=vehicle_id;
   IF vehicle_id IS DISTINCT FROM (r->>'vehicle_id')::bigint OR driver_id IS DISTINCT FROM (r->>'driver_id')::uuid THEN
    rental:=private.dashboard144_rental((r->>'service_date')::date,driver_id,vehicle_id);
   END IF;
  END IF;
  item:=r||jsonb_build_object('id','run:'||(r->>'id'),'source_type','run','run_id',r->'id','extra_trip_id',NULL,
   'driver_id',driver_id,'vehicle_id',vehicle_id,'route_id',route_id,'route_code_snapshot',route_code,
   'route_temperature_zone',zone,'temperature_zone_snapshot',zone,'plate_snapshot',plate,'is_rental',rental,
   'driver_notes',coalesce(o->>'actual_note',r->>'dispatcher_notes',r->>'driver_notes',r->>'notes',''),
   'replacement_work_id',w->'id','original_driver_id',r->'driver_id','finalized',true);
  delivery:=delivery||jsonb_build_array(item);
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_snapshot->'extra_trips','[]')) WHERE value->>'status'='active' LOOP
  route_code:=NULL;zone:=NULL;plate:=NULL;
  IF p_enrich THEN
   SELECT t.route_code,t.temperature_zone INTO route_code,zone FROM public.routes t WHERE t.id=(x->>'actual_route_id')::bigint;
   SELECT v.plate_number INTO plate FROM public.vehicles v WHERE v.id=(x->>'actual_vehicle_id')::bigint;
  END IF;
  delivery:=delivery||jsonb_build_array(x||jsonb_build_object('id','extra:'||(x->>'id'),'source_type','extra','run_id',NULL,'extra_trip_id',x->'id',
   'route_id',x->'actual_route_id','vehicle_id',x->'actual_vehicle_id','route_code_snapshot',route_code,'route_temperature_zone',zone,
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
 RETURN jsonb_build_object('version',147,'deliveries',delivery,'special_work',work_rows,'standby',shift_rows,'attendance_records',attendance_rows);
END $$;
REVOKE ALL ON FUNCTION private.dashboard147_normalize_snapshot(jsonb,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.dashboard_close_attendance_through(p_through_date date,p_note text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE dates date[];snap jsonb;stamp timestamptz;event_id bigint;expired integer;
BEGIN
 PERFORM private.dashboard143_lock();PERFORM private.dashboard143_require_dispatcher();
 IF p_through_date IS NULL OR length(coalesce(p_note,''))>1000 THEN RAISE EXCEPTION '結案日期或備註不正確';END IF;
 SELECT coalesce(array_agg(d ORDER BY d),'{}'::date[]) INTO dates FROM (
  SELECT p_through_date d UNION SELECT service_date FROM public.runs UNION SELECT service_date FROM public.trip_executions
  UNION SELECT service_date FROM public.daily_attendance_extra_trips UNION SELECT service_date FROM public.attendance_driver_days
  UNION SELECT service_date FROM public.daily_attendance_slot_counts UNION SELECT service_date FROM public.attendance_records
  UNION SELECT service_date FROM public.v055_run_work UNION SELECT service_date FROM public.v055_standby_shifts
  UNION SELECT service_date FROM public.daily_attendance_closeouts
 ) known WHERE d<=p_through_date AND NOT private.dashboard146_is_closed(d);
 -- Preserve the exact current records at closing; pending proposals are not applied.
 SELECT jsonb_build_object(
  'runs',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.runs r WHERE service_date=ANY(dates)),'[]'::jsonb),
  'trip_executions',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.trip_executions r WHERE service_date=ANY(dates)),'[]'::jsonb),
  'observations',coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.id) FROM public.daily_run_observations o JOIN public.runs r ON r.id=o.run_id WHERE r.service_date=ANY(dates)),'[]'::jsonb),
  'extra_trips',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.daily_attendance_extra_trips r WHERE service_date=ANY(dates)),'[]'::jsonb),
  'driver_days',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY service_date,driver_id) FROM public.attendance_driver_days r WHERE service_date=ANY(dates)),'[]'::jsonb),
  'slot_counts',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY service_date,category) FROM public.daily_attendance_slot_counts r WHERE service_date=ANY(dates)),'[]'::jsonb),
  'attendance_records',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.attendance_records r WHERE service_date=ANY(dates)),'[]'::jsonb),
  'special_work',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.v055_run_work r WHERE service_date=ANY(dates)),'[]'::jsonb),
  'standby',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.v055_standby_shifts r WHERE service_date=ANY(dates)),'[]'::jsonb),
  'special_completions',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.v055_driver_work_completions c JOIN public.v055_run_work w ON w.id=c.work_id WHERE w.service_date=ANY(dates)),'[]'::jsonb)
 ) INTO snap;
 stamp:=clock_timestamp();
 -- Freeze reporting metadata in the same transaction as the original closing snapshot.
 snap := snap || jsonb_build_object('monthly_report',private.dashboard147_normalize_snapshot(snap,true));
 INSERT INTO public.attendance_closeout_events(action,through_date,actor_id,happened_at,reason,affected_dates,snapshot)
 VALUES('close',p_through_date,auth.uid(),stamp,btrim(coalesce(p_note,'')),dates,snap) RETURNING id INTO event_id;
 INSERT INTO public.daily_attendance_closeouts(service_date,closed_at,closed_by,supervisor_note,reopened_at,reopen_reason)
 SELECT d,stamp,auth.uid(),btrim(coalesce(p_note,'')),NULL,NULL FROM unnest(dates) d
 ON CONFLICT(service_date) DO UPDATE SET closed_at=excluded.closed_at,closed_by=excluded.closed_by,
 supervisor_note=excluded.supervisor_note,reopened_at=NULL,reopen_reason=NULL;
 UPDATE public.attendance_change_requests SET status='stale',revision=revision+1,reviewed_by=auth.uid(),reviewed_at=stamp,
 review_reason='出勤已結案；未核准的變更未套用，重新開啟後請重新送審'
 WHERE service_date<=p_through_date AND status='pending';
 GET DIAGNOSTICS expired=ROW_COUNT;
 RETURN jsonb_build_object('event_id',event_id,'through_date',p_through_date,'closed_dates',dates,'expired_requests',expired);
END;$$;


CREATE OR REPLACE FUNCTION private.dashboard147_monthly(p_month date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
 day date; finish date; event_row record; normalized jsonb; cache jsonb:='{}';
 deliveries jsonb:='[]'; shifts jsonb:='[]'; work_rows jsonb:='[]'; attendance_rows jsonb:='[]'; original_runs jsonb:='[]'; dates jsonb:='[]';
 rows_for_date jsonb; closed boolean; reopened bigint; stamp jsonb;
BEGIN
 IF NOT private.can_manage_finance() THEN RAISE EXCEPTION '僅 Brian 可查看月度報表' USING ERRCODE='42501'; END IF;
 IF p_month IS NULL OR extract(day from p_month)<>1 THEN RAISE EXCEPTION '請提供月份第一日'; END IF;
 finish:=(p_month+interval '1 month')::date;
 FOR day IN SELECT generate_series(p_month,finish-1,interval '1 day')::date LOOP
  SELECT max(id) INTO reopened FROM public.attendance_closeout_events WHERE action='reopen' AND through_date=day;
  SELECT e.* INTO event_row FROM public.attendance_closeout_events e
   WHERE e.action='close' AND day=ANY(e.affected_dates) AND e.id>coalesce(reopened,0) ORDER BY e.id DESC LIMIT 1;
  closed:=private.dashboard146_is_closed(day);
  dates:=dates||jsonb_build_array(jsonb_build_object('service_date',day,'status',CASE WHEN event_row.id IS NOT NULL AND closed THEN 'finalized'
    WHEN closed THEN 'closed_without_snapshot' WHEN reopened IS NOT NULL THEN 'reopened' ELSE 'open' END,'close_event_id',event_row.id,'closed_at',event_row.happened_at));
  IF event_row.id IS NULL OR NOT closed THEN CONTINUE; END IF;
  normalized:=cache->event_row.id::text;
  IF normalized IS NULL THEN
   normalized:=coalesce(event_row.snapshot->'monthly_report',private.dashboard147_normalize_snapshot(event_row.snapshot,false));
   cache:=cache||jsonb_build_object(event_row.id::text,normalized);
  END IF;
  stamp:=jsonb_build_object('close_event_id',event_row.id,'closed_at',event_row.happened_at,'legacy_snapshot',NOT(event_row.snapshot ? 'monthly_report'));
  SELECT coalesce(jsonb_agg(value||stamp),'[]') INTO rows_for_date FROM jsonb_array_elements(normalized->'deliveries') WHERE value->>'service_date'=day::text;
  deliveries:=deliveries||rows_for_date;
  SELECT coalesce(jsonb_agg(value||stamp),'[]') INTO rows_for_date FROM jsonb_array_elements(normalized->'standby') WHERE value->>'service_date'=day::text;
  shifts:=shifts||rows_for_date;
  SELECT coalesce(jsonb_agg(value||stamp),'[]') INTO rows_for_date FROM jsonb_array_elements(normalized->'special_work') WHERE value->>'service_date'=day::text;
  work_rows:=work_rows||rows_for_date;
  SELECT coalesce(jsonb_agg(value||stamp),'[]') INTO rows_for_date FROM jsonb_array_elements(normalized->'attendance_records') WHERE value->>'service_date'=day::text;
  attendance_rows:=attendance_rows||rows_for_date;
  SELECT coalesce(jsonb_agg(value||stamp||jsonb_build_object('finalized',true)),'[]') INTO rows_for_date FROM jsonb_array_elements(event_row.snapshot->'runs') WHERE value->>'service_date'=day::text;
  original_runs:=original_runs||rows_for_date;
 END LOOP;
 RETURN jsonb_build_object('version',147,'month',p_month,'deliveries',deliveries,'standby',shifts,'special_work',work_rows,
  'attendance_records',attendance_rows,'original_runs',original_runs,'dates',dates);
END $$;
REVOKE ALL ON FUNCTION private.dashboard147_monthly(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.dashboard147_monthly(date) TO authenticated;
CREATE OR REPLACE FUNCTION public.dashboard_get_finalized_monthly(p_month date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT private.dashboard147_monthly(p_month);
$$;
REVOKE ALL ON FUNCTION public.dashboard_get_finalized_monthly(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dashboard_get_finalized_monthly(date) TO authenticated;
COMMENT ON FUNCTION public.dashboard_get_finalized_monthly(date) IS '1.4.7 Brian-only monthly report from latest unreopened closing snapshots; no completion/execution-review prerequisite.';
NOTIFY pgrst,'reload schema';
COMMIT;

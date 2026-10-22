-- 1.4.16: reopening preserves the last confirmed monthly records until reclose.
-- Read-path change only: no attendance rows, close events, rates or permissions are rewritten.
BEGIN;
SET LOCAL lock_timeout='10s';
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
  -- Select one complete confirmed snapshot per date, even while attendance is reopened.
  -- affected_dates prevents a later cumulative close from replacing unrelated dates.
  SELECT e.* INTO event_row FROM public.attendance_closeout_events e
   WHERE e.action='close' AND day=ANY(e.affected_dates) ORDER BY e.id DESC LIMIT 1;
  closed:=private.dashboard146_is_closed(day);
  -- status describes the report snapshot; attendance_status describes editability.
  dates:=dates||jsonb_build_array(jsonb_build_object('service_date',day,'status',CASE WHEN event_row.id IS NOT NULL THEN 'finalized'
    WHEN closed THEN 'closed_without_snapshot' WHEN reopened IS NOT NULL THEN 'reopened' ELSE 'open' END,'close_event_id',event_row.id,'closed_at',event_row.happened_at,
    'attendance_status',CASE WHEN closed THEN 'closed' WHEN reopened IS NOT NULL THEN 'reopened' ELSE 'open' END,
    'pending_reclose',event_row.id IS NOT NULL AND NOT closed));
  IF event_row.id IS NULL THEN CONTINUE; END IF;
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
COMMENT ON FUNCTION public.dashboard_get_finalized_monthly(date) IS '1.4.16 Brian-only monthly report from each date latest closing snapshot; reopening retains it until a new confirmation replaces it.';
NOTIFY pgrst,'reload schema';
COMMIT;

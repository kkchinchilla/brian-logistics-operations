-- 1.4.13: approved six-component salary; no base or separate regional/job allowance.
-- Read-only RPC; no data rewrites or settlement side effects. Unresolved source records remain visible.
BEGIN;
SET LOCAL lock_timeout='10s';
CREATE OR REPLACE FUNCTION public.dashboard_get_calculated_payroll(p_month date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
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
  parts:='{"per_run":0,"standby":0,"follow_along":0,"learning":0,"rental":0,"adjustment":0}';driver_issues:='[]';
  FOR x IN
   SELECT 'per_run' kind,q item,q->>'id' source FROM jsonb_array_elements(f->'deliveries') q WHERE q->>'driver_id'=d.id
   UNION ALL SELECT 'rental',q,q->>'id' FROM jsonb_array_elements(f->'deliveries') q WHERE q->>'driver_id'=d.id AND q->>'is_rental'='true'
   UNION ALL SELECT 'standby',q,'standby:'||(q->>'id') FROM jsonb_array_elements(f->'standby') q WHERE q->>'driver_id'=d.id AND NOT coalesce((q->>'converted_to_support')::boolean,false)
   UNION ALL SELECT q->>'kind',q,'special:'||(q->>'id') FROM jsonb_array_elements(f->'special_work') q WHERE q->>'driver_id'=d.id AND q->>'kind' IN ('follow_along','learning')
   UNION ALL SELECT 'adjustment',q,'adjustment:'||(q->>'id') FROM jsonb_array_elements(b->'adjustments') q WHERE q->>'driver_id'=d.id
  LOOP
   rate:=NULL;code:=NULL;message:=NULL;date_text:=x.item->>'service_date';
   label:=CASE x.kind WHEN 'standby' THEN '值班津貼' WHEN 'follow_along' THEN '跟車費用' WHEN 'learning' THEN '學習費用' ELSE '租車費用' END;
   IF x.kind='per_run' THEN
    SELECT q INTO rate FROM jsonb_array_elements(b->'route_rates') q WHERE q->>'route_id'=x.item->>'route_id';
    amount:=(rate->>'amount')::numeric;
    valid:=coalesce(amount>=0 AND amount=trunc(amount,2) AND abs(amount)*100<=9007199254740991 AND rate->>'region_id' IS NOT NULL
     AND nullif(x.item->>'route_temperature_zone','') IS NOT NULL AND rate->>'zone_name'=x.item->>'route_temperature_zone',false);
    IF NOT valid THEN code:='route_rate_missing';message:='路線管理費率未設定，或目前溫層與結案紀錄不符';END IF;
    line:=jsonb_build_object('routeId',x.item->'route_id','routeCode',coalesce(x.item->>'route_code_snapshot',''),'temperatureZone',coalesce(x.item->>'route_temperature_zone',''),
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
  SELECT CASE WHEN count(value)=6 THEN sum(value::numeric) END INTO subtotal FROM jsonb_each_text(parts);
  IF abs(subtotal)*100>9007199254740991 THEN RAISE EXCEPTION '對帳金額超出安全計算範圍';END IF;
  SELECT jsonb_build_object(
   'count',(SELECT count(*) FROM jsonb_array_elements(f->'deliveries') q WHERE q->>'driver_id'=d.id),
   'standbyCount',(SELECT count(*) FROM jsonb_array_elements(f->'standby') q WHERE q->>'driver_id'=d.id AND NOT coalesce((q->>'converted_to_support')::boolean,false)),
   'followAlongCount',(SELECT count(*) FROM jsonb_array_elements(f->'special_work') q WHERE q->>'driver_id'=d.id AND q->>'kind'='follow_along'),
   'learningCount',(SELECT count(*) FROM jsonb_array_elements(f->'special_work') q WHERE q->>'driver_id'=d.id AND q->>'kind'='learning'),
   'rentalCount',(SELECT count(*) FROM jsonb_array_elements(f->'deliveries') q WHERE q->>'driver_id'=d.id AND q->>'is_rental'='true'),
   'unknownRentalCount',(SELECT count(*) FROM jsonb_array_elements(f->'deliveries') q WHERE q->>'driver_id'=d.id AND q->>'is_rental' IS NULL)) INTO counts;
  summaries:=summaries||jsonb_build_array(counts||jsonb_build_object('driverId',d.id,'name',d.name,'basis','route_management',
   'variable',parts->'per_run','standbyPay',parts->'standby','followAlongPay',parts->'follow_along','learningPay',parts->'learning',
   'rentalDeduction',parts->'rental','adjustment',parts->'adjustment','basicSubtotal',subtotal,'salary',CASE WHEN subtotal IS NOT NULL AND jsonb_array_length(driver_issues)=0 THEN subtotal END,'salaryReady',subtotal IS NOT NULL AND jsonb_array_length(driver_issues)=0,'knownItemsReady',subtotal IS NOT NULL,'issues',driver_issues));
  issues:=issues||driver_issues;
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(b->'expenses') LOOP
  issues:=issues||jsonb_build_array(jsonb_build_object('code','expense_treatment','driverId',coalesce(r->>'driver_id',''),'date',r->>'service_date','source','expense:'||(r->>'id'),'message','停車交通／零用金列為獨立費用；不自動併入薪資'));
 END LOOP;
 RETURN b||jsonb_build_object('calculation',jsonb_build_object('version',1413,'engine','database','month',to_char(p_month,'YYYY-MM'),
  'summaries',summaries,'lines',lines,'issues',issues,'expenses',b->'expenses','dates',f->'dates'));
END $$;
REVOKE ALL ON FUNCTION public.dashboard_get_calculated_payroll(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dashboard_get_calculated_payroll(date) TO authenticated;
COMMENT ON FUNCTION public.dashboard_get_calculated_payroll(date) IS 'Brian-only read-only six-component salary from 結案 records. No base salary; regional/job additions use manual adjustments. Missing inputs or unresolved legacy entries block only the affected salary.';
NOTIFY pgrst,'reload schema';
COMMIT;

-- 1.4.14: individual monthly base salary, effective from the selected month.
-- Latest user decision supersedes the historical no-base rule. No amounts are inferred.
BEGIN;
SET LOCAL lock_timeout='10s';
CREATE TABLE public.driver_base_salaries (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 driver_id uuid NOT NULL REFERENCES public.profiles(id),
 amount numeric NOT NULL CHECK(amount>=0 AND amount<=10000000 AND amount=trunc(amount)),
 effective_month date NOT NULL CHECK(effective_month BETWEEN '1900-01-01' AND '9998-12-01' AND extract(day FROM effective_month)=1),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 2000),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX driver_base_salary_effective_idx ON public.driver_base_salaries(driver_id,effective_month DESC,id DESC);
CREATE INDEX driver_base_salary_actor_idx ON public.driver_base_salaries(created_by);
ALTER TABLE public.driver_base_salaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driver_base_salaries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.driver_base_salaries TO authenticated;
REVOKE ALL ON SEQUENCE public.driver_base_salaries_id_seq FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SEQUENCE public.driver_base_salaries_id_seq TO authenticated;
CREATE POLICY finance_select ON public.driver_base_salaries FOR SELECT TO authenticated USING ((SELECT private.can_manage_finance()));
CREATE POLICY finance_insert ON public.driver_base_salaries FOR INSERT TO authenticated WITH CHECK ((SELECT private.can_manage_finance()) AND created_by=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=driver_id AND p.role='driver'));
-- Serialize every version write for this driver and stamp the authenticated actor.
CREATE FUNCTION private.dashboard1414_stamp_base_salary() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT coalesce(private.can_manage_finance(),false) THEN RAISE EXCEPTION '僅 Brian 可設定司機底薪';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(1414,pg_catalog.hashtext(NEW.driver_id::text));
 NEW.created_by:=auth.uid();NEW.created_at:=clock_timestamp();NEW.reason:=btrim(NEW.reason);RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.dashboard1414_stamp_base_salary() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER base_salary_stamp BEFORE INSERT ON public.driver_base_salaries FOR EACH ROW EXECUTE FUNCTION private.dashboard1414_stamp_base_salary();
CREATE TRIGGER finance_change_audit AFTER INSERT ON public.driver_base_salaries FOR EACH ROW EXECUTE FUNCTION private.audit_finance_change();
CREATE FUNCTION public.dashboard_save_driver_base_salary(p_driver_id uuid,p_amount numeric,p_effective_month date,p_reason text,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE revision bigint; result public.driver_base_salaries;
BEGIN
 IF NOT coalesce(private.can_manage_finance(),false) THEN RAISE EXCEPTION '僅 Brian 可設定司機底薪';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_driver_id AND role='driver') THEN RAISE EXCEPTION '請選擇有效司機';END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(1414,pg_catalog.hashtext(p_driver_id::text));
 SELECT coalesce(max(id),0) INTO revision FROM public.driver_base_salaries WHERE driver_id=p_driver_id;
 IF p_expected_revision IS DISTINCT FROM revision THEN RAISE EXCEPTION '底薪設定已變更，請重新整理後再操作';END IF;
 IF p_amount IS NULL OR NOT(p_amount>=0 AND p_amount<=10000000 AND p_amount=trunc(p_amount)) THEN RAISE EXCEPTION '底薪請輸入 0 至 10,000,000 的整數；無底薪請填 0';END IF;
 IF p_effective_month IS NULL OR p_effective_month NOT BETWEEN '1900-01-01' AND '9998-12-01' OR extract(day FROM p_effective_month)<>1 THEN RAISE EXCEPTION '請選擇有效生效月份';END IF;
 IF coalesce(length(btrim(p_reason)),0)=0 OR length(p_reason)>2000 THEN RAISE EXCEPTION '請填寫 1 至 2000 字的變更原因';END IF;
 INSERT INTO public.driver_base_salaries(driver_id,amount,effective_month,reason)
 VALUES(p_driver_id,p_amount,p_effective_month,btrim(p_reason)) RETURNING * INTO result;
 RETURN to_jsonb(result);
END $$;
REVOKE ALL ON FUNCTION public.dashboard_save_driver_base_salary(uuid,numeric,date,text,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dashboard_save_driver_base_salary(uuid,numeric,date,text,bigint) TO authenticated;
COMMENT ON TABLE public.driver_base_salaries IS 'Brian-only monthly base salary versions, recorded from 車輛管理／司機名單. Latest effective month then latest ID wins; no implicit zero or proration.';
CREATE OR REPLACE FUNCTION public.dashboard_get_calculated_payroll(p_month date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE b jsonb;f jsonb;d record;x record;r jsonb;rate jsonb;parts jsonb;line jsonb;
 lines jsonb:='[]';issues jsonb:='[]';driver_issues jsonb;summaries jsonb:='[]';counts jsonb;
 amount numeric;subtotal numeric;valid boolean;code text;message text;label text;k text;date_text text;
BEGIN
 IF NOT coalesce(private.can_manage_finance(),false) THEN RAISE EXCEPTION '僅 Brian 可查看月度報表';END IF;
 -- Existing RPC validates month, enforces Brian-only RLS and reads 結案 snapshots.
 b:=public.dashboard_get_route_payroll(p_month);f:=b->'finalized';
 b:=b||jsonb_build_object('base_salaries',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM public.driver_base_salaries s WHERE effective_month<=p_month),'[]'::jsonb));
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
  SELECT q INTO rate FROM jsonb_array_elements(b->'base_salaries') q
   WHERE q->>'driver_id'=d.id AND q->>'effective_month'<=p_month::text
   ORDER BY q->>'effective_month' DESC,(q->>'id')::bigint DESC LIMIT 1;
  amount:=(rate->>'amount')::numeric;
  parts:=jsonb_set(parts,'{base}',coalesce(to_jsonb(amount),'null'::jsonb));
  lines:=lines||jsonb_build_array(jsonb_build_object('driverId',d.id,'date',p_month,'source','base:'||coalesce(rate->>'id',d.id),
   'kind','base','quantity',1,'ruleId',rate->'id','amount',amount,'closeEventId',NULL,'effectiveMonth',rate->'effective_month',
   'status',CASE WHEN amount IS NULL THEN '底薪未設定' ELSE '每月底薪' END));
  IF amount IS NULL THEN driver_issues:=driver_issues||jsonb_build_array(jsonb_build_object('code','base_salary_missing','driverId',d.id,'date',p_month,
   'source','base:'||d.id,'message','底薪尚未設定，請至車輛管理 → 司機名單設定此月份底薪；無底薪請填 0'));END IF;
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
  SELECT CASE WHEN count(value)=7 THEN sum(value::numeric) END INTO subtotal FROM jsonb_each_text(parts);
  IF abs(subtotal)*100>9007199254740991 THEN RAISE EXCEPTION '對帳金額超出安全計算範圍';END IF;
  SELECT jsonb_build_object(
   'count',(SELECT count(*) FROM jsonb_array_elements(f->'deliveries') q WHERE q->>'driver_id'=d.id),
   'standbyCount',(SELECT count(*) FROM jsonb_array_elements(f->'standby') q WHERE q->>'driver_id'=d.id AND NOT coalesce((q->>'converted_to_support')::boolean,false)),
   'followAlongCount',(SELECT count(*) FROM jsonb_array_elements(f->'special_work') q WHERE q->>'driver_id'=d.id AND q->>'kind'='follow_along'),
   'learningCount',(SELECT count(*) FROM jsonb_array_elements(f->'special_work') q WHERE q->>'driver_id'=d.id AND q->>'kind'='learning'),
   'rentalCount',(SELECT count(*) FROM jsonb_array_elements(f->'deliveries') q WHERE q->>'driver_id'=d.id AND q->>'is_rental'='true'),
   'unknownRentalCount',(SELECT count(*) FROM jsonb_array_elements(f->'deliveries') q WHERE q->>'driver_id'=d.id AND q->>'is_rental' IS NULL)) INTO counts;
  summaries:=summaries||jsonb_build_array(counts||jsonb_build_object('driverId',d.id,'name',d.name,'basis','route_management',
   'baseSalary',parts->'base','variable',parts->'per_run','standbyPay',parts->'standby','followAlongPay',parts->'follow_along','learningPay',parts->'learning',
   'rentalDeduction',parts->'rental','adjustment',parts->'adjustment','basicSubtotal',subtotal,'salary',CASE WHEN subtotal IS NOT NULL AND jsonb_array_length(driver_issues)=0 THEN subtotal END,'salaryReady',subtotal IS NOT NULL AND jsonb_array_length(driver_issues)=0,'knownItemsReady',subtotal IS NOT NULL,'issues',driver_issues));
  issues:=issues||driver_issues;
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(b->'expenses') LOOP
  issues:=issues||jsonb_build_array(jsonb_build_object('code','expense_treatment','driverId',coalesce(r->>'driver_id',''),'date',r->>'service_date','source','expense:'||(r->>'id'),'message','停車交通／零用金列為獨立費用；不自動併入薪資'));
 END LOOP;
 RETURN b||jsonb_build_object('calculation',jsonb_build_object('version',1414,'engine','database','month',to_char(p_month,'YYYY-MM'),
  'summaries',summaries,'lines',lines,'issues',issues,'expenses',b->'expenses','dates',f->'dates'));
END $$;
REVOKE ALL ON FUNCTION public.dashboard_get_calculated_payroll(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dashboard_get_calculated_payroll(date) TO authenticated;
COMMENT ON FUNCTION public.dashboard_get_calculated_payroll(date) IS 'Brian-only seven-component salary: monthly driver base + finalized attendance pay - rental + signed adjustments. Missing base is not zero. Effective-month base versions do not rewrite attendance snapshots.';
NOTIFY pgrst,'reload schema';
COMMIT;

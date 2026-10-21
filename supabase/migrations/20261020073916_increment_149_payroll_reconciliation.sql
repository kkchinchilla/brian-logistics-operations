-- Increment 1.4.9: reuse existing finance tables and audit trails; no rates or data backfill.
BEGIN;

-- One serialized write path for new and legacy rate editors. RLS remains authoritative.
CREATE OR REPLACE FUNCTION private.guard_payroll_rule_overlap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(149,1);
 IF NEW.active AND EXISTS (
  SELECT 1 FROM public.payroll_rules other WHERE other.id<>NEW.id AND other.active
   AND other.driver_id=NEW.driver_id AND other.component=NEW.component
   AND other.route_id IS NOT DISTINCT FROM NEW.route_id
   AND daterange(other.effective_from,coalesce(other.effective_to,'infinity'::date),'[]')
    && daterange(NEW.effective_from,coalesce(NEW.effective_to,'infinity'::date),'[]')
 ) THEN RAISE EXCEPTION '此司機的薪資規則日期區間重疊，請先結束或停用原規則'; END IF;
 NEW.updated_at:=clock_timestamp();
 RETURN NEW;
END $$;

CREATE FUNCTION public.dashboard_get_payroll_reconciliation(p_month date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT coalesce(private.can_manage_finance(),false) THEN RAISE EXCEPTION '僅 Brian 可使用月度計薪對帳'; END IF;
 IF p_month IS NULL OR extract(day FROM p_month)<>1 OR p_month<'1900-01-01' OR p_month>'9998-12-01' THEN RAISE EXCEPTION '請提供有效月份第一日'; END IF;
 RETURN jsonb_build_object('version',149,'month',p_month,
  'finalized',public.dashboard_get_finalized_monthly(p_month),
  'configs',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.payroll_configs c),'[]'::jsonb),
  'rules',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM public.payroll_rules r),'[]'::jsonb),
  'adjustments',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.payroll_adjustments a WHERE a.service_date>=p_month AND a.service_date<(p_month+interval '1 month')::date),'[]'::jsonb),
  'expenses',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM public.expense_records e WHERE e.service_date>=p_month AND e.service_date<(p_month+interval '1 month')::date),'[]'::jsonb));
END $$;

CREATE FUNCTION public.dashboard_save_payroll_config(p_driver_id uuid,p_pay_basis text,p_explanation text,p_expected jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE current_row public.payroll_configs; result_row public.payroll_configs;
BEGIN
 IF NOT coalesce(private.can_manage_finance(),false) THEN RAISE EXCEPTION '僅 Brian 可設定計薪'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(149,2);
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_driver_id AND role='driver' AND active) THEN RAISE EXCEPTION '請選擇啟用中的司機'; END IF;
 IF p_pay_basis IS NULL OR p_pay_basis NOT IN ('fixed_only','per_run_only','fixed_plus_run','manual') THEN RAISE EXCEPTION '計酬方式無效'; END IF;
 IF coalesce(length(btrim(p_explanation)),0)=0 OR length(p_explanation)>2000 THEN RAISE EXCEPTION '請填寫 1 至 2000 字的設定依據'; END IF;
 SELECT * INTO current_row FROM public.payroll_configs WHERE driver_id=p_driver_id FOR UPDATE;
 IF FOUND THEN
  IF p_expected IS DISTINCT FROM to_jsonb(current_row) THEN RAISE EXCEPTION '計酬設定已變更，請重新整理後再操作'; END IF;
  UPDATE public.payroll_configs SET pay_basis=p_pay_basis,explanation=btrim(p_explanation),updated_by=auth.uid() WHERE id=current_row.id RETURNING * INTO result_row;
 ELSE
  IF p_expected IS NOT NULL THEN RAISE EXCEPTION '計酬設定已變更，請重新整理後再操作'; END IF;
  INSERT INTO public.payroll_configs(driver_id,pay_basis,explanation,updated_by) VALUES(p_driver_id,p_pay_basis,btrim(p_explanation),auth.uid()) RETURNING * INTO result_row;
 END IF;
 RETURN to_jsonb(result_row);
END $$;

CREATE FUNCTION public.dashboard_add_payroll_rate(p_driver_id uuid,p_component text,p_route_id bigint,p_amount numeric,p_effective_from date,p_effective_to date,p_explanation text,p_supersedes_id bigint DEFAULT NULL,p_expected jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old_row public.payroll_rules; result_row public.payroll_rules; end_date date:=p_effective_to;
BEGIN
 IF NOT coalesce(private.can_manage_finance(),false) THEN RAISE EXCEPTION '僅 Brian 可設定計薪'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(149,1);
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_driver_id AND role='driver' AND active) THEN RAISE EXCEPTION '請選擇啟用中的司機'; END IF;
 IF p_component IS NULL OR p_component NOT IN ('fixed_monthly','per_run') THEN RAISE EXCEPTION '計薪項目無效'; END IF;
 IF (p_component='fixed_monthly' AND p_route_id IS NOT NULL) OR (p_component='per_run' AND NOT EXISTS(SELECT 1 FROM public.routes WHERE id=p_route_id AND active)) THEN RAISE EXCEPTION '請選擇正確的計薪路線'; END IF;
 IF p_amount IS NULL OR p_amount<0 OR p_amount>10000000 OR p_amount<>trunc(p_amount) THEN RAISE EXCEPTION '費率請輸入 0 至 10,000,000 的整數'; END IF;
 IF p_effective_from IS NULL OR p_effective_from<'1900-01-01' OR p_effective_from>'9998-12-31' OR (end_date IS NOT NULL AND (end_date<p_effective_from OR end_date>'9998-12-31')) THEN RAISE EXCEPTION '費率有效日期不正確'; END IF;
 IF coalesce(length(btrim(p_explanation)),0)=0 OR length(p_explanation)>2000 THEN RAISE EXCEPTION '請填寫 1 至 2000 字的費率依據'; END IF;
 IF p_supersedes_id IS NOT NULL THEN
  SELECT * INTO old_row FROM public.payroll_rules WHERE id=p_supersedes_id FOR UPDATE;
  IF NOT FOUND OR p_expected IS DISTINCT FROM to_jsonb(old_row) THEN RAISE EXCEPTION '費率已變更，請重新整理後再操作'; END IF;
  IF NOT old_row.active OR old_row.driver_id<>p_driver_id OR old_row.component<>p_component OR old_row.route_id IS DISTINCT FROM p_route_id THEN RAISE EXCEPTION '新費率必須延續相同司機及計薪項目'; END IF;
  IF p_effective_from<=old_row.effective_from OR (old_row.effective_to IS NOT NULL AND p_effective_from>old_row.effective_to) THEN RAISE EXCEPTION '新費率須在原期間內、原生效日之後開始'; END IF;
  end_date:=coalesce(end_date,old_row.effective_to);
  UPDATE public.payroll_rules SET effective_to=p_effective_from-1 WHERE id=old_row.id;
 ELSIF p_expected IS NOT NULL THEN RAISE EXCEPTION '新增費率不可指定舊版本'; END IF;
 INSERT INTO public.payroll_rules(driver_id,component,route_id,amount,effective_from,effective_to,explanation,active,created_by)
 VALUES(p_driver_id,p_component,p_route_id,p_amount,p_effective_from,end_date,btrim(p_explanation),true,auth.uid()) RETURNING * INTO result_row;
 RETURN to_jsonb(result_row);
END $$;

CREATE FUNCTION public.dashboard_end_payroll_rate(p_rule_id bigint,p_expected jsonb,p_effective_to date,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old_row public.payroll_rules; result_row public.payroll_rules;
BEGIN
 IF NOT coalesce(private.can_manage_finance(),false) THEN RAISE EXCEPTION '僅 Brian 可設定計薪'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(149,1);
 IF coalesce(length(btrim(p_reason)),0)=0 OR length(p_reason)>2000 THEN RAISE EXCEPTION '請填寫 1 至 2000 字的變更原因'; END IF;
 SELECT * INTO old_row FROM public.payroll_rules WHERE id=p_rule_id FOR UPDATE;
 IF NOT FOUND OR p_expected IS DISTINCT FROM to_jsonb(old_row) THEN RAISE EXCEPTION '費率已變更，請重新整理後再操作'; END IF;
 IF NOT old_row.active THEN RAISE EXCEPTION '費率已停用'; END IF;
 IF p_effective_to IS NOT NULL AND (p_effective_to<old_row.effective_from OR p_effective_to>'9998-12-31' OR (old_row.effective_to IS NOT NULL AND p_effective_to>old_row.effective_to)) THEN RAISE EXCEPTION '結束日須在原有效期間內'; END IF;
 UPDATE public.payroll_rules SET active=p_effective_to IS NOT NULL,effective_to=coalesce(p_effective_to,effective_to),
  explanation=left(explanation,2000)||E'\n'||CASE WHEN p_effective_to IS NULL THEN '停用：' ELSE '結束期間：' END||btrim(p_reason)
 WHERE id=p_rule_id RETURNING * INTO result_row;
 RETURN to_jsonb(result_row);
END $$;

REVOKE ALL ON FUNCTION public.dashboard_get_payroll_reconciliation(date) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.dashboard_save_payroll_config(uuid,text,text,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.dashboard_add_payroll_rate(uuid,text,bigint,numeric,date,date,text,bigint,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.dashboard_end_payroll_rate(bigint,jsonb,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dashboard_get_payroll_reconciliation(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_save_payroll_config(uuid,text,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_add_payroll_rate(uuid,text,bigint,numeric,date,date,text,bigint,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_end_payroll_rate(bigint,jsonb,date,text) TO authenticated;
COMMIT;

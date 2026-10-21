-- 1.4.9.1: route management is the sole trip-pay source. No existing data is changed.
-- Supplement versions are append-only: effective date, then latest ID wins.
CREATE TABLE public.payroll_supplement_rates (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 component text NOT NULL CHECK(component IN ('standby','rental')),
 amount numeric NOT NULL CHECK(amount>=0 AND amount<=10000000 AND amount=trunc(amount)),
 effective_from date NOT NULL CHECK(effective_from BETWEEN '1900-01-01' AND '9998-12-31'),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 2000),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX payroll_supplement_effective_idx ON public.payroll_supplement_rates(component,effective_from DESC,id DESC);
CREATE INDEX payroll_supplement_actor_idx ON public.payroll_supplement_rates(created_by);
ALTER TABLE public.payroll_supplement_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payroll_supplement_rates FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.payroll_supplement_rates TO authenticated;
GRANT USAGE ON SEQUENCE public.payroll_supplement_rates_id_seq TO authenticated;
CREATE POLICY finance_select ON public.payroll_supplement_rates FOR SELECT TO authenticated USING ((SELECT private.can_manage_finance()));
CREATE POLICY finance_insert ON public.payroll_supplement_rates FOR INSERT TO authenticated WITH CHECK ((SELECT private.can_manage_finance()) AND created_by=(SELECT auth.uid()));
CREATE FUNCTION private.dashboard1491_stamp_supplement() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT coalesce(private.can_manage_finance(),false) THEN RAISE EXCEPTION '僅 Brian 可設定值班／租車'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(1491,1);
 NEW.created_by:=auth.uid(); NEW.created_at:=clock_timestamp(); NEW.reason:=btrim(NEW.reason);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.dashboard1491_stamp_supplement() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER supplement_stamp BEFORE INSERT ON public.payroll_supplement_rates FOR EACH ROW EXECUTE FUNCTION private.dashboard1491_stamp_supplement();
CREATE TRIGGER finance_change_audit AFTER INSERT ON public.payroll_supplement_rates FOR EACH ROW EXECUTE FUNCTION private.audit_finance_change();

CREATE FUNCTION public.dashboard_save_payroll_supplements(p_effective_from date,p_standby_amount numeric,p_rental_amount numeric,p_reason text,p_expected_revision bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE revision bigint;
BEGIN
 IF NOT coalesce(private.can_manage_finance(),false) THEN RAISE EXCEPTION '僅 Brian 可設定值班／租車'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(1491,1);
 SELECT coalesce(max(id),0) INTO revision FROM public.payroll_supplement_rates;
 IF p_expected_revision IS DISTINCT FROM revision THEN RAISE EXCEPTION '設定已變更，請重新整理後再操作'; END IF;
 IF p_effective_from IS NULL OR p_effective_from NOT BETWEEN '1900-01-01' AND '9998-12-31' THEN RAISE EXCEPTION '請選擇有效生效日'; END IF;
 IF coalesce(length(btrim(p_reason)),0)=0 OR length(p_reason)>2000 THEN RAISE EXCEPTION '請填寫 1 至 2000 字的變更原因'; END IF;
 IF p_standby_amount IS NULL AND p_rental_amount IS NULL THEN RAISE EXCEPTION '請至少填寫一項金額'; END IF;
 IF (p_standby_amount IS NOT NULL AND (p_standby_amount<0 OR p_standby_amount>10000000 OR p_standby_amount<>trunc(p_standby_amount))) OR
    (p_rental_amount IS NOT NULL AND (p_rental_amount<0 OR p_rental_amount>10000000 OR p_rental_amount<>trunc(p_rental_amount))) THEN RAISE EXCEPTION '金額請輸入 0 至 10,000,000 的整數；租車費用會自動扣除'; END IF;
 IF p_standby_amount IS NOT NULL THEN INSERT INTO public.payroll_supplement_rates(component,amount,effective_from,reason) VALUES('standby',p_standby_amount,p_effective_from,p_reason); END IF;
 IF p_rental_amount IS NOT NULL THEN INSERT INTO public.payroll_supplement_rates(component,amount,effective_from,reason) VALUES('rental',p_rental_amount,p_effective_from,p_reason); END IF;
 RETURN jsonb_build_object('revision',(SELECT max(id) FROM public.payroll_supplement_rates));
END $$;

CREATE FUNCTION public.dashboard_get_route_payroll(p_month date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NOT coalesce(private.can_manage_finance(),false) THEN RAISE EXCEPTION '僅 Brian 可查看月度報表'; END IF;
 IF p_month IS NULL OR extract(day FROM p_month)<>1 OR p_month<'1900-01-01' OR p_month>'9998-12-01' THEN RAISE EXCEPTION '請提供有效月份第一日'; END IF;
 RETURN jsonb_build_object('version',1491,'month',p_month,
  'finalized',public.dashboard_get_finalized_monthly(p_month),
  'route_rates',coalesce((SELECT jsonb_agg(jsonb_build_object('route_id',r.id,'region_id',r.delivery_region_id,'zone_name',r.temperature_zone,'amount',f.delivery_fee,'updated_at',f.updated_at) ORDER BY r.id) FROM public.routes r LEFT JOIN public.delivery_region_zone_rates f ON f.region_id=r.delivery_region_id AND f.zone_name=r.temperature_zone),'[]'::jsonb),
  'supplements',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM public.payroll_supplement_rates s),'[]'::jsonb),
  'adjustments',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.payroll_adjustments a WHERE a.service_date>=p_month AND a.service_date<(p_month+interval '1 month')::date),'[]'::jsonb),
  'expenses',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM public.expense_records e WHERE e.service_date>=p_month AND e.service_date<(p_month+interval '1 month')::date),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.dashboard_save_payroll_supplements(date,numeric,numeric,text,bigint),public.dashboard_get_route_payroll(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.dashboard_save_payroll_supplements(date,numeric,numeric,text,bigint),public.dashboard_get_route_payroll(date) TO authenticated;

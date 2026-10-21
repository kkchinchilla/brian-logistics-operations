BEGIN READ ONLY;
DO $$
DECLARE owner_id uuid;other_id uuid;driver_id uuid;b jsonb;denied boolean;
BEGIN
 owner_id:=private.dashboard146_finance_owner();
 SELECT id INTO other_id FROM public.profiles WHERE role='dispatcher' AND active AND id<>owner_id LIMIT 1;
 SELECT id INTO driver_id FROM public.profiles WHERE role='driver' AND active LIMIT 1;
 IF owner_id IS NULL OR other_id IS NULL OR driver_id IS NULL THEN RAISE EXCEPTION 'Missing role fixtures; no checks claimed';END IF;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 SET LOCAL ROLE authenticated;
 b:=public.dashboard_get_calculated_payroll('2026-10-01');
 IF b->'calculation'->>'version'<>'1412' OR b->'calculation'->>'engine'<>'database' THEN RAISE EXCEPTION 'Calculation version mismatch';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(b->'calculation'->'summaries') x WHERE x->>'salary' IS NOT NULL) THEN RAISE EXCEPTION 'Unapproved final salary';END IF;
 b:=public.dashboard_get_calculated_payroll('2026-11-01');
 IF b->'calculation'->>'month'<>'2026-11' THEN RAISE EXCEPTION 'Month mismatch';END IF;
 PERFORM set_config('request.jwt.claim.sub',other_id::text,true);
 denied:=false;BEGIN PERFORM public.dashboard_get_calculated_payroll('2026-10-01');EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%Brian%' THEN denied:=true;ELSE RAISE;END IF;END;
 IF NOT denied THEN RAISE EXCEPTION 'Other dispatcher access unexpectedly allowed';END IF;
 PERFORM set_config('request.jwt.claim.sub',driver_id::text,true);
 denied:=false;BEGIN PERFORM public.dashboard_get_calculated_payroll('2026-10-01');EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%Brian%' THEN denied:=true;ELSE RAISE;END IF;END;
 IF NOT denied THEN RAISE EXCEPTION 'Driver access unexpectedly allowed';END IF;
 SET LOCAL ROLE anon;
 denied:=false;BEGIN PERFORM public.dashboard_get_calculated_payroll('2026-10-01');EXCEPTION WHEN insufficient_privilege THEN denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'Anonymous execute unexpectedly allowed';END IF;
 RESET ROLE;
 IF (SELECT prosecdef FROM pg_proc WHERE oid='public.dashboard_get_calculated_payroll(date)'::regprocedure) THEN RAISE EXCEPTION 'Unexpected definer privilege';END IF;
END $$;
SELECT '7 live checks passed in a read-only transaction' AS result;
ROLLBACK;

-- Fictional demonstration data only. Run once against the isolated reviewer DB.
-- Uses existing confirmed reviewer identities; never writes Supabase Auth tables.
BEGIN;
SET LOCAL lock_timeout='10s';
DO $demo$
<<demo>>
DECLARE
 owner_id uuid; driver_id uuid; region_id bigint;
 owned_vehicle bigint; rental_vehicle bigint;
 ambient_route bigint; chilled_route bigint; frozen_route bigint;
 day_revision integer; item record; monthly jsonb; summary jsonb;
 empty_source jsonb := '{"kind":"empty","id":null,"revision":0,"observation_revision":0}';
BEGIN
 PERFORM pg_advisory_xact_lock(1461,1);
 owner_id := private.dashboard146_finance_owner();
 IF owner_id IS NULL OR (SELECT count(*) FROM public.profiles)<>3 OR
    NOT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u USING(id)
      WHERE p.id=owner_id AND p.display_name='審查管理員' AND p.role='dispatcher'
      AND p.active AND p.can_manage_finance AND u.raw_app_meta_data->>'review_role'='owner'
      AND u.deleted_at IS NULL AND u.phone_confirmed_at IS NOT NULL)
 THEN RAISE EXCEPTION 'Requires the isolated, prepared reviewer environment'; END IF;
 SELECT p.id INTO STRICT driver_id FROM public.profiles p JOIN auth.users u USING(id)
 WHERE p.display_name='審查司機' AND p.role='driver' AND p.active AND NOT p.can_manage_finance
   AND u.raw_app_meta_data->>'review_role'='driver' AND u.deleted_at IS NULL AND u.phone_confirmed_at IS NOT NULL;
 IF EXISTS(SELECT 1 FROM public.routes) OR EXISTS(SELECT 1 FROM public.runs)
   OR EXISTS(SELECT 1 FROM public.vehicles) OR EXISTS(SELECT 1 FROM public.delivery_regions)
   OR EXISTS(SELECT 1 FROM public.delivery_temperature_zones) OR EXISTS(SELECT 1 FROM public.attendance_duty_entries)
   OR EXISTS(SELECT 1 FROM public.attendance_closeout_events) OR EXISTS(SELECT 1 FROM public.payroll_adjustments)
   OR EXISTS(SELECT 1 FROM public.duty_assignment_rates) OR EXISTS(SELECT 1 FROM public.payroll_supplement_rates)
 THEN RAISE EXCEPTION 'Demo business data already exists; seed refused without changing existing records'; END IF;

 -- Identify the audit actor within this transaction, without creating an Auth session.
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
 INSERT INTO public.delivery_temperature_zones(name) VALUES('常溫'),('冷藏'),('冷凍');
 INSERT INTO public.delivery_regions(name) VALUES('示範配送區') RETURNING id INTO region_id;
 INSERT INTO public.vehicles(plate_number,label) VALUES('DEMO-001','示範自有車') RETURNING id INTO owned_vehicle;
 INSERT INTO public.vehicles(plate_number,label) VALUES('DEMO-002','示範租用車') RETURNING id INTO rental_vehicle;
 INSERT INTO public.vehicle_owner_bindings(driver_id,vehicle_id,effective_from,note)
 VALUES(driver_id,owned_vehicle,'2026-10-01','虛構展示資料：此車屬於審查司機');
 INSERT INTO public.routes(route_name,temperature_zone,delivery_region_id)
 VALUES('示範市區配送','常溫',region_id) RETURNING id INTO ambient_route;
 INSERT INTO public.routes(route_name,temperature_zone,delivery_region_id)
 VALUES('示範冷藏配送','冷藏',region_id) RETURNING id INTO chilled_route;
 INSERT INTO public.routes(route_name,temperature_zone,delivery_region_id)
 VALUES('示範冷凍配送','冷凍',region_id) RETURNING id INTO frozen_route;
 INSERT INTO public.delivery_region_zone_rates(region_id,zone_name,delivery_fee)
 VALUES(region_id,'常溫',600),(region_id,'冷藏',800),(region_id,'冷凍',1000);
 PERFORM public.dashboard_save_assignment_rate('standby',200,0);
 PERFORM public.dashboard_save_assignment_rate('follow_along',150,0);
 PERFORM public.dashboard_save_assignment_rate('learning',100,0);
 PERFORM public.dashboard_save_rental_rate('2026-10-01',100,'虛構展示資料：每次租車扣除 100',0);

 FOR item IN SELECT * FROM (VALUES
   ('2026-10-27'::date,'日配',ambient_route,owned_vehicle,false),
   ('2026-10-27'::date,'鮮二',chilled_route,rental_vehicle,true),
   ('2026-10-28'::date,'冷凍',frozen_route,rental_vehicle,true),
   ('2026-10-29'::date,'日配',ambient_route,owned_vehicle,false)
 ) AS rows(service_date,category,route_id,vehicle_id,is_rental) LOOP
   SELECT coalesce((SELECT d.revision FROM public.attendance_driver_days d
     WHERE d.service_date=item.service_date AND d.driver_id=demo.driver_id),0) INTO day_revision;
   PERFORM public.dashboard_save_day_plan(item.service_date,driver_id,item.category,1,item.route_id,item.vehicle_id,
     item.is_rental,'虛構展示資料',NULL,0,day_revision);
 END LOOP;
 FOR item IN SELECT generate_series('2026-10-27'::date,'2026-10-29'::date,'1 day')::date AS d LOOP
   PERFORM public.dashboard_set_attendance_slot_counts(item.d,'{"日配":2,"OC":2,"鮮二":1,"冷凍":1,"低鮮":1}');
 END LOOP;
 PERFORM public.dashboard_save_attendance_standby('2026-10-27',driver_id,'日配',2,empty_source,
   '{"kind":"standby","note":"虛構展示資料：值班一次"}');
 PERFORM public.dashboard_save_attendance_duty('2026-10-27',driver_id,'OC',1,empty_source,
   '{"kind":"follow_along","note":"虛構展示資料：跟車一次"}');
 PERFORM public.dashboard_save_attendance_duty('2026-10-28',driver_id,'OC',1,empty_source,
   '{"kind":"learning","note":"虛構展示資料：學習一次"}');
 INSERT INTO public.payroll_adjustments(driver_id,service_date,amount,category,reason)
 VALUES(driver_id,'2026-10-27',300,'allowance','虛構展示資料：加給'),
       (driver_id,'2026-10-28',-50,'deduction','虛構展示資料：扣款');
 PERFORM public.dashboard_close_attendance_through('2026-10-27','虛構展示資料：已結案日期');
 PERFORM public.dashboard_close_attendance_through('2026-10-28','虛構展示資料：保留結案快照');
 PERFORM public.dashboard_reopen_attendance_date('2026-10-28','虛構展示資料：重新開啟後仍保留上次結案紀錄');

 monthly := public.dashboard_get_calculated_payroll('2026-10-01');
 SELECT value INTO STRICT summary FROM jsonb_array_elements(monthly->'calculation'->'summaries')
 WHERE value->>'driverId'=driver_id::text;
 IF (summary->>'salary')::numeric IS DISTINCT FROM 2900
   OR (summary->>'count')::integer IS DISTINCT FROM 3
   OR (summary->>'standbyPay')::numeric IS DISTINCT FROM 200
   OR (summary->>'followAlongPay')::numeric IS DISTINCT FROM 150
   OR (summary->>'learningPay')::numeric IS DISTINCT FROM 100
 THEN RAISE EXCEPTION 'Demo payroll verification failed; all seed changes rolled back'; END IF;
END
$demo$;
COMMIT;

-- Increment 1.4. Protect closed service dates from changes to scheduled runs.
-- Prerequisite: sql/132_01_shared_dashboard.sql applied.
-- Non-destructive / idempotent; does NOT modify historical records.
BEGIN;
CREATE OR REPLACE FUNCTION public.dashboard_guard_closed_run_day()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE old_date date; new_date date;
BEGIN
 IF TG_OP <> 'INSERT' THEN old_date := OLD.service_date; END IF;
 IF TG_OP <> 'DELETE' THEN new_date := NEW.service_date; END IF;
 IF (old_date IS NOT NULL AND EXISTS
     (SELECT 1 FROM public.daily_attendance_closeouts c WHERE c.service_date=old_date AND c.closed_at IS NOT NULL))
 OR (new_date IS NOT NULL AND EXISTS
     (SELECT 1 FROM public.daily_attendance_closeouts c WHERE c.service_date=new_date AND c.closed_at IS NOT NULL)) THEN
   RAISE EXCEPTION '此出勤日期已結案；請由主管重新開啟後再修改配送預排';
 END IF;
 -- Prevent changing planned attribution after a real execution was confirmed.
 IF TG_OP='UPDATE' THEN
   IF EXISTS (SELECT 1 FROM public.trip_executions e WHERE e.run_id=OLD.id AND e.review_status='confirmed')
      AND (OLD.service_date,OLD.route_id,OLD.driver_id,OLD.vehicle_id,OLD.is_rental)
          IS DISTINCT FROM (NEW.service_date,NEW.route_id,NEW.driver_id,NEW.vehicle_id,NEW.is_rental) THEN
     RAISE EXCEPTION '此趟次已完成確認；不得回頭修改影響已確認出勤的預排欄位';
   END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS dashboard_closed_run_day_guard ON public.runs;
CREATE TRIGGER dashboard_closed_run_day_guard BEFORE INSERT OR UPDATE OR DELETE
 ON public.runs FOR EACH ROW EXECUTE FUNCTION public.dashboard_guard_closed_run_day();
COMMIT;

-- Increment 1.4.1: finalized date-specific attendance column controls.
-- Prereqs: 132 shared board + 140 closed-day safeguards.
-- NON-DESTRUCTIVE: no backfill, no historical classification by temperature_zone.
BEGIN;

ALTER TABLE public.runs
  ADD COLUMN IF NOT EXISTS attendance_category text,
  ADD COLUMN IF NOT EXISTS attendance_slot_index integer;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.runs'::regclass AND conname='runs_attendance_slot_pair_check') THEN
    ALTER TABLE public.runs ADD CONSTRAINT runs_attendance_slot_pair_check CHECK (
      (attendance_category IS NULL AND attendance_slot_index IS NULL)
      OR
      (attendance_category IN ('日配','OC','鮮二','冷凍','低鮮') AND attendance_slot_index BETWEEN 1 AND 30)
    );
  END IF;
END $$;

-- One position per driver/category/day; never lose a booked run by overwriting a cell.
CREATE UNIQUE INDEX IF NOT EXISTS runs_attendance_unique_driver_slot
  ON public.runs(service_date,driver_id,attendance_category,attendance_slot_index)
  WHERE attendance_category IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.daily_attendance_slot_counts (
  service_date date NOT NULL,
  category text NOT NULL CHECK (category IN ('日配','OC','鮮二','冷凍','低鮮')),
  slot_count integer NOT NULL CHECK (slot_count BETWEEN 1 AND 30),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id),
  PRIMARY KEY (service_date,category)
);
ALTER TABLE public.daily_attendance_slot_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_slots_read ON public.daily_attendance_slot_counts;
DROP POLICY IF EXISTS attendance_slots_write ON public.daily_attendance_slot_counts;
CREATE POLICY attendance_slots_read ON public.daily_attendance_slot_counts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY attendance_slots_write ON public.daily_attendance_slot_counts
  FOR ALL TO authenticated
  USING ((SELECT private.is_dispatcher())) WITH CHECK ((SELECT private.is_dispatcher()));
REVOKE ALL ON public.daily_attendance_slot_counts FROM anon;
REVOKE DELETE ON public.daily_attendance_slot_counts FROM authenticated;
GRANT SELECT,INSERT,UPDATE ON public.daily_attendance_slot_counts TO authenticated;

CREATE OR REPLACE FUNCTION public.dashboard_attendance_slot_base(p_category text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT CASE p_category WHEN '日配' THEN 2 WHEN 'OC' THEN 3
   WHEN '鮮二' THEN 3 WHEN '冷凍' THEN 4 WHEN '低鮮' THEN 4 ELSE NULL END;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_guard_attendance_slot_count()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE highest integer;
BEGIN
 IF NOT (SELECT private.is_dispatcher()) THEN RAISE EXCEPTION '只有主管可調整每日趟數'; END IF;
 IF TG_OP='UPDATE' AND (OLD.service_date,OLD.category) IS DISTINCT FROM (NEW.service_date,NEW.category) THEN
   RAISE EXCEPTION '不可變更已儲存出勤欄位設定的日期或類別';
 END IF;
 -- Serialize changes to a particular day against assignments made via the board.
 PERFORM pg_catalog.pg_advisory_xact_lock(20261019,pg_catalog.hashtext(NEW.service_date::text));
 IF EXISTS (SELECT 1 FROM public.daily_attendance_closeouts c
            WHERE c.service_date=NEW.service_date AND c.closed_at IS NOT NULL) THEN
   RAISE EXCEPTION '此日期已結案，請先重新開啟';
 END IF;
 SELECT COALESCE(MAX(r.attendance_slot_index),0) INTO highest FROM public.runs r
 WHERE r.service_date=NEW.service_date AND r.attendance_category=NEW.category;
 IF NEW.slot_count < highest THEN
   RAISE EXCEPTION '%第 % 趟已有資料，不可減少至 % 趟',NEW.category,highest,NEW.slot_count;
 END IF;
 NEW.updated_at:=now();NEW.updated_by:=auth.uid();
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS dashboard_attendance_slot_counts_guard ON public.daily_attendance_slot_counts;
CREATE TRIGGER dashboard_attendance_slot_counts_guard
 BEFORE INSERT OR UPDATE ON public.daily_attendance_slot_counts FOR EACH ROW
 EXECUTE FUNCTION public.dashboard_guard_attendance_slot_count();

CREATE OR REPLACE FUNCTION public.dashboard_guard_attendance_slot_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE limit_slots integer;
BEGIN
 IF TG_OP='UPDATE' AND
    (OLD.attendance_category,OLD.attendance_slot_index) IS DISTINCT FROM
    (NEW.attendance_category,NEW.attendance_slot_index) AND
    EXISTS (SELECT 1 FROM public.trip_executions e
      WHERE e.run_id=OLD.id AND e.review_status='confirmed') THEN
   RAISE EXCEPTION '此趟次已確認，無法改動出勤類別或欄位';
 END IF;
 -- Leave old dispatchers compatible: unclassified legacy rows are allowed and
 -- remain visible under 其他路線 until a supervisor explicitly classifies them.
 IF NEW.attendance_category IS NULL THEN RETURN NEW; END IF;
 IF NOT (SELECT private.is_dispatcher()) THEN RAISE EXCEPTION '只有主管可指定出勤欄位'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(20261019,pg_catalog.hashtext(NEW.service_date::text));
 SELECT COALESCE((SELECT c.slot_count FROM public.daily_attendance_slot_counts c
                  WHERE c.service_date=NEW.service_date AND c.category=NEW.attendance_category),
                 public.dashboard_attendance_slot_base(NEW.attendance_category))
 INTO limit_slots;
 IF NEW.attendance_slot_index > limit_slots THEN
   RAISE EXCEPTION '此日期的%目前只有%趟；請先調整趟數',NEW.attendance_category,limit_slots;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS dashboard_attendance_run_slot_guard ON public.runs;
CREATE TRIGGER dashboard_attendance_run_slot_guard
 BEFORE INSERT OR UPDATE OF attendance_category,attendance_slot_index,service_date ON public.runs
 FOR EACH ROW EXECUTE FUNCTION public.dashboard_guard_attendance_slot_assignment();

-- One transaction for all five categories: cancelled modals never persist;
-- one failing category rolls back every count change.
CREATE OR REPLACE FUNCTION public.dashboard_set_attendance_slot_counts(p_service_date date,p_counts jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE grp text; n integer; raw text;
BEGIN
 IF NOT (SELECT private.is_dispatcher()) THEN RAISE EXCEPTION '只有主管可調整每日趟數'; END IF;
 IF p_service_date IS NULL OR p_counts IS NULL OR jsonb_typeof(p_counts)<>'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_counts))<>5 THEN
   RAISE EXCEPTION '請提供日期與五個配送類別的趟數';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(20261019,pg_catalog.hashtext(p_service_date::text));
 IF EXISTS (SELECT 1 FROM public.daily_attendance_closeouts c
            WHERE c.service_date=p_service_date AND c.closed_at IS NOT NULL) THEN
    RAISE EXCEPTION '此日期已結案，請先重新開啟';
 END IF;
 FOREACH grp IN ARRAY ARRAY['日配','OC','鮮二','冷凍','低鮮'] LOOP
   raw:=p_counts->>grp;
   IF raw IS NULL OR raw !~ '^[0-9]{1,2}$' THEN
     RAISE EXCEPTION '類別 % 的趟數不是整數',grp;
   END IF;
   n:=raw::integer;
   IF n NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION '每日每類別僅可設定 1–30 趟'; END IF;
   INSERT INTO public.daily_attendance_slot_counts(service_date,category,slot_count)
     VALUES(p_service_date,grp,n)
   ON CONFLICT(service_date,category) DO UPDATE SET slot_count=excluded.slot_count;
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.dashboard_set_attendance_slot_counts(date,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dashboard_set_attendance_slot_counts(date,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_attendance_slot_base(text) TO authenticated;
COMMIT;

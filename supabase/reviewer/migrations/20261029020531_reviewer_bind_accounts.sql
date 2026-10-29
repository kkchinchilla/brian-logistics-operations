-- REVIEW PROJECT ONLY: vfnpgecoewtyyzukizgu. Never add to the operational chain.
-- Read Auth identities created by the Admin API; never mutate managed Auth tables.
DO $review$
DECLARE owner_id uuid;
BEGIN
 IF private.dashboard146_finance_owner() IS NOT NULL
    OR EXISTS(SELECT 1 FROM public.profiles)
    OR EXISTS(SELECT 1 FROM public.routes)
    OR EXISTS(SELECT 1 FROM public.runs)
    OR (SELECT count(*) FROM auth.users) <> 3
 THEN RAISE EXCEPTION 'Reviewer-only bootstrap requires an unbound empty application and exactly three prepared Auth users'; END IF;

 IF (SELECT count(*) FROM auth.users u JOIN (VALUES
      ('12025550101','owner'),('12025550102','supervisor'),('12025550103','driver')
    ) expected(phone,role) ON ltrim(u.phone,'+')=expected.phone
      AND u.raw_app_meta_data->>'review_role'=expected.role
    WHERE u.deleted_at IS NULL AND u.phone_confirmed_at IS NOT NULL
      AND u.raw_app_meta_data->>'review_bootstrap' ~ '^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$') <> 3
    OR (SELECT count(DISTINCT raw_app_meta_data->>'review_bootstrap') FROM auth.users) <> 1
 THEN RAISE EXCEPTION 'Reviewer identities do not match one confirmed bootstrap batch'; END IF;

 SELECT id INTO STRICT owner_id FROM auth.users
 WHERE ltrim(phone,'+')='12025550101' AND raw_app_meta_data->>'review_role'='owner';
 -- Freeze the verified ID in the existing private binding; metadata is not used
 -- for authorization after provisioning. CREATE OR REPLACE preserves its ACL.
 EXECUTE format(
   'CREATE OR REPLACE FUNCTION private.dashboard146_finance_owner() RETURNS uuid LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '''' AS %L',
   format('SELECT %L::uuid;',owner_id::text));

 INSERT INTO public.profiles(id,display_name,role,active,can_manage_finance)
 SELECT id,
   CASE raw_app_meta_data->>'review_role'
     WHEN 'owner' THEN '審查管理員' WHEN 'supervisor' THEN '審查主管' ELSE '審查司機' END,
   CASE WHEN raw_app_meta_data->>'review_role'='driver' THEN 'driver' ELSE 'dispatcher' END,
   true,id=owner_id
 FROM auth.users;
END
$review$;

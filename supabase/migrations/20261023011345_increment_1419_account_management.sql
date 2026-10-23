-- Account credentials stay in Supabase Auth. All Auth mutations use its Admin API.
-- Profiles (and their foreign keys) survive account deletion for historical reporting.
CREATE TABLE private.account_admin_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid NOT NULL,
 target_id uuid NOT NULL,
 action text NOT NULL CHECK (action IN ('create','edit','phone','password','delete_requested','delete')),
 happened_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE private.account_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.account_admin_audit FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX account_admin_audit_target ON private.account_admin_audit(target_id,happened_at DESC);

CREATE FUNCTION private.dashboard1419_active_account() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
 WHERE p.id=(SELECT auth.uid()) AND p.active AND u.deleted_at IS NULL);
$$;
REVOKE ALL ON FUNCTION private.dashboard1419_active_account() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.dashboard1419_active_account() TO authenticated;
-- Reject still-unexpired JWTs belonging to removed/inactive accounts, including
-- company-wide roster policies. Existing row-level permissions still apply.
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity LOOP
  EXECUTE format('CREATE POLICY account1419_active_access ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT private.dashboard1419_active_account())) WITH CHECK ((SELECT private.dashboard1419_active_account()))',t.relname);
 END LOOP;
END $$;

CREATE FUNCTION public.dashboard_account_admin_context() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE sid text;
BEGIN
 IF NOT coalesce(private.can_manage_finance(),false) OR NOT private.dashboard1419_active_account()
 THEN RAISE EXCEPTION '帳號管理僅限 Brian 使用' USING ERRCODE='42501'; END IF;
 sid:=nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'session_id';
 IF sid IS NULL OR NOT EXISTS(SELECT 1 FROM auth.sessions s WHERE s.id::text=sid AND s.user_id=auth.uid() AND (s.not_after IS NULL OR s.not_after>now()))
 THEN RAISE EXCEPTION '登入已失效，請重新登入' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('actor_id',auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.dashboard_account_admin_context() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_account_admin_context() TO authenticated;

-- These service-only RPCs never accept the browser's credentials. The Edge Function
-- verifies Brian and his live session before constructing its privileged client.
CREATE FUNCTION public.dashboard_account_directory(p_actor uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_actor IS DISTINCT FROM private.dashboard146_finance_owner() OR NOT EXISTS(
 SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=p_actor AND p.active AND p.role='dispatcher' AND p.can_manage_finance AND u.deleted_at IS NULL)
 THEN RAISE EXCEPTION '帳號管理僅限 Brian 使用' USING ERRCODE='42501';END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'role',p.role,
 'active',p.active,'phone',CASE WHEN u.deleted_at IS NULL THEN coalesce(u.phone,'') ELSE '' END,
 'phone_confirmed',u.phone_confirmed_at IS NOT NULL,'deleted',u.deleted_at IS NOT NULL,
 'is_owner',p.id=private.dashboard146_finance_owner()) ORDER BY p.created_at,p.id)
 FROM public.profiles p JOIN auth.users u ON u.id=p.id),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.dashboard_account_directory(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_account_directory(uuid) TO service_role;

CREATE FUNCTION public.dashboard_account_apply(p_actor uuid,p_target uuid,p_action text,p_name text DEFAULT NULL,p_role text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target public.profiles%ROWTYPE;is_deleted boolean;
BEGIN
 IF p_actor IS DISTINCT FROM private.dashboard146_finance_owner() OR NOT EXISTS(
 SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id WHERE p.id=p_actor AND p.active AND p.role='dispatcher' AND p.can_manage_finance AND u.deleted_at IS NULL)
 THEN RAISE EXCEPTION '帳號管理僅限 Brian 使用' USING ERRCODE='42501';END IF;
 IF p_action IS NULL OR p_action NOT IN ('create','edit','phone','password','delete_requested','delete') THEN RAISE EXCEPTION '操作不正確';END IF;
 SELECT deleted_at IS NOT NULL INTO is_deleted FROM auth.users WHERE id=p_target;
 IF NOT FOUND THEN RAISE EXCEPTION '找不到帳號';END IF;
 SELECT * INTO target FROM public.profiles WHERE id=p_target FOR UPDATE;
 IF p_action='create' THEN
  IF FOUND OR is_deleted THEN RAISE EXCEPTION '帳號已存在或已刪除';END IF;
 ELSE
  IF NOT FOUND THEN RAISE EXCEPTION '找不到使用者資料';END IF;
  IF (is_deleted AND p_action<>'delete') OR (NOT target.active AND p_action NOT IN ('delete_requested','delete')) THEN RAISE EXCEPTION '此帳號已停用或刪除';END IF;
 END IF;
 IF p_target=private.dashboard146_finance_owner() AND (p_action IN ('delete_requested','delete') OR (p_action='edit' AND p_role IS DISTINCT FROM 'dispatcher'))
 THEN RAISE EXCEPTION '無法刪除自己的管理員帳號或變更管理員角色';END IF;
 IF p_action IN ('create','edit') THEN
  IF p_name IS NULL OR length(btrim(p_name)) NOT BETWEEN 1 AND 70 OR p_role IS NULL OR p_role NOT IN ('driver','dispatcher') THEN RAISE EXCEPTION '請填寫姓名及正確角色';END IF;
  IF p_action='create' THEN
   INSERT INTO public.profiles(id,display_name,role,active,can_manage_finance) VALUES(p_target,btrim(p_name),p_role,true,false);
  ELSE
   UPDATE public.profiles SET display_name=btrim(p_name),role=p_role WHERE id=p_target;
  END IF;
 ELSIF p_action='delete_requested' THEN
  UPDATE public.profiles SET active=false WHERE id=p_target;
 ELSIF p_action='delete' THEN
  IF NOT is_deleted THEN RAISE EXCEPTION '登入帳號尚未完成刪除';END IF;
  UPDATE public.profiles SET active=false WHERE id=p_target;
 END IF;
 INSERT INTO private.account_admin_audit(actor_id,target_id,action) VALUES(p_actor,p_target,p_action);
END $$;
REVOKE ALL ON FUNCTION public.dashboard_account_apply(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_account_apply(uuid,uuid,text,text,text) TO service_role;

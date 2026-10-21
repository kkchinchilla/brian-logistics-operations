-- Read-only installation verification. Does not rerun migrations or modify records.
SELECT version,name FROM supabase_migrations.schema_migrations WHERE name='increment_149_payroll_reconciliation';
SELECT n.nspname,p.proname,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('dashboard_get_payroll_reconciliation','dashboard_save_payroll_config','dashboard_add_payroll_rate','dashboard_end_payroll_rate');
-- Expected: four invoker functions, empty search_path, anon false, authenticated true.
-- Authenticated access is still restricted inside each function and by existing Brian-only RLS.
SELECT tablename,policyname,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename IN ('payroll_configs','payroll_rules','payroll_adjustments','expense_records');
SELECT 'payroll_configs' AS table_name,count(*) FROM public.payroll_configs
UNION ALL SELECT 'payroll_rules',count(*) FROM public.payroll_rules;
-- Counts depend on Brian's later edits. This increment inserts no default configurations or rates.

-- Read-only verification after Increment 1.4.5: direct, non-audited attendance run editing.
SELECT jsonb_build_object(
 'direct_rpc',to_regprocedure('public.dashboard_edit_run_direct(bigint,bigint,bigint,text,integer,integer,boolean)') IS NOT NULL,
 'authenticated_can_call_direct_rpc',has_function_privilege('authenticated','public.dashboard_edit_run_direct(bigint,bigint,bigint,text,integer,integer,boolean)','EXECUTE'),
 'driver_ownership_guard_in_rpc',(SELECT position('r.driver_id<>actor' in pg_get_functiondef(p.oid))>0 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='dashboard_edit_run_direct'),
 'driver_marker',to_regprocedure('private.dashboard145_direct_edit_allowed(bigint)') IS NOT NULL,
 'old_observation_rpc_callable_by_authenticated',has_function_privilege('authenticated','public.dashboard_save_actual_observation(bigint,bigint,bigint,text,integer)','EXECUTE'),
 'run_audit_trigger',(SELECT count(*) FROM pg_trigger WHERE tgrelid='public.runs'::regclass AND tgname='zzz_dashboard143_audit' AND tgenabled<>'D'),
 'template_audit_trigger',(SELECT count(*) FROM pg_trigger WHERE tgrelid='public.driver_day_templates'::regclass AND tgname='zzz_dashboard143_audit' AND tgenabled<>'D'),
 'extra_audit_trigger',(SELECT count(*) FROM pg_trigger WHERE tgrelid='public.daily_attendance_extra_trips'::regclass AND tgname='dashboard_log_extra_trip' AND tgenabled<>'D'),
 'existing_runs',(SELECT count(*) FROM public.runs),
 'confirmed_executions',(SELECT count(*) FROM public.trip_executions WHERE review_status='confirmed'),
 'unconsolidated_legacy_observations',(SELECT count(*) FROM public.daily_run_observations),
 'closed_day_guard',(SELECT count(*) FROM pg_trigger WHERE tgrelid='public.runs'::regclass AND tgname='dashboard_closed_run_day_guard' AND tgenabled<>'D'),
 'binding_rental_guard',(SELECT count(*) FROM pg_trigger WHERE tgrelid='public.runs'::regclass AND tgname='aaa_dashboard144_rental_run' AND tgenabled<>'D')
) AS verification;

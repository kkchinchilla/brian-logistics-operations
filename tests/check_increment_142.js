/* Non-production release regression / static guard: node tests/check_increment_142.js */
const assert=require('assert');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const a=read('js/production-attendance.js'),sql=read('sql/142_01_actual_trip_workflows.sql');
const html=read('ui-attendance.html'),css=read('css/attendance-actual-142.css');
for(const label of ['actual_route_id','actual_vehicle_id','revision'])assert(a.includes(label),'missing '+label);
for(const fn of ['dashboard_save_actual_observation','dashboard_save_extra_actual_trip']){
 assert(sql.includes('FUNCTION public.'+fn),'142 historical migration missing RPC '+fn);
}
assert(a.includes('dashboard_edit_run_direct'), '145 UI must edit runs directly');
assert(a.includes('dashboard_save_extra_actual_trip'), 'extra-trip safeguard preserved');
const direct=read('sql/145_01_direct_run_edits.sql');
assert(direct.includes('CREATE OR REPLACE FUNCTION public.dashboard_edit_run_direct'),'direct-update RPC missing');
for(const name of ['daily_attendance_extra_trips','daily_attendance_change_log','dashboard_guard_attendance_slot_count','dashboard_guard_attendance_slot_assignment','dashboard_guard_closeout_lock','dashboard_bump_schedule_revision'])assert(sql.includes(name),'missing SQL safeguard '+name);
assert(a.includes("[data-add]")||a.includes("document.querySelectorAll('[data-add]')"));
assert(a.includes("document.querySelectorAll('[data-extra]')"));
assert(a.includes('actualWriteReady'));
assert(a.includes("status==='active'"));
assert(a.includes(".eq('dashboard_schedule_revision',expectedRevision)"));
assert(sql.includes('FOR UPDATE'));
assert(sql.includes('p_expected_revision'));
assert(sql.includes("review_status='confirmed'"));
assert(sql.includes('REVOKE INSERT,UPDATE,DELETE ON public.daily_run_observations FROM authenticated'));
assert(sql.includes('REVOKE INSERT,UPDATE,DELETE ON public.daily_attendance_extra_trips FROM authenticated'));
assert(sql.includes('pg_advisory_xact_lock'));
assert(html.includes('attendance-actual-142.css'));
assert(css.includes('add-actual'));
assert(!/\b(TRUNCATE|DROP TABLE|DELETE FROM public\.runs|DELETE FROM public\.daily_run_observations)\b/i.test(sql),'destructive operation in SQL');
assert(!/INSERT INTO public\.trip_executions/i.test(sql),'payroll execution should not be silently created');
console.log('PASS 142 legacy migration protections + 145 direct-run compatibility');

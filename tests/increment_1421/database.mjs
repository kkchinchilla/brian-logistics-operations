// Isolated real-schema authorization and supervisor regression checks. No live data.
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const pg=new PGlite(),dir=new URL('../../supabase/migrations/',import.meta.url);
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const value=async(sql,args)=>Object.values((await pg.query(sql,args)).rows[0])[0];
const actor=n=>pg.exec(`RESET ROLE;SELECT set_config('request.jwt.claim.sub','${id(n)}',false);SET ROLE authenticated;`);
const migration=n=>fs.readFileSync(new URL(fs.readdirSync(dir).find(f=>f.includes('_increment_'+n+'_')),dir),'utf8');
const empty={kind:'empty',id:null,revision:0,observation_revision:0};
const day='2026-10-25';
const saveDuty=(driver,category,target,source=empty,date=day)=>value('select dashboard_save_attendance_duty($1,$2,$3,1,$4,$5)',[date,id(driver),category,source,target]);
const fingerprint=()=>value("select jsonb_build_object('runs',(select jsonb_agg(to_jsonb(x) order by id) from runs x),'observations',(select jsonb_agg(to_jsonb(x) order by id) from daily_run_observations x),'requests',(select jsonb_agg(to_jsonb(x) order by id) from attendance_change_requests x),'closeouts',(select jsonb_agg(to_jsonb(x) order by service_date) from daily_attendance_closeouts x),'events',(select jsonb_agg(to_jsonb(x) order by id) from attendance_closeout_events x))");
let checks=0;const ok=(name,v=true)=>{assert.ok(v,name);checks++;console.log('PASS:',name);};
try{
 await pg.exec(fs.readFileSync(new URL('../increment_146/baseline_fixture.sql',import.meta.url),'utf8'));
 for(const n of ['146','147','148','149','1491','1410','1411','14111','1412','1413','1414','1415','1416','1418'])await pg.exec(migration(n));
 await pg.exec('ALTER TABLE auth.users ADD COLUMN phone text,ADD COLUMN phone_confirmed_at timestamptz,ADD COLUMN deleted_at timestamptz;CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,not_after timestamptz);');
 await pg.exec(migration('1419'));
 await actor(2);
 await pg.exec("INSERT INTO delivery_temperature_zones(name) VALUES('常溫');INSERT INTO delivery_regions(id,name) VALUES(1,'Test');INSERT INTO vehicles(id,plate_number) VALUES(1,'TEST-1'),(2,'TEST-2');INSERT INTO routes(id,route_code,temperature_zone,delivery_region_id) VALUES(1,'TEST-ROUTE','常溫',1);");
 for(const n of [3,4]){
  await pg.query('INSERT INTO runs(id,service_date,route_id,driver_id,vehicle_id,attendance_category,attendance_slot_index) VALUES($1,$2,1,$3,$4,\'日配\',1)',[n,day,id(n),n-2]);
  await value('select dashboard_save_extra_actual_trip($1,$2,\'OC\',1,1,$3,false,\'extra fixture\',0,false)',[day,id(n),n-2]);
  await saveDuty(n,'冷凍',{kind:'learning',note:'learning fixture'});
  await saveDuty(n,'低鮮',{kind:'follow_along',note:'follow fixture'});
  await value('select dashboard_save_attendance_standby($1,$2,\'鮮二\',1,$3,$4)',[day,id(n),empty,{kind:'standby',note:'standby fixture'}]);
 }
 await pg.exec('RESET ROLE;');
 await pg.query("INSERT INTO daily_run_observations(run_id,driver_id,actual_route_id,actual_vehicle_id,actual_note) VALUES(3,$1,1,1,'own observation'),(4,$2,1,2,'other observation')",[id(3),id(4)]);
 // Retained historical requests and closed snapshots predate the new authorization.
 await actor(3);const request=await value('select dashboard_request_attendance_change(3,null,1,1,\'historical request\',1,1,false)');
 await actor(2);await value('select dashboard_review_attendance_change($1,$2,false,\'historical rejection\')',[request.id,request.revision]);
 await value('select dashboard_close_attendance_through($1,\'fixture close\')',[day]);
 await pg.exec('RESET ROLE;');const before=await fingerprint();await pg.exec(migration('1421'));
 assert.deepEqual(await fingerprint(),before);ok('migration preserves attendance, historical requests and closed snapshots exactly');
 await actor(3);
 for(const table of ['runs','daily_run_observations','daily_attendance_extra_trips','attendance_driver_days','attendance_duty_entries']){
  const rows=(await pg.query('SELECT driver_id FROM '+table)).rows;
  ok('driver can read only own '+table,rows.length>0&&rows.every(x=>x.driver_id===id(3)));
 }
 for(const rpc of ['dashboard_get_attendance_standby','dashboard_get_attendance_duties']){
  const rows=await value('select '+rpc+'($1)',[day]);ok('privileged '+rpc+' returns only own rows',rows.length>0&&rows.every(x=>x.driver_id===id(3)));
 }
 ok('company closeout snapshots and approval history are inaccessible',Number(await value('select count(*) from daily_attendance_closeouts'))===0&&Number(await value('select count(*) from attendance_change_requests'))===0);
 assert.deepEqual(Object.keys(await value('select dashboard_get_attendance_day_state($1)',[day])).sort(),['closed','service_date']);ok('day-state RPC cannot leak a company snapshot');
 await actor(2);await value('select dashboard_reopen_attendance_date($1,\'test readonly while open\')',[day]);
 await actor(3);
 for(const table of ['runs','daily_run_observations']){
  const field=table==='runs'?'dispatcher_notes':'actual_note';
  const unchanged=async sql=>{try{return (await pg.query(sql)).rows.length===0;}catch(e){if(e.code==='42501')return true;throw e;}};
  ok('driver cannot update '+table,await unchanged(`UPDATE ${table} SET ${field}='forbidden' RETURNING id`));
  ok('driver cannot delete '+table,await unchanged(`DELETE FROM ${table} RETURNING id`));
 }
 await assert.rejects(()=>pg.query('INSERT INTO daily_run_observations(run_id,driver_id) VALUES(3,$1)',[id(3)]),/僅可查看|row-level|permission/);ok('driver direct insertion is blocked');
 const requests=[
  "select dashboard_request_attendance_change(3,null,1,1,'bad',1,1,false)",
  `select dashboard_request_attendance_add('${day}','日配',2,1,1,'bad',0)`,
  `select dashboard_review_attendance_change(${request.id},1,true,'bad')`,
  "select v055_submit_special_completion(1,'bad')"
 ];
 for(const sql of requests)await assert.rejects(()=>value(sql),/permission denied/);
 ok('retired request/review/completion endpoints reject cached clients');
 for(const rpc of ['dashboard_save_attendance_duty','dashboard_save_attendance_standby'])await assert.rejects(()=>value(`select ${rpc}($1,$2,'日配',2,$3,$4)`,[day,id(3),empty,{kind:'learning',note:'bad'}]),/主管|權限/);
 await assert.rejects(()=>value('select dashboard_edit_run_direct(3,1,1,\'bad\',1,1,false)'),/主管|權限/);
 await assert.rejects(()=>value('select dashboard_set_driver_leave($1,$2,true,0)',[day,id(3)]),/主管|權限/);
 await assert.rejects(()=>value('select dashboard_close_attendance_through($1,\'bad\')',[day]),/主管|權限/);ok('driver cannot edit duties, runs, leave or close days through RPCs');
 for(const t of ['runs','daily_run_observations','daily_attendance_extra_trips','attendance_driver_days','attendance_duty_entries','v055_standby_shifts','trip_executions','v055_run_work','v055_driver_work_completions','daily_attendance_closeouts','attendance_closeout_events','attendance_change_requests','daily_attendance_slot_counts']){
  assert.equal(await value("select has_table_privilege('authenticated',$1,'TRUNCATE') or has_table_privilege('authenticated',$1,'TRIGGER')",[t]),false);
 }
 await assert.rejects(()=>pg.exec('TRUNCATE daily_attendance_extra_trips'),/permission/);ok('table-level privileges cannot bypass driver row protection');
 // Simulate an old SECURITY DEFINER function with a driver JWT: RLS bypass must still fail.
 await pg.exec('RESET ROLE;');await assert.rejects(()=>pg.query("UPDATE runs SET status='in_progress' WHERE id=3"),/僅可查看/);ok('table trigger blocks a privileged legacy writer acting for a driver');
 await actor(2);ok('supervisor still reads both drivers',Number(await value('select count(*) from runs'))===2&&(await value('select dashboard_get_attendance_duties($1)',[day])).length===4);
 await value('select dashboard_edit_run_direct(3,1,1,\'supervisor correction\',1,1,false)');ok('supervisor directly edits attendance',await value("select dispatcher_notes='supervisor correction' from runs where id=3"));
 let duty=(await value('select dashboard_get_attendance_duties($1)',[day])).find(x=>x.driver_id===id(3)&&x.kind==='learning');
 const source={kind:'duty',id:duty.id,revision:duty.revision,observation_revision:0};
 await saveDuty(3,'冷凍',{kind:'learning',note:'supervisor updated'},source);ok('supervisor saves duties without creating an approval request',Number(await value('select count(*) from attendance_change_requests'))===1);
 await assert.rejects(()=>saveDuty(3,'冷凍',{kind:'learning',note:'stale'},source),/原紀錄/);ok('stale supervisor edits remain protected');
 await value('select dashboard_set_driver_leave($1,$2,true,0)',['2026-10-26',id(3)]);ok('supervisor retains leave scheduling',await value("select is_leave from attendance_driver_days where service_date='2026-10-26' and driver_id=$1",[id(3)]));
 await value('select dashboard_close_attendance_through($1,\'reclose fixture\')',[day]);
 ok('reclose captures supervisor correction',(await value('select dashboard_get_attendance_day_state($1)',[day])).closed===true);
 await assert.rejects(()=>saveDuty(3,'冷凍',{kind:'learning',note:'closed'},source),/結案/);ok('closed dates still reject supervisor edits');
 await pg.exec('RESET ROLE;');await pg.query('UPDATE profiles SET active=false WHERE id=$1',[id(3)]);await actor(3);
 ok('inactive driver loses schedule read access',Number(await value('select count(*) from runs'))===0);
 await assert.rejects(()=>value('select dashboard_get_attendance_duties($1)',[day]),/權限/);
 await pg.exec("RESET ROLE;SELECT set_config('request.jwt.claim.sub','',false);SET ROLE anon;");await assert.rejects(()=>value('select dashboard_get_attendance_standby($1)',[day]),/permission/);ok('anonymous and inactive RPC access remain denied');
 console.log(`RESULT: ${checks} driver-readonly database checks passed`);
}catch(e){console.error('FAIL:',e.message,e.query||'',e.where||'');process.exitCode=1;}finally{await pg.close();}

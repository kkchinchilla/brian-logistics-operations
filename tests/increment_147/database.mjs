import {PGlite} from '@electric-sql/pglite';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {cases} from '../increment_146/regression_cases.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const pg=new PGlite();let count=0;
const ok=(name,test)=>{assert.ok(test,name);console.log('PASS:',name);count++;};
const one=async sql=>(await pg.query(sql)).rows[0];const scalar=async sql=>Object.values(await one(sql))[0];
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const actor=async n=>pg.exec(`RESET ROLE;SELECT set_config('request.jwt.claim.sub','${id(n)}',false);SET ROLE authenticated;`);
const report=async(month='2026-10-01')=>scalar(`SELECT dashboard_get_finalized_monthly('${month}')`);
const denied=async(sql,re)=>{await assert.rejects(()=>pg.query(sql),re);};
try{
 await pg.exec(fs.readFileSync(here+'/../increment_146/baseline_fixture.sql','utf8'));
 for(const inc of ['146','147','148','149','1491']){const f=fs.readdirSync(root+'/supabase/migrations').find(f=>f.includes('_'+inc+'_')||f.includes('increment_'+inc+'_'));await pg.exec(fs.readFileSync(root+'/supabase/migrations/'+f,'utf8'));}
 await cases(pg);await actor(1);
 let data=await report();
 ok('closed assigned/in-progress runs count without execution review',data.deliveries.length===10&&Number(await scalar('SELECT count(*) FROM trip_executions'))===2);
 ok('open next date and void extra excluded',!data.deliveries.some(x=>x.service_date==='2026-10-11'||x.source_type==='extra'));
 ok('pending special work finalized by closing',data.special_work.length===1&&data.special_work[0].finalized&&data.special_work[0].review_status==='pending');
 ok('every included delivery has event provenance',data.deliveries.every(x=>x.finalized&&x.close_event_id&&x.closed_at));
 const original=data.deliveries.find(x=>x.run_id===2), oldSnapshot=await scalar(`SELECT snapshot FROM attendance_closeout_events WHERE id=${original.close_event_id}`);
 await scalar("SELECT dashboard_reopen_attendance_date('2026-10-02','correction')");
 data=await report();ok('reopened date excluded immediately',data.deliveries.length===9&&data.dates.find(x=>x.service_date==='2026-10-02').status==='reopened');
 await scalar("SELECT dashboard_edit_run_direct(2,2,2,'new finalized note',(SELECT dashboard_schedule_revision FROM runs WHERE id=2),0,false)");
 ok('open correction does not leak into monthly source',!(await report()).deliveries.some(x=>x.run_id===2));
 await scalar("SELECT dashboard_close_attendance_through('2026-10-20','reclose')");
 data=await report();ok('reclose replaces one date and preserves older closed dates',data.deliveries.length===11&&data.deliveries.find(x=>x.run_id===2).driver_notes==='new finalized note'&&new Set(data.deliveries.map(x=>x.id)).size===11);
 assert.deepEqual(await scalar(`SELECT snapshot FROM attendance_closeout_events WHERE id=${original.close_event_id}`),oldSnapshot);ok('prior snapshot stays unchanged',true);
 const closedRecord=data.deliveries.find(x=>x.run_id===2);
 await pg.exec("RESET ROLE;ALTER TABLE routes DISABLE TRIGGER USER;UPDATE routes SET route_code='MASTER-CHANGED',temperature_zone='OTHER' WHERE id=2;ALTER TABLE routes ENABLE TRIGGER USER;ALTER TABLE vehicles DISABLE TRIGGER USER;UPDATE vehicles SET plate_number='RENAMED' WHERE id=2;ALTER TABLE vehicles ENABLE TRIGGER USER;");await actor(1);
 assert.deepEqual((await report()).deliveries.find(x=>x.run_id===2),closedRecord);ok('later master changes cannot alter frozen report metadata',true);
 await actor(2);await denied("SELECT dashboard_get_finalized_monthly('2026-10-01')",/Brian/);await denied("SELECT private.dashboard147_monthly('2026-10-01')",/Brian/);ok('Karen denied through public and private entry points',true);
 await actor(3);await denied("SELECT dashboard_get_finalized_monthly('2026-10-01')",/Brian/);ok('driver denied',true);
 await pg.exec('RESET ROLE;SET ROLE anon;');await denied("SELECT dashboard_get_finalized_monthly('2026-10-01')",/permission denied/);ok('anonymous denied',true);
 await actor(1);await denied("SELECT dashboard_get_finalized_monthly('2026-10-02')",/第一日/);ok('invalid month rejected',true);
 // Archival fixtures exercise pre-147 snapshots without inventing missing historical metadata.
 const snapshot={runs:[{id:100,service_date:'2026-11-01',driver_id:id(3),vehicle_id:1,route_id:1,status:'assigned',route_code_snapshot:'OLD',temperature_zone_snapshot:'常溫',is_rental:false},{id:101,service_date:'2026-11-01',driver_id:id(3),vehicle_id:1,route_id:1,status:'cancelled'}],observations:[{run_id:100,actual_vehicle_id:2,actual_route_id:2,actual_note:'saved observation'}],trip_executions:[{run_id:100,review_status:'confirmed'}],extra_trips:[{id:100,service_date:'2026-11-01',driver_id:id(3),actual_route_id:2,actual_vehicle_id:2,status:'active',is_rental:true},{id:101,service_date:'2026-11-01',driver_id:id(3),status:'void'}],special_work:[{id:100,run_id:100,service_date:'2026-11-01',kind:'breakdown_replacement',driver_id:id(4),vehicle_id:2,replacement_payee:'both',standby_shift_id:100,review_status:'pending'},{id:101,run_id:100,service_date:'2026-11-01',kind:'follow_along',driver_id:id(3),follow_stage_snapshot:'trainee',review_status:'pending'},{id:102,run_id:100,service_date:'2026-11-01',kind:'attached_support',driver_id:id(3),review_status:'rejected'}],standby:[{id:100,service_date:'2026-11-01',driver_id:id(4),review_status:'pending'},{id:101,service_date:'2026-11-01',driver_id:id(3),review_status:'pending'}],attendance_records:[{id:100,service_date:'2026-11-01',driver_id:id(3),review_status:'pending'},{id:101,service_date:'2026-11-01',driver_id:id(3),review_status:'rejected'}]};
 await pg.exec('RESET ROLE;');await pg.query(`INSERT INTO attendance_closeout_events(action,through_date,actor_id,affected_dates,snapshot) VALUES('close','2026-11-01',$1,ARRAY['2026-11-01'::date],$2)`,[id(1),JSON.stringify(snapshot)]);await actor(1);
 data=await report('2026-11-01');
 ok('legacy snapshots supported; run/execution not double counted; extra ID distinct',data.deliveries.length===2&&new Set(data.deliveries.map(x=>x.id)).size===2&&data.deliveries.every(x=>x.legacy_snapshot));
 const replaced=data.deliveries.find(x=>x.run_id===100);
 ok('B/C replacement remains one delivery attributed to actual replacement driver',replaced.driver_id===id(4)&&replaced.original_driver_id===id(3)&&data.special_work[0].replacement_payee==='both');
 ok('old corrected metadata remains unknown instead of borrowing current masters',replaced.route_code_snapshot===null&&replaced.route_temperature_zone===null&&replaced.is_rental===null&&replaced.driver_notes==='saved observation');
 ok('support/follow-along excluded from delivery count; rejected work excluded',data.special_work.length===2&&data.deliveries.length===2);
 ok('standby converted once and unconverted pending shift finalized',data.standby.length===2&&data.standby[0].converted_to_support&&!data.standby[1].converted_to_support&&data.standby[1].finalized);
 ok('attendance exceptions finalized without per-row review; rejected excluded',data.attendance_records.length===1&&data.attendance_records[0].finalized);
 await pg.exec('RESET ROLE;');
 await pg.query(`INSERT INTO attendance_closeout_events(action,through_date,actor_id,affected_dates,snapshot)
 SELECT 'close','2026-12-01',$1::uuid,ARRAY['2026-12-01'::date],jsonb_build_object('runs',jsonb_agg(jsonb_build_object('id',i,'service_date','2026-12-01','status','assigned','driver_id',$1::text,'route_id',1,'vehicle_id',1,'route_code_snapshot','01','temperature_zone_snapshot','常溫','is_rental',false))) FROM generate_series(1,1005) i`,[id(3)]);
 await actor(1);data=await report('2026-12-01');ok('monthly JSON source is not truncated at 1000 records',data.deliveries.length===1005);
 ok('empty month returns valid complete structure',(await report('2027-01-01')).deliveries.length===0);
 console.log(`RESULT: ${count} Increment 1.4.7 scenarios passed plus 29 Increment 1.4.6 regressions`);
}catch(e){console.error(e.stack,e.detail||'',e.where||'',e.query?.slice(0,500)||'');process.exitCode=1;}finally{await pg.close();}

import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),E=require('../../js/payroll-reconciliation-1491.js');
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),pg=new PGlite(),keep=setInterval(()=>{},1000);let count=0;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const scalar=async(sql,args)=>(Object.values((await pg.query(sql,args)).rows[0]))[0];
const actor=async n=>pg.exec(`RESET ROLE;SELECT set_config('request.jwt.claim.sub','${id(n)}',false);SET ROLE authenticated;`);
const ok=(name,test=true)=>{assert.ok(test,name);console.log('PASS:',name);count++};
const denied=async(name,sql,args,re)=>{await assert.rejects(()=>pg.query(sql,args),re);ok(name)};
const read=()=>scalar("select dashboard_get_route_payroll('2026-10-01')");
const save=(standby,rental,date,revision,reason='isolated test only')=>scalar('select dashboard_save_payroll_supplements($1,$2,$3,$4,$5)',[date,standby,rental,reason,revision]);
try{
 await pg.exec(fs.readFileSync(here+'/../increment_146/baseline_fixture.sql','utf8'));
 for(const inc of ['146','147','148','149','1491','1410','1411']){const f=fs.readdirSync(root+'/supabase/migrations').find(f=>f.includes('increment_'+inc+'_'));await pg.exec(fs.readFileSync(root+'/supabase/migrations/'+f,'utf8'));}
 await actor(1);let bundle=await read();ok('migration adds no default amounts',bundle.supplements.length===0&&bundle.version===1491);
 await assert.rejects(()=>save(null,null,'2026-10-01',0),/至少/);ok('blank amounts rejected');
 for(const bad of [-1,0.01,10000001,'NaN']){await assert.rejects(()=>save(100,bad,'2026-10-01',0),/整數/);ok('bad rental amount rejected '+bad);}
 await assert.rejects(()=>save(100,10,'2026-10-01',0,' '),/原因/);ok('reason required');
 let saved=await save(400,80,'2026-10-01',0),revision=Number(saved.revision);bundle=await read();ok('two positive settings saved atomically',bundle.supplements.length===2);
 await assert.rejects(()=>save(500,90,'2026-10-01',0),/已變更/);ok('stale settings rejected');
 const original=bundle.supplements[0];saved=await save(null,0,'2026-10-16',revision);revision=Number(saved.revision);bundle=await read();
 ok('blank standby leaves prior amount and zero rental is explicit',bundle.supplements.length===3&&bundle.supplements[0].amount===original.amount&&Number(bundle.supplements[2].amount)===0);
 saved=await save(null,50,'2026-10-16',revision);revision=Number(saved.revision);bundle=await read();ok('same-day correction retains previous version',bundle.supplements.length===4&&Number(E.selectSupplement(bundle.supplements,'rental','2026-10-16').amount)===50);
 await denied('Brian cannot overwrite history','update payroll_supplement_rates set amount=5',[],/permission denied/);
 await denied('Brian cannot delete history','delete from payroll_supplement_rates',[],/permission denied/);
 ok('settings writes audited',Number(await scalar("select count(*) from finance_audit_logs where source_table='payroll_supplement_rates'"))===4);
 for(const who of [2,3]){
  await actor(who);await denied('non-Brian read denied '+who,"select dashboard_get_route_payroll('2026-10-01')",[],/Brian/);
  await assert.rejects(()=>save(1,1,'2026-10-01',revision),/Brian/);ok('non-Brian save denied '+who);
  ok('raw RLS read denied '+who,Number(await scalar('select count(*) from payroll_supplement_rates'))===0);
  await denied('raw RLS insert denied '+who,"insert into payroll_supplement_rates(component,amount,effective_from,reason) values('rental',1,'2026-10-01','test')",[],/Brian|row-level/);
 }
 await pg.exec('RESET ROLE;SET ROLE anon;');await denied('anonymous RPC denied',"select dashboard_get_route_payroll('2026-10-01')",[],/permission denied/);
 await denied('anonymous table denied','select * from payroll_supplement_rates',[],/permission denied/);await actor(1);
 await denied('month must begin on first',"select dashboard_get_route_payroll('2026-10-02')",[],/第一日/);
 await pg.exec("INSERT INTO delivery_temperature_zones(name) VALUES('常溫');INSERT INTO delivery_regions(id,name) VALUES(1,'Test');INSERT INTO vehicles(id,plate_number) VALUES(1,'TEST-1');INSERT INTO routes(id,route_code,temperature_zone,delivery_region_id,default_start_time,default_end_time) VALUES(1,'01','常溫',1,'06:00','08:00');INSERT INTO delivery_region_zone_rates(region_id,zone_name,delivery_fee) VALUES(1,'常溫',1000);");
 await pg.exec(`INSERT INTO runs(id,service_date,route_id,driver_id,vehicle_id,attendance_category,attendance_slot_index) VALUES(10,'2026-10-15',1,'${id(3)}',1,'日配',1),(11,'2026-10-16',1,'${id(3)}',1,'日配',1),(12,'2026-10-20',1,'${id(3)}',1,'日配',1);`);
 ok('unclosed runs excluded',(await read()).finalized.deliveries.length===0);
 await scalar("select dashboard_close_attendance_through('2026-10-16','isolated close')");bundle=await read();
 let result=E.build({...bundle,month:'2026-10'}).summaries.find(x=>x.driverId===id(3));ok('real SQL bundle uses route management without legacy payroll rules',result.count===2&&result.variable===2000&&Number(bundle.route_rates[0].amount)===1000);
 const snapshot=await scalar("select md5(string_agg(snapshot::text,'|' order by id)) from attendance_closeout_events");
 await pg.exec("update delivery_region_zone_rates set delivery_fee=1200 where region_id=1 and zone_name='常溫'");bundle=await read();
 result=E.build({...bundle,month:'2026-10'}).summaries.find(x=>x.driverId===id(3));ok('draft report reflects current route board rate',result.variable===2400);
 ok('rate edits do not rewrite closing snapshots',snapshot===await scalar("select md5(string_agg(snapshot::text,'|' order by id)) from attendance_closeout_events"));
 await scalar("select dashboard_reopen_attendance_date('2026-10-16','isolated correction')");bundle=await read();result=E.build({...bundle,month:'2026-10'}).summaries.find(x=>x.driverId===id(3));ok('reopening immediately excludes that date',result.count===1&&result.variable===1200);
 await scalar("select dashboard_close_attendance_through('2026-10-16','isolated reclose')");ok('reclose restores one contribution per physical delivery',(await read()).finalized.deliveries.length===2);
 await pg.exec('RESET ROLE;');const funcs=await pg.query("select p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('dashboard_get_route_payroll','dashboard_save_payroll_supplements')");ok('both endpoints are invoker with empty search path',funcs.rows.length===2&&funcs.rows.every(x=>!x.prosecdef&&x.proconfig.includes('search_path=""')));
 console.log(`RESULT: ${count} Increment 1.4.9.1 database checks passed`);
}catch(e){console.error(e.stack,e.detail||'',e.where||'');process.exitCode=1;}finally{await pg.close();clearInterval(keep);}

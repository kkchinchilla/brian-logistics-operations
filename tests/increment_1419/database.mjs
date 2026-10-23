import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../..'),pg=new PGlite();
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
let checks=0;const ok=(name,v=true)=>{assert.ok(v,name);checks++;console.log('PASS:',name);};
const value=async(sql,args)=>Object.values((await pg.query(sql,args)).rows[0])[0];
const actor=async n=>pg.exec(`RESET ROLE;SELECT set_config('request.jwt.claim.sub','${id(n)}',false);SELECT set_config('request.jwt.claims','${JSON.stringify({sub:id(n),session_id:id(100+n)})}',false);SET ROLE authenticated;`);
const service=()=>pg.exec('RESET ROLE;SET ROLE service_role;');
const migration=inc=>fs.readFileSync(root+'/supabase/migrations/'+fs.readdirSync(root+'/supabase/migrations').find(n=>n.includes('_increment_'+inc+'_')),'utf8');
const apply=(action,target,name=null,role=null,owner=id(1))=>value('select dashboard_account_apply($1,$2,$3,$4,$5)',[owner,id(target),action,name,role]);
try{
 await pg.exec(fs.readFileSync(root+'/tests/increment_146/baseline_fixture.sql','utf8'));
 for(const inc of ['146','147','148','149','1491','1410','1411','14111','1412','1413','1414','1415','1416','1418'])await pg.exec(migration(inc));
 await pg.exec("ALTER TABLE auth.users ADD COLUMN phone text,ADD COLUMN phone_confirmed_at timestamptz,ADD COLUMN deleted_at timestamptz;CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,not_after timestamptz);");
 for(const n of [1,2,3,4])await pg.query('INSERT INTO auth.sessions(id,user_id) VALUES($1,$2)',[id(100+n),id(n)]);
 await pg.exec(migration('1419'));
 await actor(1);ok('Brian needs a valid live session and receives his own ID',(await value('select dashboard_account_admin_context()')).actor_id===id(1));
 await assert.rejects(()=>pg.query('select dashboard_account_directory($1)',[id(1)]),/permission denied/);ok('even Brian cannot invoke the privileged directory directly');
 await assert.rejects(()=>apply('password',3),/permission denied/);ok('browser cannot invoke service-only mutations');
 for(const n of [2,3]){
  await actor(n);await assert.rejects(()=>value('select dashboard_account_admin_context()'),/Brian/);ok('non-owner '+n+' cannot enter account administration');
  ok('active non-owner '+n+' keeps existing roster access',Number(await value('select count(*) from profiles'))>=4);
 }
 await actor(1);await pg.exec(`SELECT set_config('request.jwt.claims','{"session_id":"revoked"}',false);`);await assert.rejects(()=>value('select dashboard_account_admin_context()'),/登入已失效/);ok('revoked or forged session IDs are refused');
 await pg.exec('RESET ROLE;');await pg.query('INSERT INTO auth.users(id) VALUES($1)',[id(20)]);
 await service();await apply('create',20,'Created driver','driver');
 const users=await value('select dashboard_account_directory($1)',[id(1)]);ok('new driver is provisioned and visible',users.some(u=>u.id===id(20)&&u.role==='driver'&&u.active));
 await apply('edit',20,'Updated dispatcher','dispatcher');ok('name and ordinary role can be updated',(await value('select dashboard_account_directory($1)',[id(1)])).some(u=>u.id===id(20)&&u.display_name==='Updated dispatcher'&&u.role==='dispatcher'));
 await assert.rejects(()=>apply('edit',1,'Brian','driver'),/管理員/);await assert.rejects(()=>apply('delete_requested',1),/管理員/);ok('self deletion and administrator demotion are refused');
 await apply('edit',1,'Brian renamed','dispatcher');await apply('phone',1);await apply('password',1);ok('Brian can manage his own name and credential audit');
 await assert.rejects(()=>apply('edit',20,'Injected','driver',id(2)),/Brian/);ok('service RPC independently checks the authorized actor');
 await assert.rejects(()=>apply('edit',20,'Bad','admin'),/正確角色/);ok('arbitrary administrator roles cannot be assigned');
 // A real FK-bound attendance record must survive deletion preparation and Auth soft-delete.
 await pg.exec('RESET ROLE;');await pg.query("INSERT INTO attendance_records(service_date,driver_id,entry_type,note,recorded_by) VALUES('2026-10-01',$1,'other','history fixture',$2)",[id(3),id(2)]);
 const before=await value('select jsonb_agg(to_jsonb(a)) from attendance_records a');
 await service();await apply('delete_requested',3);
 await actor(3);ok('old JWT cannot read the company roster after removal begins',Number(await value('select count(*) from profiles'))===0);ok('old JWT cannot read attendance after removal begins',Number(await value('select count(*) from attendance_records'))===0);
 await assert.rejects(()=>value("select v055_my_special_assignments('2026-10-01')"),/權限/);ok('inactive driver cannot use legacy privileged assignment RPC');
 await pg.exec('RESET ROLE;');await pg.query('UPDATE auth.users SET deleted_at=now(),phone=null WHERE id=$1',[id(3)]);await service();await apply('delete',3);
 const deleted=(await value('select dashboard_account_directory($1)',[id(1)])).find(u=>u.id===id(3));ok('deleted directory entry retains name and hides phone',deleted.deleted&&!deleted.active&&deleted.phone==='');
 await assert.rejects(()=>apply('edit',3,'Revive','driver'),/停用或刪除/);ok('deleted accounts cannot be reactivated via edit');
 await pg.exec('RESET ROLE;');assert.deepEqual(await value('select jsonb_agg(to_jsonb(a)) from attendance_records a'),before);ok('attendance and foreign-key identities survive account deletion');
 const columns=(await pg.query("select column_name from information_schema.columns where table_schema='private' and table_name='account_admin_audit'")).rows.map(r=>r.column_name);assert.deepEqual(columns,['id','actor_id','target_id','action','happened_at']);ok('audit schema has no password or phone fields');
 await actor(1);ok('Brian can still read retained historical attendance',Number(await value('select count(*) from attendance_records'))===1);
 await pg.exec('RESET ROLE;SET ROLE anon;');await assert.rejects(()=>value('select dashboard_account_admin_context()'),/permission denied/);ok('anonymous account access denied');
 console.log(`RESULT: ${checks} account database checks passed`);
}catch(error){console.error(error.message);process.exitCode=1;}finally{await pg.close();}

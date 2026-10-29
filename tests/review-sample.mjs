import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {checkReviewSample} from '../scripts/check-review-sample.mjs';
import {PROJECT} from '../scripts/create-review-accounts.mjs';
const pg = new PGlite();
const seed = fs.readFileSync(new URL('../supabase/reviewer/seed-demo.sql',import.meta.url),'utf8');
const owner='11111111-1111-4111-8111-111111111111', supervisor='22222222-2222-4222-8222-222222222222', driver='33333333-3333-4333-8333-333333333333';
try {
 await pg.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE supabase_admin;CREATE ROLE supabase_auth_admin;CREATE ROLE dashboard_user;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,raw_app_meta_data jsonb);CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,not_after timestamptz);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO anon,authenticated;");
 await pg.exec(fs.readFileSync(new URL('../supabase/schema/1.4.15.sql',import.meta.url),'utf8'));
 const migrations=new URL('../supabase/migrations/',import.meta.url);
 for(const name of fs.readdirSync(migrations).filter(n=>/_increment_(1416|1418|1419|1421|1424|1431|1451)_/.test(n)).sort())await pg.exec(fs.readFileSync(new URL(name,migrations),'utf8'));
 for(const [id,phone,role] of [[owner,'12025550101','owner'],[supervisor,'12025550102','supervisor'],[driver,'12025550103','driver']])await pg.query('INSERT INTO auth.users VALUES($1,$2,now(),null,$3)',[id,phone,{review_role:role,review_bootstrap:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}]);
 await pg.exec(fs.readFileSync(new URL('../supabase/reviewer/migrations/20261029020531_reviewer_bind_accounts.sql',import.meta.url),'utf8'));
 await pg.exec(seed);
 const actor=async id=>{await pg.exec('RESET ROLE');await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await pg.exec('SET ROLE authenticated');};
 await actor(owner);
 const report=(await pg.query("select dashboard_get_calculated_payroll('2026-10-01') as r")).rows[0].r;
 const sum=report.calculation.summaries.find(s=>s.driverId===driver);
 assert.equal(sum.salary,2900);assert.equal(sum.count,3);
 assert.equal(sum.standbyPay,200);assert.equal(sum.followAlongPay,150);assert.equal(sum.learningPay,100);
 assert.equal(report.finalized.deliveries.length,3);
 assert.equal(report.finalized.deliveries.filter(r=>r.is_rental).length,2);
 assert.equal(report.finalized.dates.find(d=>d.service_date==='2026-10-28').pending_reclose,true);
 assert(!report.finalized.deliveries.some(r=>r.service_date==='2026-10-29'));
 assert.equal(report.calculation.issues.filter(i=>i.code!=='date_unfinalized').length,0);
 await actor(supervisor);await assert.rejects(pg.query("select dashboard_get_calculated_payroll('2026-10-01')"),/Brian/);
 await actor(driver);
 assert.equal((await pg.query('select count(*)::int n from runs')).rows[0].n,4);
 assert.equal((await pg.query('select count(*)::int n from duty_assignment_rates')).rows[0].n,0);
 await assert.rejects(pg.query("select dashboard_get_calculated_payroll('2026-10-01')"),/Brian/);
 await assert.rejects(pg.query("select dashboard_reopen_attendance_date('2026-10-27','not permitted')"));
 await pg.exec('RESET ROLE');await assert.rejects(pg.exec(seed),/already exists/);await pg.exec('ROLLBACK');
 assert.equal((await pg.query('select count(*)::int n from runs')).rows[0].n,4);
 const rows=(await pg.query('select driver_id,service_date::text,route_name_snapshot,is_rental from runs')).rows;
 const credentials={project:PROJECT,accounts:[{role:'owner',id:owner,phone:'+12025550101',password:'private-owner-password'},{role:'driver',id:driver,phone:'+12025550103',password:'private-driver-password'}]};
 const logs=[],logouts=[];
 const options={log:s=>logs.push(s),fetchImpl:async(url,opts)=>{
  assert.equal(new URL(url).origin,`https://${PROJECT}.supabase.co`);
  assert(opts.headers.apikey.startsWith('sb_publishable_'));
  assert.equal(opts.redirect,'error');
  const result=(status,data)=>({status,json:async()=>data});
  if(url.includes('/token?')){const b=JSON.parse(opts.body),a=credentials.accounts.find(a=>a.phone===b.phone&&a.password===b.password);assert(a);return result(200,{access_token:'private-token-'+a.role,user:{id:a.id}});}
  if(url.includes('/logout?')){assert(url.endsWith('scope=local'));logouts.push(opts.headers.Authorization);return result(204);}
  if(url.includes('/dashboard_get_calculated_payroll')){assert.deepEqual(JSON.parse(opts.body),{p_month:'2026-10-01'});return result(200,report);}
  assert(url.includes('/rest/v1/runs?'));assert.equal(opts.method,'GET');return result(200,rows);
 }};
 await checkReviewSample(credentials,options);assert.equal(logouts.length,2);assert(!logs.join('\n').includes('private-'));
 report.calculation.summaries[0].salary=999;
 await assert.rejects(checkReviewSample(credentials,options),/payroll differs/);assert.equal(logouts.length,3);
 await assert.rejects(checkReviewSample({...credentials,project:'other'},options),/not recognized/);
 console.log('Fictional sample passed: complete rates, expected salary, reopened snapshot, open-day exclusion, role denials and seed replay protection.');
}catch(error){console.error(error.message,error.where||'');process.exitCode=1;}finally{await pg.close();}

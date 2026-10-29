// Read-only business-data check; credentials remain in the private Mac file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT } from './create-review-accounts.mjs';
const BASE=`https://${PROJECT}.supabase.co`;
const PUBLIC_KEY='sb_publishable_VFhyCnpVRaLk2_pryTAIlQ_74gwx22F';
class SampleError extends Error {}
const stop=message=>{throw new SampleError(message);};

export async function checkReviewSample(state,{fetchImpl=fetch,log=console.log}={}) {
 if(state?.project!==PROJECT||!Array.isArray(state.accounts))stop('Private reviewer credentials file is not recognized.');
 const owner=state.accounts.find(a=>a.role==='owner'),driver=state.accounts.find(a=>a.role==='driver');
 for(const account of [owner,driver])if(!account||typeof account.password!=='string'||account.password.length<8||
   !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(account.id||''))stop('Private reviewer credentials file is incomplete.');
 if(owner.phone!=='+12025550101'||driver.phone!=='+12025550103')stop('Unexpected sample account identities.');
 async function request(endpoint,{method='POST',token,body,status=200}={}) {
  let response;
  try{response=await fetchImpl(BASE+endpoint,{method,headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json',
    ...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined,
    redirect:'error',signal:AbortSignal.timeout(20000)});}catch{stop('Sample check: connection failed or timed out.');}
  if(response.status!==status)stop(`Sample check: unexpected HTTP ${response.status}.`);
  if(status===204)return null;
  try{return await response.json();}catch{stop('Sample check: unexpected response format.');}
 }
 async function session(account,check) {
  let token;
  try{
   const auth=await request('/auth/v1/token?grant_type=password',{body:{phone:account.phone,password:account.password}});
   token=auth.access_token;
   if(typeof token!=='string'||!token||auth.user?.id!==account.id)stop('Sample check: signed-in identity mismatch.');
   await check(token);
  }finally{if(token)await request('/auth/v1/logout?scope=local',{token,status:204});}
 }
 await session(owner,async token=>{
  const report=await request('/rest/v1/rpc/dashboard_get_calculated_payroll',{token,body:{p_month:'2026-10-01'}});
  const summary=report.calculation?.summaries?.find(s=>s.driverId===driver.id);
  const expected={count:3,variable:2400,standbyPay:200,followAlongPay:150,learningPay:100,rentalCount:2,rentalDeduction:-200,adjustment:250,salary:2900,salaryReady:true};
  if(!summary||Object.entries(expected).some(([key,value])=>summary[key]!==value)||summary.issues?.length!==0)stop('Sample payroll differs from the expected initial data. No records were changed.');
  const days=report.finalized?.dates||[],closed=days.find(d=>d.service_date==='2026-10-27'),reopened=days.find(d=>d.service_date==='2026-10-28'),open=days.find(d=>d.service_date==='2026-10-29');
  if(closed?.status!=='finalized'||closed.attendance_status!=='closed'||reopened?.status!=='finalized'||
    reopened.attendance_status!=='reopened'||reopened.pending_reclose!==true||open?.status!=='open')stop('Sample date states differ from the expected closed/reopened/open example.');
  const deliveries=report.finalized.deliveries;
  if(!Array.isArray(deliveries)||deliveries.length!==3||deliveries.some(d=>d.driver_id!==driver.id||d.service_date==='2026-10-29'))stop('Sample confirmed delivery records do not match.');
 });
 log('Monthly sample salary: 2900 — passed');
 log('Closed, reopened and open dates: passed');
 await session(driver,async token=>{
  const rows=await request('/rest/v1/runs?select=driver_id,service_date,route_name_snapshot,is_rental&order=service_date,id',{method:'GET',token});
  const names=new Set(['示範市區配送','示範冷藏配送','示範冷凍配送']);
  if(!Array.isArray(rows)||rows.length!==4||rows.some(r=>r.driver_id!==driver.id||!names.has(r.route_name_snapshot))||
    rows.filter(r=>r.is_rental===true).length!==2||rows.filter(r=>r.service_date==='2026-10-29').length!==1)stop('Driver sample assignments differ from the expected initial data.');
 });
 log('Driver sample assignments: passed');
 log('Verified: reviewer sample data and payroll passed. Test sessions signed out.');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 (async()=>{
  if(process.argv.length>2)stop('This command takes no arguments.');
  const file=path.join(os.homedir(),'huoyitong-review-private','reviewer-accounts.json');
  let state;
  try{state=JSON.parse(fs.readFileSync(file,'utf8'));}catch{stop('Cannot read the private reviewer credentials file on this computer.');}
  await checkReviewSample(state);
 })().catch(error=>{console.error(error instanceof SampleError?error.message:'Sample check stopped. No private values were printed.');process.exitCode=1;});
}

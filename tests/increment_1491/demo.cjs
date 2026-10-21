const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),E=require('../../js/payroll-reconciliation-1491.js');
const root=path.resolve(__dirname,'../..');let count=0;const ok=(s,v)=>{assert.ok(v,s);console.log('PASS:',s);count++};
function make(actor=''){const context={structuredClone,Date,URLSearchParams,location:{search:actor?'?actor='+actor:''},console};context.window=context;vm.createContext(context);for(const f of ['mock_supabase_143.js','mock_increment_146.js','mock_increment_147.js','mock_increment_148.js','mock_increment_1491.js'])vm.runInContext(fs.readFileSync(root+'/tests/'+f,'utf8'),context);return context;}
(async()=>{
 const c=make(),t=c.mock143.tables,db=c._testDB143,b=(await db.rpc('dashboard_get_route_payroll',{p_month:'2026-10-01'})).data;
 const r=E.build({...b,month:'2026-10',drivers:t.profiles.filter(p=>p.role==='driver')});
 ok('four-board fixture has seven closed and seven open deliveries',b.finalized.deliveries.length===7&&t.runs.length===14);
 ok('five cold-chain trips appear for same driver on same date',t.runs.filter(x=>x.driver_id===t.profiles[1].id&&x.service_date==='2026-10-20'&&x.temperature_zone_snapshot==='冷藏').length===5);
 ok('monthly records reference the same routes, vehicles and drivers',b.finalized.deliveries.every(x=>t.routes.some(y=>y.id===x.route_id)&&t.vehicles.some(y=>y.id===x.vehicle_id)&&t.profiles.some(y=>y.id===x.driver_id)));
 ok('fixture includes rental, special work, standby and both adjustment signs',b.finalized.deliveries.filter(x=>x.is_rental).length===2&&b.finalized.special_work.length===1&&b.finalized.standby.length===1&&b.adjustments.some(x=>x.amount<0)&&b.adjustments.some(x=>x.amount>0));
 ok('fictional basic subtotal calculated but salary pending',r.summaries.find(x=>x.driverId===t.profiles[1].id).basicSubtotal===4900&&r.summaries.every(x=>x.salary===null));
 ok('demo rental cost deducted for two rental trips',r.summaries.find(x=>x.driverId===t.profiles[2].id).rentalDeduction===-160);
 ok('demo standby allowance added',r.summaries.find(x=>x.driverId===t.profiles[3].id).standbyPay===400);
 const write=await db.from('runs').insert({id:999});ok('operational demonstration mutations blocked',write.error&&t.runs.length===14);
 const edit=await db.rpc('dashboard_edit_run_direct',{p_run_id:1});ok('operational RPC simulation cannot mutate canonical demo',!!edit.error);
 const k=make('karen');ok('Karen demo denied monthly data',!!(await k._testDB143.rpc('dashboard_get_route_payroll',{p_month:'2026-10-01'})).error);
 const d=make('driver');ok('driver demo denied monthly data',!!(await d._testDB143.rpc('dashboard_get_route_payroll',{p_month:'2026-10-01'})).error);
 const demo=path.resolve(root,'../OFFLINE_DEMO_1_4_9_1');for(const file of ['ui-attendance.html','ui-routes.html','ui-vehicles.html','ui-monthly.html']){
  const html=fs.readFileSync(demo+'/'+file,'utf8');ok(file+' has no external script/config and blocks network',!/<script[^>]+src=/.test(html)&&html.includes("connect-src 'none'")&&html.includes('隔離展示'));
 }
 console.log(`RESULT: ${count} isolated demo data checks passed (no browser/visual QA)`);
})().catch(e=>{console.error(e);process.exitCode=1});

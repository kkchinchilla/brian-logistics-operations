import {JSDOM,VirtualConsole} from 'jsdom';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8'),tick=()=>new Promise(r=>setImmediate(r));
let checks=0;const ok=(name,test)=>{assert.ok(test,name);checks++;console.log('PASS:',name);};
async function setup(actor='driver-one',monthly=false){
 const dom=new JSDOM(read(monthly?'ui-monthly.html':'ui-attendance.html'),{url:'https://example.invalid/',runScripts:'outside-only',virtualConsole:new VirtualConsole()}),ctx=dom.getInternalVMContext();
 await new Promise(r=>dom.window.addEventListener('load',r));
 vm.runInContext(read('tests/increment_1421/fixture.js'),ctx);
 const f=ctx.attendanceFixture1421;f.state.actor=actor==='owner'?'supervisor':actor;ctx.db=f.db;
 ctx.DashboardAccess146={load:async()=>actor==='owner',finance:()=>actor==='owner'};
 // Return an empty, valid server report: this suite tests navigation, not pricing.
 if(monthly){
  const rpc=ctx.db.rpc;ctx.db.rpc=async(name,args)=>{
   if(name!=='dashboard_get_calculated_payroll')return rpc(name,args);
   f.state.calls.push({rpc:name,args});
   return {data:{version:1491,month:args.p_month,route_rates:[],supplements:[],adjustments:[],expenses:[],finalized:{deliveries:[],standby:[],special_work:[],dates:[]}}};
  };
  f.tables.profiles=f.tables.profiles.filter(p=>p.role!=='driver');
  ctx.PayrollServer1412={read:()=>({summaries:[],lines:[],issues:[]})};
  ctx.PayrollSettings1491={setState(){},open(){},exportCSV(){}};
 }
 for(const file of ['production-common','compact-date-navigation',...(monthly?['payroll-reconciliation-1491','production-monthly']:['vehicle-bindings-144','driver-attendance-1421','production-attendance','attendance-templates-143'])]){
  vm.runInContext(read('js/'+file+'.js').replace("const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});","const today=()=> '2026-10-30';"),ctx);
 }
 vm.runInContext('currentUser={id:attendanceFixture1421.state.actor};currentProfile=attendanceFixture1421.tables.profiles.find(x=>x.id===currentUser.id);',ctx);
 await ctx.loadPage();await tick();
 const doc=dom.window.document,input=doc.querySelector('.compact-date-native');
 return {dom,ctx,f,doc,input,change:async value=>{input.value=value;input.dispatchEvent(new dom.window.Event('change',{bubbles:true}));await tick();}};
}
for(const role of ['driver-one','supervisor','owner']){
 const e=await setup(role),id=role==='driver-one'?'driver':'management',prev=e.doc.querySelector('.compact-date-arrows button:first-child'),next=e.doc.querySelector('.compact-date-arrows button:last-child');
 ok(`${id}: native input survives with label`,e.input.type==='date'&&e.input.getAttribute('aria-label')==='出勤日期');
 ok(`${id}: compact date and weekday agree`,e.doc.querySelector('.compact-date-label').textContent==='10月30日'&&e.doc.querySelector('.compact-date-context').textContent==='2026 年 · 星期五');
 ok(`${id}: current marker replaces reset`,!e.doc.querySelector('.compact-date-current').hidden&&e.doc.querySelector('.compact-date-reset').hidden);
 await e.change('2028-02-28');next.click();await tick();
 ok(`${id}: leap day stays consistent with loaded date`,e.input.value==='2028-02-29'&&e.doc.querySelector('.compact-date-label').textContent==='2月29日'&&e.f.state.calls.some(c=>c.args?.p_date==='2028-02-29'));
 next.click();await tick();ok(`${id}: day crosses month end`,e.input.value==='2028-03-01');prev.click();await tick();ok(`${id}: previous returns to leap day`,e.input.value==='2028-02-29');
 await e.change('2026-12-31');next.click();await tick();ok(`${id}: year boundary updates context`,e.input.value==='2027-01-01'&&e.doc.querySelector('.compact-date-context').textContent==='2027 年 · 星期五');
 const calls=e.f.state.calls.length;await e.change('');ok(`${id}: clearing selection restores it without a query`,e.input.value==='2027-01-01'&&e.f.state.calls.length===calls);
 e.doc.querySelector('.compact-date-reset').click();await tick();ok(`${id}: reset reloads today once`,e.input.value==='2026-10-30'&&!e.doc.querySelector('.compact-date-current').hidden);
 if(role==='driver-one')ok('driver controls stay read-only',!e.doc.querySelector('#new-run,#close,#template-open')&&!e.doc.querySelector('#driver-content button,input:not(.compact-date-native)'));
 else{
  vm.runInContext("boardDate='2026-11-03';document.querySelector('#service-date').value=boardDate;",e.ctx);await e.ctx.fetchBoard();
  ok(`${id}: programmatic template date updates label`,e.doc.querySelector('.compact-date-label').textContent==='11月3日');
 }
 ok(`${id}: refresh does not duplicate status or controls`,e.doc.querySelectorAll('.compact-date-status').length===1&&e.doc.querySelectorAll('.compact-date-native').length===1);
 e.dom.window.close();
}
const m=await setup('owner',true);
await m.change('2026-12');m.doc.getElementById('month-next').click();await tick();
ok('monthly year boundary reloads the selected month',m.input.value==='2027-01'&&m.doc.querySelector('.compact-date-context').textContent==='2027 年'&&m.f.state.calls.at(-1).args.p_month==='2027-01-01');
m.doc.getElementById('month-prev').click();await tick();ok('monthly previous returns across year boundary',m.input.value==='2026-12');
const calls=m.f.state.calls.length;await m.change('');ok('empty monthly selection never reaches payroll RPC',m.input.value==='2026-12'&&m.f.state.calls.length===calls);
m.doc.getElementById('month-today').click();await tick();ok('monthly reset selects current month',m.input.value==='2026-10'&&!m.doc.querySelector('.compact-date-current').hidden);
m.dom.window.close();
for(const role of ['supervisor','driver-one']){
 const e=await setup(role,true);ok(`${role}: no month control or payroll request without finance access`,!e.input&&!e.f.state.calls.some(c=>c.rpc==='dashboard_get_calculated_payroll'));e.dom.window.close();
}
console.log(`RESULT: ${checks} compact-date interaction checks passed`);

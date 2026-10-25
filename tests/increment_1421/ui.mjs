import {JSDOM,VirtualConsole} from 'jsdom';
import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
let checks=0;const ok=(name,v=true)=>{assert.ok(v,name);checks++;console.log('PASS:',name);};
const tick=()=>new Promise(r=>setImmediate(r));
async function setup(actor='driver-one'){
 const dom=new JSDOM(read('ui-attendance.html'),{url:'https://example.invalid/ui-attendance.html',runScripts:'outside-only',virtualConsole:new VirtualConsole()}),ctx=dom.getInternalVMContext();
 await new Promise(r=>dom.window.addEventListener('load',r));
 vm.runInContext(read('tests/increment_1421/fixture.js'),ctx);
 const fixture=ctx.attendanceFixture1421;fixture.state.actor=actor;ctx.db=fixture.db;
 ctx.DashboardAccess146={load:async()=>false,finance:()=>false};
 for(const file of ['js/production-common.js','js/vehicle-bindings-144.js','js/driver-attendance-1421.js','js/production-attendance.js','js/attendance-templates-143.js','js/session-controls-1421.js']){
  vm.runInContext(read(file).replace("const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});","const today=()=> '2026-10-25';"),ctx);
 }
 vm.runInContext('currentUser={id:attendanceFixture1421.state.actor};currentProfile=attendanceFixture1421.tables.profiles.find(x=>x.id===currentUser.id);',ctx);
 await ctx.loadPage();
 return {dom,ctx,fixture,el:id=>dom.window.document.getElementById(id),doc:dom.window.document};
}
let e=await setup();
ok('driver starts on own card view with no company table',e.doc.body.dataset.attendanceView==='driver'&&!e.doc.querySelector('table')&&!e.el('new-run')&&!e.el('close')&&!e.el('approval-open'));
ok('own deliveries, extra trip, standby, follow and learning render',e.doc.querySelectorAll('.driver-card').length===7&&e.el('driver-content').textContent.includes('TEST-001'));
ok('other drivers and cancelled/void trips are absent',!e.el('driver-content').textContent.includes('OTHER'));
ok('old observation survives a cancelled plan',e.el('driver-content').textContent.includes('保留實際配送紀錄'));
ok('notes render safely as literal text',e.el('driver-content').textContent.includes('<img src=x onerror=alert(1)>')&&!e.el('driver-content').querySelector('img'));
ok('driver view has no edit actions',!e.el('driver-content').querySelector('button,input,textarea,select,a'));
ok('driver queries scope operational data to own ID and selected date',e.fixture.state.calls.filter(x=>['runs','daily_attendance_extra_trips','attendance_driver_days'].includes(x.table)).every(x=>x.filters.some(([k,v])=>k==='driver_id'&&v===e.fixture.own)&&x.filters.some(([k,v])=>k==='service_date'&&v===e.fixture.day)));
ok('no roster or vehicle-ownership bulk query for a driver',!e.fixture.state.calls.some(x=>['profiles','vehicle_owner_bindings'].includes(x.table)));
ok('no approval RPC or request-list query',!e.fixture.state.calls.some(x=>/request|review/.test(x.rpc||x.table||'')));
e.el('driver-next').click();await tick();ok('next date shows own leave state and clears old cards',e.el('driver-date').value==='2026-10-26'&&e.el('driver-content').textContent.includes('當日休假')&&!e.doc.querySelector('.driver-card'));
e.el('driver-next').click();await tick();ok('unscheduled date has a clear empty state',e.el('driver-content').textContent.includes('當日尚無排班'));
e.el('driver-today').click();await tick();ok('today returns to the current schedule',e.doc.querySelectorAll('.driver-card').length===7);
e.fixture.state.fail=true;await e.el('driver-refresh').onclick();ok('failed refresh clears stale schedule and offers retry',!e.doc.querySelector('.driver-card')&&e.el('driver-content').textContent.includes('班表載入失敗'));
e.fixture.state.fail=false;await e.el('driver-refresh').onclick();ok('retry restores the schedule',e.doc.querySelectorAll('.driver-card').length===7);
let release;e.fixture.state.hold=new Promise(r=>release=r);e.el('driver-prev').click();await tick();e.fixture.state.hold=null;e.el('driver-today').click();await tick();release();await tick();ok('slow previous date cannot replace the newest selected date',e.el('driver-date').value==='2026-10-25'&&e.doc.querySelectorAll('.driver-card').length===7);
e.ctx.editAttendanceCell145('driver-one','日配',1);ok('driver cannot open a legacy editor programmatically',!e.el('modal').classList.contains('open'));
e.fixture.state.logoutError=true;e.doc.querySelector('[data-session-logout]').click();await tick();ok('logout failure leaves controls usable and explains retry',e.el('logout-status').textContent.includes('登出失敗')&&!e.doc.querySelector('[data-session-logout]').disabled);
e.fixture.state.logoutError=false;e.fixture.state.logoutHold=new Promise(r=>release=r);e.doc.querySelector('[data-session-logout]').click();e.el('logout').click();ok('mobile and desktop logout share one in-flight request',e.fixture.state.logoutCalls===2);release();await tick();ok('successful logout calls the existing auth sign-out',e.fixture.state.logoutCalls===2);e.dom.window.close();
e=await setup('supervisor');
ok('supervisor retains full attendance table and scheduling/close controls',!!e.doc.querySelector('table')&&!!e.el('new-run')&&!!e.el('template-open')&&!!e.el('close'));
ok('supervisor sees both drivers',e.el('page').textContent.includes('測試司機甲')&&e.el('page').textContent.includes('測試司機乙'));
ok('supervisor attendance cells show route names instead of old codes',e.el('page').textContent.includes('北區門市配送')&&e.el('page').textContent.includes('冷鏈補貨路線')&&!e.el('page').textContent.includes('北區 01')&&!e.el('page').textContent.includes('冷鏈 02'));
e.el('filter').value='冷鏈補貨路線';e.el('filter').dispatchEvent(new e.dom.window.Event('input'));
ok('attendance search finds the visible actual route name',e.el('page').textContent.includes('測試司機甲')&&!e.doc.querySelector('tbody').textContent.includes('測試司機乙'));
e.el('filter').value='';e.el('filter').dispatchEvent(new e.dom.window.Event('input'));
e.ctx.editAttendanceCell145('driver-one','日配',1,e.fixture.tables.runs[0]);
ok('route editor offers name labels with ID values',e.el('modal-fields').textContent.includes('北區門市配送')&&!e.el('modal-fields').textContent.includes('北區 01')&&Array.from(e.el('modal-fields').querySelectorAll('option')).some(x=>x.value==='1'&&x.textContent.includes('北區門市配送')));
ok('retired approval entry is removed for supervisors',!e.el('approval-open')&&!e.fixture.state.calls.some(x=>x.table==='attendance_change_requests'));
e.ctx.closeOrReopen();ok('supervisor close dialog still opens',e.el('modal-save').textContent==='確認結案');e.dom.window.close();
for(const page of ['attendance','routes','vehicles','monthly','accounts']){
 const html=read('ui-'+page+'.html'),doc=new JSDOM(html).window.document;
 assert.equal(doc.querySelectorAll('[data-session-logout]').length,1);assert.ok(doc.querySelector('main .dashboard-footer [data-session-logout]'));assert.equal(doc.querySelectorAll('.side [data-session-logout],.head [data-session-logout]').length,0);assert.equal(doc.querySelectorAll('script[src="js/session-controls-1421.js"]').length,1);
}
ok('all five dashboards provide the shared mobile logout control');
console.log(`RESULT: ${checks} driver mobile/read-only UI checks passed`);

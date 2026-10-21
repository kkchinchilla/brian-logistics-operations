'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const jsFile=path.join(root,'js','monthly.js');
const html=fs.readFileSync(path.join(root,'monthly.html'),'utf8');
const js=fs.readFileSync(jsFile,'utf8');
const migration=fs.readFileSync(path.join(root,'sql','02_monthly_finance_foundation.sql'),'utf8');
const guard=fs.readFileSync(path.join(root,'sql','03_route_overlap_guard.sql'),'utf8');
const {monthRange,safeText,calculateForTests}=require(jsFile);
assert.deepEqual(monthRange('2026-12'),{first:'2026-12-01',next:'2027-01-01',last:'2026-12-31'});
assert.deepEqual(monthRange('2026-02'),{first:'2026-02-01',next:'2026-03-01',last:'2026-02-28'});
assert.deepEqual(monthRange('2028-02'),{first:'2028-02-01',next:'2028-03-01',last:'2028-02-29'});
assert.throws(()=>monthRange('2026-13'));
assert.equal(safeText('=1+1'),"'=1+1");
assert.equal(safeText('  @SUM(A1)'),"'  @SUM(A1)");
assert.equal(safeText('王小明'),'王小明');
for(const id of [...js.matchAll(/\$\('([a-z0-9-]+)'\)/g)].map(m=>m[1])) {
  assert.ok(html.includes(`id="${id}"`),`missing DOM id: ${id}`);
}
for(const title of ['出勤明細','薪資統計','停車交通','零用金']) assert.ok(js.includes(`'${title}'`));
for(const table of ['attendance_records','payroll_configs','payroll_rules','payroll_adjustments','expense_records','monthly_settlements']) {
  assert.ok(migration.includes(`public.${table}`));
}
assert.ok(migration.includes('private.can_manage_finance()'));
assert.ok(migration.includes('finance_audit_logs'));
assert.ok(guard.includes('pg_advisory_xact_lock'));
assert.ok(guard.includes('tsrange('));
assert.ok(guard.includes('new.scheduled_time := start_t'));
assert.ok(html.includes('lang="zh-Hant-TW"'));
const seeded={
  month:'2026-08',
  drivers:[{id:'a',display_name:'Adam'}],
  routes:[{id:7,route_code:'FM-01'},{id:8,route_code:'FM-02'}],
  vehicles:[],attendance:[], expenses:[],
  executions:[
    {id:1,driver_id:'a',route_id:7,service_date:'2026-08-10',review_status:'confirmed'},
    {id:2,driver_id:'a',route_id:8,service_date:'2026-08-11',review_status:'confirmed'},
    {id:3,driver_id:'a',route_id:7,service_date:'2026-08-12',review_status:'pending'}
  ],
  configs:[{driver_id:'a',pay_basis:'per_run_only'}],
  rates:[{driver_id:'a',route_id:7,component:'per_run',active:true,effective_from:'2026-08-01',effective_to:null,amount:800}],
  adjustments:[{driver_id:'a',amount:200}]
};
const first=calculateForTests(seeded);
assert.equal(first.confirmed.length,2);
assert.equal(first.pending,1);
assert.equal(first.payroll[0].total,null,'incomplete rates must not show fake pay total');
assert.ok(first.issues.some(x=>x.includes('FM-02')));
const second=calculateForTests({...seeded,rates:[...seeded.rates,{driver_id:'a',route_id:8,component:'per_run',active:true,effective_from:'2026-08-01',effective_to:null,amount:900}]});
assert.equal(second.payroll[0].total,1900);
assert.equal(second.payroll[0].count,2);
assert.ok(second.issues.some(x=>x.includes('尚未審核')));
console.log('PASS: provisional payroll sums with explicit rates / approval filter');
console.log('PASS: incomplete payroll remains unpriced when a route rate is missing');
console.log('PASS: month boundaries / leap year / input escaping');
console.log('PASS: monthly DOM element selectors exist');
console.log('PASS: four worksheet names and finance RLS guards');
console.log('PASS: route conflict guard and route-controlled time');

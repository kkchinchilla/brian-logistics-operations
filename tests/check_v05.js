const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const zone=require('../js/zone_report.js');
const exp=require('../js/template_export.js');
const root=path.resolve(__dirname,'..');
const drivers=[{id:'u1',display_name:'王小明'},{id:'u2',display_name:'陳小華'}];
const routes=[{id:1,route_code:'FM-01',temperature_zone:'冷藏'},{id:2,route_code:'FM-02',temperature_zone:'常溫'}];
const runs=[
 {id:10,driver_id:'u1',route_id:1,temperature_zone_snapshot:'冷藏',is_rental:false,status:'completed',service_date:'2026-10-10'},
 {id:11,driver_id:'u1',route_id:1,temperature_zone_snapshot:'冷藏',is_rental:false,status:'completed',service_date:'2026-10-10'},
 {id:12,driver_id:'u1',route_id:2,temperature_zone_snapshot:'常溫',is_rental:true,status:'completed',service_date:'2026-10-11'},
 {id:13,driver_id:'u2',route_id:1,temperature_zone_snapshot:'冷藏',is_rental:null,status:'assigned',service_date:'2026-10-12'},
 {id:14,driver_id:'u2',route_id:2,temperature_zone_snapshot:'常溫',is_rental:true,status:'cancelled',service_date:'2026-10-13'}
];
const executions=[
 {id:20,driver_id:'u1',route_id:1,route_temperature_zone:'冷藏',route_code_snapshot:'FM-01',is_rental:false,review_status:'confirmed',service_date:'2026-10-10',vehicle_id:5},
 {id:21,driver_id:'u1',route_id:1,route_temperature_zone:'冷藏',route_code_snapshot:'FM-01',is_rental:false,review_status:'confirmed',service_date:'2026-10-10',vehicle_id:5},
 {id:22,driver_id:'u1',route_id:2,route_temperature_zone:'常溫',route_code_snapshot:'FM-02',is_rental:true,review_status:'confirmed',service_date:'2026-10-11',vehicle_id:6},
 {id:23,driver_id:'u2',route_id:1,route_temperature_zone:'冷藏',is_rental:null,review_status:'pending',service_date:'2026-10-12'}
];
const s=zone.buildSummary({runs,executions,routes,drivers});
assert.equal(s.rows.length,3,'unneeded cancelled temperature must be absent');
const c=s.rows.find(r=>r.driverId==='u1'&&r.zone==='冷藏');
assert.deepEqual({assigned:c.assigned,confirmed:c.confirmed,rental:c.rental,nonRental:c.nonRental},
 {assigned:2,confirmed:2,rental:0,nonRental:2});
const w=s.rows.find(r=>r.driverId==='u1'&&r.zone==='常溫');
assert.equal(w.rental,1);
const ar=s.rows.find(r=>r.driverId==='u2');
assert.equal(ar.confirmed,0); assert.match(s.warnings.join('|'),/尚未確認是否租車/);
const r=exp.makeRows({runs,executions,routes,drivers});
assert.equal(r.groups.length,3);
const assigned=r.groups.find(x=>x.driverId==='u1'&&x.zone==='冷藏');
assert.equal(assigned.dateMap.get('2026-10-10').length,2,'multiple same-day runs must not collide');
assert.ok(r.warnings.some(x=>x.kind==='趟次未確認'));
assert.equal(exp.days(2026,2),28);assert.equal(exp.days(2028,2),29);assert.equal(exp.days(2026,10),31);
assert.equal(exp.safe('=1+1'),"'=1+1",'spreadsheet formula injection must be neutralized');
assert.equal(exp.safe('+SUM(2,3)'),"'+SUM(2,3)");
for(const filename of ['dispatcher.html','driver.html','monthly.html','routes.html']){
 const content=fs.readFileSync(path.join(root,filename),'utf8');assert.match(content,/lang="zh-Hant-TW"/);
}
const monthlyHtml=fs.readFileSync(path.join(root,'monthly.html'),'utf8');
assert.match(monthlyHtml,/id="zone-summary-body"/);assert.doesNotMatch(monthlyHtml,/id="template-route-form"/);
const dispatcherHtml=fs.readFileSync(path.join(root,'dispatcher.html'),'utf8');
assert.match(dispatcherHtml,/id="run-rental"/);assert.match(dispatcherHtml,/routes.html/);
assert.doesNotMatch(dispatcherHtml,/id="scheduled-time"/);
const driverJs=fs.readFileSync(path.join(root,'js/driver.js'),'utf8');
assert.doesNotMatch(driverJs,/new Date\(\)\.toISOString/);
const sql=fs.readFileSync(path.join(root,'sql/05_routes_rentals_dynamic_reporting.sql'),'utf8');
assert.match(sql,/create or replace function private\.guard_execution_review/);
assert.doesNotMatch(sql,/if new\.actual_end_time is null/);
assert.match(sql,/new\.route_code_snapshot/);
assert.match(sql,/coalesce\(q\.planned_start_time,r\.default_start_time\)/);
console.log('v0.5 PASS: route-based zones; rental counts; unconfirmed/cancelled; multi-runs-per-day; date lengths; code snapshots; forms; SQL guards.');

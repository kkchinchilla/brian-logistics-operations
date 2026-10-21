/* Unit/regression tests, no database connection. node tests/check_increment_1_4.js */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path'),root=path.join(__dirname,'..');
async function testPaged(){
 let offsets=[];
 let records=Array.from({length:1205},(_,id)=>({id}));
 const db={from(table){assert.equal(table,'trip_executions');return {select(){return this},gte(){return this},lte(){return this},order(){return this},range(from,to){offsets.push([from,to]);return Promise.resolve({data:records.slice(from,to+1),error:null})}}}};
 const ctx=vm.createContext({db,document:{querySelector:()=>null,addEventListener(){}},console,window:{},location:{},setTimeout});
 vm.runInContext(fs.readFileSync(path.join(root,'js/production-common.js'),'utf8'),ctx);
 const data=await vm.runInContext("allPagedRows('trip_executions','id',q=>q.gte('service_date','2026-10-01'))",ctx);
 assert.equal(data.length,1205);assert.deepEqual(offsets,[[0,499],[500,999],[1000,1499]]);
}
function testMonthly(){
 const ctx=vm.createContext({today:()=> '2026-10-19',document:{querySelector(){return {}}},window:{},console});
 vm.runInContext(fs.readFileSync(path.join(root,'js/production-monthly.js'),'utf8').replace(/^async function loadPage\(/,'async function loadPage('),ctx);
 vm.runInContext(`drivers=[{id:'a',display_name:'甲'}];routes=[{id:1,temperature_zone:'冷凍'}];bindings=[{driver_id:'a',vehicle_id:1,effective_from:'2025-01-01',effective_to:null}];
 runs=[{id:1,driver_id:'a',review_status:'confirmed',service_date:'2026-10-01',route_id:1,vehicle_id:1,is_rental:true},
 {id:2,driver_id:'a',review_status:'confirmed',service_date:'2026-10-02',route_id:1,vehicle_id:100,is_rental:false},
 {id:3,driver_id:'a',review_status:'confirmed',service_date:'2026-10-03',route_id:1,vehicle_id:1,is_rental:null},
 {id:4,driver_id:'a',review_status:'pending',service_date:'2026-10-04',route_id:1,vehicle_id:100,is_rental:true}];
 adjustments=[];standby=[];`,ctx);
 const summary=vm.runInContext('report(drivers[0])',ctx);
 assert.equal(summary.rr.length,3);assert.equal(summary.rental,1,'explicit rented true despite owned vehicle');
 assert.equal(summary.unknownRental,1,'null must be unknown');assert.equal(summary.z['冷凍'],3);
}
function testGuardSql(){
 const migration=fs.readFileSync(path.join(root,'sql/140_01_closed_day_run_guard.sql'),'utf8');
 assert(migration.includes('BEFORE INSERT OR UPDATE OR DELETE'));
 assert(migration.includes('old_date')&&migration.includes('new_date'));
 assert(!/\b(TRUNCATE|DROP TABLE|DELETE FROM public\.runs)\b/i.test(migration));
}
function testRouteAndVehicleCode(){
 const a=fs.readFileSync(path.join(root,'js/production-attendance.js'),'utf8');
 const v=fs.readFileSync(path.join(root,'js/production-vehicles.js'),'utf8');
 assert(a.includes("supervisor()")&&a.includes("$('#new-run').disabled"));
 assert(a.includes("if(closeout?.closed_at)throw Error"));
 assert(a.includes("status:'assigned'"));
 assert(v.includes('bindingHistory')&&v.includes('effective_to<effective_from'));
}
(async()=>{await testPaged();testMonthly();testGuardSql();testRouteAndVehicleCode();console.log('PASS: pagination 1205 / tri-state rental / closed-day SQL / daily & binding controls');})().catch(e=>{console.error(e);process.exit(1)});

import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ExcelJS=require('exceljs'),template=require('../../js/template_export.js'),special=require('../../js/special_summary.js'),zone=require('../../js/zone_report.js'),api=require('../../js/finalized-monthly-147.js');
let count=0;const ok=(name,test)=>{assert.ok(test,name);console.log('PASS:',name);count++};
const drivers=[{id:'d1',display_name:'Driver One'},{id:'d2',display_name:'=SUM(1,1)'}],routes=[{id:1,route_code:'NEW-CODE',temperature_zone:'NEW-ZONE'}];
const executions=[{id:'run:1',run_id:1,source_type:'run',service_date:'2026-10-01',driver_id:'d1',vehicle_id:1,route_id:1,route_code_snapshot:'FROZEN',route_temperature_zone:'常溫',plate_snapshot:'OLD-CAR',is_rental:false,finalized:true,close_event_id:1},
{id:'extra:1',run_id:null,source_type:'extra',service_date:'2026-10-01',driver_id:'d1',vehicle_id:1,route_id:1,route_code_snapshot:'FROZEN-EXTRA',route_temperature_zone:'常溫',plate_snapshot:'OLD-CAR',is_rental:true,finalized:true,close_event_id:1},
{id:'run:2',run_id:2,source_type:'run',service_date:'2026-10-02',driver_id:'d2',vehicle_id:1,route_id:1,route_code_snapshot:null,route_temperature_zone:null,plate_snapshot:null,is_rental:null,finalized:true,close_event_id:1}];
const work=[{id:1,service_date:'2026-10-01',run_id:1,driver_id:'d1',standby_shift_id:1,kind:'attached_support',review_status:'pending',finalized:true},{id:2,service_date:'2026-10-01',run_id:1,driver_id:'d2',kind:'follow_along',follow_stage_snapshot:'trainee',review_status:'pending',finalized:true},{id:3,service_date:'2026-10-01',run_id:2,driver_id:'d2',kind:'follow_along',follow_stage_snapshot:'trainee',review_status:'pending',finalized:true}];
const shifts=[{id:1,service_date:'2026-10-01',driver_id:'d1',start_time:'05:00',end_time:'18:00',review_status:'pending',finalized:true,converted_to_support:true}];
const summary=special.build({drivers,work,shifts,executions});ok('closing finalizes pending special duties without additional review',!summary.issues.some(x=>/尚未確認|尚未審核|支援待審核/.test(x))&&summary.entries.some(x=>x.status==='已結案'));ok('trainee day deduplicated and support replaces standby',summary.traineeDays===1&&summary.entries.some(x=>x.payUnit==='不另計值班'));ok('unapproved special-duty pay remains unsettled',summary.issues.some(x=>x.includes('待設定')));
const z=zone.buildSummary({executions,routes,drivers});ok('zone totals include all finalized sources once',z.rows.reduce((n,x)=>n+x.confirmed,0)===3&&z.rows.some(x=>x.zone==='溫層待設定')&&!z.rows.some(x=>x.zone==='NEW-ZONE'));
const data={executions,routes,drivers,runs:[],specialWork:work,specialShifts:shifts,attendance:[],expenses:[],preview:[]};
const result=await template.exportTemplate({ExcelJS,month:'2026-10',data,display:{route:()=> 'NEW-CODE',plate:()=> 'NEW-CAR',driver:id=>drivers.find(d=>d.id===id)?.display_name}});
ok('Excel maps same-day run and extra without review_status prerequisite',result.mapped===3);
const wb=new ExcelJS.Workbook();await wb.xlsx.load(result.buffer);let values=[];wb.eachSheet(s=>s.eachRow(r=>r.eachCell(c=>values.push(c.value))));
ok('Excel contains frozen labels and never current master replacements',values.includes('FROZEN')&&values.includes('FROZEN-EXTRA')&&values.includes('OLD-CAR')&&!values.includes('NEW-CODE')&&!values.includes('NEW-CAR')&&!values.includes('NEW-ZONE'));
ok('legacy missing metadata is explicit in Excel',values.includes('未保存'));
ok('Excel labels closing as final status',values.includes('已結案')&&values.includes('已結案趟次'));
ok('Excel formula injection escaped',values.includes("'=SUM(1,1)")&&!values.includes('=SUM(1,1)'));
const valid={version:147,month:'2026-10-01',deliveries:executions,standby:[],special_work:[],attendance_records:[],original_runs:[],dates:[]};
assert.equal((await api.load({rpc:async()=>({data:valid})},'2026-10')).deliveries.length,3);
for(const bad of [{...valid,version:146},{...valid,month:'2026-11-01'},{...valid,deliveries:[...executions,executions[0]]},{...valid,deliveries:[{...executions[0],finalized:false}]}])await assert.rejects(()=>api.load({rpc:async()=>({data:bad})},'2026-10'));
ok('client rejects old API, wrong month, duplicate and unfinalized payloads',true);
console.log(`RESULT: ${count} export and aggregation assertions passed`);

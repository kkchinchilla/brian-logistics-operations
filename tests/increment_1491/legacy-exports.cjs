const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path'),ExcelJS=require('exceljs'),E=require('../../js/payroll-reconciliation-1491.js'),template=require('../../js/template_export.js');
const root=path.resolve(__dirname,'../..');let count=0;const ok=(s,v)=>{assert.ok(v,s);console.log('PASS:',s);count++};
(async()=>{
 const context={module:{exports:{}},window:{PayrollReconciliation1491:E},console,Date,Set};vm.createContext(context);vm.runInContext(fs.readFileSync(root+'/js/monthly.js','utf8'),context);
 const drivers=[{id:'a',display_name:'A'}],run={id:'run:1',run_id:1,service_date:'2026-10-15',driver_id:'a',route_id:1,is_rental:true,route_temperature_zone:'冷藏',route_code_snapshot:'R1',plate_snapshot:'C1',finalized:true,close_event_id:1};
 const finalized={version:147,month:'2026-10-01',deliveries:[run],standby:[],special_work:[],attendance_records:[],original_runs:[],dates:[{service_date:'2026-10-15',status:'finalized'}]};
 const bundle={version:1491,month:'2026-10-01',finalized,route_rates:[{route_id:1,region_id:1,zone_name:'冷藏',amount:1000}],supplements:[{id:1,component:'rental',effective_from:'2026-10-01',amount:80}],adjustments:[],expenses:[]};
 const calculated=context.module.exports.calculateForTests({month:'2026-10',drivers,executions:[run],payrollBundle:bundle});
 ok('legacy monthly uses same route pay and rental deduction',calculated.payroll[0].variable===1000&&calculated.payroll[0].rentalDeduction===-80&&calculated.payroll[0].basicSubtotal===920);
 const result=await template.exportTemplate({ExcelJS,month:'2026-10',data:{runs:[],executions:[run],attendance:[],expenses:[],preview:calculated.payroll,routes:[],drivers,specialWork:[],specialShifts:[]},display:{driver:()=> 'A',route:()=> 'R1',plate:()=> 'C1'}});
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(result.buffer);const sheet=wb.getWorksheet('薪資統計');let values=[];sheet.eachRow(r=>r.eachCell(c=>values.push(c.value)));
 ok('Excel labels rental as deduction',values.includes('租車費用（扣款）'));
 ok('Excel stores rental deduction as a negative number',values.includes(-80)&&!values.includes(80));
 ok('Excel subtotal equals current monthly calculation',values.includes(920)&&values.includes(1000));
 ok('Excel full salary remains pending',values.includes('應計薪資')&&values.includes('待設定'));
 const html=fs.readFileSync(root+'/monthly.html','utf8');ok('legacy duplicate price forms removed',!html.includes('id="basis-form"')&&!html.includes('id="rate-form"'));
 console.log(`RESULT: ${count} legacy monthly and Excel consistency checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1});

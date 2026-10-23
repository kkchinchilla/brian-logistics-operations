const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ExcelJS=require('exceljs'),template=require('../../js/template_export.js');let count=0;
const ok=(s,v)=>{assert.ok(v,s);console.log('PASS:',s);count++};
(async()=>{
 const driver={id:'test',display_name:'Isolated salary test'};
 const summary={driver:driver.display_name,count:1,variable:1000,standbyPay:400,followAlongPay:240,learningPay:120,rentalDeduction:-80,adjustment:105.15,salary:1025.15,basicSubtotal:1025.15,knownItemsReady:true,messages:[]};
 const result=await template.exportTemplate({ExcelJS,month:'2026-10',data:{drivers:[driver],runs:[],executions:[],routes:[],specialWork:[],specialShifts:[],attendance:[],expenses:[],preview:[summary,{...summary,driver:'Missing rate',salary:null,knownItemsReady:false,messages:['missing rate']},{...summary,driver:'Unresolved source',salary:null,knownItemsReady:true,messages:['legacy support']}]},display:{driver:()=>driver.display_name,route:()=>'',plate:()=>''}});
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(result.buffer);const sheet=wb.getWorksheet('薪資統計');
 ok('Excel exposes only three components without regional/base columns',sheet.getRow(4).values.slice(1).join('|')==='司機|已結案趟次|配送計酬|租車費用（扣款）|加給／獎懲|應計薪資|待確認事項');
 ok('Excel excludes removed pay headings',!sheet.getRow(4).values.join('|').match(/底薪|值班津貼|跟車費用|學習費用/));
 ok('Excel rental deduction remains negative numeric',sheet.getCell('D5').value===-80);
 ok('Excel salary preserves exact formula total',sheet.getCell('F5').value===1025.15);
 ok('Excel missing rate salary is not exported as zero',sheet.getCell('F6').value==='待設定');
 ok('Excel unresolved record remains pending',sheet.getCell('F7').value==='待確認');
 const named=await template.exportTemplate({ExcelJS,month:'2026-10',data:{drivers:[driver],runs:[],routes:[],executions:[{id:'run:1',driver_id:driver.id,service_date:'2026-10-01',route_id:1,route_name_snapshot:'北區門市配送',route_temperature_zone:'常溫',plate_snapshot:'TEST',is_rental:false,finalized:true}]},display:{driver:()=>driver.display_name,route:()=>{throw Error('Finalized exports must use saved names');},plate:()=>''}});
 const namedBook=new ExcelJS.Workbook();await namedBook.xlsx.load(named.buffer);
 ok('Excel attendance uses saved route names and a matching heading',namedBook.getWorksheet('出勤明細').getCell('D4').value==='路線名稱'&&namedBook.getWorksheet('出勤明細').getCell('D5').value==='北區門市配送');
 // Execute the actual legacy preview row expressions against the same fixture.
 const src=fs.readFileSync(__dirname+'/../../js/monthly.js','utf8');
 const line=src.split('\n').find(l=>l.includes("renderRows('payroll-preview-body'"));let rendered;
 vm.runInNewContext(line,{payroll:[summary],value:v=>v,renderRows:(id,rows)=>rendered=rows});
 ok('legacy screen displays retained components and the final total',rendered[0][2]===1000&&rendered[0][3]===-80&&rendered[0][5]===1025.15);
 const exportLine=src.split('\n').find(l=>l.includes('state.preview.map(p=>'));const expression=exportLine.trim().replace(/,$/,'');const rows=vm.runInNewContext(expression,{state:{preview:[summary]}});
 ok('legacy flat Excel row agrees with dynamic workbook',rows[0][2]===1000&&rows[0][3]===-80&&rows[0][5]===1025.15);
 console.log(`RESULT: ${count} salary export checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1});

const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ExcelJS=require('exceljs'),template=require('../../js/template_export.js');let count=0;
const ok=(s,v)=>{assert.ok(v,s);console.log('PASS:',s);count++};
(async()=>{
 const driver={id:'test',display_name:'Isolated salary test'};
 const summary={driver:driver.display_name,count:1,variable:1000,standbyPay:400,followAlongPay:240,learningPay:120,rentalDeduction:-80,adjustment:105.15,salary:1785.15,basicSubtotal:1785.15,knownItemsReady:true,messages:[]};
 const result=await template.exportTemplate({ExcelJS,month:'2026-10',data:{drivers:[driver],runs:[],executions:[],routes:[],specialWork:[],specialShifts:[],attendance:[],expenses:[],preview:[summary,{...summary,driver:'Missing rate',salary:null,knownItemsReady:false,messages:['missing rate']},{...summary,driver:'Unresolved source',salary:null,knownItemsReady:true,messages:['legacy support']}]},display:{driver:()=>driver.display_name,route:()=>'',plate:()=>''}});
 const wb=new ExcelJS.Workbook();await wb.xlsx.load(result.buffer);const sheet=wb.getWorksheet('薪資統計');
 ok('Excel exposes all six components without regional/base columns',sheet.getRow(4).values.slice(1).join('|')==='司機|已結案趟次|配送計酬|值班津貼|跟車費用|學習費用|租車費用（扣款）|加給／獎懲|應計薪資|待確認事項');
 ok('Excel carries separate follow and learning costs',sheet.getCell('E5').value===240&&sheet.getCell('F5').value===120);
 ok('Excel rental deduction remains negative numeric',sheet.getCell('G5').value===-80);
 ok('Excel salary preserves exact formula total',sheet.getCell('I5').value===1785.15);
 ok('Excel missing rate salary is not exported as zero',sheet.getCell('I6').value==='待設定');
 ok('Excel unresolved record remains pending',sheet.getCell('I7').value==='待確認');
 // Execute the actual legacy preview row expressions against the same fixture.
 const src=fs.readFileSync(__dirname+'/../../js/monthly.js','utf8');
 const line=src.split('\n').find(l=>l.includes("renderRows('payroll-preview-body'"));let rendered;
 vm.runInNewContext(line,{payroll:[summary],value:v=>v,renderRows:(id,rows)=>rendered=rows});
 ok('legacy screen displays distinct duty costs and the final total',rendered[0][4]===240&&rendered[0][5]===120&&rendered[0][8]===1785.15);
 const exportLine=src.split('\n').find(l=>l.includes('state.preview.map(p=>'));const expression=exportLine.trim().replace(/,$/,'');const rows=vm.runInNewContext(expression,{state:{preview:[summary]}});
 ok('legacy flat Excel row agrees with dynamic workbook',rows[0][4]===240&&rows[0][5]===120&&rows[0][8]===1785.15);
 console.log(`RESULT: ${count} salary export checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1});

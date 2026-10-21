/* Node VM integration, not a browser or a visual/layout acceptance test. */
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');let count=0;
const ok=(name,test=true)=>{assert.ok(test,name);console.log('PASS:',name);count++};
function env(){
 const el=new Map(),created=[],calls=[],notices=[];
 function element(key){if(!el.has(key))el.set(key,{value:'',innerHTML:'',disabled:false,hidden:false,textContent:'',classList:{add(){},remove(){},toggle(){}},onclick:null,addEventListener(type,fn){this["on"+type]=fn;},remove(){},click(){},insertAdjacentHTML(where,s){this.innerHTML+=s;}});return el.get(key);}
 const f={version:147,month:'2026-10-01',deliveries:[{id:'run:1',run_id:1,driver_id:'a',service_date:'2026-10-15',route_id:1,route_code_snapshot:'FROZEN',route_temperature_zone:'常溫',is_rental:false,finalized:true,close_event_id:1}],standby:[],special_work:[],attendance_records:[],original_runs:[],dates:[{service_date:'2026-10-15',status:'finalized'}]};
 const bundle={version:1491,month:'2026-10-01',finalized:f,route_rates:[{route_id:1,region_id:1,zone_name:'常溫',amount:100}],supplements:[],adjustments:[],expenses:[]};
 const ctx={console:{error(){}},Date,Intl,Set,Map,Number,String,Object,Array,JSON,RegExp,Promise,Blob,structuredClone,setTimeout:()=>{},clearTimeout(){},bundle,fail:false,delay:0,allowed:true,
  document:{querySelector:element,querySelectorAll:()=>[],createElement:tag=>{const e=element('created:'+created.length);e.tag=tag;created.push(e);return e;},body:{appendChild(){},append(){}}},
  URL:{createObjectURL:b=>{ctx.blobs.push(b);return 'blob:test';},revokeObjectURL(){}},blobs:[],
  $:element,esc:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),fmt:n=>Number(n||0).toLocaleString('zh-TW'),today:()=> '2026-10-20',finance:()=>ctx.allowed,notify:x=>notices.push(x),currentUser:{id:'brian'},
  wrapTable:(heads,body)=>'<table>'+heads.join('|')+body+'</table>',option:(v,t,selected)=>`<option value="${v}" ${v===selected?'selected':''}>${t}</option>`,field:(l,id,v='')=>`<label>${l}</label><input id="${id}" value="${v}">`,chosen:id=>element('#'+id).value,
  modal:(title,html,onSave)=>{ctx.modalState={title,html,onSave};},save:async()=>{},
  db:{rpc:async(fn,args)=>{calls.push({fn,args:structuredClone(args)});if(ctx.fail)return {data:null,error:{message:'network unavailable'}};if(fn!=='dashboard_get_calculated_payroll')return {data:{revision:1},error:null};const b=structuredClone(ctx.bundle);if(args.p_month!==b.month){b.month=args.p_month;b.finalized.month=args.p_month;for(const key of ['deliveries','standby','special_work','attendance_records','original_runs','dates'])b.finalized[key]=[];}if(!ctx.omitCalculation)b.calculation=ctx.serverCalculation(b);if(ctx.corrupt)ctx.corrupt(b);if(ctx.delay)await new Promise(r=>setTimeout(r,ctx.delay));return {data:b,error:null};}},
 };
 vm.createContext(ctx);for(const f of ['payroll-reconciliation-1491.js','payroll-server-1412.js','payroll-settings-1491.js','production-monthly.js'])vm.runInContext(fs.readFileSync(root+'/js/'+f,'utf8'),ctx);
 vm.runInContext("drivers=[{id:'a',display_name:'A <img onerror=evil>',active:true}];routes=[{id:1,route_code:'LIVE',active:true}];",ctx);
 const referenceBuild=ctx.PayrollReconciliation1491.build;
 ctx.serverCalculation=b=>{const report=referenceBuild({...b,month:b.month.slice(0,7),drivers:[{id:'a',display_name:'A <img onerror=evil>'}]});
  for(const x of report.summaries){const rr=b.finalized.deliveries.filter(r=>r.driver_id===x.driverId),dw=b.finalized.special_work.filter(r=>r.driver_id===x.driverId);
   Object.assign(x,{standbyCount:b.finalized.standby.filter(r=>r.driver_id===x.driverId&&!r.converted_to_support).length,followAlongCount:dw.filter(r=>r.kind==='follow_along').length,learningCount:dw.filter(r=>r.kind==='learning').length,rentalCount:rr.filter(r=>r.is_rental===true).length,unknownRentalCount:rr.filter(r=>r.is_rental==null).length,knownItemsReady:x.basicSubtotal!==null});}
  return {...report,version:1412,engine:'database'};
 };
 return {ctx,el,element,calls,notices,run:s=>vm.runInContext(s,ctx)};
}
(async()=>{
 const e=env();
 for(const [i,kind] of ['follow_along','learning','learning'].entries())e.ctx.bundle.finalized.special_work.push({id:'duty:'+i,driver_id:'a',service_date:'2026-10-15',kind,note:'fictional',finalized:true,close_event_id:1});
 e.ctx.bundle.supplements=[{id:1,component:'follow_along',amount:120,effective_from:'2026-10-01'},{id:2,component:'learning',amount:60,effective_from:'2026-10-01'}];
 e.ctx.PayrollReconciliation1491.build=()=>{throw Error('frontend must not recalculate server result')};
 await e.run('loadMonth()');
 ok('monthly page uses the calculated payroll RPC',e.calls.length===1&&e.calls[0].fn==='dashboard_get_calculated_payroll');
 ok('server result is displayed without browser payroll recalculation',e.run('monthlyReady')&&e.run('reconciliation.summaries[0].basicSubtotal')===340);
 ok('follow and learning columns appear beside standby',e.element('#monthly-body').innerHTML.includes('值班|跟車|學習|租車'));
 ok('summary displays one follow and two learning entries',e.run('displayed[0].followAlong')===1&&e.run('displayed[0].learning')===2&&e.element('#monthly-body').innerHTML.includes('<td>0</td><td>1</td><td>2</td><td>0</td>'));
 ok('duty entries do not increase delivery count',e.run('displayed[0].rr.length')===1);
 ok('driver names remain escaped',!e.element('#monthly-body').innerHTML.includes('<img onerror=evil>'));
 ok('pay details retain each duty amount and calculation explanation',e.ctx.PayrollSettings1491.detailHTML('a').includes('依結案紀錄計算')&&e.ctx.PayrollSettings1491.detailHTML('a').includes('跟車勤務費'));
 await e.run('exportCSV()');const attendance=await e.ctx.blobs.at(-1).text();ok('attendance CSV includes separate duty counts',attendance.includes('跟車筆數')&&attendance.includes('學習筆數')&&attendance.includes('"0","1","2","0"'));
 await e.ctx.PayrollSettings1491.exportCSV();const pay=await e.ctx.blobs.at(-1).text();ok('reconciliation CSV keeps one line per entry and amount',pay.includes('follow_along')&&pay.match(/learning/g).length===2&&pay.includes('340'));
 ok('exports refetch server authority',e.calls.length===3);
 e.ctx.bundle.finalized.deliveries=[];e.ctx.bundle.finalized.special_work=[];e.ctx.bundle.finalized.dates[0].status='reopened';await e.run('loadMonth()');
 ok('reopening clears duty counts and calculated amount together',e.run('displayed[0].followAlong')===0&&e.run('displayed[0].learning')===0&&e.run('reconciliation.summaries[0].basicSubtotal')===0);
 e.ctx.fail=true;const before=e.ctx.blobs.length;await e.ctx.PayrollSettings1491.exportCSV();ok('network failure prevents stale payroll exports',e.ctx.blobs.length===before&&e.run('reconciliation')===null&&e.element('#export').disabled);
 const m=env();m.ctx.omitCalculation=true;await m.run('loadMonth()');ok('missing server calculation never falls back to browser pricing',!m.run('monthlyReady')&&m.element('#export-reconciliation').disabled);
 const invalid=env();invalid.ctx.corrupt=b=>{b.calculation.summaries[0].followAlongCount=99};await invalid.run('loadMonth()');ok('inconsistent duty count is rejected',!invalid.run('monthlyReady'));
 invalid.ctx.corrupt=b=>{b.calculation.summaries[0].basicSubtotal=10000};await invalid.run('loadMonth()');ok('inconsistent subtotal is rejected',!invalid.run('monthlyReady'));
 invalid.ctx.corrupt=b=>{b.calculation.summaries.push(b.calculation.summaries[0])};await invalid.run('loadMonth()');ok('duplicate driver results are rejected',!invalid.run('monthlyReady'));
 invalid.ctx.corrupt=b=>{b.calculation.lines.push(b.calculation.lines[0])};await invalid.run('loadMonth()');ok('duplicate pay source lines are rejected',!invalid.run('monthlyReady'));
 const race=env();race.ctx.delay=20;await race.run("month='2026-10';var earlier=loadMonth();month='2026-11';var later=loadMonth();Promise.all([earlier,later])");ok('late response cannot replace current month',race.run('reconciliation.month')==='2026-11');
 const n=env();n.ctx.allowed=false;await n.run('loadPage()');ok('non-finance user has no payroll fetch or settings',n.calls.length===0&&n.element('#page').innerHTML.includes('未被授權'));
 const blank=env();await blank.run("month='';loadMonth()");ok('invalid month fails before API',blank.calls.length===0&&!blank.run('monthlyReady'));
 const source=fs.readFileSync(root+'/js/production-monthly.js','utf8');ok('no duplicate pricing tab or completion step added',!source.includes('計價設定')&&!source.includes('完成配送')&&!source.includes('實際趟次確認'));
 console.log(`RESULT: ${count} Increment 1.4.12 monthly UI integration checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1});

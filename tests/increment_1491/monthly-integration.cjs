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
  db:{rpc:async(fn,args)=>{calls.push({fn,args:structuredClone(args)});if(ctx.fail)return {data:null,error:{message:'network unavailable'}};if(fn!=='dashboard_get_route_payroll')return {data:{revision:1},error:null};const b=structuredClone(ctx.bundle);if(args.p_month!==b.month){b.month=args.p_month;b.finalized.month=args.p_month;for(const key of ['deliveries','standby','special_work','attendance_records','original_runs','dates'])b.finalized[key]=[];}if(ctx.delay)await new Promise(r=>setTimeout(r,ctx.delay));return {data:b,error:null};}},
 };
 vm.createContext(ctx);for(const f of ['payroll-reconciliation-1491.js','payroll-settings-1491.js','production-monthly.js'])vm.runInContext(fs.readFileSync(root+'/js/'+f,'utf8'),ctx);
 vm.runInContext("drivers=[{id:'a',display_name:'A <img onerror=evil>',active:true}];routes=[{id:1,route_code:'LIVE',active:true}];",ctx);
 return {ctx,el,element,calls,notices,run:s=>vm.runInContext(s,ctx)};
}
(async()=>{
 const e=env();await e.run('loadMonth()');
 ok('monthly page requests one coherent server bundle',e.calls.length===1&&e.calls[0].fn==='dashboard_get_route_payroll');
 ok('settings enabled only after successful load',!e.element('#supplement-settings').disabled);
 ok('untrusted driver names escaped in summary',!e.element('#monthly-body').innerHTML.includes('<img onerror=evil>')&&e.element('#monthly-body').innerHTML.includes('&lt;img'));
 ok('basic subtotal available while full salary remains pending',e.run('reconciliation.summaries[0].basicSubtotal')===100&&e.element('#monthly-body').innerHTML.includes('待設定'));
 ok('details retain saved route label rather than current master',e.ctx.PayrollSettings1491.detailHTML('a').includes('FROZEN')&&!e.ctx.PayrollSettings1491.detailHTML('a').includes('LIVE'));
 await e.ctx.PayrollSettings1491.exportCSV();ok('reconciliation export refetches authority first',e.calls.length===2&&e.ctx.blobs.length===1);const csv=await e.ctx.blobs[0].text();ok('reconciliation CSV contains basic subtotal and unresolved policy',csv.includes('基本項目小計')&&csv.includes('policy_pending')&&csv.includes('run:1'));
 e.ctx.bundle.finalized.deliveries=[];e.ctx.bundle.finalized.dates[0].status='reopened';await e.ctx.PayrollSettings1491.exportCSV();const next=await e.ctx.blobs[1].text();ok('fresh export reflects dispatcher reopening',!next.includes('"run:1"')&&next.includes('date_unfinalized'));
 e.ctx.fail=true;await e.ctx.PayrollSettings1491.exportCSV();ok('failed export clears current state and creates no stale CSV',e.ctx.blobs.length===2&&e.run('reconciliation')===null&&e.element('#export').disabled&&e.element('#export-reconciliation').disabled);
 ok('failure disables setting entry',e.element('#supplement-settings').disabled);
 e.ctx.fail=false;e.ctx.delay=20;await e.run("month='2026-10';var earlier=loadMonth();month='2026-11';var later=loadMonth();Promise.all([earlier,later])");ok('late month response cannot replace selected month',e.run('reconciliation.month')==='2026-11'&&e.run('runs.length')===0);
 e.ctx.delay=0;e.ctx.bundle.version=148;await e.run('loadMonth()');ok('wrong database version blocks controls and exports',e.element('#export').disabled&&e.element('#export-reconciliation').disabled);
 const n=env();n.ctx.allowed=false;await n.run('loadPage()');ok('non-finance user does not fetch payroll or render controls',n.calls.length===0&&n.element('#page').innerHTML.includes('未被授權'));
 const invalid=env();await invalid.run("month='';loadMonth()");ok('blank month input fails closed without RPC',invalid.calls.length===0&&invalid.element('#export').disabled);
 const form=env();await form.run('loadMonth()');form.ctx.PayrollSettings1491.open();
 ok('settings dialog has only standby and rental inputs',form.ctx.modalState.title==='值班／租車設定'&&form.ctx.modalState.html.includes('supplement-rental')&&!form.ctx.modalState.html.includes('pricing-basis'));
 const set=(id,v)=>{form.element('#'+id).value=v;};
 for(const [id,v] of Object.entries({'supplement-from':'2026-10-01','supplement-standby':'','supplement-rental':'','supplement-reason':'test'}))set(id,v);
 await assert.rejects(()=>form.ctx.modalState.onSave(),/至少/);ok('both blank rejected before write',form.calls.length===1);
 set('supplement-rental','-80');await assert.rejects(()=>form.ctx.modalState.onSave(),/整數/);ok('negative rental input rejected',form.calls.length===1);
 set('supplement-rental','0');set('supplement-reason',' ');await assert.rejects(()=>form.ctx.modalState.onSave(),/原因/);ok('reason required before write',form.calls.length===1);
 set('supplement-reason','test');await form.ctx.modalState.onSave();const write=form.calls.find(x=>x.fn==='dashboard_save_payroll_supplements');ok('zero rental and unchanged standby sent with expected revision',write.args.p_rental_amount===0&&write.args.p_standby_amount===null&&write.args.p_expected_revision===0);
 form.ctx.PayrollSettings1491.open();set('supplement-rental','100');form.ctx.fail=true;await assert.rejects(()=>form.ctx.modalState.onSave(),err=>err.message==='network unavailable');ok('server save failure surfaced to modal',form.notices.length===1);
 const badRender=env();badRender.ctx.wrapTable=()=>{throw Error('render failure')};await badRender.run('loadMonth()');ok('render error cannot re-enable stale exports',badRender.element('#export').disabled&&badRender.element('#export-reconciliation').disabled&&badRender.element('#supplement-settings').disabled);
 const source=fs.readFileSync(root+'/js/production-monthly.js','utf8');ok('duplicate pricing tab removed from current monthly page',!source.includes('計價設定')&&!source.includes('month-rules')&&source.includes('值班／租車設定'));
 const legacy=fs.readFileSync(root+'/js/monthly.js','utf8');ok('legacy page also uses shared route-pay engine',legacy.includes('dashboard_get_route_payroll')&&legacy.includes('PayrollReconciliation1491.build')&&!legacy.includes("allRows('payroll_rules')"));
 console.log(`RESULT: ${count} Node VM monthly integration checks passed (no browser/visual QA)`);
})().catch(e=>{console.error(e);process.exitCode=1});

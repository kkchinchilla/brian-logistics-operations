const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');let count=0;const ok=(n,v=true)=>{assert.ok(v,n);count++;console.log('PASS:',n)};
function env(allowed=true){
 const nodes=new Map(),calls=[],reads=[];const el=k=>{if(!nodes.has(k))nodes.set(k,{value:'',innerHTML:'',hidden:false});return nodes.get(k)};
 const tables={profiles:[{id:'a',display_name:'A <script>',role:'driver',active:true},{id:'b',display_name:'B',role:'driver',active:true}],vehicles:[],vehicle_owner_bindings:[],driver_base_salaries:[{id:1,driver_id:'a',amount:30000,effective_month:'2026-10-01',reason:'initial'},{id:2,driver_id:'a',amount:35000,effective_month:'2026-12-01',reason:'future'}]};
 const ctx={console,Date,Set,Map,Number,String,Array,Object,Promise,Math,today:()=> '2026-10-21',finance:()=>allowed,supervisor:()=>true,$:el,esc:s=>String(s??'').replaceAll('<','&lt;').replaceAll('>','&gt;'),fmt:n=>Number(n).toLocaleString('zh-TW'),rows:async(t)=>structuredClone(tables[t]),allPagedRows:async(t)=>{reads.push(t);return structuredClone(tables[t])},wrapTable:(h,b)=>h.join('|')+b,document:{querySelectorAll:()=>[]},field:(l,id,v='')=>`<label>${l}</label><input id="${id}" value="${v}">`,chosen:id=>el('#'+id).value,notify:msg=>{ctx.notice=msg},modal:(title,html,save)=>{ctx.form={title,html,save}},db:{rpc:async(fn,p)=>{calls.push({fn,p});if(ctx.error)return {error:{message:ctx.error}};const data={id:tables.driver_base_salaries.length+1,driver_id:p.p_driver_id,amount:p.p_amount,effective_month:p.p_effective_month,reason:p.p_reason};tables.driver_base_salaries.push(data);return {data,error:null}}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(root+'/js/production-vehicles.js','utf8'),ctx);
 return {ctx,el,calls,reads,tables,run:s=>vm.runInContext(s,ctx)};
}
(async()=>{
 const e=env();await e.run('reloadVehicles()');e.run("fleetTab='drivers';renderFleetTable()");ok('driver roster shows monthly base and effective month',e.el('#fleet-table').innerHTML.includes('每月底薪|生效月份')&&e.el('#fleet-table').innerHTML.includes('30,000'));
 ok('future setting does not replace current displayed salary',!e.el('#fleet-table').innerHTML.includes('35,000'));
 ok('unset is displayed without inventing zero',e.el('#fleet-table').innerHTML.includes('未設定'));
 ok('driver names are escaped',!e.el('#fleet-table').innerHTML.includes('A <script>'));
 e.run("baseSalaryEditor('a')");ok('editor provides amount effective month and retained history',e.ctx.form.html.includes('base-month')&&e.ctx.form.html.includes('base-reason')&&e.ctx.form.html.includes('35,000'));
 e.el('#base-month').value='2026-10';e.el('#base-reason').value='correction';e.el('#base-amount').value='';await assert.rejects(e.ctx.form.save,/底薪/);ok('blank is not submitted as zero',e.calls.length===0);
 e.el('#base-amount').value='-1';await assert.rejects(e.ctx.form.save,/底薪/);ok('negative base rejected before RPC',e.calls.length===0);
 e.el('#base-amount').value='32000';e.el('#base-month').value='';await assert.rejects(e.ctx.form.save,/月份/);ok('invalid month rejected');
 e.el('#base-month').value='2026-10';e.el('#base-reason').value=' ';await assert.rejects(e.ctx.form.save,/原因/);ok('reason required');
 e.el('#base-reason').value='correction';await e.ctx.form.save();ok('save targets one driver with exact revision',e.calls[0].fn==='dashboard_save_driver_base_salary'&&e.calls[0].p.p_driver_id==='a'&&e.calls[0].p.p_amount===32000&&e.calls[0].p.p_expected_revision===2&&e.calls[0].p.p_effective_month==='2026-10-01');
 ok('successful save reloads displayed salary',e.el('#fleet-table').innerHTML.includes('32,000'));
 ok('other driver remains unset',!e.tables.driver_base_salaries.some(r=>r.driver_id==='b'));
 e.run("baseSalaryEditor('b')");e.el('#base-month').value='2026-10';e.el('#base-amount').value='0';e.el('#base-reason').value='explicit zero';await e.ctx.form.save();ok('zero is saved explicitly',e.calls.at(-1).p.p_amount===0);
 e.run("baseSalaryEditor('a')");e.el('#base-month').value='2026-10';e.el('#base-amount').value='40000';e.el('#base-reason').value='stale test';e.ctx.error='底薪設定已變更，請重新整理後再操作';await assert.rejects(e.ctx.form.save,e=>/已變更/.test(e.message));ok('stale conflict is surfaced without pretending success');
 const denied=env(false);await denied.run('reloadVehicles()');denied.run("fleetTab='drivers';renderFleetTable();baseSalaryEditor('a')");ok('non-finance users do not fetch salary rows',denied.reads.length===0);ok('salary columns and editor hidden from other dispatchers',!denied.el('#fleet-table').innerHTML.includes('每月底薪')&&!denied.ctx.form&&denied.calls.length===0);
 console.log(`RESULT: ${count} vehicle salary UI checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1});

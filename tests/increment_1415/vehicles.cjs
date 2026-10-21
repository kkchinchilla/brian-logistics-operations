const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');let count=0;const ok=(n,v=true)=>{assert.ok(v,n);count++;console.log('PASS:',n)};
function env(allowed=true){
 const nodes=new Map(),calls=[],reads=[];const el=k=>{if(!nodes.has(k))nodes.set(k,{value:'',innerHTML:'',hidden:false});return nodes.get(k)};
 const tables={profiles:[{id:'a',display_name:'A <script>',role:'driver',active:true},{id:'b',display_name:'B',role:'driver',active:true}],vehicles:[],vehicle_owner_bindings:[],driver_base_salaries:[{id:1,driver_id:'a',amount:30000,effective_month:'2026-10-01',reason:'initial'},{id:2,driver_id:'a',amount:35000,effective_month:'2026-12-01',reason:'future'}]};
 const ctx={console,Date,Set,Map,Number,String,Array,Object,Promise,Math,today:()=> '2026-10-21',finance:()=>allowed,supervisor:()=>true,$:el,esc:s=>String(s??'').replaceAll('<','&lt;').replaceAll('>','&gt;'),fmt:n=>Number(n).toLocaleString('zh-TW'),rows:async(t)=>structuredClone(tables[t]),allPagedRows:async(t)=>{reads.push(t);return structuredClone(tables[t])},wrapTable:(h,b)=>h.join('|')+b,document:{querySelectorAll:()=>[]},field:(l,id,v='')=>`<label>${l}</label><input id="${id}" value="${v}">`,dropdown:(label,id)=>`<label>${label}</label><select id="${id}"></select>`,chosen:id=>el('#'+id).value,notify:msg=>{ctx.notice=msg},modal:(title,html,save)=>{ctx.form={title,html,save}},db:{rpc:async(fn,p)=>{calls.push({fn,p});if(ctx.error)return {error:{message:ctx.error}};const data={id:tables.driver_base_salaries.length+1,driver_id:p.p_driver_id,amount:p.p_amount,effective_month:p.p_effective_month,reason:p.p_reason};tables.driver_base_salaries.push(data);return {data,error:null}}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(root+'/js/production-vehicles.js','utf8'),ctx);
 return {ctx,el,calls,reads,tables,run:s=>vm.runInContext(s,ctx)};
}
(async()=>{
 for(const allowed of [true,false]){
  const e=env(allowed);await e.run('reloadVehicles()');e.run("fleetTab='drivers';renderVehicles()");
  ok('driver roster has only name and vehicle columns',e.el('#fleet-table').innerHTML.startsWith('司機姓名|綁定車號|車輛數')&&!/底薪|生效月份|操作/.test(e.el('#fleet-table').innerHTML));
  ok('driver names remain escaped',!e.el('#fleet-table').innerHTML.includes('A <script>'));
  ok('no salary reads occur',e.reads.length===0);
  ok('top driver editor remains and row editor stays removed',e.el('#page').innerHTML.includes('編輯司機')&&!e.el('#fleet-table').innerHTML.includes('編輯姓名'));
  e.el('#edit-driver').onclick();ok('top editor still opens the name form',e.ctx.form.html.includes('newname'));
 }
 console.log(`RESULT: ${count} vehicle UI checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1});

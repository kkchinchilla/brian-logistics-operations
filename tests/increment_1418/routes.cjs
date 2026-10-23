const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),html=fs.readFileSync(root+'/ui-routes.html','utf8');
let checks=0;const ok=(name,v=true)=>{assert.ok(v,name);checks++;console.log('PASS:',name)};
async function setup({finance=false,role='dispatcher',capabilityError=false}={}){
 const calls=[],nodes=new Map();
 function node(){const classes=new Set();return {value:'',textContent:'',innerHTML:'',disabled:false,style:{},parentElement:{style:{}},classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n),toggle(n,on){if(on===undefined)on=!classes.has(n);on?classes.add(n):classes.delete(n)}},setAttribute(){},addEventListener(){}};}
 for(const m of html.matchAll(/id="([^"]+)"/g))nodes.set(m[1],node());
 const workspace=node(),tables={delivery_regions:[{id:1,name:'Test region'}],delivery_temperature_zones:[{name:'常溫'}],delivery_region_zone_rates:[{region_id:1,zone_name:'常溫',delivery_fee:9876}],routes:[{id:1,route_code:'TEST',route_name:'Test route',active:true,temperature_zone:'常溫',delivery_region_id:1}]};
 const db={auth:{getUser:async()=>({data:{user:{id:'synthetic-account'}}})},rpc:async(fn)=>({data:capabilityError?null:{increment:'1.4.6',can_manage_finance:finance},error:capabilityError?{message:'offline'}:null}),from(table){
  const q={action:'select',select(){return this},order(){return this},eq(){return this},insert(payload){this.action='insert';this.payload=payload;return this},update(payload){this.action='update';this.payload=payload;return this},upsert(payload){this.action='upsert';this.payload=payload;return this},async single(){return {data:{id:'synthetic-account',active:true,role,display_name:'Test operator'},error:null}},then(resolve){calls.push({table,action:this.action,payload:this.payload&&JSON.parse(JSON.stringify(this.payload))});return Promise.resolve({data:structuredClone(tables[table]||[]),error:null}).then(resolve)}};return q;
 }};
 const ctx={db,console,setTimeout:()=>1,clearTimeout(){},location:{href:''},document:{body:{dataset:{}},getElementById:id=>nodes.get(id)||null,querySelector:s=>s==='.workspace'?workspace:nodes.get(s.slice(1)),querySelectorAll:()=>[],addEventListener(){}},matchMedia:()=>({matches:false}),addEventListener(){},confirm:()=>true};ctx.window=ctx;
 vm.createContext(ctx);for(const f of ['js/access-146.js','js/ui-routes-live.js'])vm.runInContext(fs.readFileSync(root+'/'+f,'utf8'),ctx);
 await new Promise(resolve=>setImmediate(resolve));return {ctx,calls,el:id=>nodes.get(id),workspace};
}
(async()=>{
 ok('route dialog has no price preview or time inputs',!/(fee-preview|fee-caption|f-start|f-end|fixed-time-field|preview-cost)/.test(html));
 ok('route code field and column are removed',!html.includes('f-code')&&!html.includes('編號'));
 ok('time column is removed',!html.includes('固定時段'));
 const css=fs.readFileSync(root+'/css/ui-routes-parity.css','utf8');ok('rates are hidden until the server allows finance access',css.includes(':not([data-finance-access="allowed"]) [data-route-finance]{display:none!important}'));
 for(const finance of [false,true]){
  const e=await setup({finance});
  ok((finance?'Brian':'dispatcher')+' loads the route catalogue',e.el('routes-body').innerHTML.includes('Test route'));
  ok('rate reads follow the finance capability',e.calls.some(x=>x.table==='delivery_region_zone_rates')===finance);
  ok('rate amounts only render for Brian',e.el('routes-body').innerHTML.includes('9,876')===finance);
  e.el('tab-rates').onclick();ok('rate tab cannot be forced open without capability',e.el('section-title').textContent===(finance?'地區 × 溫層費率表':'路線列表'));
  e.el('add-route').onclick();e.el('f-name').value='New route';e.el('f-region').value='Test region';e.el('f-zone').value='常溫';
  await e.el('route-form').onsubmit({preventDefault(){}});
  const create=e.calls.find(x=>x.action==='insert'&&x.table==='routes');
  assert.deepEqual(create.payload,{route_name:'New route',temperature_zone:'常溫',delivery_region_id:1,active:true});ok('route creation sends operational fields only');
  e.el('routes-body').onclick({target:{closest:()=>({dataset:{id:'1'}})}});e.el('f-name').value='Edited route';
  await e.el('route-form').onsubmit({preventDefault(){}});
  const edit=e.calls.find(x=>x.action==='update'&&x.table==='routes');ok('editing does not overwrite historical times',edit.payload.route_name==='Edited route'&&!Object.hasOwn(edit.payload,'default_start_time')&&!Object.hasOwn(edit.payload,'default_end_time'));
  e.el('rates-body').onclick({target:{closest:()=>({dataset:{rateRegion:'1',rateZone:'常溫'}})}});e.el('rate-amount').value='123';
  await e.el('rate-form').onsubmit({preventDefault(){}});ok('rate edit event is capability guarded',e.calls.some(x=>x.action==='upsert')===finance);
 }
 const failed=await setup({finance:true,capabilityError:true});ok('capability failure keeps rates closed but route management usable',!failed.calls.some(x=>x.table==='delivery_region_zone_rates')&&failed.el('routes-body').innerHTML.includes('Test route')&&failed.ctx.document.body.dataset.financeAccess==='denied');
 const driver=await setup({role:'driver'});ok('drivers still cannot open route administration',driver.workspace.innerHTML.includes('沒有路線管理權限')&&driver.calls.length===0);
 console.log(`RESULT: ${checks} route UI checks passed`);
})().catch(error=>{console.error(error);process.exitCode=1});

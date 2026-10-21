/* Node VM integration only; not browser or visual/layout acceptance. */
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');let count=0;const ok=(n,v=true)=>{assert.ok(v,n);console.log('PASS:',n);count++};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function env(role='dispatcher'){
 const els=new Map(),calls=[],notices=[];let html='';
 const elem=k=>{if(!els.has(k)){let h='';els.set(k,{value:'',disabled:false,hidden:false,required:false,dataset:{},textContent:'',scrollLeft:0,scrollTop:0,classList:{add(){},remove(){},toggle(){}},addEventListener(t,f){this['on'+t]=f;},insertAdjacentHTML(_p,s){this.innerHTML+=s;},get innerHTML(){return h;},set innerHTML(v){h=v;if(v.includes('<option')){const opts=[...v.matchAll(/<option value="([^"]*)"([^>]*)>/g)];this.value=(opts.find(x=>x[2].includes('selected'))||opts[0]||[])[1]||'';}}});}return els.get(k);};
 const ctx={console,Date,Intl,Set,Map,Number,String,Object,Array,JSON,RegExp,Promise,structuredClone,setTimeout:()=>{},clearTimeout(){},currentUser:{id:role==='driver'?'d1':'manager'},supervisor:()=>role!=='driver',today:()=> '2026-10-20',esc,$:elem,chosen:id=>elem('#'+id).value,
  option:(v,t,s)=>`<option value="${esc(v)}" ${String(v)===String(s)?'selected':''}>${esc(t)}</option>`,field:(l,id,v='')=>`<label>${esc(l)}</label><input id="${id}" value="${esc(v)}">`,notify:n=>notices.push(n),
  document:{querySelector:elem,querySelectorAll:()=>[],body:{insertAdjacentHTML(){}}},
  FleetBinding144:{preferred:()=>1,hint:()=> 'mock vehicle rental hint',rental:()=>false},
  modal:(title,body,onSave)=>{html=body;ctx.modalState={title,html:body,onSave};for(const m of body.matchAll(/<(input|select|div|p|button)[^>]*\bid="([^"]+)"[^>]*>/g)){const e=elem('#'+m[2]);e.disabled=false;e.hidden=/\bhidden\b/.test(m[0]);e.value=(m[0].match(/value="([^"]*)"/)||[])[1]||'';if(m[1]==='select'){const end=body.indexOf('</select>',m.index);e.innerHTML=body.slice(m.index,end);}}},
  db:{rpc:async(fn,args)=>{calls.push({fn,args:structuredClone(args)});if(ctx.fail)return {error:{message:'save unavailable'}};if(fn==='dashboard_get_attendance_standby')return {data:ctx.records,error:null};if(fn==='dashboard_get_attendance_duties')return {data:ctx.duties||[],error:null};if(fn==='dashboard_get_attendance_day_state')return {data:{closed:false},error:null};return {data:{status:'approved'},error:null};}},
  allPagedRows:async(table)=>ctx.tables[table]||[],rows:async(table)=>ctx.tables[table]||[],tables:{},records:[],fail:false,
 };
 vm.createContext(ctx);for(const f of ['production-attendance.js','attendance-templates-143.js','attendance-approval-146.js'])vm.runInContext(fs.readFileSync(root+'/js/'+f,'utf8'),ctx);
 const run=s=>vm.runInContext(s,ctx);
 run(`drivers=[{id:'d1',display_name:'Driver <img>',active:true},{id:'d2',display_name:'Other',active:true}];vehicles=[{id:1,plate_number:'ABC-1',active:true}];routes=[{id:1,route_code:'R1',active:true,temperature_zone:'冷凍',default_start_time:'06:00',default_end_time:'07:00'}];actualWriteReady=true;scheduleReady=true;slotReady=true;approvalReady146=true;`);
 ctx.reloads=0;run('var realFetch1410=fetchBoard;fetchBoard=async()=>{globalThis.reloads++};');
 return {ctx,run,elem,calls,notices};
}
(async()=>{
 const e=env();for(const cat of ['日配','OC','鮮二','冷凍','低鮮']){
  e.run(`editAttendanceCell145('d1','${cat}',1)`);ok('standby option exists in '+cat,e.ctx.modalState.html.includes('value="standby"')&&e.ctx.modalState.html.includes('>值班</option>'));
 }
 ok('standard route keeps preferred vehicle and hides times',e.elem('#cell-vehicle').value==='1'&&!e.elem('#cell-vehicle').disabled&&e.elem('#cell-standby-times').hidden);
 e.elem('#cell-route').value='standby';e.elem('#cell-route').onchange();
 ok('standby forces disabled unspecified vehicle',e.elem('#cell-vehicle').value===''&&e.elem('#cell-vehicle').disabled&&e.elem('#cell-vehicle').innerHTML.includes('不指定'));
 ok('standby requires times and removes temperature/rental hints',!e.elem('#cell-standby-times').hidden&&e.elem('#cell-standby-start').required&&e.elem('#cell-rental-hint').hidden&&e.elem('#cell-fixed-time').textContent==='');
 await assert.rejects(()=>e.ctx.modalState.onSave(),/開始與結束/);ok('blank period cannot save',e.calls.length===0);
 e.elem('#cell-standby-start').value='23:00';e.elem('#cell-standby-end').value='01:00';await e.ctx.modalState.onSave();
 const req=e.calls[0];ok('new standby sends period and no route vehicle fields',req.fn==='dashboard_save_attendance_standby'&&req.args.p_source.kind==='empty'&&req.args.p_target.start_time==='23:00'&&!('vehicle_id' in req.args.p_target)&&!('route_id' in req.args.p_target));
 ok('successful save reloads canonical board',e.ctx.reloads===1);
 e.elem('#cell-route').value='1';e.elem('#cell-route').onchange();ok('switching back restores vehicle and route times',e.elem('#cell-vehicle').value==='1'&&!e.elem('#cell-vehicle').disabled&&e.elem('#cell-standby-times').hidden&&e.elem('#cell-fixed-time').textContent.includes('冷凍'));
 const s={id:9,driver_id:'d1',service_date:'2026-10-20',attendance_category:'OC',attendance_slot_index:1,revision:3,start_time:'23:00:00',end_time:'01:00:00',note:'old'};
 e.ctx.sample=s;e.run('standbyShifts=[sample];editStandby1410(9)');ok('reopening standby preloads correct period and source',e.elem('#cell-route').value==='standby'&&e.elem('#cell-standby-start').value==='23:00'&&e.elem('#cell-standby-end').value==='01:00');
 e.elem('#cell-remove-standby').onclick();e.elem('#cell-note').value='';await assert.rejects(()=>e.ctx.modalState.onSave(),/原因/);e.elem('#cell-note').value='correction';await e.ctx.modalState.onSave();ok('standby removal sends reason and revision',e.calls.at(-1).args.p_target.kind==='delete'&&e.calls.at(-1).args.p_source.revision===3);
 e.run('editStandby1410(9)');e.elem('#cell-route').value='1';e.elem('#cell-route').onchange();e.elem('#cell-vehicle').value='1';await e.ctx.modalState.onSave();ok('standby to delivery uses atomic cell operation',e.calls.at(-1).args.p_target.kind==='route'&&e.calls.at(-1).args.p_target.vehicle_id===1);
 const d=env('driver');d.ctx.sample=s;d.run('standbyShifts=[sample];editStandby1410(9)');ok('driver form explicitly requires approval',d.elem('#modal-save').textContent==='送出審核'&&d.ctx.modalState.html.includes('審核前保留原紀錄'));
 d.elem('#cell-standby-end').value='02:00';await d.ctx.modalState.onSave();ok('driver does not optimistically mutate standby',d.run('standbyShifts[0].end_time')==='01:00:00'&&d.notices.at(-1).includes('等待主管核准'));
 d.ctx.fail=true;d.run('editStandby1410(9)');await assert.rejects(()=>d.ctx.modalState.onSave(),err=>err.message==='save unavailable');ok('failed save surfaces error without changing board',d.run('standbyShifts[0].revision')===3&&d.ctx.reloads===1);
 const q={id:1,request_kind:'standby',status:'pending',revision:1,driver_id:'d1',service_date:'2026-10-20',attendance_category:'OC',attendance_slot_index:1,base_record:{source:{kind:'standby'},start_time:'23:00',end_time:'01:00',note:'old'},proposed_cell:{kind:'standby',start_time:'23:00',end_time:'02:00'},proposed_note:'<img onerror=evil>'};
 e.ctx.q=q;e.run('openApprovalRequest146(q)');ok('approval compares periods and unspecified vehicle',e.ctx.modalState.html.includes('隔日 01:00')&&e.ctx.modalState.html.includes('隔日 02:00')&&e.ctx.modalState.html.includes('不指定'));
 ok('approval escapes untrusted notes',!e.ctx.modalState.html.includes('<img onerror=evil>')&&e.ctx.modalState.html.includes('&lt;img'));
 d.ctx.q=q;d.run('attendanceRequests146=[q];editStandby1410(9)');ok('driver reopens pending request instead of creating another',d.ctx.modalState.html.includes('申請 #1')&&d.elem('#modal-save').hidden);
 const b=env();b.ctx.sample=s;b.run('standbyShifts=[sample];paintBoard()');ok('board displays standby and unspecified vehicle with period',b.elem('#attendance-table').innerHTML.includes('data-standby="9"')&&b.elem('#attendance-table').innerHTML.includes('值班')&&b.elem('#attendance-table').innerHTML.includes('不指定')&&b.elem('#attendance-table').innerHTML.includes('隔日 01:00'));
 ok('standby excluded from delivery count',b.elem('#attendance-note').textContent.includes('0 趟配送 · 0 趟未預排配送 · 1 段值班'));
 b.elem('#filter').value='值班';b.run('paintBoard()');ok('standby search matches only its driver',b.elem('#attendance-table').innerHTML.includes('Driver &lt;img&gt;')&&!b.elem('#attendance-table').innerHTML.includes('Other'));
 b.elem('#filter').value='';b.run('closeout={closed_at:"closed"};paintBoard()');ok('closed board hides editable standby action',!b.elem('#attendance-table').innerHTML.includes('data-standby="9"')&&b.elem('#attendance-table').innerHTML.includes('值班'));
 b.ctx.modalState=null;b.run('editStandby1410(9)');ok('closed editor cannot open',b.ctx.modalState===null);
 b.run('closeout=null;editLeave143("d1")');ok('leave dialog recognizes standby occupancy',b.ctx.modalState.html.includes('已有值班')&&b.ctx.modalState.html.includes('disabled'));
 const f=env();f.ctx.records=[s];await f.run('realFetch1410()');ok('fetch loads standalone records and enables editor',f.run('standbyShifts.length')===1&&f.run('actualWriteReady'));
 f.ctx.fail=true;await f.run('realFetch1410()');ok('standby load failure fails closed',!f.run('actualWriteReady')&&!f.run('approvalReady146'));
 // Existing route-only behavior remains on its approved endpoints.
 const r=env();r.run('editAttendanceCell145("d1","日配",1)');r.elem('#cell-route').value='1';await r.ctx.modalState.onSave();ok('normal dispatcher add still saves planned route',r.calls[0].fn==='dashboard_save_day_plan');
 const dr=env('driver');dr.run('editAttendanceCell145("d1","日配",1)');dr.elem('#cell-route').value='1';await dr.ctx.modalState.onSave();ok('normal driver add still requests approval',dr.calls[0].fn==='dashboard_request_attendance_add');
 console.log(`RESULT: ${count} attendance VM integration checks passed (not browser/visual QA)`);
})().catch(e=>{console.error(e);process.exitCode=1});

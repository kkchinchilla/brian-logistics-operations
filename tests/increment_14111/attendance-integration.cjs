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
  e.run(`editAttendanceCell145('d1','${cat}',1)`);ok('all three duty choices in '+cat,['>值班</option>','>跟車</option>','>學習</option>'].every(s=>e.ctx.modalState.html.includes(s)));
 }
 for(const kind of ['learning','follow_along','standby']){
  e.elem('#cell-route').value=kind;e.elem('#cell-route').onchange();
  ok(kind+' hides vehicle and has no run selector or hours',e.elem('#cell-vehicle-fields').hidden&&e.elem('#cell-vehicle').disabled&&e.elem('#cell-rental-hint').hidden&&!/id="cell-(follow-run|standby-start|standby-end)"/.test(e.ctx.modalState.html));
  e.elem('#cell-note').value='note only';await e.ctx.modalState.onSave();
  const p=e.calls.at(-1).args.p_target;
  ok(kind+' saves only type and note',p.kind===kind&&p.note==='note only'&&Object.keys(p).sort().join(',')==='kind,note');
 }
 e.elem('#cell-route').value='1';e.elem('#cell-route').onchange();
 ok('returning to delivery restores selectable vehicle',!e.elem('#cell-vehicle-fields').hidden&&!e.elem('#cell-vehicle').disabled&&e.elem('#cell-vehicle').value==='1');
 const duty={id:5,driver_id:'d1',service_date:'2026-10-20',attendance_category:'OC',attendance_slot_index:1,kind:'follow_along',linked_run_id:10,linked_run:{vehicle_id:1},revision:2,note:'original'};
 e.ctx.duty=duty;e.run('dutyEntries=[duty];editDuty1411(5)');ok('historical follow opens with only duty type and note',e.elem('#cell-route').value==='follow_along'&&e.elem('#cell-vehicle-fields').hidden&&!e.ctx.modalState.html.includes('cell-follow-run'));
 e.elem('#cell-route').value='learning';e.elem('#cell-route').onchange();await e.ctx.modalState.onSave();ok('follow-to-learning uses source revision',e.calls.at(-1).args.p_source.kind==='duty'&&e.calls.at(-1).args.p_source.revision===2&&e.calls.at(-1).args.p_target.kind==='learning');
 e.run('editDuty1411(5)');e.elem('#cell-remove-duty').onclick();e.elem('#cell-note').value='';await assert.rejects(()=>e.ctx.modalState.onSave(),/原因/);e.elem('#cell-note').value='correction';await e.ctx.modalState.onSave();ok('duty deletion includes mandatory reason',e.calls.at(-1).args.p_target.kind==='delete'&&e.calls.at(-1).args.p_target.note==='correction');
 const d=env('driver');d.run('editAttendanceCell145("d1","OC",1)');d.elem('#cell-route').value='learning';d.elem('#cell-route').onchange();ok('driver form requests approval',d.elem('#modal-save').textContent==='送出審核');await d.ctx.modalState.onSave();ok('driver add does not optimistically alter attendance',d.run('dutyEntries.length')===0&&d.notices.at(-1).includes('等待主管核准'));
 const q={id:11,request_kind:'duty',driver_id:'d1',service_date:'2026-10-20',attendance_category:'OC',attendance_slot_index:1,status:'pending',revision:1,base_record:{source:{kind:'duty'},kind:'follow_along',linked_run_id:10,linked_run:{vehicle_id:1},note:'old'},proposed_cell:{kind:'learning'},proposed_note:'<img onerror=evil>'};
 e.ctx.q=q;e.run('openApprovalRequest146(q)');ok('approval shows before-after duty and per-entry unit',e.ctx.modalState.html.includes('跟車')&&e.ctx.modalState.html.includes('學習')&&e.ctx.modalState.html.includes('每筆紀錄')&&!e.ctx.modalState.html.includes('#10')&&!e.ctx.modalState.html.includes('車號')&&!e.ctx.modalState.html.includes('值班時段'));
 ok('duty approval escapes notes',!e.ctx.modalState.html.includes('<img onerror=evil>')&&e.ctx.modalState.html.includes('&lt;img'));
 d.ctx.q=q;d.run('attendanceRequests146=[q];editAttendanceCell145("d1","OC",1)');ok('driver sees pending request instead of second form',d.ctx.modalState.html.includes('申請 #11')&&d.elem('#modal-save').hidden);
 e.run('paintBoard()');ok('board renders follow separately from deliveries',e.elem('#attendance-table').innerHTML.includes('data-duty="5"')&&e.elem('#attendance-note').textContent.includes('1 筆跟車'));
 e.elem('#filter').value='跟車';e.run('paintBoard()');ok('duty keyword search works',e.elem('#attendance-table').innerHTML.includes('Driver &lt;img&gt;')&&!e.elem('#attendance-table').innerHTML.includes('Other'));
 e.run('closeout={closed_at:"closed"};paintBoard()');ok('closed duties become read-only',!e.elem('#attendance-table').innerHTML.includes('data-duty="5"'));
 e.ctx.modalState=null;e.run('editDuty1411(5)');ok('closed duty editor cannot open',e.ctx.modalState===null);
 const f=env();f.ctx.duties=[duty];await f.run('realFetch1410()');ok('canonical duty records load from new endpoint',f.run('dutyEntries.length')===1&&f.run('actualWriteReady'));
 const original=f.ctx.db.rpc;f.ctx.db.rpc=async(fn,p)=>fn==='dashboard_get_attendance_duties'?{data:null,error:{message:'duties unavailable'}}:original(fn,p);await f.run('realFetch1410()');ok('duty read failure disables all attendance editing',!f.run('actualWriteReady')&&!f.run('approvalReady146'));
 // Use actual settings UI and engine inside the same VM harness.
 const s=env();s.ctx.finance=()=>true;s.ctx.wrapTable=(headers,body)=>headers.join('|')+body;s.ctx.loadMonth=async()=>true;
 for(const file of ['payroll-reconciliation-1491.js','payroll-settings-1491.js'])vm.runInContext(fs.readFileSync(root+'/js/'+file,'utf8'),s.ctx);
 s.ctx.db.rpc=async(fn,args)=>{s.calls.push({fn,args:structuredClone(args)});return {data:{revision:3},error:null};};
 s.run('PayrollSettings1491.setState({month:"2026-10",supplements:[],report:{summaries:[],lines:[]}});PayrollSettings1491.open()');
 ok('settings renamed and both per-entry fields visible',s.ctx.modalState.title==='勤務／租車設定'&&s.ctx.modalState.html.includes('跟車勤務費（NT$／筆')&&s.ctx.modalState.html.includes('學習勤務費（NT$／筆'));
 s.elem('#supplement-from').value='2026-10-01';s.elem('#supplement-follow-along').value='120';s.elem('#supplement-learning').value='0';s.elem('#supplement-reason').value='approved rates';await s.ctx.modalState.onSave();
 ok('settings distinguish explicit zero from blank and send both rates',s.calls.at(-1).fn==='dashboard_save_duty_supplements'&&s.calls.at(-1).args.p_follow_along_amount===120&&s.calls.at(-1).args.p_learning_amount===0&&s.calls.at(-1).args.p_standby_amount===null);
 s.elem('#supplement-learning').value='-1';await assert.rejects(()=>s.ctx.modalState.onSave(),/整數/);ok('negative duty pay rejected by form');
 s.ctx.finance=()=>false;s.ctx.modalState=null;s.run('PayrollSettings1491.open()');ok('non-Brian cannot open duty settings',s.ctx.modalState===null);
 console.log(`RESULT: ${count} Increment 1.4.11.1 UI VM checks passed (not browser/visual QA)`);
})().catch(e=>{console.error(e);process.exitCode=1});

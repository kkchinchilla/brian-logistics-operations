/* Increment 1.4.3. P5 interaction/layout; Supabase persistence only.
 * No localStorage, seed records, payroll changes or automatic recurrence.
 * Depends on production-common.js and production-attendance.js.
 */
'use strict';
let scheduleReady=false,scheduleLoadError='',driverDays=[],allBoardRuns=[],executionDrivers143=new Set();
const day143=id=>driverDays.find(d=>d.driver_id===id);
const onLeave143=id=>!!day143(id)?.is_leave;
const clone143=x=>JSON.parse(JSON.stringify(x));
const occupied143=id=>(standbyShifts.some(s=>s.driver_id===id)||dutyEntries.some(s=>s.driver_id===id))||runs.some(r=>r.driver_id===id)||extraTrips.some(x=>x.driver_id===id&&x.status==='active')||executionDrivers143.has(id);
const emptyPlanChanged143=(id,category,slot)=>Array.isArray(day143(id)?.applied_rows)&&day143(id).applied_rows.some(x=>x.category===category&&Number(x.slot_index)===slot);
const date143=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const monthDays143=month=>{
 if(!/^\d{4}-\d{2}$/.test(month))throw Error('月份格式錯誤');
 const [y,m]=month.split('-').map(Number);if(m<1||m>12||y<1900||y>9998)throw Error('月份超出可用範圍');
 return Array.from({length:new Date(y,m,0).getDate()},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`);
};
function leaveCell143(driver){
 const off=onLeave143(driver.id),label=`${driver.display_name} · 休假`;
 if(supervisor()&&driver.active&&scheduleReady&&!closeout?.closed_at)return `<td class="attendance-leave"><button class="leave-toggle ${off?'is-leave':''}" data-leave="${esc(driver.id)}" aria-label="${esc(label)}" type="button">${off?'休':'&nbsp;'}</button></td>`;
 return `<td class="attendance-leave">${off?'休':''}</td>`;
}
function planCellChanged143(run,idx){
 const snapshot=day143(run.driver_id)?.applied_rows;
 if(!Array.isArray(snapshot)||run.status==='cancelled')return false;
 const origin=snapshot.find(x=>x.category===run.attendance_category&&Number(x.slot_index)===run.attendance_slot_index);
 return String(origin?.[idx===0?'route_id':'vehicle_id']??'')!==String(run[idx===0?'route_id':'vehicle_id']??'');
}
function editLeave143(driverId){
 if(!supervisor()||!scheduleReady||closeout?.closed_at)return;
 const date=boardDate,off=onLeave143(driverId),occupied=occupied143(driverId),expected=Number(day143(driverId)?.revision||0);
 modal(`${name(driverId)} · 休假`,`<p class="note">${esc(date)}｜只調整此司機當日狀態。</p><div class="leave-status-options" role="radiogroup" aria-label="當日休假狀態"><label class="leave-option"><input type="radio" name="leave-status" value="none" ${off?'':'checked'}><span><strong>不標示休假</strong><small>休假欄留白，可安排配送趟次。</small></span></label><label class="leave-option"><input type="radio" name="leave-status" value="off" ${off?'checked':''} ${occupied&&!off?'disabled':''}><span><strong>休</strong><small>標示休假後，當日不可新增趟次。</small></span></label></div><p class="leave-help ${occupied?'is-blocked':''}">${occupied?'此日已有值班／跟車／學習、預排或實際出勤趟次，無法標示「休」。系統不會自動刪除。':'標示「休」後，手動新增及範本套用都會受限制。'}</p>`,async()=>{
  if(boardDate!==date)throw Error('日期已變更，請重新開啟');
  const selection=$('#modal-fields input[name="leave-status"]:checked');if(!selection)throw Error('請選擇休假狀態');
  const {error}=await db.rpc('dashboard_set_driver_leave',{p_service_date:date,p_driver_id:driverId,p_is_leave:selection.value==='off',p_expected_revision:expected});
  if(error)throw error;await fetchBoard();notify(selection.value==='off'?'已標示「休」，當日不可新增趟次':'已取消休假，可安排當日趟次');
 });
 $('#modal-save').textContent='儲存';
}
/* Increment 1.4.5: one editing experience for all attendance cells. The
 * underlying write is selected by existing role and record state, never by a
 * tab or an extra decision made by the dispatcher/driver. */
function openRunCell143(id){editRun(id);}
function openEmptyCell143(id,category,slot){editAttendanceCell145(id,category,slot);}
function editPlannedCell143(id,category,slot,run=null){
 editAttendanceCell145(id,category,slot,run);
}

const plan143={open:false,busy:false,token:0,driver:'',tab:'template',saved:null,draft:[],dirty:false,month:'',selected:new Set(),calendar:{},error:'',pending:null,focus:null,overflow:''};
function initSchedule143(){
 if($('#plan-panel'))return;
 document.body.insertAdjacentHTML('beforeend',`<div id="plan-backdrop" class="plan-backdrop"></div><section class="plan-panel" id="plan-panel" role="dialog" aria-modal="true" aria-labelledby="plan-title" aria-hidden="true"><header class="plan-header"><div class="plan-heading"><h2 id="plan-title">司機單日班表範本與批次排班</h2><p>設定一日固定趟次，複製到選取的日期；個別日期可在每日出勤表修改。</p></div><button type="button" class="plan-x" id="plan-x" aria-label="關閉批次排班">×</button></header><div class="plan-topbar"><label for="template-driver">司機</label><select id="template-driver"></select><span class="plan-ref">儲存於 Supabase · 僅產生預排，不計為實際出勤</span></div><div class="plan-tabs" role="tablist"><button type="button" data-plan-tab="template" role="tab" aria-controls="plan-content">① 編輯單日範本</button><button type="button" data-plan-tab="apply" role="tab" aria-controls="plan-content">② 套用指定日期</button></div><div class="plan-scroll" id="plan-content" role="tabpanel"></div></section>`);
 $('#template-open').onclick=()=>safePlan143(openPlan143);
 $('#plan-x').onclick=closePlan143;$('#plan-backdrop').onclick=closePlan143;
 $('#template-driver').onchange=()=>safePlan143(async()=>{
  const next=chosen('template-driver');if(!discardTemplate143()){$('#template-driver').value=plan143.driver;return;}
  plan143.driver=next;plan143.overwrite=false;plan143.selected.clear();plan143.calendar={};plan143.pending=null;await loadTemplate143();
  if(plan143.tab==='apply')await loadCalendar143();renderPlan143();
 });
 $('#plan-panel').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||plan143.busy)return;
  if(b.dataset.planTab)safePlan143(()=>setPlanTab143(b.dataset.planTab));
  else if(b.dataset.planDate){const date=b.dataset.planDate;const info=plan143.calendar[date];if(info&&!info.closed&&!info.is_leave){plan143.selected.has(date)?plan143.selected.delete(date):plan143.selected.add(date);plan143.pending=null;renderPlan143();}}
  else if(b.dataset.planAction)safePlan143(()=>planAction143(b.dataset.planAction,b.dataset.index));
 });
 $('#plan-panel').addEventListener('change',e=>{
  const el=e.target;if(plan143.busy)return;
  if(el.dataset.templateField){
   const row=plan143.draft[Number(el.dataset.index)];if(!row)return;
   const key=el.dataset.templateField;
   row[key]=['route_id','vehicle_id','slot_index'].includes(key)?Number(el.value)||null:el.value;
   plan143.dirty=true;plan143.pending=null;
   if(key==='route_id'){const info=el.closest('.plan-route-row').querySelector('.fixed-time');info.textContent=routeTime143(row.route_id);}
   if(key==='vehicle_id'){const info=el.closest('.plan-route-row').querySelector('.plan-rental-caption');info.textContent=FleetBinding144.hint(ownerBindings,plan143.driver,row.vehicle_id,today(),vehicles);}
  }
  if(el.id==='plan-month-picker')safePlan143(async()=>{monthDays143(el.value);plan143.month=el.value;await loadCalendar143();renderPlan143();});
  if(el.id==='plan-overwrite')plan143.pending=null;
 });
 document.addEventListener('keydown',e=>{
  if(!plan143.open)return;
  if(e.key==='Escape'){e.preventDefault();closePlan143();}
  if(e.key==='Tab'){
   const nodes=[...$('#plan-panel').querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(n=>n.getClientRects().length);
   const first=nodes[0],last=nodes.at(-1);if(!first)return;
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
 });
}
async function safePlan143(fn){try{await fn();}catch(e){plan143.error=e.message||String(e);if(plan143.open){const el=$('#plan-error');if(el)el.textContent=plan143.error;else renderPlan143();}else notify(plan143.error);}}
function setBusy143(busy){
 plan143.busy=busy;$('#plan-panel')?.setAttribute('aria-busy',String(busy));
 $('#plan-panel')?.querySelectorAll('button,input,select').forEach(el=>{
  if(busy){if(!Object.hasOwn(el.dataset,'disabledBefore143'))el.dataset.disabledBefore143=String(el.disabled);el.disabled=true;}
  else if(Object.hasOwn(el.dataset,'disabledBefore143')){el.disabled=el.dataset.disabledBefore143==='true';delete el.dataset.disabledBefore143;}
 });
}
async function openPlan143(){
 if(!supervisor()||!scheduleReady)return;
 const available=drivers.filter(x=>x.active);if(!available.length){notify('請先建立啟用中的司機帳號');return;}
 plan143.open=true;plan143.focus=document.activeElement;plan143.driver=available[0].id;plan143.tab='template';plan143.month=boardDate.slice(0,7);plan143.overwrite=false;
 plan143.selected=new Set();plan143.calendar={};plan143.error='';plan143.pending=null;plan143.overwrite=false;
 plan143.overflow=document.body.style.overflow;document.body.style.overflow='hidden';
 document.querySelector('.app-shell').inert=true;document.querySelector('.mobilebar').inert=true;
 $('#template-driver').innerHTML=available.map(d=>option(d.id,d.display_name,plan143.driver)).join('');
 $('#plan-panel').classList.add('show');$('#plan-backdrop').classList.add('show');$('#plan-panel').setAttribute('aria-hidden','false');
 $('#plan-content').innerHTML='<p class="plan-loading">正在讀取單日範本…</p>';
 await loadTemplate143();renderPlan143();$('#plan-x').focus();
}
function discardTemplate143(){return !plan143.dirty||confirm('尚有未儲存的範本編輯。確定放棄修改？');}
function closePlan143(){
 if(!plan143.open||plan143.busy||!discardTemplate143())return false;
 plan143.open=false;++plan143.token;$('#plan-panel').classList.remove('show');$('#plan-backdrop').classList.remove('show');$('#plan-panel').setAttribute('aria-hidden','true');
 document.body.style.overflow=plan143.overflow;document.querySelector('.app-shell').inert=false;document.querySelector('.mobilebar').inert=false;
 plan143.focus?.focus();return true;
}
async function loadTemplate143(){
 const driver=plan143.driver,token=++plan143.token;plan143.saved=null;plan143.draft=[];plan143.dirty=false;setBusy143(true);
 try{
  const {data,error}=await db.from('driver_day_templates').select('driver_id,rows,revision,updated_at').eq('driver_id',driver).maybeSingle();
  if(error)throw error;if(token!==plan143.token||driver!==plan143.driver)return;
  plan143.saved=data;plan143.draft=(clone143(data?.rows||[])).map(({is_rental,...row})=>row);plan143.dirty=false;plan143.error='';
 }finally{setBusy143(false);}
}
async function loadCalendar143(){
 const driver=plan143.driver,month=plan143.month,token=++plan143.token;setBusy143(true);
 try{
  const {data,error}=await db.rpc('dashboard_get_schedule_month',{p_driver_id:driver,p_month:month+'-01'});
  if(error)throw error;if(token!==plan143.token||driver!==plan143.driver)return;
  for(const d of data||[]){plan143.calendar[d.date]=d;if(d.closed||d.is_leave)plan143.selected.delete(d.date);}
 }finally{setBusy143(false);}
}
async function setPlanTab143(tab){
 if(tab===plan143.tab)return;if(!discardTemplate143())return;
 plan143.draft=clone143(plan143.saved?.rows||[]);plan143.dirty=false;plan143.tab=tab;plan143.error='';
 if(tab==='apply')await loadCalendar143();renderPlan143();
}
function routeTime143(id){const r=rt(Number(id));return r?`${r.temperature_zone||'未設定'} · ${(r.default_start_time||'').slice(0,5)}–${(r.default_end_time||'').slice(0,5)}（固定時段）`:'選擇路線後帶入固定時段';}
function row143(x,i){
 const select=(key,content)=>`<select data-template-field="${key}" data-index="${i}" aria-label="第${i+1}筆${{category:'出勤類別',slot_index:'欄位',route_id:'路線',vehicle_id:'車號'}[key]}">${content}</select>`;
 const bound=FleetBinding144.valid(ownerBindings,plan143.driver,today(),vehicles);
 const note=FleetBinding144.hint(ownerBindings,plan143.driver,x.vehicle_id,today(),vehicles);
 return `<div class="plan-route-row"><label>出勤類別${select('category',attendanceGroups.map(g=>option(g.name,g.name,x.category)).join(''))}</label><label>欄位${select('slot_index',Array.from({length:30},(_,n)=>option(n+1,`第 ${n+1} 趟`,x.slot_index)).join(''))}</label><label>路線${select('route_id',option('','請選擇路線',x.route_id||'')+routes.filter(r=>r.active||r.id===x.route_id).map(r=>option(r.id,`${r.route_code}${r.active?'':'（停用）'}`,x.route_id)).join(''))}</label><label>車號${select('vehicle_id',option('','請選擇車號',x.vehicle_id||'')+vehicles.filter(v=>v.active||v.id===x.vehicle_id).map(v=>option(v.id,`${v.plate_number}${v.active?'':'（停用）'}`,x.vehicle_id)).join(''))}</label><button class="plan-tiny-remove" type="button" data-plan-action="remove" data-index="${i}" aria-label="移除第 ${i+1} 趟">×</button><div class="plan-run-meta"><span class="fixed-time">${esc(routeTime143(x.route_id))}</span><span class="plan-rental-caption">${esc(note)}${bound.length>1?' · 可自由改車':''}</span></div></div>`;
}

function renderPlan143(){
 if(!plan143.open)return;
 $('#template-driver').disabled=false;$('#plan-x').disabled=false;
 $('#plan-panel').querySelectorAll('[data-plan-tab]').forEach(b=>{b.disabled=false;b.classList.toggle('active',b.dataset.planTab===plan143.tab);b.setAttribute('aria-selected',String(b.dataset.planTab===plan143.tab));});
 if(plan143.tab==='template'){
  $('#plan-content').innerHTML=`<div class="plan-section-head"><div><h3>單日固定班表 · ${esc(name(plan143.driver))}</h3><p>只要設定此司機一天通常跑的路線和車號，之後再決定要複製到哪些日期。</p></div></div><div class="plan-info">一份範本代表 <b>一個工作日的預排趟次</b>，不設定每週固定星期。可以把同一份範本套用到不同月份裡<b>自行選取的日期</b>，例外再到每日出勤表修改。</div><div class="plan-section-head"><div><h3>當日的預排趟次</h3><p>同一司機可有多個類別與欄位；車號可自由修改，租車狀態依實際套用日期的綁定自動判定。出勤類別不由路線溫層推算。</p></div></div><div class="plan-rowlist">${plan143.draft.map(row143).join('')||'<div class="plan-empty">尚未建立單日範本。可從當日預排帶入，或新增趟次。</div>'}</div><div class="plan-foot-actions"><button class="plan-btn" type="button" data-plan-action="import">從 ${esc(boardDate)} 預排帶入</button><button class="plan-btn" type="button" data-plan-action="add">＋ 新增預排趟次</button><button class="plan-btn primary" type="button" data-plan-action="save">儲存單日範本</button></div><p class="plan-status">${plan143.saved?`已儲存版本 ${plan143.saved.revision} · 編輯範本不會同步改動已排日期。`:'僅儲存司機的單日範本，不會立即產生排班。'}</p><div class="plan-error" id="plan-error" role="alert">${esc(plan143.error)}</div>`;
 }else renderApply143();
}
function renderApply143(){
 const month=plan143.month,days=monthDays143(month),rows=plan143.saved?.rows||[],first=new Date(month+'-01T12:00:00').getDay();
 const grouped={};for(const date of [...plan143.selected].sort()){(grouped[date.slice(0,7)]||= []).push(Number(date.slice(-2)));}
 const summary=Object.entries(grouped).map(([m,ds])=>`<span class="plan-summary-pill">${esc(m)} · ${ds.length} 天（${ds.join('、')} 日）</span>`).join('');
 const cells=days.map(date=>{const d=plan143.calendar[date],chosen=plan143.selected.has(date),closed=d?.closed,off=d?.is_leave;
  return `<button type="button" class="plan-calendar-day ${chosen?'selected':''} ${d?.has_runs?'has-plan':''} ${off?'is-off':''}" data-plan-date="${date}" aria-pressed="${chosen}" aria-label="${date}${off?'（休假）':''}${closed?'（已結案）':''}" ${!d||closed||off?'disabled':''}><span>${Number(date.slice(-2))}</span>${off?'<small>休</small>':''}</button>`;
 }).join('');
 const exceptions=[...plan143.selected].filter(d=>plan143.calendar[d]?.has_plan_exception).length;
 // The change handler owns this flag; do not resurrect a previously unchecked value.
 plan143.overwrite=!!plan143.overwrite;
 $('#plan-content').innerHTML=`<div class="plan-section-head"><div><h3>挑選要複製班表的日期</h3><p>選取月曆中的具體日期，<b>可切換月份累積選取</b>。不會自動選滿全月或固定星期。</p></div></div><div class="plan-apply-grid"><div class="plan-minicard"><h4>選取日期</h4><div class="plan-datebar"><button class="plan-btn" data-plan-action="prev-month" aria-label="上個月">‹</button><input type="month" class="plan-month-picker" id="plan-month-picker" value="${month}" aria-label="套用月份"><button class="plan-btn" data-plan-action="next-month" aria-label="下個月">›</button></div><div class="plan-calendar"><div class="plan-calendar-head">${['日','一','二','三','四','五','六'].map(w=>`<span>週${w}</span>`).join('')}</div><div class="plan-calendar-grid">${'<span></span>'.repeat(first)}${cells}</div><p class="plan-summary-note">黃色：本次選取 · 小黃點：已排班 · 休：該司機休假 · 刪除線：已結案</p></div><div class="plan-pick-actions"><button class="plan-btn" data-plan-action="select-month">選取本月全部</button><button class="plan-btn" data-plan-action="select-weekdays">選取本月週一至週五</button><button class="plan-btn" data-plan-action="clear-month">清除本月選取</button></div><p class="plan-summary-note">快捷選取只是勾選日期，不代表司機固定週一至週五上班。休假及已結案日期不會被選取。</p></div><div class="plan-minicard"><h4>${esc(name(plan143.driver))} · 已儲存的單日範本</h4><p>${rows.length} 趟 · ${plan143.saved?`版本 ${plan143.saved.revision}`:'尚未儲存'}</p><p>${rows.map(x=>`${esc(x.category)}${x.slot_index} ${esc(rt(x.route_id)?.route_code||'#'+x.route_id)}／${esc(plate(x.vehicle_id))}`).join('、')||'請先到「編輯單日範本」建立趟次。'}</p><div class="plan-apply-preview">已選 <b>${plan143.selected.size}</b> 天，其中 ${exceptions} 天有單日調整。單日調整預設保留。</div><h4 style="margin-top:17px">本次選取的日期</h4><div class="plan-date-summary">${summary||'<span class="plan-empty">尚未選取任何日期</span>'}</div></div></div><label class="plan-reapply"><input type="checkbox" id="plan-overwrite" ${plan143.overwrite?'checked':''}><span>允許<b>覆蓋已做的單日預排調整</b>（預設保留；不影響實際出勤）</span></label><div class="plan-info">僅套用到已選日期；休假、結案、已執行、有值班、有特殊勤務關聯及有未處理臨時實際趟次的日期會保留。資料庫會再次檢查權限、版本及派車衝突；若可套用日期有衝突，整批不寫入。</div><div class="plan-foot-actions"><span class="plan-status">已選 ${plan143.selected.size} 天</span><button class="plan-btn" data-plan-action="refresh-dates">重新載入日期</button><button class="plan-btn primary" data-plan-action="apply" ${!rows.length||!plan143.selected.size?'disabled':''}>套用至選取日期</button></div><div class="plan-error" id="plan-error" role="alert">${esc(plan143.error)}</div>`;
 $('#plan-overwrite').onchange=e=>{plan143.overwrite=e.target.checked;plan143.pending=null;};
}
function validateTemplate143(){
 if(!plan143.draft.length)throw Error('請至少建立一趟預排；休假請在每日出勤表設定');
 const seen=new Set();
 for(const x of plan143.draft){
  if(!attendanceGroups.some(g=>g.name===x.category)||!Number.isInteger(x.slot_index)||x.slot_index<1||x.slot_index>30||!x.route_id||!x.vehicle_id)throw Error('請填妥每趟出勤類別、欄位、路線及車號');
  const key=x.category+':'+x.slot_index;if(seen.has(key))throw Error(`${x.category}第${x.slot_index}趟重複`);seen.add(key);
 }
}
function uuid143(){
 if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const h=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
async function planAction143(action,index){
 plan143.error='';
 if(action==='add'){
  let free;for(const g of attendanceGroups){for(let n=1;n<=30;n++){if(!plan143.draft.some(x=>x.category===g.name&&x.slot_index===n)){free={category:g.name,slot_index:n,route_id:null,vehicle_id:FleetBinding144.preferred(ownerBindings,plan143.driver,today(),vehicles)};break;}}if(free)break;}
  if(!free)throw Error('所有可用欄位已使用');plan143.draft.push(free);plan143.dirty=true;plan143.pending=null;renderPlan143();return;
 }
 if(action==='remove'){plan143.draft.splice(Number(index),1);plan143.dirty=true;plan143.pending=null;renderPlan143();return;}
 if(action==='import'){
  if(plan143.draft.length&&!confirm(`將 ${boardDate} 原定預排帶入，取代目前正在編輯的範本內容？`))return;
  const mine=allBoardRuns.filter(r=>r.driver_id===plan143.driver&&r.status!=='cancelled');
  if(!mine.length)throw Error('此司機當日尚無預排趟次');
  if(mine.some(r=>!r.attendance_category||!r.attendance_slot_index))throw Error('當日有未分類預排；請先在出勤表指定類別與欄號後再帶入');
  plan143.draft=mine.map(r=>({category:r.attendance_category,slot_index:r.attendance_slot_index,route_id:r.route_id,vehicle_id:r.vehicle_id}));
  plan143.dirty=true;plan143.pending=null;renderPlan143();return;
 }
 if(action==='save'){
  validateTemplate143();setBusy143(true);
  try{const {data,error}=await db.rpc('dashboard_save_day_template',{p_driver_id:plan143.driver,p_rows:clone143(plan143.draft),p_expected_revision:plan143.saved?.revision||0});if(error)throw error;
   plan143.saved=data;plan143.draft=clone143(data.rows);plan143.dirty=false;plan143.pending=null;plan143.error='單日班表範本已儲存。已排日期不會自動更動。';
  }catch(e){plan143.error=e.message||String(e);}finally{setBusy143(false);renderPlan143();}return;
 }
 if(action==='prev-month'||action==='next-month'){
  const d=new Date(plan143.month+'-01T12:00:00');d.setMonth(d.getMonth()+(action==='prev-month'?-1:1));plan143.month=date143(d).slice(0,7);
  await loadCalendar143();renderPlan143();return;
 }
 if(['select-month','select-weekdays','clear-month'].includes(action)){
  for(const d of monthDays143(plan143.month)){
   if(action==='clear-month'){plan143.selected.delete(d);continue;}
   const info=plan143.calendar[d];if(!info||info.closed||info.is_leave)continue;
   const w=new Date(d+'T12:00:00').getDay();if(action==='select-month'||(w>0&&w<6))plan143.selected.add(d);
  }
  plan143.pending=null;renderPlan143();return;
 }
 if(action==='refresh-dates'){
  const original=plan143.month,months=new Set([original,...[...plan143.selected].map(x=>x.slice(0,7))]);
  try{for(const m of months){plan143.month=m;await loadCalendar143();}}finally{plan143.month=original;plan143.pending=null;renderPlan143();}return;
 }
 if(action==='apply'){
  if(!plan143.saved?.rows?.length||!plan143.selected.size)throw Error('請先儲存範本並選取日期');
  if(plan143.selected.size>366)throw Error('單次最多選取 366 天；請分批套用。');
  const overwrite=!!$('#plan-overwrite').checked;
  if(overwrite&&!confirm('確定覆蓋已選日期的單日預排調整？休假、結案及已執行紀錄不會被覆蓋，實際出勤也會獨立保留。'))return;
  const dates=[...plan143.selected].sort(),expected=Object.fromEntries(dates.map(d=>[d,plan143.calendar[d]?.revision??0]));
  const payload={p_driver_id:plan143.driver,p_template_revision:plan143.saved.revision,p_dates:dates,p_expected_days:expected,p_overwrite:overwrite};
  const fingerprint=JSON.stringify(payload);
  if(plan143.pending?.fingerprint!==fingerprint)plan143.pending={fingerprint,id:uuid143()};
  setBusy143(true);
  try{
   const {data,error}=await db.rpc('dashboard_apply_day_template',{...payload,p_request_id:plan143.pending.id});if(error)throw error;
   plan143.dirty=false;setBusy143(false);
   const applied=data.applied_dates||[],skipped=data.skipped||[];
   if(applied.length){
    const first=applied.find(d=>d>=boardDate)||applied[0];boardDate=first;$('#service-date').value=first;closePlan143();
    const summary=`已套用 ${applied.length} 天${skipped.length?`；保留 ${skipped.length} 天：${skipped.map(x=>`${x.date}（${x.reason}）`).join('、')}`:''}。`;
    try{await fetchBoard();notify(summary);}catch(e){notify(summary+' 出勤表重新載入失敗，請重新整理：'+(e.message||String(e)));}
   }
   else{plan143.error=`未建立新排班：${skipped.map(x=>`${x.date} ${x.reason}`).join('；')}`;renderPlan143();}
   plan143.pending=null;
  }catch(e){plan143.error=(e.message||String(e))+'。請確認後重試；資料已更新時請按「重新載入日期」。';setBusy143(false);renderPlan143();}
 }
}

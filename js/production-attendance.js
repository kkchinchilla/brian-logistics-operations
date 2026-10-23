let ownerBindings=[],closeoutReady1421=false;
let boardDate=today(),runs=[],drivers=[],vehicles=[],routes=[],observations=[],extraTrips=[],standbyShifts=[],dutyEntries=[],closeout=null,boardRequest=0,actualWriteReady=false,actualWriteError="";
// Attendance columns are explicit Excel groups, NOT route temperature_zone.
const attendanceGroups=[
 {name:'日配',prefix:'日',base:2},{name:'OC',prefix:'OC',base:3},
 {name:'鮮二',prefix:'鮮二',base:3},{name:'冷凍',prefix:'冷凍',base:4},
 {name:'低鮮',prefix:'低鮮',base:4}
];
const MAX_ATTENDANCE_COLUMNS=30;
const defaultSlotCounts=()=>Object.fromEntries(attendanceGroups.map(g=>[g.name,g.base]));
let slotCounts=defaultSlotCounts(),slotReady=false,slotLoadError='';
const buckets=['常溫','冷藏','冷凍','低鮮'];

async function loadPage(){
if(!supervisor())return DriverAttendance1421.init();
[drivers,vehicles,routes,ownerBindings]=await Promise.all([
 allPagedRows('profiles','id,display_name,role,active',q=>q.eq('role','driver')),
 allPagedRows('vehicles','id,plate_number,active'),
 allPagedRows('routes','id,route_name,temperature_zone,active,default_start_time,default_end_time'),
 allPagedRows('vehicle_owner_bindings','id,driver_id,vehicle_id,effective_from,effective_to')
]);
$('#head-actions').insertAdjacentHTML('afterbegin',`<div class="date-navigation"><button class="btn icon-nav" id="previous" aria-label="前一天">‹</button><input class="field" type="date" id="service-date" value="${boardDate}" aria-label="出勤日期"><button class="btn icon-nav" id="following" aria-label="後一天">›</button></div><button id="new-run" class="btn primary" ${supervisor()?'':'hidden'}>＋ 新增配送趟次</button><button id="close" class="btn" ${supervisor()?'':'hidden'}>結案</button>`);
$('#page').innerHTML=`<div class="tools board-tools"><div class="attendance-operations"><button type="button" class="btn plan-open" id="template-open" hidden>單日範本／批次排班</button><button type="button" class="btn" id="adjust-slots" hidden>調整趟數</button><div class="board-legend"><span class="legend-dot"></span>黃色代表已異動</div></div><input class="field search" id="filter" placeholder="搜尋司機、車號、路線" aria-label="搜尋出勤資料"></div><div id="attendance-table"></div><div id="attendance-note" class="note"></div>`;
$('#service-date').onchange=e=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){e.target.value=boardDate;return;}boardDate=e.target.value;refreshBoard143()};
$('#previous').onclick=()=>shift(-1);$('#following').onclick=()=>shift(1);
$('#filter').oninput=paintBoard;$('#close').onclick=closeOrReopen;$('#new-run').onclick=()=>scheduleEditor();$('#adjust-slots').onclick=openSlotEditor;

initSchedule143();
await fetchBoard();
}

async function refreshBoard143(){try{await fetchBoard();}catch(e){notify('出勤資料重新載入失敗，請重新整理：'+(e.message||String(e)));}}
function shift(amount){const d=new Date(boardDate+'T12:00:00');d.setDate(d.getDate()+amount);boardDate=d.toLocaleDateString('en-CA');$('#service-date').value=boardDate;refreshBoard143()}
async function fetchBoard(){
 const date=boardDate,req=++boardRequest;
 scheduleReady=false;actualWriteReady=false;closeoutReady1421=false;$('#close').disabled=true;$('#new-run').disabled=true;$('#template-open').disabled=true;
 // The new run columns require migration 141. Until then preserve the old 1.4 board.
 let nextRuns, nextSlots, newSlotReady=true, nextError='';
 try{
  [nextRuns,nextSlots]=await Promise.all([
   allPagedRows('runs','id,service_date,route_id,driver_id,vehicle_id,status,is_rental,dispatcher_notes,temperature_zone_snapshot,attendance_category,attendance_slot_index,dashboard_schedule_revision',q=>q.eq('service_date',date).order('id')),
   rows('daily_attendance_slot_counts','service_date,category,slot_count',q=>q.eq('service_date',date))
  ]);
 }catch(e){
  newSlotReady=false;nextError=e.message||'欄位設定尚未安裝';
  nextRuns=await rows('runs','id,service_date,route_id,driver_id,vehicle_id,status,is_rental,dispatcher_notes,temperature_zone_snapshot',q=>q.eq('service_date',date).order('id'));
  nextSlots=[];
 }
 let nextObservations=[],nextExtras=[],ready=true,detailError='';
 // Fail safe when 142 has not been installed: continue displaying 141 data,
 // but never attempt new RPCs on a partially migrated schema.
 try{
  [nextObservations,nextExtras]=await Promise.all([
   nextRuns.length?allPagedRows('daily_run_observations','id,run_id,driver_id,actual_route_id,actual_vehicle_id,actual_note,revision',q=>q.in('run_id',nextRuns.map(r=>r.id))):Promise.resolve([]),
   allPagedRows('daily_attendance_extra_trips','id,service_date,driver_id,attendance_category,attendance_slot_index,actual_route_id,actual_vehicle_id,is_rental,actual_note,status,revision',q=>q.eq('service_date',date))
  ]);
 }catch(e){
  ready=false;detailError=e.message||'尚未啟用 142 實際配送 SQL';
  nextObservations=nextRuns.length?await allPagedRows('daily_run_observations','id,run_id,driver_id,actual_vehicle_id,actual_note',q=>q.in('run_id',nextRuns.map(r=>r.id))):[];
 }
 let nextDriverDays=[],nextExecutions=[],newScheduleReady=false,scheduleError='';
 try{
  [nextDriverDays,nextExecutions]=await Promise.all([
   rows('attendance_driver_days','service_date,driver_id,is_leave,revision,has_plan_exception,template_revision,applied_rows',q=>q.eq('service_date',date)),
   supervisor()?allPagedRows('trip_executions','id,driver_id',q=>q.eq('service_date',date)):Promise.resolve([])
  ]);newScheduleReady=true;
 }catch(e){scheduleError=e.message||'143 SQL 尚未安裝';}
 let nextCloseout=null,nextStandby=[],nextDuties=[],closeoutOK=true;
 try{
  const [state,standby,duties]=await Promise.all([
   db.rpc('dashboard_get_attendance_day_state',{p_date:date}),
   db.rpc('dashboard_get_attendance_standby',{p_date:date}),
   db.rpc('dashboard_get_attendance_duties',{p_date:date})
  ]);
  if(state.error)throw state.error;
  if(standby.error)throw standby.error;
  if(!Array.isArray(standby.data))throw Error('值班資料載入失敗');
  nextStandby=standby.data;
  if(duties.error)throw duties.error;
  if(!Array.isArray(duties.data))throw Error('跟車／學習資料載入失敗');
  nextDuties=duties.data;
  if(typeof state.data?.closed!=='boolean')throw Error('無法確認結案狀態');
  nextCloseout=state.data;
 }catch(e){closeoutOK=false;ready=false;newScheduleReady=false;detailError=e.message||'結案與勤務資料載入失敗';}

 if(req!==boardRequest||date!==boardDate)return;
 allBoardRuns=nextRuns;driverDays=nextDriverDays;executionDrivers143=new Set(nextExecutions.map(e=>e.driver_id));scheduleReady=newScheduleReady;scheduleLoadError=scheduleError;
 runs=nextRuns.filter(r=>r.status!=='cancelled'||nextObservations.some(o=>o.run_id===r.id));observations=nextObservations;extraTrips=nextExtras;standbyShifts=nextStandby;dutyEntries=nextDuties;closeout=nextCloseout;closeoutReady1421=closeoutOK;
 actualWriteReady=ready;actualWriteError=detailError;
 slotReady=newSlotReady;slotLoadError=nextError;
 slotCounts=defaultSlotCounts();
 for(const rec of nextSlots){if(Object.hasOwn(slotCounts,rec.category))slotCounts[rec.category]=Number(rec.slot_count)}
 $('#close').disabled=!closeoutOK;
 paintBoard();
}
const name=id=>drivers.find(d=>d.id===id)?.display_name||'—';const plate=id=>vehicles.find(v=>String(v.id)===String(id))?.plate_number||'';const rt=id=>routes.find(r=>r.id===id);
const routeLabel1424=id=>rt(id)?.route_name?.trim()||'未設定路線名稱';
function paintLegacyBoard(){
 const term=($('#filter')?.value||'').toLocaleLowerCase();
 const zones=[...new Set([...buckets,...runs.map(r=>rt(r.route_id)?.temperature_zone||r.temperature_zone_snapshot||'未設定')])];
 const max={};
 zones.forEach(z=>max[z]=Math.max(1,...drivers.map(d=>runs.filter(r=>r.driver_id===d.id&&(rt(r.route_id)?.temperature_zone||r.temperature_zone_snapshot||'未設定')===z).length)));
 const matching=drivers.filter(d=>{const mine=runs.filter(r=>r.driver_id===d.id);return !term||[d.display_name,...mine.flatMap(r=>[routeLabel1424(observations.find(o=>o.run_id===r.id)?.actual_route_id??r.route_id),plate(r.vehicle_id)])].join(' ').toLocaleLowerCase().includes(term)});
 let thead='<thead><tr class="category"><th class="sticky" rowspan="2">司機</th>';
 for(const zone of zones)thead+=`<th colspan="${max[zone]*2}">${esc(zone)}</th>`;
 thead+='</tr><tr class="subheading">';
 for(const zone of zones)for(let i=0;i<max[zone];i++)thead+=`<th class="attendance-route ${i===0?'group-start':''}">${esc(zone)}${i+1}</th><th>車號</th>`;
 thead+='</tr></thead>';
 let body='';
 for(const d of matching){
  let cells=`<td class="sticky">${esc(d.display_name)}</td>`;
  for(const zone of zones){
   const zoneRuns=runs.filter(r=>r.driver_id===d.id&&(rt(r.route_id)?.temperature_zone||r.temperature_zone_snapshot||'未設定')===zone);
   for(let i=0;i<max[zone];i++){
    const r=zoneRuns[i];const obs=r&&observations.find(o=>o.run_id===r.id);
    const editable=r&&['assigned','in_progress','completed'].includes(r.status)&&actualWriteReady&&!closeout?.closed_at&&supervisor();
    const route=r?(routeLabel1424(obs?.actual_route_id??r.route_id)):'';
    const effective=obs?.actual_vehicle_id??r?.vehicle_id;
    for(let idx=0;idx<2;idx++){
     const value=idx===0?route:(r?plate(effective):'');
     const changed=!!(obs&&(idx===0?(obs.actual_route_id&&String(obs.actual_route_id)!==String(r.route_id)):(obs.actual_vehicle_id&&String(obs.actual_vehicle_id)!==String(r.vehicle_id))));
     cells+=`<td class="${idx===0?'attendance-route ':''}${i===0&&idx===0?'group-start ':''}${!r?'empty-slot ':''}${changed?'changed':''}">`;
     if(editable)cells+=`<button type="button" class="cell" data-run="${r.id}" aria-label="編輯${esc(d.display_name)}${esc(zone)}${i+1}">${esc(value||'')}</button>`;
     else cells+=esc(value||'');
     cells+='</td>';
    }
   }
  }
  body+=`<tr class="${d.id===currentUser?.id?'mine':''}">${cells}</tr>`;
 }
 const markup=`<div class="panel attendance-panel"><div class="scroll"><table class="gridtable attendance-matrix">${thead}<tbody>${body||`<tr><td colspan="${1+zones.reduce((acc,z)=>acc+2*max[z],0)}" class="empty">目前沒有符合條件的司機</td></tr>`}</tbody></table></div><div class="footer">共 ${matching.length} 位司機 <span>左右滑動查看更多欄位 →</span></div></div>`;
 $('#attendance-table').innerHTML=markup;
 $('#new-run').disabled=!!closeout?.closed_at;
 $('#attendance-note').textContent=`${boardDate} · ${runs.length} 趟配送${closeout?.closed_at?' · 已結案':''}。未安排的資料保持空白。`;
 $('#close').textContent=closeout?.closed_at?'重新開啟':'結案';
 document.querySelectorAll('[data-run]').forEach(b=>b.onclick=()=>editRun(Number(b.dataset.run)));
}



// Explicit slot configuration is per service date and shared by the entire company.
// Legacy rows without an assigned group remain visible in '其他路線', never guessed from temperature.
function paintBoard(){
 if(!supervisor())return;
 const oldScroll=$('#attendance-table .scroll');const keepPosition=$('#attendance-table')?.dataset.serviceDate===boardDate;
 const pos=keepPosition&&oldScroll?{x:oldScroll.scrollLeft,y:oldScroll.scrollTop}:{x:0,y:0};
 if(!slotReady){
  paintLegacyBoard();
  $('#adjust-slots').hidden=true;$('#template-open').hidden=true;
  $('#attendance-note').textContent+=' · 尚未安裝 141 出勤欄位 SQL，暫使用舊版溫層分組。';
  return;
 }
 const isClosed=!!closeout?.closed_at;
 $('#adjust-slots').hidden=!supervisor()||isClosed;
 $('#template-open').hidden=!supervisor();$('#template-open').disabled=!scheduleReady;
 const term=($('#filter')?.value||'').toLocaleLowerCase();
 const unmatched=runs.filter(r=>!attendanceGroups.some(g=>g.name===r.attendance_category)||!Number.isInteger(r.attendance_slot_index)||r.attendance_slot_index<1);
 const othersByDriver=new Map();
 unmatched.forEach(r=>{const group=othersByDriver.get(r.driver_id)||[];group.push(r);othersByDriver.set(r.driver_id,group)});
 const otherMax=Math.max(0,...Array.from(othersByDriver.values(),x=>x.length));
 const activeExtras=extraTrips.filter(x=>x.status==='active');
 const occupiedMax=g=>Math.max(0,...dutyEntries.filter(x=>x.attendance_category===g.name).map(x=>x.attendance_slot_index||0),...standbyShifts.filter(x=>x.attendance_category===g.name).map(x=>x.attendance_slot_index||0),...runs.filter(r=>r.attendance_category===g.name).map(r=>r.attendance_slot_index||0),...activeExtras.filter(x=>x.attendance_category===g.name).map(x=>x.attendance_slot_index||0));
 const groups=attendanceGroups.map(g=>({name:g.name,prefix:g.prefix,count:Math.max(1,slotCounts[g.name]||g.base,occupiedMax(g))}));
 if(otherMax)groups.push({name:'其他路線',prefix:'其他',count:otherMax});
 const unplacedStandby=standbyShifts.filter(x=>!x.attendance_category);
 const unplacedCount=Math.max(0,...drivers.map(d=>unplacedStandby.filter(x=>x.driver_id===d.id).length));
 if(unplacedCount)groups.push({name:'其他值班',prefix:'值班',count:unplacedCount});
 const matching=drivers.filter(d=>{
  const mine=runs.filter(r=>r.driver_id===d.id);
  const extras=activeExtras.filter(x=>x.driver_id===d.id);
  return !term||[d.display_name,...mine.flatMap(r=>[routeLabel1424(observations.find(o=>o.run_id===r.id)?.actual_route_id??r.route_id),plate(r.vehicle_id),r.attendance_category]),...extras.flatMap(x=>[routeLabel1424(x.actual_route_id),plate(x.actual_vehicle_id),x.attendance_category]),...dutyEntries.filter(x=>x.driver_id===d.id).flatMap(x=>[dutyLabel1411(x.kind),'不指定',x.note]),...standbyShifts.filter(x=>x.driver_id===d.id).flatMap(x=>['值班','不指定',x.note])].join(' ').toLocaleLowerCase().includes(term);
 });
 let thead='<thead><tr class="category"><th class="sticky" rowspan="2">司機</th><th class="attendance-leave" rowspan="2">休假</th>';
 for(const group of groups)thead+=`<th colspan="${group.count*2}">${esc(group.name)}</th>`;
 thead+='</tr><tr class="subheading">';
 for(const group of groups)for(let i=1;i<=group.count;i++)thead+=`<th class="attendance-route ${i===1?'group-start':''}">${esc(group.prefix+i)}</th><th>車號</th>`;
 thead+='</tr></thead>';
 let body='';
 for(const d of matching){
  let cells=`<td class="sticky">${esc(d.display_name)}</td>${leaveCell143(d)}`;
  for(const group of groups){
   for(let i=1;i<=group.count;i++){
    const r=group.name==='其他路線'?othersByDriver.get(d.id)?.[i-1]:runs.find(x=>x.driver_id===d.id&&x.attendance_category===group.name&&x.attendance_slot_index===i);
    const extra=group.name==='其他路線'?null:activeExtras.find(x=>x.driver_id===d.id&&x.attendance_category===group.name&&x.attendance_slot_index===i);
    const standby=group.name==='其他值班'?unplacedStandby.filter(x=>x.driver_id===d.id)[i-1]:standbyShifts.find(x=>x.driver_id===d.id&&x.attendance_category===group.name&&Number(x.attendance_slot_index)===i);
    const duty=dutyEntries.find(x=>x.driver_id===d.id&&x.attendance_category===group.name&&Number(x.attendance_slot_index)===i);
    const obs=r&&observations.find(o=>o.run_id===r.id);
    const editable=actualWriteReady&&scheduleReady&&!onLeave143(d.id)&&!isClosed&&(!r||['assigned','in_progress','completed'].includes(r.status))&&supervisor();
    const isExtra=!r&&!!extra;
    const route=r?(routeLabel1424(obs?.actual_route_id??r.route_id)):(extra?routeLabel1424(extra.actual_route_id):'');
    const effective=r?(obs?.actual_vehicle_id??r.vehicle_id):extra?.actual_vehicle_id;
    for(let idx=0;idx<2;idx++){
     const value=duty?(idx===0?dutyLabel1411(duty.kind):'不指定'):standby?(idx===0?'值班':'不指定'):(idx===0?route:plate(effective));
     const changed=!!(duty||standby||isExtra||!r&&!extra&&emptyPlanChanged143(d.id,group.name,i)||r&&planCellChanged143(r,idx)||r&&obs&&(idx===0?(obs.actual_route_id&&String(obs.actual_route_id)!==String(r.route_id)):(obs.actual_vehicle_id&&String(obs.actual_vehicle_id)!==String(r.vehicle_id))));
     const empty=!r&&!extra&&!standby&&!duty;
     cells+=`<td class="${idx===0?'attendance-route ':''}${i===1&&idx===0?'group-start ':''}${empty?'empty-slot ':''}${changed?'changed':''}">`;
     if(editable&&(r||!['其他路線','其他值班'].includes(group.name))){
      const attr=duty?`data-duty="${duty.id}"`:standby?`data-standby="${standby.id}"`:r?`data-run="${r.id}"`:extra?`data-extra="${extra.id}"`:`data-add="1" data-driver="${esc(d.id)}" data-category="${esc(group.name)}" data-slot="${i}"`;
      const desc=duty?'編輯'+dutyLabel1411(duty.kind):standby?'編輯值班':r?'編輯':extra?'編輯臨時趟次':supervisor()?'新增勤務':'申請新增勤務';
      cells+=`<button type="button" class="cell ${empty?'add-actual':''}" ${attr} ${standby||duty?`title="${esc((standby||duty).note||'')}"`:""} aria-label="${desc}${esc(d.display_name)}${esc(group.name)}${i}">${esc(value||(empty?'＋':''))}</button>`;
     }else cells+=standby?`<span title="${esc(standby.note||'')}">${esc(value)}</span>`:esc(value||'');
     cells+='</td>';
    }
   }
  }
  body+=`<tr class="${d.id===currentUser?.id?'mine':''}">${cells}</tr>`;
 }
 const allColumns=2+groups.reduce((acc,g)=>acc+2*g.count,0);
 $('#attendance-table').innerHTML=`<div class="panel attendance-panel"><div class="scroll"><table class="gridtable attendance-matrix">${thead}<tbody>${body||`<tr><td colspan="${allColumns}" class="empty">目前沒有符合條件的司機</td></tr>`}</tbody></table></div><div class="footer">共 ${matching.length} 位司機 <span>左右滑動查看更多欄位 →</span></div></div>`;
 const updatedScroll=$('#attendance-table .scroll');if(updatedScroll){updatedScroll.scrollLeft=pos.x;updatedScroll.scrollTop=pos.y;}$('#attendance-table').dataset.serviceDate=boardDate;
 $('#new-run').disabled=isClosed||!scheduleReady;
 $('#close').textContent=isClosed?'重新開啟':'結案';
 $('#attendance-note').textContent=`${boardDate} · ${runs.length} 趟配送 · ${activeExtras.length} 趟未預排配送 · ${standbyShifts.length} 筆值班 · ${dutyEntries.filter(x=>x.kind==='follow_along').length} 筆跟車 · ${dutyEntries.filter(x=>x.kind==='learning').length} 筆學習${unmatched.length?` · ${unmatched.length} 趟尚未設定出勤欄位（列於其他路線）`:''}${isClosed?' · 已結案':''}${!actualWriteReady?' · 出勤資料載入不完整，暫停編輯':''}。`;
 document.querySelectorAll('[data-leave]').forEach(b=>b.onclick=()=>editLeave143(b.dataset.leave));
 document.querySelectorAll('[data-run]').forEach(b=>b.onclick=()=>openRunCell143(Number(b.dataset.run)));
 document.querySelectorAll('[data-duty]').forEach(b=>b.onclick=()=>editDuty1411(Number(b.dataset.duty)));
 document.querySelectorAll('[data-standby]').forEach(b=>b.onclick=()=>editStandby1410(Number(b.dataset.standby)));
 document.querySelectorAll('[data-extra]').forEach(b=>b.onclick=()=>editExtraTripById(Number(b.dataset.extra)));
 document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>openEmptyCell143(b.dataset.driver,b.dataset.category,Number(b.dataset.slot)));
 if(!scheduleReady)$('#attendance-note').textContent+=' 請先完成 143 SQL 檢查；新增功能暫停寫入。'; 
}

function openSlotEditor(){
 if(!supervisor()||!slotReady||closeout?.closed_at)return;
 const date=boardDate;
 const draft={...slotCounts};
 const usedCounts=Object.fromEntries(attendanceGroups.map(g=>[g.name,Math.max(0,...dutyEntries.filter(x=>x.attendance_category===g.name).map(x=>x.attendance_slot_index||0),...standbyShifts.filter(x=>x.attendance_category===g.name).map(x=>x.attendance_slot_index||0),...runs.filter(r=>r.attendance_category===g.name).map(r=>r.attendance_slot_index||0),...extraTrips.filter(x=>x.status==='active'&&x.attendance_category===g.name).map(x=>x.attendance_slot_index||0))]));
 const list=()=>attendanceGroups.map(g=>{
  const value=draft[g.name];
  const minimum=Math.max(1,usedCounts[g.name]);
  return `<div class="attendance-slot-item" data-slot-group="${esc(g.name)}"><div class="attendance-slot-copy"><strong>${esc(g.name)}</strong><span>${esc(g.prefix)}1 – ${esc(g.prefix)}${value}</span></div><div class="attendance-slot-steps"><button type="button" data-slot-step="-1" aria-label="減少${esc(g.name)}趟數" ${value<=minimum?'disabled':''}>−</button><output aria-label="${esc(g.name)}趟數">${value}</output><button type="button" class="increase" data-slot-step="1" aria-label="增加${esc(g.name)}趟數" ${value>=MAX_ATTENDANCE_COLUMNS?'disabled':''}>＋</button></div></div>`;
 }).join('');
 modal('調整每日趟數',`<p class="attendance-slot-description">調整各配送類別的欄位數量。新增趟次會一起增加「路線＋車號」兩欄。</p><div id="attendance-slot-list">${list()}</div><p class="attendance-slot-footnote">每一天可有不同趟數；有資料的最後一趟無法直接移除。</p>`,async()=>{
  if(boardDate!==date)throw Error('日期已變更，請重新開啟調整視窗。');
  if(closeout?.closed_at)throw Error('此日期已結案。');
  // Re-check the live server-side state atomically, including across operators.
  const {error}=await db.rpc('dashboard_set_attendance_slot_counts',{p_service_date:date,p_counts:draft});
  if(error)throw error;
  await fetchBoard();notify('出勤欄位數已儲存');
 });
 $('#modal-save').textContent='完成';
 const container=$('#attendance-slot-list');
 container.addEventListener('click',e=>{
  const btn=e.target.closest('button[data-slot-step]');if(!btn)return;
  const group=btn.closest('[data-slot-group]')?.dataset.slotGroup;
  const delta=Number(btn.dataset.slotStep);const next=draft[group]+delta;
  if(!Object.hasOwn(draft,group)||next<Math.max(1,usedCounts[group])||next>MAX_ATTENDANCE_COLUMNS)return;
  draft[group]=next;container.innerHTML=list();
 });
}

/* Supervisor editor. Open completed runs may still be corrected directly. */
function editRun(id){
 const run=runs.find(r=>r.id===id);
 if(run)editAttendanceCell145(run.driver_id,run.attendance_category,run.attendance_slot_index,run);
}
function editExtraTripById(id){
 const extra=extraTrips.find(x=>x.id===id);
 if(extra)editAttendanceCell145(extra.driver_id,extra.attendance_category,extra.attendance_slot_index,null,extra);
}
function editExtraTrip(driverId,category,slot){
 const extra=extraTrips.find(x=>x.driver_id===driverId&&x.attendance_category===category&&Number(x.attendance_slot_index)===Number(slot));
 editAttendanceCell145(driverId,category,slot,null,extra);
}
function editAttendanceCell145(driverId,category,slot,run=null,extra=null,standby=null,duty=null){
 if(!actualWriteReady||!scheduleReady||closeout?.closed_at||onLeave143(driverId)||
    !supervisor())return;
 if(!run&&(!slotReady||!attendanceGroups.some(g=>g.name===category)||
   !Number.isInteger(Number(slot))||Number(slot)<1||Number(slot)>slotCounts[category]))return;
 const observation=run?observations.find(o=>o.run_id===run.id):null;
 const isPlannedWrite=supervisor()&&!extra&&!run&&!standby&&!duty;
 const date=boardDate;
 const dayRevision=Number(day143(driverId)?.revision||0);
 const expectedRunRevision=run?.dashboard_schedule_revision||null;
 const expectedObservationRevision=Number(observation?.revision||0);
 const emptySlotRecord=!run&&!extra?extraTrips.find(x=>x.service_date===date&&x.driver_id===driverId&&x.attendance_category===category&&Number(x.attendance_slot_index)===Number(slot)):null;
 const expectedExtraRevision=Number(extra?.revision||emptySlotRecord?.revision||0);
 const currentRoute=duty?duty.kind:standby?'standby':run?(observation?.actual_route_id??run.route_id):extra?.actual_route_id;
 const currentVehicle=run?(observation?.actual_vehicle_id??run.vehicle_id):extra?.actual_vehicle_id;
 const currentNote=duty?duty.note:standby?standby.note:run?(observation?.actual_note??run.dispatcher_notes??''):(extra?.actual_note||'');
 const routeOptions=routes.filter(x=>x.active||String(x.id)===String(currentRoute))
   .map(x=>option(x.id,`${x.route_name||'未設定路線名稱'} · ${x.temperature_zone||''}`,currentRoute)).join('');
 const vehicleOptions=vehicles.filter(x=>x.active||String(x.id)===String(currentVehicle))
   .map(x=>option(x.id,x.plate_number,currentVehicle)).join('');
 const canCancelRun=!!(run&&run.status==='assigned');
 const canVoid=!!(extra&&extra.status==='active');
 const slotLabel=category&&slot?` · ${category}${slot}`:'';
 const explanation=duty?'修改此司機當天的勤務；每筆結案紀錄各計一次勤務費。':standby?'修改此司機當天的值班備註；結案後納入月度報表。':run
   ?'修改此司機當天的路線、車號與備註；不會影響其他日期或單日範本。'
   :extra?'修改此司機當天的趟次；不會影響其他日期或單日範本。'
   :'選擇配送路線、值班、跟車或學習；只影響此司機當天的勤務。';
 let voidIntent=false,cancelIntent=false;
 const source1410={kind:duty?"duty":standby?"standby":run?"run":extra?"extra":"empty",id:duty?.id||standby?.id||run?.id||extra?.id||null,revision:Number(duty?.revision||standby?.revision||expectedRunRevision||extra?.revision||0),observation_revision:expectedObservationRevision};
 modal(`${name(driverId)}${slotLabel}`,`<p class="note">${esc(explanation)}</p>`+
  `<label for="cell-route">路線</label><select class="field" id="cell-route">${option('','未指派',currentRoute||'')}${option('standby','值班',currentRoute)}${option('follow_along','跟車',currentRoute)}${option('learning','學習',currentRoute)}${routeOptions}</select>`+
  `<div id="cell-vehicle-fields"><label for="cell-vehicle">車號</label><select class="field" id="cell-vehicle">${option('','未指派',currentVehicle||'')}${vehicleOptions}</select></div>`+
  '<p class="note" id="cell-rental-hint" role="status"></p><p class="note" id="cell-fixed-time"></p>'+
  `<div id="cell-duty-help" hidden><p class="note">選擇勤務後，只需填寫備註；不需車輛、配送趟次或起迄時間。值班、跟車與學習僅記錄出勤，結案後納入月度筆數統計；不計算勤務費用，不另增加配送趟次或租車扣款。</p></div>`+
  field('備註','cell-note',currentNote)+
  `<p class="attendance-edit-help">未結案日期可跨日修改；儲存只影響此筆勤務。結案後需由主管填寫原因重新開啟。</p>`+
  (canCancelRun?`<button type="button" class="btn secondary-action" id="cell-cancel-run">取消此趟</button>`:'')+
  (duty?`<button type="button" class="btn secondary-action" id="cell-remove-duty">刪除此筆勤務</button>`:'')+
  (standby?`<button type="button" class="btn secondary-action" id="cell-remove-standby">刪除此筆值班</button>`:'')+
  (canVoid?`<button type="button" class="btn secondary-action" id="cell-void-trip">撤銷此趟</button>`:''),async()=>{
    if(boardDate!==date)throw Error('日期已變更，請重新開啟編輯視窗');
    if(closeout?.closed_at)throw Error('此日期已結案，請先重新開啟');
    const routeId=chosen('cell-route'),vehicleId=chosen('cell-vehicle'),note=chosen('cell-note');
    if(duty||isDuty1411(routeId)&&!cancelIntent&&!voidIntent){
      let target;
      if(voidIntent||cancelIntent)target={kind:'delete',note};
      else if(isDuty1411(routeId)){
       target={kind:routeId,note};
      }else if(routeId==='standby'){
       target={kind:'standby',note};
      }else{
       if(!routeId||!vehicleId)throw Error('請選擇路線與車號');
       target={kind:'route',route_id:Number(routeId),vehicle_id:Number(vehicleId),note};
      }
      if(target.kind==='delete'&&!note.trim())throw Error('刪除勤務請填寫原因');
      const {error}=await db.rpc('dashboard_save_attendance_duty',{p_service_date:date,p_driver_id:driverId,p_category:category,p_slot_index:Number(slot),p_source:source1410,p_target:target});
      if(error)throw error;
      await fetchBoard();notify('當日勤務已更新');return;
    }
    if(standby||routeId==='standby'&&!cancelIntent&&!voidIntent){
      const target=voidIntent||cancelIntent?{kind:'delete',note}:routeId==='standby'?{kind:'standby',note}:{kind:'route',route_id:routeId?Number(routeId):null,vehicle_id:vehicleId?Number(vehicleId):null,note};
      if(target.kind==='route'&&(!target.route_id||!target.vehicle_id))throw Error('請選擇路線與車號');
      if(target.kind==='delete'&&!note.trim())throw Error('刪除值班請填寫原因');
      const {error}=await db.rpc('dashboard_save_attendance_standby',{p_service_date:date,p_driver_id:driverId,p_category:category,p_slot_index:Number(slot),p_source:source1410,p_target:target});
      if(error)throw error;
      await fetchBoard();notify(target.kind==='delete'?'值班已刪除':'當日勤務已更新');return;
    }
    if(!voidIntent&&!cancelIntent&&Boolean(routeId)!==Boolean(vehicleId))throw Error('請同時選擇路線與車號');
    if(!voidIntent&&!cancelIntent&&(!routeId||!vehicleId))throw Error('請選擇路線與車號；取消預排請使用「取消此趟」');
    if(isPlannedWrite){
      const {error}=await db.rpc('dashboard_save_day_plan',{
        p_service_date:date,p_driver_id:driverId,p_category:category,p_slot_index:Number(slot),
        p_route_id:routeId?Number(routeId):null,p_vehicle_id:vehicleId?Number(vehicleId):null,
        p_is_rental:null,p_note:note,p_run_id:run?.id||null,
        p_expected_run_revision:expectedRunRevision,p_expected_day_revision:dayRevision
      });
      if(error){if(/已被更新|已結案|須透過/.test(error.message||''))await fetchBoard();throw error;}
    }else if(run){
      const {error}=await db.rpc('dashboard_edit_run_direct',{
        p_run_id:run.id,
        p_route_id:cancelIntent?null:Number(routeId),
        p_vehicle_id:cancelIntent?null:Number(vehicleId),
        p_note:note,
        p_expected_run_revision:Number(expectedRunRevision),
        p_expected_observation_revision:expectedObservationRevision,
        p_cancel:cancelIntent
      });
      if(error){if(/更新|已結案|不可直接修改|衝突|沒有權限/.test(error.message||''))await fetchBoard();throw error;}
    }else{
      if(voidIntent&&!note.trim())throw Error('撤銷趟次請填寫原因');
      const {error}=await db.rpc('dashboard_save_extra_actual_trip',{
        p_service_date:date,p_driver_id:driverId,p_category:category,p_slot_index:Number(slot),
        p_route_id:routeId?Number(routeId):null,p_vehicle_id:vehicleId?Number(vehicleId):null,
        p_is_rental:FleetBinding144.rental(ownerBindings,driverId,vehicleId,date),
        p_note:note,p_expected_revision:expectedExtraRevision,p_void:voidIntent
      });
      if(error){if(/資料已被其他人更新|已結案|已排|欄位/.test(error.message||''))await fetchBoard();throw error;}
    }
    await fetchBoard();notify(voidIntent?'已撤銷此趟':cancelIntent?'已取消此趟':'當日趟次已更新');
  });
 $('#modal-save').textContent='儲存';
 if(!standby&&!duty&&!currentVehicle){const preferred=FleetBinding144.preferred(ownerBindings,driverId,date,vehicles);
   if(preferred)$('#cell-vehicle').value=String(preferred);}
 let savedVehicle=$('#cell-vehicle').value;
 const updateRoute=()=>{
   const isSimple=chosen('cell-route')==='standby'||isDuty1411(chosen('cell-route'));
   $('#cell-duty-help').hidden=!isSimple;$('#cell-vehicle-fields').hidden=isSimple;
   if(isSimple){
    if(!$('#cell-vehicle').disabled)savedVehicle=$('#cell-vehicle').value;
    $('#cell-vehicle').innerHTML=option('','不指定','');$('#cell-vehicle').value='';$('#cell-vehicle').disabled=true;
   }else if($('#cell-vehicle').disabled&&!cancelIntent){
    $('#cell-vehicle').innerHTML=option('','未指派','')+vehicleOptions;$('#cell-vehicle').disabled=false;$('#cell-vehicle').value=savedVehicle||'';
   }
   $('#cell-rental-hint').hidden=isSimple;$('#cell-fixed-time').hidden=isSimple;
   const r=isSimple?null:rt(Number(chosen('cell-route')));
   $('#cell-fixed-time').textContent=r?`${r.temperature_zone||'未設定溫層'} · ${(r.default_start_time||'').slice(0,5)}–${(r.default_end_time||'').slice(0,5)}（路線固定時段）`:'';
   updateRental();
 };
 const updateRental=()=>{$('#cell-rental-hint').textContent=(chosen('cell-route')==='standby'||isDuty1411(chosen('cell-route')))?'':FleetBinding144.hint(ownerBindings,driverId,chosen('cell-vehicle'),date,vehicles);};
 $('#cell-route').onchange=updateRoute;$('#cell-vehicle').onchange=updateRental;
 updateRoute();updateRental();
 if(duty)$('#cell-remove-duty').onclick=()=>{voidIntent=true;$('#cell-route').disabled=true;$('#cell-vehicle').disabled=true;$('#modal-save').textContent='確認刪除勤務';$('#modal-error').textContent='請填寫刪除原因，再送出確認。';};
 if(standby)$('#cell-remove-standby').onclick=()=>{
   voidIntent=true;$('#cell-route').disabled=true;$('#cell-vehicle').disabled=true;
   $('#modal-save').textContent='確認刪除值班';$('#modal-error').textContent='請填寫刪除原因，再送出確認。';
 };
 if(canCancelRun)$('#cell-cancel-run').onclick=()=>{
   cancelIntent=true;
   $('#cell-route').disabled=true;$('#cell-vehicle').disabled=true;
   $('#cell-fixed-time').textContent='按下確認後將取消此趟配送，不影響其他日期。';
   $('#modal-save').textContent='確認取消趟次';
 };
 if(canVoid)$('#cell-void-trip').onclick=()=>{
   voidIntent=true;$('#modal-save').textContent='確認撤銷';
   $('#modal-error').textContent='請填寫撤銷原因，再送出確認。';
 };
}
// Only dispatchers may create or change planned assignments. Existing run triggers
// derive the planned route snapshot/time and reject driver/vehicle overlaps.
function scheduleEditor(run=null){
 if(!supervisor()||!scheduleReady)return;
 if(run&&onLeave143(run.driver_id)){notify('此司機當日為休假，請先取消休假');return;}
 if(closeout?.closed_at){notify('此日期已結案；請先重新開啟才能調整預排。');return}
 const activeDrivers=drivers.filter(d=>d.active&&!onLeave143(d.id));
 const activeVehicles=vehicles.filter(v=>v.active);
 const eligibleRoutes=routes.filter(r=>r.active&&r.temperature_zone&&r.default_start_time&&r.default_end_time);
 if(!activeDrivers.length||!activeVehicles.length||!eligibleRoutes.length){notify('請先建立啟用中的司機、車輛，以及有固定溫層和起迄時間的路線。');return}
 const choice=(id,title,items,key,label,value)=>`<label for="${id}">${title}</label><select class="field" id="${id}">${option('','請選擇',value)}${items.map(x=>option(x[key],label(x),value)).join('')}</select>`;
 const routeSelect=choice('plan-route','配送路線',eligibleRoutes,'id',x=>`${x.route_name||'未設定路線名稱'} · ${x.temperature_zone||''}`,run?.route_id);
 const driverSelect=choice('plan-driver','司機',activeDrivers,'id',x=>x.display_name,run?.driver_id);
 const vehicleSelect=choice('plan-vehicle','車輛',activeVehicles,'id',x=>x.plate_number,run?.vehicle_id);

 const selectedGroup=run?.attendance_category||'';
 const initialDate=boardDate;const expectedRevision=Number(run?.dashboard_schedule_revision||1);
 const groupSelect=slotReady?`<label for="plan-category">出勤欄位類別（與溫層不同）</label><select class="field" id="plan-category">${option('','請選擇',selectedGroup)}${attendanceGroups.map(g=>option(g.name,g.name,selectedGroup)).join('')}</select><label for="plan-slot">出勤欄位序號</label><select class="field" id="plan-slot"><option value="">請先選擇類別</option></select><p class="note">無法從路線溫層推斷類別；既有趟次可在此明確指定所屬欄位。</p>`:'';

 modal(run?'修改預排趟次':'新增配送趟次',`<p class="note">${esc(boardDate)} · 溫層與預計時間由路線主檔帶入；重疊派車由資料庫檢查。</p>${routeSelect}${driverSelect}${vehicleSelect}<p class="note" id="plan-rental-hint" role="status"></p>${groupSelect}${field('調度備註','plan-notes',run?.dispatcher_notes||'')}`,async()=>{
  if(boardDate!==initialDate)throw Error('日期已變更，請重新開啟編輯視窗。');
  if(closeout?.closed_at)throw Error('日期已結案，禁止修改預排。');
  const route=eligibleRoutes.find(x=>String(x.id)===chosen('plan-route'));
  if(!route||!chosen('plan-driver')||!chosen('plan-vehicle'))throw Error('請填寫路線、司機及車輛。');
  const payload={service_date:boardDate,route_id:Number(route.id),driver_id:chosen('plan-driver'),vehicle_id:Number(chosen('plan-vehicle')),dispatcher_notes:chosen('plan-notes').trim()||null};
  if(slotReady){
   const category=chosen('plan-category'),slot=Number(chosen('plan-slot'));
   if(!attendanceGroups.some(g=>g.name===category)||!Number.isInteger(slot)||slot<1||slot>slotCounts[category])throw Error('請指定有效的出勤類別與欄位序號。如需新增欄位，請先使用「調整趟數」。');
   if(runs.some(x=>x.id!==run?.id&&x.driver_id===payload.driver_id&&x.attendance_category===category&&x.attendance_slot_index===slot))throw Error('此司機的同類別欄位已排入其他趟次，請選擇另一個序號。');
   if(extraTrips.some(x=>x.status==='active'&&x.driver_id===payload.driver_id&&x.attendance_category===category&&x.attendance_slot_index===slot))throw Error('此欄位已有臨時實際趟次，請先處理該紀錄。');
   payload.attendance_category=category;payload.attendance_slot_index=slot;
  }
  const response=run?await db.from('runs').update(payload).eq('id',run.id).eq('dashboard_schedule_revision',expectedRevision).select('id'):await db.from('runs').insert({...payload,status:'assigned'});
  if(response.error)throw response.error;
  if(run&&!response.data?.length){await fetchBoard();throw Error('預排趟次已被另一位主管修改，請重新開啟後確認再儲存。');}
  await fetchBoard();notify(run?'預排趟次已更新':'配送趟次已建立');
 });
 $('#modal-save').textContent='儲存';
 const planRentalHint=()=>{$('#plan-rental-hint').textContent=FleetBinding144.hint(ownerBindings,chosen('plan-driver'),chosen('plan-vehicle'),initialDate,vehicles)};
 $('#plan-driver').onchange=()=>{const pref=FleetBinding144.preferred(ownerBindings,chosen('plan-driver'),initialDate,vehicles);$('#plan-vehicle').value=pref?String(pref):'';planRentalHint();};
 $('#plan-vehicle').onchange=planRentalHint;planRentalHint();
 if(slotReady){
  const category=$('#plan-category'),slot=$('#plan-slot');
  const updateSlots=()=>{
   const count=slotCounts[category.value]||0;
   const selected=category.value===selectedGroup?String(run?.attendance_slot_index||''):'';
   slot.innerHTML=option('','請選擇欄位',selected)+Array.from({length:count},(_,i)=>option(i+1,`${attendanceGroups.find(g=>g.name===category.value)?.prefix||''}${i+1}`,selected)).join('');
  };
  category.onchange=updateSlots;updateSlots();
 }
}

function closeOrReopen(){
 if(!supervisor()||!closeoutReady1421)return;
 const editingDate=boardDate,closed=!!closeout?.closed_at;
 modal(closed?'重新開啟 '+editingDate:'結案至 '+editingDate,
  `<p class="note">${closed?'只重新開啟此日期。月度報表會保留上次結案資料；修改後再次「確認結案」，才會取代報表中的舊資料。':`將鎖定 ${esc(editingDate)} 及之前所有尚未結案日期，保留按下結案時的紀錄。月度報表將以本次資料取代這些日期的上次結案資料，不重複計入。之後若需修改，須填寫原因重新開啟。`}</p>`+
  field(closed?'重新開啟原因（必填）':'主管備註','close-note',''),async()=>{
   if(boardDate!==editingDate)throw Error('日期已變更，請重新開啟視窗');
   const note=chosen('close-note').trim();
   if(closed&&!note)throw Error('請填寫重新開啟原因');
   const {error}=await db.rpc(closed?'dashboard_reopen_attendance_date':'dashboard_close_attendance_through',
    closed?{p_date:editingDate,p_reason:note}:{p_through_date:editingDate,p_note:note});
   if(error)throw error;
   await fetchBoard();notify(closed?editingDate+' 已重新開啟':'已結案至 '+editingDate);
  });
 $('#modal-save').textContent=closed?'確認重新開啟':'確認結案';
}

function standbyPeriod1410(s){return `${(s.start_time||"").slice(0,5)}–${s.end_time<s.start_time?"隔日 ":""}${(s.end_time||"").slice(0,5)}`;}
function editStandby1410(id){const s=standbyShifts.find(x=>x.id===id);if(s)editAttendanceCell145(s.driver_id,s.attendance_category,s.attendance_slot_index,null,null,s);}

const isDuty1411=k=>['follow_along','learning'].includes(k);
const dutyLabel1411=k=>({follow_along:'跟車',learning:'學習',standby:'值班'}[k]||'勤務');
function editDuty1411(id){const d=dutyEntries.find(x=>x.id===id);if(d)editAttendanceCell145(d.driver_id,d.attendance_category,d.attendance_slot_index,null,null,null,d);}

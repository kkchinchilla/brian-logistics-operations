/* Drivers read only their own schedule. No edit or approval actions. */
const DriverAttendance1421=(()=>{
 let date='',token=0;
 const groupOrder=['日配','OC','鮮二','冷凍','低鮮'];
 const category=x=>x.attendance_category?x.attendance_category+(x.attendance_slot_index||''):'其他勤務';
 const fail=result=>{if(result.error)throw result.error;return result.data;};
 async function init(){
  document.body.dataset.attendanceView='driver';
  document.querySelector('.head h1').textContent='我的出勤';
  document.querySelector('.head .eyebrow').textContent='我的班表 / MY SCHEDULE';
  document.querySelector('.head p').textContent=currentProfile.display_name+'，查看自己的配送與勤務安排。';
  date=today();
  $('#page').innerHTML=`<section class="driver-schedule" aria-label="我的每日出勤"><div class="driver-toolbar"><div class="driver-date-nav"><button class="btn" type="button" id="driver-prev" aria-label="前一天">‹</button><input class="field" type="date" id="driver-date" aria-label="出勤日期" value="${date}"><button class="btn" type="button" id="driver-next" aria-label="後一天">›</button></div><button class="btn" type="button" id="driver-today">今天</button><button class="btn" type="button" id="driver-refresh">重新整理</button></div><div id="driver-content" aria-live="polite"></div><p class="driver-schedule-help">班表由主管安排，如需調整請聯絡主管。</p></section>`;
  $('#driver-date').onchange=e=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){e.target.value=date;return;}date=e.target.value;load();};
  const shift=n=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;$('#driver-date').value=date;load();};
  $('#driver-prev').onclick=()=>shift(-1);$('#driver-next').onclick=()=>shift(1);
  $('#driver-today').onclick=()=>{date=today();$('#driver-date').value=date;load();};
  $('#driver-refresh').onclick=load;
  await load();
 }
 async function load(){
  const request=++token,day=date,id=currentUser.id;
  $('#driver-content').setAttribute('aria-busy','true');
  $('#driver-content').innerHTML='<p class="driver-empty">正在載入班表…</p>';
  try{
   const own=q=>q.eq('driver_id',id).eq('service_date',day);
   const [scheduled,extras,days,standbyResult,dutyResult]=await Promise.all([
    allPagedRows('runs','id,driver_id,route_id,vehicle_id,status,is_rental,dispatcher_notes,route_code_snapshot,temperature_zone_snapshot,attendance_category,attendance_slot_index',own),
    allPagedRows('daily_attendance_extra_trips','id,driver_id,status,actual_route_id,actual_vehicle_id,is_rental,actual_note,attendance_category,attendance_slot_index',own),
    rows('attendance_driver_days','driver_id,is_leave',own),
    db.rpc('dashboard_get_attendance_standby',{p_date:day}),db.rpc('dashboard_get_attendance_duties',{p_date:day})
   ]);
   const standby=fail(standbyResult),duties=fail(dutyResult);
   if(!Array.isArray(standby)||!Array.isArray(duties))throw Error('勤務資料載入失敗');
   const ownRuns=scheduled.filter(x=>x.driver_id===id),ownExtras=extras.filter(x=>x.driver_id===id&&x.status==='active');
   const observations=ownRuns.length?await allPagedRows('daily_run_observations','id,run_id,driver_id,actual_route_id,actual_vehicle_id,actual_note',q=>q.eq('driver_id',id).in('run_id',ownRuns.map(x=>x.id))):[];
   const items=ownRuns.filter(x=>x.status!=='cancelled'||observations.some(o=>o.run_id===x.id)).map(x=>{const o=observations.find(o=>o.run_id===x.id);return {...x,kind:'配送',route:o?.actual_route_id??x.route_id,vehicle:o?.actual_vehicle_id??x.vehicle_id,note:o?.actual_note??x.dispatcher_notes};});
   items.push(...ownExtras.map(x=>({...x,kind:'配送',route:x.actual_route_id,vehicle:x.actual_vehicle_id,note:x.actual_note})));
   items.push(...standby.filter(x=>x.driver_id===id).map(x=>({...x,kind:'值班'})),...duties.filter(x=>x.driver_id===id).map(x=>({...x,kind:x.kind==='follow_along'?'跟車':'學習'})));
   const routeIds=[...new Set(items.map(x=>x.route).filter(Boolean))],vehicleIds=[...new Set(items.map(x=>x.vehicle).filter(Boolean))];
   const [routeList,vehicleList]=await Promise.all([
    routeIds.length?allPagedRows('routes','id,route_code,route_name,temperature_zone',q=>q.in('id',routeIds)):[],
    vehicleIds.length?allPagedRows('vehicles','id,plate_number',q=>q.in('id',vehicleIds)):[]
   ]);
   if(request!==token||day!==date)return;
   const index=x=>{const n=groupOrder.indexOf(x.attendance_category);return n<0?groupOrder.length:n;};
   items.sort((a,b)=>index(a)-index(b)||(a.attendance_slot_index||0)-(b.attendance_slot_index||0)||a.id-b.id);
   render(day,items,routeList,vehicleList,days.some(x=>x.driver_id===id&&x.is_leave));
  }catch(e){
   if(request!==token||day!==date)return;
   $('#driver-content').innerHTML='<div class="driver-empty" role="alert"><strong>班表載入失敗</strong>請確認網路連線，再按「重新整理」。</div>';
  }finally{if(request===token)$('#driver-content').setAttribute('aria-busy','false');}
 }
 function render(day,items,routeList,vehicleList,onLeave){
  const label=new Intl.DateTimeFormat('zh-TW',{month:'long',day:'numeric',weekday:'long'}).format(new Date(day+'T12:00:00'));
  const totals=['配送','值班','跟車','學習'].map(kind=>`<span><strong>${items.filter(x=>x.kind===kind).length}</strong>${kind==='配送'?'趟':'筆'}${kind}</span>`).join('');
  const cards=items.map(x=>{
   const route=routeList.find(r=>String(r.id)===String(x.route)),vehicle=vehicleList.find(v=>String(v.id)===String(x.vehicle));
   const code=route?.route_code||x.route_code_snapshot||'未指定路線';
   const detail=(label,value)=>`<dt>${label}</dt><dd>${esc(value)}</dd>`;
   return `<li class="driver-card"><div class="driver-card-top"><span class="driver-category">${esc(category(x))}</span><span class="driver-kind">${x.kind}</span></div><h3>${esc(x.kind==='配送'?code:x.kind)}</h3>${x.kind==='配送'&&route?.route_name?`<p class="driver-route-name">${esc(route.route_name)}</p>`:''}<dl class="driver-details">${x.kind==='配送'?detail('車號',vehicle?.plate_number||'未指定')+detail('溫層',route?.temperature_zone||x.temperature_zone_snapshot||'未設定'):''}${x.note?detail('備註',x.note):''}</dl></li>`;
  }).join('');
  $('#driver-content').innerHTML=`<h2 class="driver-day-heading">${esc(label)}${day===today()?' · 今天':''}</h2><div class="driver-summary" aria-label="當日出勤統計">${totals}</div>${items.length?`<ul class="driver-cards">${cards}</ul>`:`<div class="driver-empty"><strong>${onLeave?'當日休假':'當日尚無排班'}</strong>${onLeave?'這一天已由主管標示休假。':'有新的配送或勤務安排後，會顯示在這裡。'}</div>`}`;
 }
 return {init};
})();

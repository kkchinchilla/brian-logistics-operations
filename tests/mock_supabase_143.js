/* BROWSER TEST FIXTURE ONLY. Not loaded by any production page. */
(()=>{
const D='11111111-1111-4111-8111-111111111111',E='22222222-2222-4222-8222-222222222222',F='33333333-3333-4333-8333-333333333333',M='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const copy=x=>JSON.parse(JSON.stringify(x));
window.mock143={role:'dispatcher',fail:null,calls:[],tables:{
 profiles:[{id:M,display_name:'測試主管',role:'dispatcher',active:true,can_manage_finance:true},{id:D,display_name:'測試司機 A',role:'driver',active:true},{id:E,display_name:'測試司機 B',role:'driver',active:true},{id:F,display_name:'測試司機 C',role:'driver',active:true}],
 vehicles:[{id:1,plate_number:'1001',active:true},{id:2,plate_number:'1002',active:true}],
 routes:[{id:1,route_code:'01',route_name:'測試日配一',temperature_zone:'冷藏',active:true,default_start_time:'06:00:00',default_end_time:'08:00:00'},
 {id:2,route_code:'02',route_name:'測試日配二',temperature_zone:'冷藏',active:true,default_start_time:'09:00:00',default_end_time:'11:00:00'},
 {id:3,route_code:'03',route_name:'測試替代路線',temperature_zone:'冷藏',active:true,default_start_time:'06:00:00',default_end_time:'08:00:00'}],
 runs:[{id:1,service_date:'2026-10-15',route_id:1,driver_id:D,vehicle_id:1,status:'assigned',is_rental:false,dispatcher_notes:'',route_code_snapshot:'01',temperature_zone_snapshot:'冷藏',attendance_category:'日配',attendance_slot_index:1,dashboard_schedule_revision:1},
 {id:2,service_date:'2026-10-15',route_id:2,driver_id:D,vehicle_id:1,status:'assigned',is_rental:false,dispatcher_notes:'',route_code_snapshot:'02',temperature_zone_snapshot:'冷藏',attendance_category:'日配',attendance_slot_index:2,dashboard_schedule_revision:1}],
 vehicle_owner_bindings:[{id:1,driver_id:D,vehicle_id:1,effective_from:'2026-09-01',effective_to:null},{id:2,driver_id:E,vehicle_id:1,effective_from:'2026-10-01',effective_to:null},{id:3,driver_id:D,vehicle_id:2,effective_from:'2026-10-10',effective_to:null}],
 daily_attendance_slot_counts:[],daily_run_observations:[],daily_attendance_extra_trips:[],daily_attendance_closeouts:[],driver_day_templates:[],attendance_driver_days:[{service_date:'2026-10-15',driver_id:F,is_leave:true,revision:1,has_plan_exception:true,applied_rows:null}],trip_executions:[]}};
const t=mock143.tables;
function day(date,id){let d=t.attendance_driver_days.find(x=>x.service_date===date&&x.driver_id===id);if(!d){d={service_date:date,driver_id:id,is_leave:false,revision:0,has_plan_exception:false,applied_rows:null};t.attendance_driver_days.push(d);}return d;}
function hasRuns(date,id){return t.runs.some(x=>x.service_date===date&&x.driver_id===id&&x.status!=='cancelled')||t.daily_attendance_extra_trips.some(x=>x.service_date===date&&x.driver_id===id&&x.status==='active');}
class Q{
 constructor(table){this.table=table;this.filters=[];this.bounds=null;this.op='read';}
 select(){return this;}eq(k,v){this.filters.push(x=>x[k]===v);return this;}in(k,v){this.filters.push(x=>v.includes(x[k]));return this;}
 gte(k,v){this.filters.push(x=>x[k]>=v);return this;}lte(k,v){this.filters.push(x=>x[k]<=v);return this;}
 order(){return this;}range(a,b){this.bounds=[a,b];return this;}single(){this.one=true;return this;}maybeSingle(){this.one=true;return this;}
 insert(x){this.op='insert';this.payload=x;return this;}update(x){this.op='update';this.payload=x;return this;}upsert(x){this.op='upsert';this.payload=x;return this;}
 match(x){for(const [k,v]of Object.entries(x))this.eq(k,v);return this;}
 then(resolve,reject){return Promise.resolve().then(()=>{
  if(mock143.fail===this.table)return {error:{message:'測試：資料表尚未安裝'}};
  let data=t[this.table]||[];
  if(this.op==='insert'){const x={id:100+data.length,...this.payload};data.push(x);}
  if(this.op==='upsert'){const old=data.find(x=>x.service_date===this.payload.service_date);if(old)Object.assign(old,this.payload);else data.push(copy(this.payload));}
  data=data.filter(x=>this.filters.every(f=>f(x)));
  if(this.op==='update')data.forEach(x=>Object.assign(x,this.payload));
  if(this.bounds)data=data.slice(this.bounds[0],this.bounds[1]+1);
  return {data:copy(this.one?data[0]||null:data),error:null};
 }).then(resolve,reject);}
}
async function rpc(fn,p){
 mock143.calls.push({fn,args:copy(p)});
 if(mock143.fail===fn){mock143.fail=null;return {data:null,error:{message:'測試：資料已被其他人更新'}};}
 if(mock143.role!=='dispatcher'&&['dashboard_save_day_template','dashboard_apply_day_template','dashboard_set_driver_leave','dashboard_save_day_plan'].includes(fn))return {error:{message:'只有主管可執行'}};
 try{
 let data;
 if(fn==='dashboard_save_day_template'){
  let old=t.driver_day_templates.find(x=>x.driver_id===p.p_driver_id);if((old?.revision||0)!==p.p_expected_revision)throw Error('範本已被更新');
  data={driver_id:p.p_driver_id,rows:copy(p.p_rows),revision:(old?.revision||0)+1,updated_at:new Date().toISOString()};if(old)Object.assign(old,data);else t.driver_day_templates.push(data);
 }else if(fn==='dashboard_get_schedule_month'){
  const month=p.p_month.slice(0,7),n=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
  data=Array.from({length:n},(_,i)=>{const date=month+'-'+String(i+1).padStart(2,'0'),d=t.attendance_driver_days.find(x=>x.service_date===date&&x.driver_id===p.p_driver_id);
   return {date,revision:d?.revision||0,is_leave:!!d?.is_leave,closed:!!t.daily_attendance_closeouts.find(x=>x.service_date===date)?.closed_at,has_runs:hasRuns(date,p.p_driver_id),has_plan_exception:!!d?.has_plan_exception,template_revision:d?.template_revision};});
 }else if(fn==='dashboard_set_driver_leave'){
  const d=day(p.p_service_date,p.p_driver_id);if(d.revision!==p.p_expected_revision)throw Error('此日出勤已被更新');
  if(p.p_is_leave&&hasRuns(p.p_service_date,p.p_driver_id))throw Error('此日已有趟次');d.is_leave=p.p_is_leave;d.revision++;data=d;
 }else if(fn==='dashboard_apply_day_template'){
  const template=t.driver_day_templates.find(x=>x.driver_id===p.p_driver_id);data={applied_dates:[],skipped:[]};
  for(const date of p.p_dates){const d=day(date,p.p_driver_id);if(d.is_leave){data.skipped.push({date,reason:'休假'});continue;}if(d.has_plan_exception&&!p.p_overwrite){data.skipped.push({date,reason:'保留單日調整'});continue;}
   d.applied_rows=copy(template.rows);d.template_revision=template.revision;d.has_plan_exception=false;d.revision++;
   for(const x of template.rows){let r=t.runs.find(r=>r.service_date===date&&r.driver_id===p.p_driver_id&&r.attendance_category===x.category&&r.attendance_slot_index===x.slot_index);const vals={service_date:date,driver_id:p.p_driver_id,route_id:x.route_id,vehicle_id:x.vehicle_id,is_rental:!(t.vehicle_owner_bindings.some(b=>b.driver_id===p.p_driver_id&&String(b.vehicle_id)===String(x.vehicle_id)&&b.effective_from<=date&&(!b.effective_to||b.effective_to>=date))),status:'assigned',attendance_category:x.category,attendance_slot_index:x.slot_index,dashboard_schedule_revision:1};if(r)Object.assign(r,vals);else t.runs.push({id:100+t.runs.length,...vals});}
   data.applied_dates.push(date);
  }
 }else if(fn==='dashboard_save_day_plan'){
  const d=day(p.p_service_date,p.p_driver_id);if(d.is_leave)throw Error('已休假');if(d.revision!==p.p_expected_day_revision)throw Error('此日出勤已被更新');
  let r=p.p_run_id?t.runs.find(x=>x.id===p.p_run_id):null;
  if(d.applied_rows===null)d.applied_rows=t.runs.filter(x=>x.service_date===p.p_service_date&&x.driver_id===p.p_driver_id).map(x=>({category:x.attendance_category,slot_index:x.attendance_slot_index,route_id:x.route_id,vehicle_id:x.vehicle_id}));
  const vals={service_date:p.p_service_date,driver_id:p.p_driver_id,route_id:p.p_route_id,vehicle_id:p.p_vehicle_id,is_rental:!(t.vehicle_owner_bindings.some(b=>b.driver_id===p.p_driver_id&&String(b.vehicle_id)===String(p.p_vehicle_id)&&b.effective_from<=p.p_service_date&&(!b.effective_to||b.effective_to>=p.p_service_date))),dispatcher_notes:p.p_note,status:p.p_route_id?'assigned':'cancelled',attendance_category:p.p_category,attendance_slot_index:p.p_slot_index,dashboard_schedule_revision:(r?.dashboard_schedule_revision||0)+1};if(r)Object.assign(r,vals);else t.runs.push({id:100+t.runs.length,...vals});d.revision++;d.has_plan_exception=true;data={};
 }else if(fn==='dashboard_set_attendance_slot_counts'){
  for(const[category,slot_count]of Object.entries(p.p_counts)){const old=t.daily_attendance_slot_counts.find(x=>x.service_date===p.p_service_date&&x.category===category);if(old)old.slot_count=slot_count;else t.daily_attendance_slot_counts.push({service_date:p.p_service_date,category,slot_count});}data=null;
 }else if(fn==='dashboard_edit_run_direct'){
  const r=t.runs.find(x=>x.id===p.p_run_id);if(!r)throw Error('找不到趟次');
  if(mock143.role!=='dispatcher'&&r.driver_id!==D)throw Error('沒有編輯權限');
  if(!['assigned','in_progress'].includes(r.status)||t.trip_executions.some(x=>x.run_id===r.id))throw Error('已確認的趟次不可直接修改');
  if(r.dashboard_schedule_revision!==p.p_expected_run_revision)throw Error('趟次已被其他人更新');
  const obs=t.daily_run_observations.find(x=>x.run_id===r.id);
  if((obs?.revision||0)!==p.p_expected_observation_revision)throw Error('配送資料已被其他人更新');
  if(p.p_cancel&&mock143.role!=='dispatcher')throw Error('只有主管可以取消趟次');
  const d=day(r.service_date,r.driver_id);if(d.is_leave)throw Error('休假不可排車');
  if(t.daily_attendance_closeouts.some(x=>x.service_date===r.service_date&&x.closed_at))throw Error('已結案');
  if(obs){const i=t.daily_run_observations.indexOf(obs);t.daily_run_observations.splice(i,1);}
  if(p.p_cancel){r.status='cancelled';}
  else {r.route_id=p.p_route_id;r.vehicle_id=p.p_vehicle_id;
    r.is_rental=!t.vehicle_owner_bindings.some(b=>b.driver_id===r.driver_id&&String(b.vehicle_id)===String(r.vehicle_id)&&b.effective_from<=r.service_date&&(!b.effective_to||b.effective_to>=r.service_date));
    r.route_code_snapshot=t.routes.find(x=>x.id===r.route_id)?.route_code||'';}
  r.dispatcher_notes=p.p_note;r.dashboard_schedule_revision++;d.revision++;d.has_plan_exception=true;
  data={run_id:r.id,revision:r.dashboard_schedule_revision,cancelled:!!p.p_cancel};
 }else if(fn==='dashboard_save_actual_observation'){
  const r=t.runs.find(x=>x.id===p.p_run_id),old=t.daily_run_observations.find(x=>x.run_id===r.id);const next={id:old?.id||1,driver_id:r.driver_id,run_id:r.id,actual_route_id:p.p_actual_route_id,actual_vehicle_id:p.p_actual_vehicle_id,actual_note:p.p_note,revision:(old?.revision||0)+1};if(old)Object.assign(old,next);else t.daily_run_observations.push(next);data=next.revision;
 }else if(fn==='dashboard_save_extra_actual_trip'){
  data=1;
 }else throw Error('未模擬 RPC '+fn);
 return {data:copy(data),error:null};
 }catch(e){return {data:null,error:{message:e.message}};}
}
window._testDB143={auth:{async getUser(){return {data:{user:{id:mock143.role==='dispatcher'?M:D}},error:null};},async signOut(){return {error:null};}},from:table=>new Q(table),rpc};
})();

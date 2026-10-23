/* Fictional data only. Used by isolated UI tests and the local responsive preview. */
(()=>{
 const day='2026-10-25',own='driver-one',other='driver-two';
 const state={actor:own,fail:false,hold:null,calls:[],logoutCalls:0,logoutError:false,logoutHold:null};
 const tables={
  profiles:[{id:own,display_name:'測試司機甲',role:'driver',active:true},{id:other,display_name:'測試司機乙',role:'driver',active:true},{id:'supervisor',display_name:'測試主管',role:'dispatcher',active:true}],
  runs:[
   {id:1,driver_id:own,service_date:day,route_id:1,vehicle_id:1,status:'assigned',attendance_category:'日配',attendance_slot_index:1,dispatcher_notes:'先至倉庫確認貨物，再依路線配送。'},
   {id:2,driver_id:own,service_date:day,route_id:2,vehicle_id:1,status:'assigned',attendance_category:'OC',attendance_slot_index:1,dispatcher_notes:'配送前請聯絡收貨窗口。'},
   {id:3,driver_id:other,service_date:day,route_id:3,vehicle_id:2,status:'assigned',attendance_category:'日配',attendance_slot_index:1,dispatcher_notes:'OTHER DRIVER PRIVATE NOTE'},
   {id:4,driver_id:own,service_date:day,route_id:3,vehicle_id:1,status:'cancelled',attendance_category:'日配',attendance_slot_index:2},
   {id:5,driver_id:own,service_date:day,route_id:1,vehicle_id:1,status:'cancelled',attendance_category:'日配',attendance_slot_index:3}
  ],
  daily_run_observations:[{id:1,run_id:5,driver_id:own,actual_route_id:2,actual_vehicle_id:1,actual_note:'保留實際配送紀錄'}],
  daily_attendance_extra_trips:[{id:1,driver_id:own,service_date:day,status:'active',actual_route_id:1,actual_vehicle_id:1,attendance_category:'低鮮',attendance_slot_index:1,actual_note:'加趟備註'}, {id:2,driver_id:own,service_date:day,status:'void',actual_route_id:3,actual_vehicle_id:1}],
  attendance_driver_days:[{driver_id:own,service_date:day,is_leave:false},{driver_id:own,service_date:'2026-10-26',is_leave:true},{driver_id:other,service_date:day,is_leave:true}],
  routes:[{id:1,route_code:'北區 01',route_name:'北區門市配送',temperature_zone:'常溫',active:true},{id:2,route_code:'冷鏈 02',route_name:'冷鏈補貨路線',temperature_zone:'冷藏',active:true},{id:3,route_code:'OTHER DRIVER ROUTE',route_name:'不應顯示',temperature_zone:'常溫',active:true}],
  vehicles:[{id:1,plate_number:'TEST-001',active:true},{id:2,plate_number:'OTHER-002',active:true}],
  vehicle_owner_bindings:[],trip_executions:[],daily_attendance_slot_counts:[]
 };
 const standby=[{id:1,driver_id:own,service_date:day,attendance_category:'鮮二',attendance_slot_index:1,note:'回倉協助清點。'},{id:2,driver_id:other,service_date:day,note:'OTHER STANDBY'}];
 const duties=[{id:1,driver_id:own,service_date:day,attendance_category:'冷凍',attendance_slot_index:1,kind:'follow_along',note:'熟悉門市收貨動線。'},{id:2,driver_id:own,service_date:day,attendance_category:'冷凍',attendance_slot_index:2,kind:'learning',note:'<img src=x onerror=alert(1)> 長備註測試'}, {id:3,driver_id:other,service_date:day,kind:'learning',note:'OTHER LEARNING'}];
 class Query{
  constructor(table){this.table=table;this.filters=[];this.bounds=null;this.one=false;state.calls.push({table,filters:this.filters});}
  select(){return this;}eq(k,v){this.filters.push([k,v]);return this;}in(k,v){this.filters.push([k,v]);return this;}order(){return this;}range(a,b){this.bounds=[a,b];return this;}single(){this.one=true;return this;}
  async then(resolve,reject){try{
   const hold=state.hold,fail=state.fail;if(hold)await hold;
   if(fail)return resolve({error:{message:'Synthetic network failure'}});
   let result=(tables[this.table]||[]).filter(row=>this.filters.every(([k,v])=>Array.isArray(v)?v.includes(row[k]):row[k]===v));
   if(this.bounds)result=result.slice(this.bounds[0],this.bounds[1]+1);
   return resolve({data:this.one?result[0]:result,error:null});
  }catch(e){return reject(e);}}
 }
 const db={from:table=>new Query(table),auth:{getUser:async()=>({data:{user:{id:state.actor}}}),signOut:async()=>{state.logoutCalls++;if(state.logoutHold)await state.logoutHold;return {error:state.logoutError?Error('Synthetic sign-out failure'):null};}},rpc:async(name,args)=>{
  state.calls.push({rpc:name,args});const hold=state.hold,fail=state.fail;if(hold)await hold;
  if(fail)return {error:{message:'Synthetic RPC failure'}};
  if(name==='dashboard_get_capabilities')return {data:{increment:'1.4.6',can_manage_finance:false}};
  if(name==='dashboard_get_attendance_day_state')return {data:{closed:false,closed_at:null}};
  // Deliberately return another driver's RPC rows to verify defensive UI filtering too.
  if(name==='dashboard_get_attendance_standby')return {data:standby.filter(x=>x.service_date===args.p_date)};
  if(name==='dashboard_get_attendance_duties')return {data:duties.filter(x=>x.service_date===args.p_date)};
  throw Error('Unexpected RPC: '+name);
 }};
 window.attendanceFixture1421={state,tables,standby,duties,db,day,own};
})();

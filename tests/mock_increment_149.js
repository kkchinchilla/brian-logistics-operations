/* OFFLINE DEMONSTRATION ONLY. All names, rates and records are fictional. */
(()=>{
 const t=mock143.tables,copy=x=>structuredClone(x),base=_testDB143.rpc,originalFrom=_testDB143.from;
 const [manager,a,b,c]=t.profiles;manager.display_name='演示 Brian';mock143.financeAllowed=true;
 t.delivery_regions=[{id:1,name:'示範北區'},{id:2,name:'示範南區'}];t.delivery_temperature_zones=[{name:'冷藏'},{name:'常溫'}];
 t.delivery_region_zone_rates=[{region_id:1,zone_name:'冷藏',delivery_fee:900},{region_id:1,zone_name:'常溫',delivery_fee:800},{region_id:2,zone_name:'冷藏',delivery_fee:1100},{region_id:2,zone_name:'常溫',delivery_fee:1000}];
 t.routes=Array.from({length:6},(_,i)=>({id:i+1,route_code:'DEMO-'+String(i+1).padStart(2,'0'),route_name:'示範路線 '+(i+1),temperature_zone:i===5?'常溫':'冷藏',delivery_region_id:i===5?2:1,active:true,default_start_time:String(5+i).padStart(2,'0')+':00:00',default_end_time:String(6+i).padStart(2,'0')+':00:00'}));
 t.vehicle_owner_bindings=[{id:1,driver_id:a.id,vehicle_id:1,effective_from:'2026-09-01',effective_to:null},{id:2,driver_id:b.id,vehicle_id:2,effective_from:'2026-09-01',effective_to:null}];
 t.vehicles[0].label='示範自有車';t.vehicles[1].label='示範共用車';
 t.runs=[];for(const date of ['2026-10-15','2026-10-20'])for(let i=0;i<7;i++){
  const route=t.routes[i<5?i:i-4],driver=i<5?a:b;
  t.runs.push({id:t.runs.length+1,service_date:date,route_id:route.id,driver_id:driver.id,vehicle_id:1,status:'assigned',is_rental:driver===b,dispatcher_notes:'隔離示範資料',route_code_snapshot:route.route_code,temperature_zone_snapshot:route.temperature_zone,attendance_category:'日配',attendance_slot_index:i<5?i+1:i-4,dashboard_schedule_revision:1});
 }
 t.daily_attendance_slot_counts=['2026-10-15','2026-10-20'].map(service_date=>({service_date,category:'日配',slot_count:5}));
 t.attendance_driver_days=[{service_date:'2026-10-20',driver_id:c.id,is_leave:true,revision:1,has_plan_exception:true,applied_rows:null}];
 t.daily_attendance_closeouts=[{service_date:'2026-10-15',closed_at:'2026-10-16T00:00:00Z'}];
 t.payroll_configs=[{id:1,driver_id:a.id,pay_basis:'per_run_only',explanation:'虛構示範，非公司規則'},{id:2,driver_id:b.id,pay_basis:'fixed_plus_run',explanation:'虛構示範，非公司規則'},{id:3,driver_id:c.id,pay_basis:'manual',explanation:'示範尚待確認的計薪方式'}];
 t.payroll_rules=t.routes.map((r,i)=>({id:i+1,driver_id:a.id,route_id:r.id,component:'per_run',amount:100,effective_from:'2026-10-01',effective_to:null,active:true,explanation:'虛構示範費率，非公司規則'}));
 t.payroll_rules.push({id:7,driver_id:b.id,route_id:null,component:'fixed_monthly',amount:30000,effective_from:'2026-10-01',effective_to:'2026-10-31',active:true,explanation:'虛構示範費率，非公司規則'},...t.routes.map((r,i)=>({id:i+8,driver_id:b.id,route_id:r.id,component:'per_run',amount:200,effective_from:'2026-10-01',effective_to:null,active:true,explanation:'虛構示範費率，非公司規則'})));
 t.payroll_adjustments=[{id:1,driver_id:a.id,service_date:'2026-10-15',category:'allowance',amount:500,reason:'示範加給'},{id:2,driver_id:a.id,service_date:'2026-10-15',category:'deduction',amount:-100,reason:'示範懲處'}];
 t.expense_records=[{id:1,driver_id:a.id,service_date:'2026-10-15',category:'parking',amount:50,description:'示範獨立停車費'}];
 mock143.finalized={version:147,month:'2026-10-01',deliveries:t.runs.filter(r=>r.service_date==='2026-10-15').map(r=>({...r,id:'run:'+r.id,run_id:r.id,original_driver_id:r.driver_id,source_type:'run',route_temperature_zone:r.temperature_zone_snapshot,plate_snapshot:t.vehicles[0].plate_number,finalized:true,close_event_id:10,closed_at:'2026-10-16T00:00:00Z'})),standby:[{id:1,driver_id:c.id,service_date:'2026-10-15',converted_to_support:false,finalized:true,close_event_id:10}],special_work:[{id:1,kind:'follow_along',driver_id:b.id,run_id:1,service_date:'2026-10-15',follow_stage_snapshot:'trainee',finalized:true,close_event_id:10}],attendance_records:[],original_runs:copy(t.runs.filter(r=>r.service_date==='2026-10-15')),dates:Array.from({length:31},(_,i)=>({service_date:'2026-10-'+String(i+1).padStart(2,'0'),status:i===14?'finalized':'open'}))};
 // Seed the existing fixture's close-state before disabling operational mutations.
 base('dashboard_close_attendance_through',{p_through_date:'2026-10-15'});
 const actor=typeof location!=='undefined'?new URLSearchParams(location.search).get('actor'):null;
 if(actor==='driver'){mock143.role='driver';mock143.financeAllowed=false;}
 if(actor==='karen'){mock143.financeAllowed=false;manager.display_name='演示 Karen';manager.can_manage_finance=false;}
 _testDB143.from=name=>{const q=originalFrom(name),then=q.then.bind(q);for(const op of ['insert','update','upsert','delete'])q[op]=()=>{q.demoBlocked=true;return q;};q.then=(resolve,reject)=>q.demoBlocked?Promise.resolve({data:null,error:{message:'營運示範僅供瀏覽；計價設定可在記憶體試填。'}}).then(resolve,reject):then(resolve,reject);return q;};
 const checkedDriver=id=>{if(!t.profiles.some(p=>p.id===id&&p.role==='driver'&&p.active))throw Error('請選擇司機');};
 function overlap(r,except){return t.payroll_rules.some(x=>x.id!==except&&x.active&&r.active&&x.driver_id===r.driver_id&&x.component===r.component&&x.route_id===r.route_id&&x.effective_from<=(r.effective_to||'9999-12-31')&&r.effective_from<=(x.effective_to||'9999-12-31'));}
 _testDB143.rpc=async(fn,p={})=>{
  if(!['dashboard_get_payroll_reconciliation','dashboard_save_payroll_config','dashboard_add_payroll_rate','dashboard_end_payroll_rate'].includes(fn)){
   if(fn.startsWith('dashboard_get_'))return base(fn,p);
   return {data:null,error:{message:'營運示範僅供瀏覽；不連接 Supabase。'}};
  }
  try{
   if(!mock143.financeAllowed)throw Error('僅 Brian 可使用月度計薪對帳');let data;
   if(fn==='dashboard_get_payroll_reconciliation'){
    const finalized=copy(mock143.finalized);finalized.month=p.p_month;
    if(p.p_month!=='2026-10-01')for(const k of ['deliveries','standby','special_work','attendance_records','original_runs','dates'])finalized[k]=[];
    data={version:149,month:p.p_month,finalized,configs:t.payroll_configs,rules:t.payroll_rules,adjustments:t.payroll_adjustments.filter(x=>x.service_date.startsWith(p.p_month.slice(0,7))),expenses:t.expense_records.filter(x=>x.service_date.startsWith(p.p_month.slice(0,7)))};
   }else if(fn==='dashboard_save_payroll_config'){
    checkedDriver(p.p_driver_id);const old=t.payroll_configs.find(x=>x.driver_id===p.p_driver_id);if(JSON.stringify(old||null)!==JSON.stringify(p.p_expected))throw Error('設定已變更');
    data={id:old?.id||t.payroll_configs.length+1,driver_id:p.p_driver_id,pay_basis:p.p_pay_basis,explanation:p.p_explanation};if(old)Object.assign(old,data);else t.payroll_configs.push(data);
   }else if(fn==='dashboard_add_payroll_rate'){
    checkedDriver(p.p_driver_id);const old=t.payroll_rules.find(x=>x.id===p.p_supersedes_id);
    if(old&&(JSON.stringify(old)!==JSON.stringify(p.p_expected)||p.p_effective_from<=old.effective_from))throw Error('新費率生效日或版本不正確');
    data={id:Math.max(0,...t.payroll_rules.map(x=>x.id))+1,driver_id:p.p_driver_id,route_id:p.p_route_id,component:p.p_component,amount:p.p_amount,effective_from:p.p_effective_from,effective_to:p.p_effective_to||old?.effective_to||null,active:true,explanation:p.p_explanation};
    if(overlap(data,old?.id))throw Error('費率期間重疊');
    if(old){const d=new Date(p.p_effective_from+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-1);old.effective_to=d.toISOString().slice(0,10);}t.payroll_rules.push(data);
   }else{
    data=t.payroll_rules.find(x=>x.id===p.p_rule_id);if(!data||JSON.stringify(data)!==JSON.stringify(p.p_expected))throw Error('費率已變更');
    if(!p.p_reason?.trim())throw Error('請填原因');if(p.p_effective_to&&p.p_effective_to<data.effective_from)throw Error('日期不正確');data.active=!!p.p_effective_to;data.effective_to=p.p_effective_to||data.effective_to;data.explanation+='\n'+p.p_reason;
   }
   return {data:copy(data),error:null};
  }catch(e){return {data:null,error:{message:e.message}};}
 };
})();

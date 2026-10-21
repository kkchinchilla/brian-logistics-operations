/* OFFLINE DEMONSTRATION ONLY: fictional duties and amounts, no network writes. */
(()=>{
 const t=mock143.tables,base=_testDB143.rpc,copy=x=>structuredClone(x),driver=t.profiles[2].id;
 t.attendance_duty_entries=[];
 for(const [i,date] of ['2026-10-15','2026-10-20'].entries()){
  const main=t.runs.find(r=>r.service_date===date&&r.attendance_slot_index===1&&r.driver_id===t.profiles[1].id);
  for(let n=1;n<=3;n++)t.attendance_duty_entries.push({id:i*3+n,service_date:date,driver_id:driver,attendance_category:'OC',attendance_slot_index:n,
   kind:n===1?'follow_along':'learning',linked_run_id:n===1?main.id:null,
   linked_run:n===1?{id:main.id,service_date:date,driver_id:main.driver_id,vehicle_id:main.vehicle_id,route_id:main.route_id,revision:1,observation_revision:0}:null,
   revision:1,note:n===1?'虛構跟車，共用主線車輛':'虛構學習，每筆各計一次'});
 }
 t.payroll_supplement_rates.push({id:3,component:'follow_along',amount:120,effective_from:'2026-10-01',reason:'虛構跟車費，每筆'},
  {id:4,component:'learning',amount:60,effective_from:'2026-10-01',reason:'虛構學習費，每筆'});
 mock143.finalized.special_work=t.attendance_duty_entries.filter(x=>x.service_date==='2026-10-15').map(x=>({...copy(x),id:'duty:'+x.id,source_type:'attendance_duty',run_id:x.linked_run_id,plate_snapshot:x.linked_run?t.vehicles.find(v=>v.id===x.linked_run.vehicle_id)?.plate_number:null,pay_basis:'per_entry',finalized:true,close_event_id:10}));
 _testDB143.rpc=async(fn,p={})=>{
  if(fn==='dashboard_get_attendance_duties')return {data:copy(t.attendance_duty_entries.filter(x=>x.service_date===p.p_date)),error:null};
  if(fn==='dashboard_save_attendance_duty')return {data:null,error:{message:'隔離展示可試填勤務；儲存及審核請在開發系統驗收。'}};
  if(fn!=='dashboard_save_duty_supplements')return base(fn,p);
  try{
   if(!mock143.financeAllowed)throw Error('僅 Brian 可設定勤務／租車');
   let revision=Math.max(0,...t.payroll_supplement_rates.map(x=>x.id));
   if(revision!==p.p_expected_revision)throw Error('設定已變更');
   if(!p.p_reason?.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(p.p_effective_from))throw Error('請填寫生效日及原因');
   const entries=[['standby',p.p_standby_amount],['rental',p.p_rental_amount],['follow_along',p.p_follow_along_amount],['learning',p.p_learning_amount]].filter(x=>x[1]!==null&&x[1]!==undefined);
   if(!entries.length||entries.some(x=>!Number.isSafeInteger(x[1])||x[1]<0||x[1]>10000000))throw Error('請輸入有效金額');
   for(const [component,amount] of entries)t.payroll_supplement_rates.push({id:++revision,component,amount,effective_from:p.p_effective_from,reason:p.p_reason});
   return {data:{revision},error:null};
  }catch(e){return {data:null,error:{message:e.message}};}
 };
})();

/* Browser-only finalized-report fixture. Never load in production. */
(()=>{
 const base=_testDB143.rpc,from=_testDB143.from;
 mock143.reads=[];_testDB143.from=(name)=>{mock143.reads.push(name);return from(name);};
 const driver=mock143.tables.profiles[1].id,other=mock143.tables.profiles[2].id;
 const row=(id,date,who,rental,zone)=>({id,source_type:id.split(':')[0],run_id:id.startsWith('run:')?Number(id.slice(4)):null,extra_trip_id:id.startsWith('extra:')?Number(id.slice(6)):null,service_date:date,driver_id:who,route_id:1,vehicle_id:1,route_code_snapshot:'FROZEN-01',route_temperature_zone:zone,plate_snapshot:'FROZEN-CAR',is_rental:rental,status:'assigned',finalized:true,close_event_id:10,closed_at:'2026-10-20T00:00:00Z'});
 mock143.finalized={version:147,month:'2026-10-01',deliveries:[row('run:1','2026-10-15',driver,false,'常溫'),row('run:2','2026-10-19',driver,true,'冷藏'),row('extra:1','2026-10-19',other,null,null)],standby:[{id:1,service_date:'2026-10-15',driver_id:driver,finalized:true,converted_to_support:false,review_status:'pending'},{id:2,service_date:'2026-10-19',driver_id:other,finalized:true,converted_to_support:true,review_status:'pending'}],special_work:[],attendance_records:[],original_runs:[],dates:[{service_date:'2026-10-15',status:'finalized'},{service_date:'2026-10-19',status:'finalized'},{service_date:'2026-10-20',status:'reopened'}]};
 mock143.tables.trip_executions=[{id:999,service_date:'2026-10-20',driver_id:driver,review_status:'confirmed',route_id:1,is_rental:true}];
 mock143.tables.payroll_adjustments=[{id:1,service_date:'2026-10-15',driver_id:driver,category:'allowance',amount:100,reason:'approved adjustment'}];
 _testDB143.rpc=async(fn,p={})=>{
  if(fn!=='dashboard_get_finalized_monthly')return base(fn,p);
  mock143.calls.push({fn,args:structuredClone(p)});
  if(mock143.fail===fn)return {data:null,error:{message:'測試：結案月報無法讀取'}};
  if(!mock143.financeAllowed)return {data:null,error:{message:'僅 Brian 可查看月度報表'}};
  const result=structuredClone(mock143.finalized);
  if(p.p_month!==result.month){result.month=p.p_month;for(const k of ['deliveries','standby','special_work','attendance_records','original_runs','dates'])result[k]=[];}
  if(mock143.reportDelay)await new Promise(resolve=>setTimeout(resolve,mock143.reportDelay));
  return {data:result,error:null};
 };
})();

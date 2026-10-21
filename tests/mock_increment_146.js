/* UI-only fixture layered on mock_supabase_143.js. Never loaded in production. */
(()=>{
 const t=mock143.tables,base=_testDB143.rpc;mock143.financeAllowed=false;t.attendance_change_requests=[];let cutoff=null,reopened=new Set();
 const isClosed=d=>!!cutoff&&d<=cutoff&&!reopened.has(d);
 _testDB143.rpc=async(fn,p={})=>{
  if(!['dashboard_get_capabilities','dashboard_get_attendance_day_state','dashboard_request_attendance_change','dashboard_review_attendance_change','dashboard_close_attendance_through','dashboard_reopen_attendance_date'].includes(fn))return base(fn,p);
  mock143.calls.push({fn,args:structuredClone(p)});
  if(mock143.fail===fn)return {data:null,error:{message:'測試：資料載入失敗'}};
  let data;
  if(fn==='dashboard_get_capabilities')data={increment:'1.4.6',can_manage_finance:mock143.financeAllowed};
  if(fn==='dashboard_get_attendance_day_state')data={service_date:p.p_date,closed:isClosed(p.p_date),closed_at:isClosed(p.p_date)?'2026-10-20T00:00:00Z':null};
  if(fn==='dashboard_request_attendance_change'){
   const r=t.runs.find(r=>r.id===p.p_run_id),x=t.daily_attendance_extra_trips.find(x=>x.id===p.p_extra_trip_id);
   data={id:1+t.attendance_change_requests.length,run_id:r?.id||null,extra_trip_id:x?.id||null,service_date:(r||x).service_date,driver_id:(r||x).driver_id,base_record:{route_id:r?.route_id||x?.actual_route_id,vehicle_id:r?.vehicle_id||x?.actual_vehicle_id,note:r?.dispatcher_notes||x?.actual_note},proposed_route_id:p.p_route_id,proposed_vehicle_id:p.p_vehicle_id,proposed_note:p.p_note,proposed_void:p.p_void,revision:1,status:'pending'};
   t.attendance_change_requests.push(data);
  }
  if(fn==='dashboard_review_attendance_change'){
   data=t.attendance_change_requests.find(q=>q.id===p.p_request_id);data.status=p.p_approve?'approved':'rejected';data.review_reason=p.p_reason;data.revision++;
   if(p.p_approve){const r=t.runs.find(r=>r.id===data.run_id);if(r){r.route_id=data.proposed_route_id;r.vehicle_id=data.proposed_vehicle_id;r.dispatcher_notes=data.proposed_note;r.dashboard_schedule_revision++;}}
  }
  if(fn==='dashboard_close_attendance_through'){
   cutoff=cutoff&&cutoff>p.p_through_date?cutoff:p.p_through_date;reopened=new Set([...reopened].filter(d=>d>p.p_through_date));
   for(const q of t.attendance_change_requests)if(q.status==='pending'&&q.service_date<=p.p_through_date){q.status='stale';q.revision++;}data={through_date:p.p_through_date,closed_dates:[],expired_requests:0};
  }
  if(fn==='dashboard_reopen_attendance_date'){reopened.add(p.p_date);data={reopened:true};}
  return {data:structuredClone(data),error:null};
 };
})();

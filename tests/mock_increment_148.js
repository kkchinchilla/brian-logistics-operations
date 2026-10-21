/* Test-only request queue; no production data or connection. */
(()=>{
 const base=_testDB143.rpc,t=mock143.tables;
 _testDB143.rpc=async(fn,p={})=>{
  if(fn==='dashboard_request_attendance_add'){
   mock143.calls.push({fn,args:structuredClone(p)});
   if(mock143.fail===fn)return {data:null,error:{message:'測試：新增申請未送出'}};
   const driver=t.profiles.find(x=>x.role==='driver').id;
   let q=t.attendance_change_requests.find(q=>q.request_kind==='add'&&q.status==='pending'&&q.driver_id===driver&&q.service_date===p.p_service_date&&q.attendance_category===p.p_category&&q.attendance_slot_index===p.p_slot_index);
   if(!q){q={id:t.attendance_change_requests.length+1,request_kind:'add',service_date:p.p_service_date,driver_id:driver,attendance_category:p.p_category,attendance_slot_index:p.p_slot_index,source_revision:p.p_expected_revision,base_record:{status:'empty'},proposed_route_id:p.p_route_id,proposed_vehicle_id:p.p_vehicle_id,proposed_note:p.p_note,proposed_void:false,status:'pending',revision:1};t.attendance_change_requests.push(q);}
   return {data:structuredClone(q),error:null};
  }
  if(fn==='dashboard_review_attendance_change'){
   const q=t.attendance_change_requests.find(q=>q.id===p.p_request_id);
   if(q?.request_kind==='add'){
    mock143.calls.push({fn,args:structuredClone(p)});
    if(mock143.fail===fn)return {data:null,error:{message:'測試：審核失敗'}};
    if(q.status!=='pending')return {data:{status:q.status,already_reviewed:true},error:null};
    if(p.p_approve){
     let x=t.daily_attendance_extra_trips.find(x=>x.driver_id===q.driver_id&&x.service_date===q.service_date&&x.attendance_category===q.attendance_category&&x.attendance_slot_index===q.attendance_slot_index);
     const values={service_date:q.service_date,driver_id:q.driver_id,attendance_category:q.attendance_category,attendance_slot_index:q.attendance_slot_index,actual_route_id:q.proposed_route_id,actual_vehicle_id:q.proposed_vehicle_id,actual_note:q.proposed_note,is_rental:false,status:'active',revision:(x?.revision||0)+1};
     if(x)Object.assign(x,values);else {x={id:100+t.daily_attendance_extra_trips.length,...values};t.daily_attendance_extra_trips.push(x);}q.result_extra_trip_id=x.id;
    }
    q.status=p.p_approve?'approved':'rejected';q.review_reason=p.p_reason;q.revision++;return {data:structuredClone(q),error:null};
   }
   const result=await base(fn,p);
   if(!result.error&&p.p_approve&&q?.proposed_void){
    if(q.run_id)t.runs.find(r=>r.id===q.run_id).status='cancelled';
    else {const x=t.daily_attendance_extra_trips.find(x=>x.id===q.extra_trip_id);x.status='void';x.revision++;}
   }
   return result;
  }
  return base(fn,p);
 };
})();

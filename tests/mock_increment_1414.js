/* OFFLINE MOCK ONLY: production uses the database calculation; this demo has no network. */
(()=>{
 const base=_testDB143.rpc;
 mock143.tables.driver_base_salaries=mock143.tables.profiles.filter(d=>d.role==='driver').map((d,i)=>({id:i+1,driver_id:d.id,amount:[30000,32000,35000][i],effective_month:'2026-10-01',reason:'虛構展示底薪',created_at:'2026-10-01T00:00:00Z'}));
 _testDB143.rpc=async(fn,p={})=>{
  if(fn==='dashboard_save_driver_base_salary'){
   const cap=await base('dashboard_get_capabilities',{});if(!cap.data?.can_manage_finance)return {data:null,error:{message:'僅 Brian 可設定司機底薪'}};
   const table=mock143.tables.driver_base_salaries,revision=Math.max(0,...table.filter(x=>x.driver_id===p.p_driver_id).map(x=>x.id));
   if(revision!==p.p_expected_revision)return {data:null,error:{message:'底薪設定已變更，請重新整理後再操作'}};
   if(!Number.isInteger(p.p_amount)||p.p_amount<0||p.p_amount>10000000||!p.p_reason?.trim())return {data:null,error:{message:'底薪或原因不正確'}};
   const row={id:Math.max(0,...table.map(x=>x.id))+1,driver_id:p.p_driver_id,amount:p.p_amount,effective_month:p.p_effective_month,reason:p.p_reason,created_at:new Date().toISOString()};table.push(row);return {data:row,error:null};
  }
  if(fn!=='dashboard_get_calculated_payroll')return base(fn,p);
  const response=await base('dashboard_get_route_payroll',p);if(response.error)return response;
  const b=response.data,drivers=mock143.tables.profiles.filter(x=>x.role==='driver');
  b.base_salaries=mock143.tables.driver_base_salaries.filter(x=>x.effective_month<=p.p_month);
  const report=PayrollReconciliation1491.build({...b,month:p.p_month.slice(0,7),drivers});
  for(const x of report.summaries){
   const rr=b.finalized.deliveries.filter(r=>r.driver_id===x.driverId),dw=b.finalized.special_work.filter(r=>r.driver_id===x.driverId);
   Object.assign(x,{standbyCount:b.finalized.standby.filter(r=>r.driver_id===x.driverId&&!r.converted_to_support).length,
    followAlongCount:dw.filter(r=>r.kind==='follow_along').length,learningCount:dw.filter(r=>r.kind==='learning').length,
    rentalCount:rr.filter(r=>r.is_rental===true).length,unknownRentalCount:rr.filter(r=>r.is_rental==null).length,knownItemsReady:x.basicSubtotal!==null});
  }
  b.calculation={...report,version:1414,engine:'database'};return {data:b,error:null};
 };
})();

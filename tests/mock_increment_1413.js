/* OFFLINE MOCK ONLY: production uses the database calculation; this demo has no network. */
(()=>{
 const base=_testDB143.rpc;
 _testDB143.rpc=async(fn,p={})=>{
  if(fn!=='dashboard_get_calculated_payroll')return base(fn,p);
  const response=await base('dashboard_get_route_payroll',p);if(response.error)return response;
  const b=response.data,drivers=mock143.tables.profiles.filter(x=>x.role==='driver');
  const report=PayrollReconciliation1491.build({...b,month:p.p_month.slice(0,7),drivers});
  for(const x of report.summaries){
   const rr=b.finalized.deliveries.filter(r=>r.driver_id===x.driverId),dw=b.finalized.special_work.filter(r=>r.driver_id===x.driverId);
   Object.assign(x,{standbyCount:b.finalized.standby.filter(r=>r.driver_id===x.driverId&&!r.converted_to_support).length,
    followAlongCount:dw.filter(r=>r.kind==='follow_along').length,learningCount:dw.filter(r=>r.kind==='learning').length,
    rentalCount:rr.filter(r=>r.is_rental===true).length,unknownRentalCount:rr.filter(r=>r.is_rental==null).length,knownItemsReady:x.basicSubtotal!==null});
  }
  b.calculation={...report,version:1413,engine:'database'};return {data:b,error:null};
 };
})();

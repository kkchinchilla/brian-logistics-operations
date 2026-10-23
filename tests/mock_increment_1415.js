/* OFFLINE MOCK ONLY: production uses the database calculation; this demo has no network. */
(()=>{
 const base=_testDB143.rpc;
 mock143.tables.payroll_supplement_rates=mock143.tables.payroll_supplement_rates.filter(x=>x.component==='rental');
 _testDB143.rpc=async(fn,p={})=>{
  if(['dashboard_save_driver_base_salary','dashboard_save_duty_supplements','dashboard_save_payroll_supplements'].includes(fn))return {data:null,error:{message:'此設定已停用'}};
  if(fn==='dashboard_save_rental_rate'){
   if(!mock143.financeAllowed)return {data:null,error:{message:'僅 Brian 可設定租車費用'}};
   const table=mock143.tables.payroll_supplement_rates,revision=Math.max(0,...table.map(x=>x.id));
   if(revision!==p.p_expected_revision)return {data:null,error:{message:'設定已變更，請重新整理'}};
   if(!Number.isInteger(p.p_amount)||p.p_amount<0||p.p_amount>10000000||!p.p_reason?.trim())return {data:null,error:{message:'金額或原因不正確'}};
   table.push({id:revision+1,component:'rental',amount:p.p_amount,effective_from:p.p_effective_from,reason:p.p_reason});return {data:{revision:revision+1},error:null};
  }
  if(fn!=='dashboard_get_calculated_payroll')return base(fn,p);
  const response=await base('dashboard_get_route_payroll',p);if(response.error)return response;
  const b=response.data,drivers=mock143.tables.profiles.filter(x=>x.role==='driver');
  // Adapt historical synthetic fixtures to the current name-only report shape.
  for(const row of [...b.finalized.deliveries,...b.finalized.original_runs]){
   row.route_name_snapshot=mock143.tables.routes.find(r=>String(r.id)===String(row.route_id))?.route_name||null;
   delete row.route_code_snapshot;
  }
  const report=PayrollReconciliation1491.build({...b,month:p.p_month.slice(0,7),drivers});
  for(const x of report.summaries){
   const rr=b.finalized.deliveries.filter(r=>r.driver_id===x.driverId),dw=b.finalized.special_work.filter(r=>r.driver_id===x.driverId);
   Object.assign(x,{standbyCount:b.finalized.standby.filter(r=>r.driver_id===x.driverId&&!r.converted_to_support).length,
    followAlongCount:dw.filter(r=>r.kind==='follow_along').length,learningCount:dw.filter(r=>r.kind==='learning').length,
    rentalCount:rr.filter(r=>r.is_rental===true).length,unknownRentalCount:rr.filter(r=>r.is_rental==null).length,knownItemsReady:x.basicSubtotal!==null});
  }
  b.calculation={...report,version:1415,engine:'database'};return {data:b,error:null};
 };
})();

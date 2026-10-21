/* v0.5 pure attendance-zone aggregation. No payroll-units inference. */
(function(root,factory){
  const api=factory();
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  if(root)root.DispatchZoneReport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const key=x=>String(x??'');
  const lookup=(list,id,field)=> (list||[]).find(x=>key(x.id)===key(id))?.[field]??null;
  const rentalLabel=b=>b===true?'租車':b===false?'非租車':'未確認';
  function buildSummary({runs=[],executions=[],routes=[],drivers=[]}){
    const groups=new Map(),warnings=[];
    const zoneForRun=r=>r.temperature_zone_snapshot||(!r.finalized&&lookup(routes,r.route_id,'temperature_zone'))||'溫層待設定';
    const zoneForExecution=e=>e.route_temperature_zone||(!e.finalized&&lookup(routes,e.route_id,'temperature_zone'))||'溫層待設定';
    function get(driver,zone){const k=key(driver)+'\u0000'+zone;
      if(!groups.has(k))groups.set(k,{driverId:driver,driver:lookup(drivers,driver,'display_name')||'未知司機',
        zone,assigned:0,confirmed:0,rental:0,nonRental:0,unknownRental:0});
      return groups.get(k);
    }
    for(const r of runs){if(r.status==='cancelled')continue;const zone=zoneForRun(r);
      get(r.driver_id,zone).assigned++;
      if(zone==='溫層待設定')warnings.push(`派車 #${r.id} 未設定溫層`);
      if(r.is_rental===null||r.is_rental===undefined)warnings.push(`派車 #${r.id} 尚未確認是否租車`);
    }
    for(const e of executions){if(e.finalized!==true&&e.review_status!=='confirmed')continue;const zone=zoneForExecution(e),g=get(e.driver_id,zone);g.confirmed++;
      if(e.is_rental===true)g.rental++;
      else if(e.is_rental===false)g.nonRental++;
      else {g.unknownRental++;warnings.push(`已結案趟次 #${e.id} 未記錄是否租車`);}
      if(zone==='溫層待設定')warnings.push(`已結案趟次 #${e.id} 未記錄溫層`);
    }
    return {rows:[...groups.values()].sort((a,b)=>a.driver.localeCompare(b.driver,'zh-TW')||a.zone.localeCompare(b.zone,'zh-TW')),
      warnings};
  }
  return {buildSummary,rentalLabel};
});

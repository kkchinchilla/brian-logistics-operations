/* Pure v0.5.5 work-type reconciliation. Does not post payroll amounts. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.DispatchSpecialSummary=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const confirmed=x=>x.finalized===true||x.review_status==='confirmed';
  const pending=x=>!x.finalized&&x.review_status==='pending';
  function build({shifts=[],work=[],runs=[],executions=[],drivers=[]}){
    const name=id=>drivers.find(p=>String(p.id)===String(id))?.display_name||'未知司機';
    const run=id=>runs.find(r=>String(r.id)===String(id));
    const entries=[],issues=[],affected=new Set();
    for(const s of shifts){
      if(s.review_status==='rejected')continue;
      const related=work.filter(w=>w.standby_shift_id===s.id&&w.review_status!=='rejected'&&
        (w.kind==='attached_support'||w.kind==='breakdown_replacement'));
      const converted=related.some(w=>confirmed(w));
      const unresolved=related.some(w=>pending(w));
      const classification=converted?'支援已取代值班':unresolved?'待確認是否轉支援':confirmed(s)?(s.finalized?'值班已結案':'值班已確認'):'值班待審核';
      entries.push({date:s.service_date,driverId:s.driver_id,driver:name(s.driver_id),kind:'值班班段',
        description:`${String(s.start_time).slice(0,5)}–${String(s.end_time).slice(0,5)} · ${classification}`,
        status:classification,payUnit:converted?'不另計值班筆數':unresolved?'值班筆數待確認':confirmed(s)?'1 筆出勤':'待審核'});
      affected.add(s.driver_id);
      if(unresolved)issues.push(`${name(s.driver_id)} ${s.service_date} 值班班段 #${s.id} 的支援待審核，值班筆數待確認`);
      if(pending(s))issues.push(`${name(s.driver_id)} ${s.service_date} 值班班段 #${s.id} 尚未審核`);
    }
    const traineeDays=new Set();
    for(const w of work){
      if(w.review_status==='rejected')continue;
      affected.add(w.driver_id);
      const original=run(w.run_id);
      if(w.kind==='breakdown_replacement'&&original)affected.add(original.driver_id);
      const type={attached_support:'附屬支援',breakdown_replacement:'故障接替',follow_along:'跟車',learning:'學習'}[w.kind];
      let pay='費率與歸屬待對帳';
      if(w.kind==='follow_along'){
        if(w.follow_stage_snapshot==='trainee'){
          if(confirmed(w))traineeDays.add(`${w.driver_id}|${w.service_date}`);
          pay='1 筆出勤';
        } else pay='1 筆出勤';
      }
      if(w.kind==='learning')pay='1 筆出勤';
      if(w.kind==='breakdown_replacement')pay=w.replacement_payee==='both'?'C：兩位司機計酬歸屬':'B：僅接替司機計酬歸屬';
      entries.push({date:w.service_date,driverId:w.driver_id,driver:name(w.driver_id),kind:type,
        description:`主線 #${w.run_id}${w.support_reference?' · '+w.support_reference:''} · ${w.note}`,status:w.finalized?'已結案':confirmed(w)?'已確認':'待審核',
        payUnit:confirmed(w)?pay:'尚未核准'});
      if(pending(w))issues.push(`${name(w.driver_id)} ${w.service_date} ${type} #${w.id} 尚未確認`);
      if(w.kind==='breakdown_replacement'){
        const execution=executions.find(e=>e.run_id===w.run_id);
        if(execution && (execution.driver_id!==w.driver_id || Number(execution.vehicle_id)!==Number(w.vehicle_id)))
          issues.push(`故障接替 #${w.id}：主線實際司機／車輛與接替回報不符，請先執行稽核校正`);
        issues.push(`故障接替 #${w.id}：營運實際歸屬與 B／C 薪資計酬是不同概念，B／C 薪資規則尚未正式整合`);
      }
    }
    if(work.some(x=>x.review_status!=='rejected'&&!['follow_along','learning'].includes(x.kind)))
      issues.push('歷史支援／故障接替的薪資歸屬仍須對帳確認');
    entries.sort((a,b)=>a.date.localeCompare(b.date)||a.driver.localeCompare(b.driver,'zh-TW'));
    return {entries,issues,affected,traineeDays:traineeDays.size};
  }
  return {build};
});

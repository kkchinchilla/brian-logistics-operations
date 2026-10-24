/* 1.4.9.1: 1.4.15: delivery pay - rental cost + adjustments; duties are attendance only. */
(function(root){
 'use strict';
 const basisLabels={fixed_only:'固定月薪',per_run_only:'按路線計趟',fixed_plus_run:'固定＋按趟',manual:'人工計算'};
 const componentLabels={per_run:'配送計酬',standby:'值班費用',follow_along:'跟車費用',learning:'學習費用',rental:'租車費用（扣款）',adjustment:'加給／獎懲'};
 const same=(a,b)=>String(a)===String(b);
 function dates(month){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<1900||Number(month.slice(0,4))>9998)throw Error('月份格式不正確');
  const [y,m]=month.split('-').map(Number);
  return {first:month+'-01',last:month+'-'+new Date(Date.UTC(y,m,0)).getUTCDate()};
 }
 function cents(value){
  if(value===null||value===undefined||value==='')return null;
  const s=String(value);if(!/^-?\d+(\.\d{1,2})?$/.test(s))return null;
  const [whole,fraction='']=s.replace('-','').split('.');
  const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  return Number.isSafeInteger(n)?(s.startsWith('-')?-n:n):null;
 }
 const money=n=>n===null?null:n/100;
 function validate(finalized,month){
  dates(month);
  if(!finalized||finalized.version!==147||finalized.month!==month+'-01'||!['deliveries','standby','special_work','attendance_records','original_runs','dates'].every(k=>Array.isArray(finalized[k])))throw Error('結案資料不完整');
  const validDates=new Set(finalized.dates.filter(d=>d.status==='finalized').map(d=>d.service_date));
  for(const k of ['deliveries','standby','special_work','attendance_records']){
   const seen=new Set();for(const row of finalized[k]){
    if(row.finalized!==true||!row.service_date?.startsWith(month+'-')||!row.close_event_id||!validDates.has(row.service_date)||row.id===null||row.id===undefined||seen.has(String(row.id)))throw Error('結案對帳來源不一致');
    seen.add(String(row.id));
   }
  }
 }
 function build({month,finalized,drivers=[],route_rates=[],supplements=[],adjustments=[],expenses=[]}){
  validate(finalized,month);const range=dates(month),issues=[],lines=[];
  const issue=(code,driverId,date,source,message)=>{const x={code,driverId:driverId||'',date:date||'',source:source||'',message};issues.push(x);return x;};
  const idSet=new Set(drivers.map(d=>d.id));
  for(const list of [adjustments,finalized.deliveries,finalized.standby,finalized.special_work,finalized.attendance_records])for(const row of list)if(row.driver_id)idSet.add(row.driver_id);
  for(const work of finalized.special_work)if(work.kind==='breakdown_replacement'){
   const run=finalized.original_runs.find(r=>same(r.id,work.run_id));if(run?.driver_id)idSet.add(run.driver_id);
   const delivery=finalized.deliveries.find(r=>same(r.run_id,work.run_id));if(delivery?.original_driver_id)idSet.add(delivery.original_driver_id);
  }
  const names=new Map(drivers.map(d=>[d.id,d.display_name]));
  for(const d of finalized.dates)if(d.status!=='finalized')issue('date_unfinalized','',d.service_date,'',d.status==='reopened'?'日期已重新開啟，未計入本次對帳':'日期尚未結案或缺少結案快照，未計入本次對帳');
  const summaries=[];
  for(const driverId of idSet){
   const deliveries=finalized.deliveries.filter(r=>same(r.driver_id,driverId));
   const adjustmentsFor=adjustments.filter(r=>same(r.driver_id,driverId));
   const start=issues.length;
   let variable=0,rentalCost=0,adjustment=0;
   const supplement=(component,date,source,closeEventId)=>{
    const rate=selectSupplement(supplements,component,date),value=rate?cents(rate.amount):null;
    const valid=value!==null&&value>=0;
    if(!valid)issue(component+'_rate_missing',driverId,date,source,component==='rental'?'租車費用尚未設定，扣款待確認':(componentLabels[component]||component)+'尚未設定');
    lines.push({driverId,date,source,kind:component,quantity:1,ruleId:rate?.id||null,amount:valid?money(component==='rental'?-value:value):null,closeEventId,status:valid?(component==='rental'?'自薪資扣除':'加入薪資'):'待設定'});
    return valid?value:null;
   };
   for(const run of deliveries){
    const matches=route_rates.filter(r=>same(r.route_id,run.route_id));
    const rate=matches.length===1?matches[0]:null,value=rate?cents(rate.amount):null;
    // Use the closed temperature, and do not silently price a route whose temperature changed.
    const valid=value!==null&&value>=0&&!!rate.region_id&&!!run.route_temperature_zone&&rate.zone_name===run.route_temperature_zone;
    if(!valid){variable=null;issue('route_rate_missing',driverId,run.service_date,run.id,'路線管理費率未設定，或目前溫層與結案紀錄不符');}
    else if(variable!==null)variable+=value;
    lines.push({driverId,date:run.service_date,source:run.id,kind:'per_run',routeId:run.route_id,routeName:run.route_name_snapshot||'',temperatureZone:run.route_temperature_zone||'',quantity:1,ruleId:valid?'route:'+rate.region_id+':'+rate.zone_name:null,rateUpdatedAt:rate?.updated_at||null,amount:valid?money(value):null,closeEventId:run.close_event_id,status:valid?'路線管理目前費率（試算）':'待設定'});
    if(run.is_rental===true){const cost=supplement('rental',run.service_date,run.id,run.close_event_id);rentalCost=rentalCost===null||cost===null?null:rentalCost+cost;}
    else if(run.is_rental!==false){rentalCost=null;issue('rental_unknown',driverId,run.service_date,run.id,'結案快照的租車狀態未確認，扣款待確認');}
   }
   for(const w of finalized.special_work){
    const original=finalized.original_runs.find(r=>same(r.id,w.run_id));
    const delivery=finalized.deliveries.find(r=>same(r.run_id,w.run_id));
    const related=same(w.driver_id,driverId)||(w.kind==='breakdown_replacement'&&(same(original?.driver_id,driverId)||same(delivery?.original_driver_id,driverId)));
    if(!related)continue;
    if(['follow_along','learning'].includes(w.kind))continue;
    const label={attached_support:'附屬支援',breakdown_replacement:'故障接替',follow_along:'跟車'}[w.kind]||'特殊勤務';
    issue('special_pay',driverId,w.service_date,'special:'+w.id,label+'計酬歸屬與金額待確認；不另增加配送總趟次');
    lines.push({driverId,date:w.service_date,source:'special:'+w.id,kind:w.kind,quantity:null,ruleId:null,amount:null,closeEventId:w.close_event_id,status:label+'待對帳'});
   }
   for(const a of finalized.attendance_records.filter(a=>same(a.driver_id,driverId)))issue('attendance_exception',driverId,a.service_date,'attendance:'+a.id,'出勤例外／原始代碼對薪資的影響待確認');
   for(const a of adjustmentsFor){
    const value=cents(a.amount),inMonth=a.service_date>=range.first&&a.service_date<=range.last;
    if(value===null||!inMonth){issue('adjustment_invalid',driverId,a.service_date,'adjustment:'+a.id,'調整金額或月份無效');adjustment=null;}
    else if(adjustment!==null)adjustment+=value;
    lines.push({driverId,date:a.service_date,source:'adjustment:'+a.id,kind:'adjustment',quantity:1,ruleId:null,amount:inMonth?money(value):null,closeEventId:null,status:'月報人工調整'});
   }
   if([variable,rentalCost,adjustment].some(v=>v!==null&&!Number.isSafeInteger(v)))throw Error('對帳金額超出安全計算範圍');
   const subtotal=[variable,rentalCost,adjustment].every(v=>v!==null)?variable-rentalCost+adjustment:null;
   if(subtotal!==null&&!Number.isSafeInteger(subtotal))throw Error('對帳金額超出安全計算範圍');
   // The approved formula is complete; only actual source/input issues block this driver.
   summaries.push({driverId,name:names.get(driverId)||'未列於司機名冊',basis:'route_management',count:deliveries.length,variable:money(variable),rentalDeduction:money(rentalCost===null?null:-rentalCost),adjustment:money(adjustment),basicSubtotal:money(subtotal),salary:issues.length===start?money(subtotal):null,salaryReady:subtotal!==null&&issues.length===start,issues:issues.slice(start)});
  }
  for(const e of expenses){
   if(e.service_date<range.first||e.service_date>range.last||cents(e.amount)===null)throw Error('費用資料月份或金額無效');
   issue('expense_treatment',e.driver_id,e.service_date,'expense:'+e.id,'停車交通／零用金列為獨立費用；不自動併入薪資');
  }
  return {version:1491,month,summaries,lines,issues,expenses,dates:finalized.dates};
 }
 function csv(rows){return '\ufeff'+rows.map(row=>row.map(value=>{const raw=String(value??'');const safe=typeof value==='string'&&/^[\s]*[=+@-]/.test(raw)?"'"+raw:raw;return '"'+safe.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
 function exportRows(report){
  const names=new Map(report.summaries.map(x=>[x.driverId,x.name]));
  const rows=[['月份','資料類型','司機 ID','司機','日期','來源','結案紀錄','計薪項目','數量','費率來源／版本','金額','狀態／待確認事項']];
  for(const x of report.lines)rows.push([report.month,'明細',x.driverId,names.get(x.driverId)||'',x.date,x.source,x.closeEventId||'',x.kind,x.quantity??'',x.ruleId??'',x.notApplicable?'不適用':x.amount??'待設定',x.status]);
  for(const x of report.summaries){
   rows.push([report.month,'應計薪資',x.driverId,x.name,'','','',report.version===1431?'配送計酬＋值班費用＋跟車費用＋學習費用－租車費用＋加給／獎懲':'配送計酬－租車費用＋加給／獎懲','','',x.salary??(x.basicSubtotal===null?'待設定':'待確認'),x.salaryReady?'依已結案紀錄計算':x.issues.map(i=>i.message).join('；')]);
   if(!x.salaryReady)rows.push([report.month,'已知項目小計',x.driverId,x.name,'','','','','','',x.basicSubtotal??'待設定','尚有缺漏或待確認紀錄，不能當作應計薪資']);
  }
  for(const x of report.issues)rows.push([report.month,'待確認',x.driverId,names.get(x.driverId)||'',x.date,x.source,'',x.code,'','','',x.message]);
  for(const x of report.expenses)rows.push([report.month,'獨立費用',x.driver_id||'',names.get(x.driver_id)||'',x.service_date,'expense:'+x.id,'',x.category,1,'',x.amount,x.description||'']);
  return rows;
 }
 function selectSupplement(rates,component,date){return rates.filter(r=>r.component===component&&r.effective_from<=date).sort((a,b)=>b.effective_from.localeCompare(a.effective_from)||Number(b.id)-Number(a.id))[0]||null;}
 const api={selectSupplement,build,validate,dates,cents,csv,exportRows,basisLabels,componentLabels};root.PayrollReconciliation1491=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

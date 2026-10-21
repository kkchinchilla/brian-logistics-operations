/* Payroll reconciliation, not final salary. No inferred rates or work-code conversions. */
(function(root){
 'use strict';
 const basisLabels={fixed_only:'固定月薪',per_run_only:'按路線計趟',fixed_plus_run:'固定＋按趟',manual:'人工計算'};
 const componentLabels={fixed_monthly:'固定月薪',per_run:'路線每趟'};
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
 function build({month,finalized,drivers=[],configs=[],rules=[],adjustments=[],expenses=[]}){
  validate(finalized,month);const range=dates(month),issues=[],lines=[];
  const issue=(code,driverId,date,source,message)=>{const x={code,driverId:driverId||'',date:date||'',source:source||'',message};issues.push(x);return x;};
  const active=rules.filter(r=>r.active===true),idSet=new Set(drivers.map(d=>d.id));
  for(const list of [configs,adjustments,finalized.deliveries,finalized.standby,finalized.special_work,finalized.attendance_records])for(const row of list)if(row.driver_id)idSet.add(row.driver_id);
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
   const driverConfigs=configs.filter(c=>same(c.driver_id,driverId));
   const conf=driverConfigs.length===1?driverConfigs[0]:null;
   const configValid=conf&&Object.hasOwn(basisLabels,conf.pay_basis);
   const start=issues.length;let fixed=null,variable=null,adjustment=0;
   if(!configValid)issue('basis_missing',driverId,'','',driverConfigs.length>1?'計酬方式重複':'計酬方式尚未設定');
   if(conf?.pay_basis==='manual')issue('manual_basis',driverId,'','','此司機採人工計算');
   const fixedApplies=configValid&&['fixed_only','fixed_plus_run'].includes(conf.pay_basis);
   const runApplies=configValid&&['per_run_only','fixed_plus_run'].includes(conf.pay_basis);
   if(fixedApplies){
    // Any overlapping active rule matters: a mid-month rule must not silently win.
    const matches=active.filter(r=>same(r.driver_id,driverId)&&r.component==='fixed_monthly'&&r.effective_from<=range.last&&(!r.effective_to||r.effective_to>=range.first));
    const valid=matches.length===1&&matches[0].effective_from<=range.first&&(!matches[0].effective_to||matches[0].effective_to>=range.last);
    const value=valid?cents(matches[0].amount):null;
    if(!valid||value===null||value<0)issue('fixed_rate_unresolved',driverId,'','',matches.length>1?'固定月薪有多個生效期間；月中異動如何拆算待確認':'缺少整月有效的固定月薪；不自行按天折算');
    else fixed=value;
    lines.push({driverId,date:range.first,source:'fixed:'+driverId,kind:'fixed_monthly',quantity:1,ruleId:valid?matches[0].id:null,amount:money(fixed),closeEventId:null,status:fixed===null?'待設定':'已設定基本項目'});
   }else if(configValid&&conf.pay_basis==='per_run_only')fixed=0;
   if(runApplies)variable=0;else if(configValid&&conf.pay_basis==='fixed_only')variable=0;
   for(const run of deliveries){
    let amount=null,ruleId=null,status=runApplies?'待設定':conf?.pay_basis==='fixed_only'?'固定月薪，不另套每趟費率':'計酬方式待設定';
    if(runApplies){
     const matches=active.filter(r=>r.component==='per_run'&&same(r.driver_id,driverId)&&same(r.route_id,run.route_id)&&r.effective_from<=run.service_date&&(!r.effective_to||r.effective_to>=run.service_date));
     const rate=matches.length===1?cents(matches[0].amount):null;
     if(rate===null||rate<0){issue(matches.length>1?'rate_overlap':'rate_missing',driverId,run.service_date,run.id,matches.length>1?'同日路線費率重疊':'缺少有效路線費率');variable=null;}
     else {ruleId=matches[0].id;amount=money(rate);if(variable!==null)variable+=rate;status='已設定基本項目';}
    }
    lines.push({driverId,date:run.service_date,source:run.id,kind:'per_run',routeId:run.route_id,routeCode:run.route_code_snapshot||'',temperatureZone:run.route_temperature_zone||'',quantity:1,ruleId,amount,notApplicable:conf?.pay_basis==='fixed_only',closeEventId:run.close_event_id,status});
    if(run.is_rental===true)issue('rental_pay',driverId,run.service_date,run.id,'租車補貼金額及適用規則待確認');
    else if(run.is_rental!==false)issue('rental_unknown',driverId,run.service_date,run.id,'結案快照的租車狀態未確認');
    if(!run.route_temperature_zone)issue('temperature_unknown',driverId,run.service_date,run.id,'結案快照未保存溫層');
   }
   for(const s of finalized.standby.filter(s=>same(s.driver_id,driverId)&&!s.converted_to_support)){
    issue('standby_pay',driverId,s.service_date,'standby:'+s.id,'值班班段金額及類型待確認');
    lines.push({driverId,date:s.service_date,source:'standby:'+s.id,kind:'standby',quantity:1,ruleId:null,amount:null,closeEventId:s.close_event_id,status:'值班計酬待確認'});
   }
   for(const w of finalized.special_work){
    const original=finalized.original_runs.find(r=>same(r.id,w.run_id));
    const delivery=finalized.deliveries.find(r=>same(r.run_id,w.run_id));
    const related=same(w.driver_id,driverId)||(w.kind==='breakdown_replacement'&&(same(original?.driver_id,driverId)||same(delivery?.original_driver_id,driverId)));
    if(!related)continue;
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
   if([fixed,variable,adjustment].some(v=>v!==null&&!Number.isSafeInteger(v)))throw Error('對帳金額超出安全計算範圍');
   const subtotal=[fixed,variable,adjustment].every(v=>v!==null)?fixed+variable+adjustment:null;
   if(subtotal!==null&&!Number.isSafeInteger(subtotal))throw Error('對帳金額超出安全計算範圍');
   // A basic subtotal is not the final salary: region/duty/special rules remain unsigned.
   issue('policy_pending',driverId,'','','地區／職務加給、其他薪資適用規則與最終 Excel 對版尚待確認');
   summaries.push({driverId,name:names.get(driverId)||'未列於司機名冊',basis:conf?.pay_basis||null,count:deliveries.length,fixed:money(fixed),variable:money(variable),adjustment:money(adjustment),basicSubtotal:money(subtotal),salary:null,issues:issues.slice(start)});
  }
  for(const e of expenses){
   if(e.service_date<range.first||e.service_date>range.last||cents(e.amount)===null)throw Error('費用資料月份或金額無效');
   issue('expense_treatment',e.driver_id,e.service_date,'expense:'+e.id,'停車交通／零用金列為獨立費用；不自動併入薪資');
  }
  return {version:149,month,summaries,lines,issues,expenses,dates:finalized.dates};
 }
 function csv(rows){return '\ufeff'+rows.map(row=>row.map(value=>{const raw=String(value??'');const safe=typeof value==='string'&&/^[\s]*[=+@-]/.test(raw)?"'"+raw:raw;return '"'+safe.replace(/"/g,'""')+'"';}).join(',')).join('\r\n');}
 function exportRows(report){
  const names=new Map(report.summaries.map(x=>[x.driverId,x.name]));
  const rows=[['月份','資料類型','司機 ID','司機','日期','來源','結案紀錄','計薪項目','數量','費率 ID','基本項目金額','狀態／待確認事項']];
  for(const x of report.lines)rows.push([report.month,'明細',x.driverId,names.get(x.driverId)||'',x.date,x.source,x.closeEventId||'',x.kind,x.quantity??'',x.ruleId??'',x.notApplicable?'不適用':x.amount??'待設定',x.status]);
  for(const x of report.summaries)rows.push([report.month,'基本項目小計',x.driverId,x.name,'','','','固定＋按趟＋人工調整','','',x.basicSubtotal??'待設定','不等於應計薪資；完整薪資仍待設定']);
  for(const x of report.issues)rows.push([report.month,'待確認',x.driverId,names.get(x.driverId)||'',x.date,x.source,'',x.code,'','','',x.message]);
  for(const x of report.expenses)rows.push([report.month,'獨立費用',x.driver_id||'',names.get(x.driver_id)||'',x.service_date,'expense:'+x.id,'',x.category,1,'',x.amount,x.description||'']);
  return rows;
 }
 const api={build,validate,dates,cents,csv,exportRows,basisLabels,componentLabels};root.PayrollReconciliation149=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

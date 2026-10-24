/* Validate the database-calculated report. Never fall back to stale/client-calculated pay. */
(function(root){
 'use strict';
 function read(bundle,month){
  const e=root.PayrollReconciliation1491,p=bundle?.calculation,f=bundle?.finalized;
  e.validate(f,month);
  if(!p||![1415,1431].includes(p.version)||p.engine!=='database'||p.month!==month||!['summaries','lines','issues','expenses','dates'].every(k=>Array.isArray(p[k])))throw Error('計薪資料不完整，請重新整理並確認資料庫版本');
  const same=(a,b)=>String(a)===String(b),ids=new Set();
  const moneyKeys=['variable','rentalDeduction','adjustment',...(p.version===1431?['standbyPay','followAlongPay','learningPay']:[])];
  const countKeys=['count','standbyCount','followAlongCount','learningCount','rentalCount','unknownRentalCount'];
  const fail=()=>{throw Error('計薪結果與結案來源不一致');};
  for(const x of p.summaries){
   if(!x.driverId||ids.has(x.driverId)||typeof x.name!=='string'||!Array.isArray(x.issues))fail();ids.add(x.driverId);
   if(countKeys.some(k=>!Number.isSafeInteger(x[k])||x[k]<0))fail();
   if([...moneyKeys,'basicSubtotal','salary'].some(k=>x[k]!==null&&(typeof x[k]!=='number'||e.cents(x[k])===null)))fail();
   const runs=f.deliveries.filter(r=>same(r.driver_id,x.driverId)),duties=f.special_work.filter(r=>same(r.driver_id,x.driverId));
   const counts=[runs.length,f.standby.filter(r=>same(r.driver_id,x.driverId)&&!r.converted_to_support).length,
    duties.filter(r=>r.kind==='follow_along').length,duties.filter(r=>r.kind==='learning').length,
    runs.filter(r=>r.is_rental===true).length,runs.filter(r=>r.is_rental===null||r.is_rental===undefined).length];
   if(countKeys.some((k,i)=>x[k]!==counts[i]))fail();
   const complete=moneyKeys.every(k=>x[k]!==null);
   if(x.knownItemsReady!==complete||(complete?(e.cents(x.basicSubtotal)!==moneyKeys.reduce((n,k)=>n+e.cents(x[k]),0)):x.basicSubtotal!==null))fail();
   const salaryReady=complete&&x.issues.length===0;
   if(x.salaryReady!==salaryReady||(salaryReady?e.cents(x.salary)!==e.cents(x.basicSubtotal):x.salary!==null))fail();
  }
  for(const group of [f.deliveries,f.standby,f.special_work,f.attendance_records,bundle.adjustments])if(group.some(r=>!ids.has(r.driver_id)))fail();
  if(p.summaries.some(x=>['baseSalary',...(p.version===1415?['standbyPay','followAlongPay','learningPay']:[])].some(k=>Object.hasOwn(x,k)))||p.lines.some(l=>['base',...(p.version===1415?['standby','follow_along','learning']:[])].includes(l.kind)))fail();
  const seen=new Set();
  for(const l of p.lines){
   const key=[l.driverId,l.kind,l.source].join('|');
   if(!ids.has(l.driverId)||seen.has(key)||typeof l.source!=='string'||typeof l.status!=='string'||(l.amount!==null&&(typeof l.amount!=='number'||e.cents(l.amount)===null)))fail();
   seen.add(key);
  }
  if(JSON.stringify(p.dates)!==JSON.stringify(f.dates)||JSON.stringify(p.expenses)!==JSON.stringify(bundle.expenses))fail();
  return p;
 }
 const api={read};root.PayrollServer1412=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

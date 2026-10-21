/* One authoritative source for monthly UI and exports. No live execution fallback. */
(function(root){
 'use strict';
 async function load(db,month){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('月份格式不正確');
  const {data,error}=await db.rpc('dashboard_get_finalized_monthly',{p_month:month+'-01'});
  if(error)throw error;
  if(!data||data.version!==147||data.month!==month+'-01'||!['deliveries','standby','special_work','attendance_records','original_runs','dates'].every(k=>Array.isArray(data[k])))throw Error('結案月報資料不完整，請確認 1.4.7 資料庫版本');
  if(data.deliveries.some(r=>r.finalized!==true||!r.service_date?.startsWith(month+'-')||!r.close_event_id)||new Set(data.deliveries.map(r=>r.id)).size!==data.deliveries.length)throw Error('結案月報來源不一致');
  return data;
 }
 const api={load};root.FinalizedMonthly147=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);

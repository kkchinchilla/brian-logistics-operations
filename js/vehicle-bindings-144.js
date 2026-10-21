/* Increment 1.4.4: effective-dated many-to-many binding lookup.
 * A binding persists until the dispatcher ends it. Preselection is only a UI
 * convenience; the database always determines rental status at write time.
 */
'use strict';
window.FleetBinding144=Object.freeze({
 valid(bindings,driver,date,vehicleList=[]){
  if(!driver||!/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')))return [];
  const activeVehicles=new Set(vehicleList.filter(v=>v.active!==false).map(v=>String(v.id)));
  const list=bindings.filter(b=>String(b.driver_id)===String(driver)&&b.effective_from<=date&&(!b.effective_to||b.effective_to>=date)&&activeVehicles.has(String(b.vehicle_id)));
  list.sort((a,b)=>String(b.effective_from).localeCompare(String(a.effective_from))||Number(a.vehicle_id)-Number(b.vehicle_id));
  const seen=new Set();return list.filter(b=>{const key=String(b.vehicle_id);if(seen.has(key))return false;seen.add(key);return true;});
 },
 preferred(bindings,driver,date,vehicleList){return this.valid(bindings,driver,date,vehicleList)[0]?.vehicle_id??null;},
 rental(bindings,driver,vehicle,date){if(!driver||!vehicle||!date)return null;
  return !bindings.some(b=>String(b.driver_id)===String(driver)&&String(b.vehicle_id)===String(vehicle)&&b.effective_from<=date&&(!b.effective_to||b.effective_to>=date));},
 hint(bindings,driver,vehicle,date,vehicleList){
  if(!driver)return '選取司機後，系統會帶入已綁定車輛。';
  const bound=this.valid(bindings,driver,date,vehicleList);
  if(!vehicle)return bound.length?'系統可依綁定帶入車號；仍可手動選擇其他車輛。':'此司機在所選日期沒有有效綁定車輛，請手動選車。';
  const rental=this.rental(bindings,driver,vehicle,date);
  const tail=bound.length>1?' · 此司機有多台綁定車輛（預選最近生效的一台）':'';
  return (rental?'租車 · 此車未綁定所選司機':'非租車 · 此車已綁定所選司機')+tail+' · 以儲存時的資料庫綁定為準';
 }
});

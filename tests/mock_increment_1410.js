/* OFFLINE DEMONSTRATION ONLY. Never loaded by a production page. */
(()=>{
 const t=mock143.tables,base=_testDB143.rpc;
 t.v055_standby_shifts=[
  {id:1,driver_id:t.profiles[3].id,service_date:'2026-10-15',attendance_category:'OC',attendance_slot_index:1,start_time:'12:00:00',end_time:'16:00:00',note:'虛構已結案值班',revision:1},
  {id:2,driver_id:t.profiles[2].id,service_date:'2026-10-20',attendance_category:'冷凍',attendance_slot_index:1,start_time:'14:00:00',end_time:'18:00:00',note:'虛構未結案值班，不指定車輛、不限溫層',revision:1}
 ];
 Object.assign(mock143.finalized.standby[0],structuredClone(t.v055_standby_shifts[0]));
 _testDB143.rpc=async(fn,p={})=>fn==='dashboard_get_attendance_standby'
  ?{data:structuredClone(t.v055_standby_shifts.filter(s=>s.service_date===p.p_date)),error:null}
  :fn==='dashboard_save_attendance_standby'
   ?{data:null,error:{message:'隔離展示可試填值班時段；儲存及審核請在開發系統驗收。示範資料保持不變。'}}
   :base(fn,p);
})();

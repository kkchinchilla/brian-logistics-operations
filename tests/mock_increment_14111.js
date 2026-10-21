/* OFFLINE DEMONSTRATION ONLY: fictional notes-only duties. */
(()=>{
 const t=mock143.tables;
 for(const d of t.attendance_duty_entries){delete d.linked_run_id;delete d.linked_run;d.note=d.kind==='follow_along'?'虛構跟車，每筆各計一次':'虛構學習，每筆各計一次';}
 for(const s of t.v055_standby_shifts){s.start_time=null;s.end_time=null;s.note='虛構值班，不需起迄時間';}
 for(const d of mock143.finalized.special_work){delete d.linked_run_id;delete d.linked_run;d.run_id=null;d.vehicle_id=null;d.plate_snapshot=null;d.note=d.kind==='follow_along'?'虛構跟車，每筆各計一次':'虛構學習，每筆各計一次';}
 for(const s of mock143.finalized.standby){s.start_time=null;s.end_time=null;s.note='虛構值班，不需起迄時間';}
})();

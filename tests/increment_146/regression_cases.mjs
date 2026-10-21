import assert from 'node:assert/strict';
export async function cases(pg){
 const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
 const q=async sql=>(await pg.query(sql)).rows;
 const one=async sql=>(await q(sql))[0];
 const scalar=async sql=>Object.values(await one(sql))[0];
 const actor=async n=>{await pg.exec(`RESET ROLE;SELECT set_config('request.jwt.claim.sub','${id(n)}',false);SET ROLE authenticated;`);};
 let count=0;const ok=(name,condition=true)=>{assert.ok(condition,name);count++;console.log('PASS:',name);};
 async function denied(sql,re=/.+/){let error;try{await pg.query(sql);}catch(e){error=e;}assert.ok(error,'Expected denial: '+sql);assert.match(error.message,re);}
 const rev=async n=>scalar(`SELECT dashboard_schedule_revision FROM runs WHERE id=${n}`);
 const submit=async(n,note='requested',route=2,vehicle=2)=>scalar(`SELECT dashboard_request_attendance_change(${n},NULL,${route},${vehicle},'${note}',${await rev(n)},0,false)`);
 const review=async r=>scalar(`SELECT dashboard_review_attendance_change(${r.id},${r.revision},true,'ok')`);
 const edit=async(n,note='dispatcher',route=1,vehicle=1)=>scalar(`SELECT dashboard_edit_run_direct(${n},${route},${vehicle},'${note}',${await rev(n)},0,false)`);
 async function run(n,date,driver=3,route=1,vehicle=1,slot=1){await pg.query(`INSERT INTO runs(id,service_date,route_id,driver_id,vehicle_id,attendance_category,attendance_slot_index) OVERRIDING SYSTEM VALUE VALUES(${n},'${date}',${route},'${id(driver)}',${vehicle},'日配',${slot})`);}
 await actor(1);
 await pg.exec(`INSERT INTO delivery_temperature_zones(name) VALUES('冷藏');
 INSERT INTO vehicles(id,plate_number) OVERRIDING SYSTEM VALUE VALUES(1,'TEST-001'),(2,'TEST-002');
 INSERT INTO routes(id,route_code,route_name,temperature_zone,default_start_time,default_end_time) OVERRIDING SYSTEM VALUE VALUES(1,'01','Morning','冷藏','06:00','08:00'),(2,'02','Afternoon','冷藏','09:00','11:00'),(3,'03','Conflict','冷藏','06:00','08:00');
 INSERT INTO vehicle_owner_bindings(vehicle_id,driver_id,effective_from) VALUES(1,'${id(3)}','2020-01-01');`);
 await run(1,'2026-10-01');await run(2,'2026-10-02');await run(3,'2026-10-03');await run(4,'2026-10-04');await run(5,'2026-10-05');await run(6,'2026-10-06');await run(7,'2026-10-07');await run(8,'2026-10-08');await run(9,'2026-10-09');await run(10,'2026-10-11');
 await actor(3);const r=await submit(1);
 ok('driver proposal leaves canonical run unchanged',(await one('SELECT route_id,vehicle_id,dispatcher_notes FROM runs WHERE id=1')).route_id===1);
 ok('duplicate submission is idempotent',(await submit(1)).id===r.id);
 await denied('SELECT dashboard_edit_run_direct(1,2,2,\'bypass\',1,0,false)',/主管|調度/);
 await denied("UPDATE runs SET route_id=2,dispatcher_notes='bypass' WHERE id=1",/Drivers|主管|申請/);
 await denied(`SELECT dashboard_review_attendance_change(${r.id},1,true,'')`,/主管|調度/);
 await denied("INSERT INTO attendance_change_requests(service_date) VALUES('2026-10-01')",/permission denied/);
 ok('driver cannot bypass proposal or approve requests');
 await actor(4);await denied('SELECT dashboard_request_attendance_change(1,NULL,2,2,\'wrong owner\',1,0,false)',/本人/);
 ok('driver request history is private',(await q('SELECT id FROM attendance_change_requests')).length===0);
 await actor(2);ok('Karen can approve operational changes',(await review(r)).status==='approved');
 let saved=await one('SELECT route_id,vehicle_id,dispatcher_notes FROM runs WHERE id=1');assert.deepEqual(saved,{route_id:2,vehicle_id:2,dispatcher_notes:'requested'});
 const after=await rev(1);await review(r);ok('repeat approval does not apply twice',await rev(1)===after);
 await actor(3);const reject=await submit(2,'reject me');await actor(2);
 await denied(`SELECT dashboard_review_attendance_change(${reject.id},1,false,' ')`,/原因/);
 await scalar(`SELECT dashboard_review_attendance_change(${reject.id},1,false,'keep original')`);
 ok('reasoned rejection retains original',(await scalar('SELECT route_id FROM runs WHERE id=2'))===1);
 await actor(3);const stale=await submit(3);await actor(2);await edit(3,'newer saved value');
 ok('stale request cannot overwrite a newer correction',(await review(stale)).status==='stale'&&(await scalar('SELECT dispatcher_notes FROM runs WHERE id=3'))==='newer saved value');
 // Existing start/completion workflow continues to generate one execution.
 await actor(3);await pg.exec("UPDATE runs SET status='in_progress',actual_start_time='2026-10-04 06:00+00' WHERE id=4;UPDATE runs SET status='completed',actual_end_time='2026-10-04 08:00+00' WHERE id=4;");
 await actor(2);await pg.exec("UPDATE trip_executions SET review_status='confirmed' WHERE run_id=4;");
 const beforeExec=await one('SELECT id,review_status,reviewed_by,reviewed_at,actual_start_time,actual_end_time FROM trip_executions WHERE run_id=4');
 await actor(3);const complete=await submit(4,'completed correction');await actor(2);await review(complete);
 assert.deepEqual(await one('SELECT id,review_status,reviewed_by,reviewed_at,actual_start_time,actual_end_time FROM trip_executions WHERE run_id=4'),beforeExec);
 saved=await one('SELECT route_id,vehicle_id,is_rental,route_start_time FROM trip_executions WHERE run_id=4');
 ok('open completed/confirmed run corrected atomically with same execution',saved.route_id===2&&saved.vehicle_id===2&&saved.is_rental&&saved.route_start_time==='09:00:00');
 ok('no duplicate executions',await scalar('SELECT count(*)::int FROM trip_executions WHERE run_id=4')===1);
 // Collision is evaluated on approval, with total rollback on failure.
 await run(11,'2026-10-05',4,2,2);await actor(3);const conflict=await submit(5);await actor(2);
 await denied(`SELECT dashboard_review_attendance_change(${conflict.id},1,true,'')`,/重疊|衝突|overlap|使用/);
 ok('conflicting approval leaves run and request unchanged',await scalar('SELECT route_id FROM runs WHERE id=5')===1&&await scalar(`SELECT status FROM attendance_change_requests WHERE id=${conflict.id}`)==='pending');
 // Pending request expires when completion/review changes its source.
 await actor(3);const changedExecution=await submit(6);await pg.exec("UPDATE runs SET status='in_progress' WHERE id=6;UPDATE runs SET status='completed' WHERE id=6;");await actor(2);
 ok('completion after proposal makes it stale',(await review(changedExecution)).status==='stale');
 // Current rule: addition is approved before testing subsequent edit/delete requests.
 await actor(3);const addition=await scalar(`SELECT dashboard_request_attendance_add('2026-10-07','日配',2,2,1,'new extra',0)`);await actor(2);await review(addition);await actor(3);
 const extra=await one("SELECT id,revision FROM daily_attendance_extra_trips WHERE service_date='2026-10-07'");
 await denied(`SELECT dashboard_save_extra_actual_trip('2026-10-07','${id(3)}','日配',2,2,2,true,'bypass',1,false)`,/申請|送出/);
 const er=await scalar(`SELECT dashboard_request_attendance_change(NULL,${extra.id},2,2,'extra edit',1,0,false)`);await actor(2);await review(er);
 ok('existing extra trip changes only upon approval',await scalar(`SELECT actual_vehicle_id FROM daily_attendance_extra_trips WHERE id=${extra.id}`)===2);
 await actor(3);const ev=await scalar(`SELECT dashboard_request_attendance_change(NULL,${extra.id},2,2,'no longer needed',2,0,true)`);await actor(2);await review(ev);
 ok('driver extra-trip void requires approval',await scalar(`SELECT status FROM daily_attendance_extra_trips WHERE id=${extra.id}`)==='void');
 // Finance is restricted by authenticated UUID, not role or mutable name.
 await actor(1);await pg.exec(`INSERT INTO payroll_adjustments(service_date,driver_id,amount,category,reason) VALUES('2026-10-01','${id(3)}',10,'allowance','local test');`);
 ok('Brian capability and finance RLS allow access',(await scalar('SELECT dashboard_get_capabilities()')).can_manage_finance&&await scalar('SELECT count(*)::int FROM payroll_adjustments')===1);
 await actor(2);ok('Karen finance capability and row access denied',!(await scalar('SELECT dashboard_get_capabilities()')).can_manage_finance&&await scalar('SELECT count(*)::int FROM payroll_adjustments')===0);
 await denied(`INSERT INTO payroll_adjustments(service_date,driver_id,amount,category,reason) VALUES('2026-10-01','${id(3)}',11,'allowance','denied')`,/row-level security/);
 await pg.exec('RESET ROLE;');await denied(`UPDATE profiles SET can_manage_finance=true WHERE id='${id(2)}'`,/Brian/);
 await pg.exec(`UPDATE profiles SET display_name='Brian' WHERE id='${id(2)}';`);await actor(2);
 ok('renaming another profile cannot gain Brian access',!(await scalar('SELECT dashboard_get_capabilities()')).can_manage_finance);
 // Link a special duty through the established dispatcher path.
 await pg.exec(`INSERT INTO v055_run_work(run_id,service_date,kind,driver_id,vehicle_id,note,support_reference) VALUES(8,'2026-10-08','attached_support','${id(3)}',1,'linked special duty','local');`);
 await denied(`SELECT dashboard_edit_run_direct(8,2,1,'change',${await rev(8)},0,false)`,/特殊勤務/);
 ok('linked special-duty assignment guard retained');
 await actor(3);const closingRequest=await submit(9);await actor(2);
 const closed=await scalar("SELECT dashboard_close_attendance_through('2026-10-10','end of period')");
 ok('closure covers all unclosed known dates through cutoff',closed.closed_dates.includes('2026-10-01')&&closed.closed_dates.includes('2026-10-09')&&closed.closed_dates.includes('2026-10-10')&&!closed.closed_dates.includes('2026-10-11'));
 ok('close freezes current approved records and expires pending requests',await scalar(`SELECT status FROM attendance_change_requests WHERE id=${closingRequest.id}`)==='stale'&&await scalar('SELECT route_id FROM runs WHERE id=9')===1);
 const snap=await scalar(`SELECT snapshot FROM attendance_closeout_events WHERE id=${closed.event_id}`);ok('close stores permanent complete snapshot',snap.runs.length===10&&snap.trip_executions.length===2&&snap.special_work.length===1);
 await denied(`SELECT dashboard_edit_run_direct(1,1,1,'closed',${await rev(1)},0,false)`,/已結案/);
 await denied("UPDATE trip_executions SET review_status='pending' WHERE run_id=4",/已結案/);
 await denied("INSERT INTO daily_attendance_closeouts(service_date) VALUES('2026-10-12')",/permission denied/);
 await denied('TRUNCATE daily_attendance_closeouts',/permission denied/);
 await denied(`INSERT INTO runs(service_date,route_id,driver_id,vehicle_id) VALUES('2026-09-20',1,'${id(3)}',1)`,/已結案/);
 ok('closed dates and empty earlier dates reject late writes and cached direct closeout writes');
 ok('empty past-date state and batch calendar reflect cumulative close',(await scalar("SELECT dashboard_get_attendance_day_state('2026-09-20')")).closed&&(await scalar(`SELECT dashboard_get_schedule_month('${id(3)}','2026-09-01')`)).every(d=>d.closed));
 await edit(10,'future remains open');ok('dates after cutoff remain editable');
 await denied("SELECT dashboard_reopen_attendance_date('2026-10-01',' ')",/原因/);
 await actor(3);await denied("SELECT dashboard_reopen_attendance_date('2026-10-01','driver denied')",/主管|調度/);
 await actor(2);await scalar("SELECT dashboard_reopen_attendance_date('2026-10-01','approved correction')");await edit(1,'after reopen');
 ok('reasoned reopening affects only selected date',!(await scalar("SELECT dashboard_get_attendance_day_state('2026-10-01')")).closed&&(await scalar("SELECT dashboard_get_attendance_day_state('2026-10-02')")).closed);
 assert.deepEqual(await scalar(`SELECT snapshot FROM attendance_closeout_events WHERE id=${closed.event_id}`),snap);
 ok('reopening retains original close snapshot and reason',await scalar("SELECT reason FROM attendance_closeout_events WHERE action='reopen' ORDER BY id DESC LIMIT 1")==='approved correction');
 await scalar("SELECT dashboard_reopen_attendance_date('2026-09-20','add missing past record')");await run(12,'2026-09-20');
 ok('empty historical date can be deliberately reopened');
 await scalar("SELECT dashboard_close_attendance_through('2026-10-10','close reopened dates')");
 ok('later cumulative close includes reopened dates',(await scalar("SELECT dashboard_get_attendance_day_state('2026-09-20')")).closed&&(await scalar("SELECT dashboard_get_attendance_day_state('2026-10-01')")).closed);
 await pg.exec('RESET ROLE;SET ROLE anon;');await denied("SELECT dashboard_get_capabilities()",/permission denied/);await denied("SELECT dashboard_close_attendance_through('2026-10-11','')",/permission denied/);ok('anonymous RPC access denied');
 console.log(`RESULT: ${count} integration scenarios passed`);
}

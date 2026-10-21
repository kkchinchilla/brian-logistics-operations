'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.join(__dirname,'..');
const {build}=require('../js/special_summary');
const sample={
  drivers:[{id:'A',display_name:'王小明'},{id:'B',display_name:'陳小華'}],
  runs:[{id:11,driver_id:'A'}],
  shifts:[
    {id:1,service_date:'2026-10-12',driver_id:'B',start_time:'08:00',end_time:'12:00',review_status:'confirmed'},
    {id:2,service_date:'2026-10-12',driver_id:'A',start_time:'13:00',end_time:'17:00',review_status:'confirmed'},
    {id:3,service_date:'2026-10-13',driver_id:'B',start_time:'08:00',end_time:'12:00',review_status:'pending'}
  ],
  work:[
    {id:2,kind:'breakdown_replacement',run_id:11,service_date:'2026-10-12',driver_id:'B',standby_shift_id:1,review_status:'confirmed',replacement_payee:'replacement_only',note:'車輛故障'},
    {id:3,kind:'follow_along',run_id:11,service_date:'2026-10-12',driver_id:'B',review_status:'confirmed',follow_stage_snapshot:'trainee',note:'跟車 A'},
    {id:4,kind:'follow_along',run_id:11,service_date:'2026-10-12',driver_id:'B',review_status:'confirmed',follow_stage_snapshot:'trainee',note:'跟車 B'},
    {id:5,kind:'attached_support',run_id:11,service_date:'2026-10-13',driver_id:'A',standby_shift_id:3,review_status:'pending',note:'臨時支援'}
  ]
};
const v=build(sample);
assert.equal(v.traineeDays,1,'two trainee follows same driver/date -> 1 payable training day');
assert.equal(v.entries.find(e=>e.description.includes('08:00–12:00')).payUnit,'不另計值班','confirmed support replaces entire standby block');
assert.equal(v.entries.find(e=>e.description.includes('13:00–17:00')).payUnit,'1 班段（費率待設定）','independent standby remains');
assert.equal(v.entries.find(e=>e.description.includes('待確認是否轉支援')).payUnit,'暫停值班計酬');
assert.ok(v.affected.has('A')&&v.affected.has('B'));
assert.ok(v.issues.some(i=>i.includes('B／C')));
const sql=fs.readFileSync(path.join(base,'sql/06_special_work_records.sql'),'utf8');
for(const part of ['create table if not exists public.v055_standby_shifts','create table if not exists public.v055_run_work','private.v055_guard_new_run','private.v055_validate_run_work','v055_run_work_audit'])assert.ok(sql.includes(part),part);
assert.ok(sql.includes("new.review_status<>'pending'"),'reject newly inserted fake confirmed records');
const monthly=fs.readFileSync(path.join(base,'js/monthly.js'),'utf8');
assert.ok(monthly.includes('specialSummary?.affected.has(driverId)'));
const html=fs.readFileSync(path.join(base,'special.html'),'utf8');
assert.ok(html.includes('lang="zh-Hant-TW"'));
const browserSource=fs.readFileSync(path.join(base,'js/special.js'),'utf8');
for(const id of [...browserSource.matchAll(/\$\('([a-z0-9-]+)'\)/g)].map(m=>m[1]))
  assert.ok(html.includes(`id="${id}"`),`Missing special.html DOM selector: ${id}`);
assert.ok(fs.readFileSync(path.join(base,'monthly.html'),'utf8').includes('id="finance-trainee-days"'));
console.log('v0.5.5 local summary/security-wiring checks passed');

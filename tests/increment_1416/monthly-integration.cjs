// Node VM integration using the same client code and report decoder as production.
const assert=require('node:assert/strict');
const {env}=require('../increment_1415/monthly-integration.cjs');
let checks=0;
const ok=(name,v=true)=>{assert.ok(v,name);console.log('PASS:',name);checks++};
(async()=>{
 const e=env();
 for(const [i,kind] of ['follow_along','learning'].entries())e.ctx.bundle.finalized.special_work.push({id:'duty:'+i,driver_id:'a',service_date:'2026-10-15',kind,finalized:true,close_event_id:1});
 e.ctx.bundle.finalized.standby.push({id:'standby:1',driver_id:'a',service_date:'2026-10-15',finalized:true,close_event_id:1,converted_to_support:false});
 await e.run('loadMonth()');const old=JSON.stringify(e.run('displayed[0]'));
 Object.assign(e.ctx.bundle.finalized.dates[0],{attendance_status:'reopened',pending_reclose:true,close_event_id:1});
 await e.run('loadMonth()');ok('reopened snapshot retains displayed delivery, duty counts and salary',JSON.stringify(e.run('displayed[0]'))===old);
 ok('pending confirmation is visible above the table',e.element('#monthly-body').innerHTML.includes('1 個日期重新開啟待結案')&&e.element('#monthly-body').innerHTML.indexOf('重新開啟待結案')<e.element('#monthly-body').innerHTML.indexOf('<table>'));
 ok('message explains when edits replace the confirmed version',e.element('#monthly-body').innerHTML.includes('2026-10-15')&&e.element('#monthly-body').innerHTML.includes('再次「確認結案」後才會更新')&&!e.element('#monthly-body').innerHTML.includes('暫不計入'));
 await e.run('exportCSV()');const csv=await e.ctx.blobs.at(-1).text();ok('attendance export keeps the same counts while reopened',csv.includes('"1","1","1","0"'));
 await e.ctx.PayrollSettings1491.exportCSV();const pay=await e.ctx.blobs.at(-1).text();ok('payroll export keeps the confirmed delivery source',pay.includes('run:1')&&pay.includes('100'));
 e.ctx.bundle.finalized.special_work=[{id:'duty:3',driver_id:'a',service_date:'2026-10-15',kind:'learning',finalized:true,close_event_id:2}];
 Object.assign(e.ctx.bundle.finalized.dates[0],{attendance_status:'closed',pending_reclose:false,close_event_id:2});
 for(const group of ['deliveries','standby'])for(const row of e.ctx.bundle.finalized[group])row.close_event_id=2;
 await e.run('loadMonth()');ok('reconfirmed version replaces previous duty counts',e.run('displayed[0].followAlong')===0&&e.run('displayed[0].learning')===1);
 ok('pending confirmation notice clears after reclose',!e.element('#monthly-body').innerHTML.includes('重新開啟待結案'));
 await e.run('loadMonth()');ok('repeated report loads do not duplicate counts',e.run('displayed[0].rr.length')===1&&e.run('displayed[0].learning')===1);
 console.log(`RESULT: ${checks} reopened-monthly UI/export checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1});

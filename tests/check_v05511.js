'use strict';
// Static/contract checks only. Live Supabase RLS/trigger tests remain mandatory.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sql=read('sql/07_driver_special_workflow.sql');
const js=read('js/driver.js');
const dispatcher=read('js/special.js');
const driver=read('driver.html');
const special=read('special.html');
for(const fragment of [
  'create table if not exists public.v055_driver_work_completions',
  'create or replace function public.v055_my_special_assignments',
  'create or replace function public.v055_submit_special_completion',
  'create or replace function public.v055_finalize_replacement',
  'create unique index if not exists v05511_one_active_replacement',
  'w.driver_id=auth.uid()',
  'w.driver_id<>worker',
  'w.review_status<>\'pending\'',
  'private.is_dispatcher()',
  'join public.v055_driver_work_completions c',
  'v05511_confirm_requires_driver_submission',
  'v05511_driver_completion_audit'
])assert.ok(sql.includes(fragment),`SQL contract missing ${fragment}`);
assert.ok(!/grant\s+(insert|update|delete)[^;]+on\s+public\.v055_driver_work_completions/i.test(sql),
  'No authenticated direct write permission for completion table');
assert.match(sql,/grant execute on function public\.v055_my_special_assignments\(date\) to authenticated/);
for(const name of ['v055_my_special_assignments','v055_submit_special_completion'])
 assert.ok(js.includes(name),`Driver UI RPC ${name}`);
assert.ok(dispatcher.includes('v055_finalize_replacement'));
assert.ok(dispatcher.includes('v055_driver_work_completions'));
assert.ok(js.includes('escapeHtml(work.work_note'));
assert.ok(js.includes('escapeHtml(work.submission_note'));
assert.ok(driver.includes('lang="zh-Hant-TW"'));
for(const id of ['driver-special-work','driver-special-refresh','driver-special-feedback'])
 assert.ok(driver.includes(`id="${id}"`));
assert.ok(special.includes('<th>司機回報</th>'));
assert.ok(special.includes('結束主線並送審'));
assert.ok(!js.includes(".from('v055_run_work')"),'Driver must not query supervisor-only v055_run_work directly');
assert.ok(!js.includes(".from('v055_driver_work_completions')"),'Driver must not write completion table');
console.log('v0.5.5 Increment 1.1 static security / frontend contract checks passed');

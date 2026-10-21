/* Phase 1 frontend regression guard. Run: node tests/check_attendance_ui_v12.js */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=(name)=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('attendance-board.html');
const js=read('js/attendance-board.js');
const css=read('css/attendance-board.css');
assert.match(html,/<html lang="zh-Hant-TW">/);
assert.match(html,/id="grid-head"/);
assert.match(html,/id="grid-body"/);
assert.match(html,/id="attendance-date"/);
assert.match(html,/id="edit-modal"/);
assert.match(html,/id="close-modal"/);
for(const [group,prefix,initial] of [
  ['日配','日',2],['OC','OC',3],['鮮二','鮮二',3],['冷凍','冷凍',4],['低鮮','低鮮',4]
]) {
  assert.ok(js.includes(`name:'${group}',prefix:'${prefix}',initial:${initial}`),`Missing dynamic group ${group}`);
}
assert.match(html,/id="slot-settings"/);
assert.match(html,/id="slot-modal"/);
assert.match(js,/function groupsFromCounts|const groupsFromCounts/);
assert.match(js,/function stepSlotCount/);
assert.match(js,/slotsInUse\(\)\.has\(removed\)/);
assert.match(js,/detectedCounts/);
assert.match(js,/const MAX_PREVIEW_SLOTS = 50/);
assert.match(js,/window\.location\.search/);
assert.match(js,/function canEdit\(/);
assert.match(js,/model\.role === 'dispatcher'/);
assert.match(js,/getAllRows\('runs'/);
assert.match(js,/getAllRows\('profiles'/);
assert.match(js,/function mapActualRows\(/);
// Intentional: Phase 1 must NEVER write directly to existing operational tables.
assert.doesNotMatch(js,/\.from\(['"](?:runs|trip_executions)['"]\)\s*\.\s*(?:update|insert|delete|upsert)\s*\(/);
assert.match(css,/position:sticky/);
assert.doesNotMatch(css,/linear-gradient|radial-gradient|conic-gradient/i);
assert.match(read('driver.html'),/href="attendance-board\.html"/);
assert.match(read('dispatcher.html'),/href="attendance-board\.html"/);
console.log('Increment 1.2 Phase 1 frontend checks passed');

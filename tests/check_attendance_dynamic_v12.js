const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const src=fs.readFileSync(require('node:path').join(__dirname,'..','js','attendance-board.js'),'utf8');
class FakeElement{
 constructor(id){this.id=id;this._events={};this._inner='';this.textContent='';this.value='';this.hidden=false;this.dataset={};this.style={};this.classList={toggle(){},add(){},remove(){}};this.attributes={};}
 set innerHTML(v){this._inner=v;} get innerHTML(){return this._inner;}
 addEventListener(name,fn){(this._events[name]??=[]).push(fn)}
 trigger(name,event={}){for(const fn of(this._events[name]||[]))fn(event)}
 setAttribute(k,v){this.attributes[k]=v;}
 querySelector(){return {focus(){}}}
 replaceChildren(){}
 focus(){}
}
const ids=new Map();const elem=id=>ids.get(id)||(ids.set(id,new FakeElement(id)),ids.get(id));
const roles=['driver','dispatcher'].map(r=>{let e=new FakeElement(r);e.dataset.demoRole=r;return e;});
const doc={getElementById:elem,querySelectorAll(selector){if(selector==='[data-demo-role]')return roles;return[]},addEventListener(){}};
const sandbox={document:doc,window:{location:{search:'?demo=1'}},URLSearchParams,Date,console,structuredClone,setTimeout:()=>1,clearTimeout:()=>{},Object};
vm.createContext(sandbox);vm.runInContext(src,sandbox);
// Dynamic columns start from original daily-sheet counts.
assert.match(elem('grid-head').innerHTML,/冷凍4/);
assert.doesNotMatch(elem('grid-head').innerHTML,/冷凍5/);
assert.equal(elem('slot-settings').hidden,true);
roles[1].trigger('click');
assert.equal(elem('slot-settings').hidden,false);
elem('slot-settings').onclick();
assert.match(elem('slot-list').innerHTML,/冷凍/);
function step(group,number){elem('slot-list').trigger('click',{target:{closest(){return {dataset:{group,slotStep:String(number)}}}}})}
step('冷凍',1);step('冷凍',1);
assert.match(elem('grid-head').innerHTML,/冷凍5/);
assert.match(elem('grid-head').innerHTML,/冷凍6/);
assert.match(elem('grid-body').innerHTML,/data-edit-slot="冷凍6"/);
// Data in the newest slot must prevent destructive removal.
elem('grid-body').trigger('click',{target:{closest(){return{dataset:{editDriver:'a',editSlot:'冷凍6'}}}}});
elem('edit-route').value='R-06';elem('edit-vehicle').value='1008';
elem('edit-form').trigger('submit',{preventDefault(){}});
assert.match(elem('grid-body').innerHTML,/R-06/);
step('冷凍',-1);
assert.match(elem('slot-error').textContent,/已有配送資料/);
assert.match(elem('grid-head').innerHTML,/冷凍6/);
roles[0].trigger('click');
assert.equal(elem('slot-settings').hidden,true);
assert.doesNotMatch(elem('grid-body').innerHTML,/data-edit-driver="b"/);
roles[1].trigger('click');
elem('date-next').onclick();
assert.doesNotMatch(elem('grid-head').innerHTML,/冷凍6/);
elem('date-prev').onclick();
assert.match(elem('grid-head').innerHTML,/冷凍6/);
// Lock the board and verify no editing and slot changes.
elem('day-close').onclick();elem('close-save').onclick();
assert.equal(elem('slot-settings').hidden,true);
assert.doesNotMatch(elem('grid-body').innerHTML,/data-edit-driver=/);
console.log('Dynamic slot behavior: expansion 4→6, edit, non-destructive shrink, date scope, driver permissions and closeout passed.');

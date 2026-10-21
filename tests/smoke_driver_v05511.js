'use strict';
// Small headless mock test of the driver page's own special-duty rendering and
// completion interaction. This does NOT replace Supabase RLS tests.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
class Element {
  constructor(tag='div'){this.tag=tag;this.children=[];this.listeners={};this._html='';this._text='';this.value='';this.disabled=false;}
  set innerHTML(v){this._html=String(v);this.children=[];}
  get innerHTML(){return this._html;}
  set textContent(v){this._text=String(v);}
  get textContent(){return this._text;}
  appendChild(e){this.children.push(e);return e;}
  append(...es){this.children.push(...es);}
  replaceChildren(...es){this.children=es;}
  addEventListener(name,cb){this.listeners[name]=cb;}
  querySelector(){return new Element();}
}
(async()=>{
  const ids=['driver-name','driver-date','driver-runs','logout-button',
    'driver-special-work','driver-special-feedback','driver-special-refresh'];
  const el=Object.fromEntries(ids.map(x=>[x,new Element()]));
  let submitCalls=0;let submitted=false;
  const task={work_id:202,run_id:7,kind:'breakdown_replacement',review_status:'pending',
    planned_start_time:'06:00:00',planned_end_time:'10:00:00',route_code:'FM-01',
    route_name:'Main route',plate_number:'TEST-123',temperature_zone:'冷凍',
    work_note:'<img src=x onerror=alert(1)>',submission_note:null,submitted_at:null};
  const query={select(){return this;},eq(){return this;},order(){return Promise.resolve({data:[],error:null});},
    single(){return Promise.resolve({data:{display_name:'司機測試',role:'driver',active:true},error:null});}};
  const db={
    auth:{getUser:async()=>({data:{user:{id:'driver-test'}},error:null}),signOut:async()=>{}},
    from:()=>Object.create(query),
    rpc:async(name,args)=>{
      if(name==='v055_my_special_assignments')return {data:[{...task,submitted_at:submitted?'2026-10-11T00:00:00Z':null}],error:null};
      if(name==='v055_submit_special_completion'){
        assert.equal(args.p_work_id,202);submitCalls++;submitted=true;
        return {data:{state:'submitted'},error:null};
      }
      return {error:{message:`Unexpected RPC ${name}`}};
    }
  };
  const context={db,document:{querySelector:s=>el[s.replace(/^#/,'')],createElement:tag=>new Element(tag)},
    window:{confirm:()=>true,location:{href:''}},console,Date,Promise,Intl};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../js/driver.js'),'utf8'),context);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(el['driver-special-work'].children.length,1,'replacement should display on special-duty board');
  let card=el['driver-special-work'].children[0];
  assert.ok(card.innerHTML.includes('故障接替'));
  assert.ok(card.innerHTML.includes('&lt;img'), 'freeform notes are HTML escaped');
  const actions=card.children.find(x=>x.tag==='div');
  assert.ok(actions,'has a submission button');
  const button=actions.children.find(x=>x.tag==='button');
  assert.equal(button.textContent,'回報接替配送完成');
  await button.listeners.click();
  assert.equal(submitCalls,1,'submits one completion through RPC');
  card=el['driver-special-work'].children[0];
  assert.ok(card.innerHTML.includes('已回報，待主管審核'),'shows submitted state');
  assert.equal(card.children.find(x=>x.tag==='div'),undefined,'no second submission button');
  console.log('v0.5.5 Increment 1.1 driver board mock interaction passed');
})().catch(e=>{console.error(e);process.exitCode=1;});

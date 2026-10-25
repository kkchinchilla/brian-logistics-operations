import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const read=p=>fs.readFileSync(p,'utf8');
let checks=0;
function ok(name,value){assert.ok(value,name);checks++;console.log('PASS:',name);}
const settle=()=>new Promise(r=>setImmediate(r));
async function setup({storage=new Map(),page='index',reachable=false,online=false,config=true}={}){
 const dom=new JSDOM(read(`${page}.html`),{runScripts:'outside-only'});await new Promise(r=>dom.window.addEventListener('load',r));
 const doc=dom.window.document;let visibility='visible',serial=0;
 Object.defineProperty(doc,'visibilityState',{get:()=>visibility,configurable:true});
 const style=doc.createElement('style');style.textContent=read('css/connection-recovery.css');doc.head.append(style);
 const timers=new Map(),listeners={},calls={fetches:[],reloads:0};
 const state={reachable,fetcher:null};
 const ctx={document:doc,navigator:{onLine:online},AbortController,
  setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  location:{reload(){calls.reloads++;}},addEventListener:(type,fn)=>listeners[type]=fn,
  async fetch(url,options){calls.fetches.push({url,options});if(state.fetcher)return state.fetcher(url,options);if(!state.reachable)throw Error('network unavailable');return {ok:true,json:async()=>({name:'GoTrue'})};}
 };ctx.window=ctx;
 if(config){ctx.SUPABASE_URL='https://test.supabase.co';ctx.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';}
 vm.createContext(ctx);vm.runInContext(read('js/dashboard-session.js'),ctx);ctx.DashboardSession.showRecovery();
 async function tick(ms=3000){const entry=[...timers].find(([,v])=>v.ms===ms);assert.ok(entry,`scheduled ${ms} ms task exists`);timers.delete(entry[0]);await entry[1].fn();await settle();}
 return {ctx,state,calls,timers,listeners,storage,doc,dom,tick,
  visibility(value){visibility=value;doc.dispatchEvent(new dom.window.Event('visibilitychange'));},
  close(){listeners.pagehide?.();dom.window.close();}};
}
for(const page of ['index','ui-attendance','ui-routes','ui-vehicles','ui-monthly','ui-accounts']){
 const e=await setup({page});await e.tick();
 ok(`${page}: offline probe keeps recovery and schedules another check`,e.calls.reloads===0&&[...e.timers.values()].some(t=>t.ms===3000));
 e.state.reachable=true;await e.tick();
 ok(`${page}: recovers without online/focus events even with a stale offline flag`,e.calls.reloads===1&&e.ctx.navigator.onLine===false&&e.timers.size===0);
 const req=e.calls.fetches[1];
 ok(`${page}: probe sends no user credentials and bypasses cache`,req.url==='https://test.supabase.co/auth/v1/health'&&req.options.cache==='no-store'&&req.options.credentials==='omit'&&Object.keys(req.options.headers).join(',')==='apikey');e.close();
}
const early=await setup();await early.listeners.online();
ok('early online event does not reload before real connectivity exists',early.calls.reloads===0);
early.state.reachable=true;await early.tick();ok('timer recovers after an early online event',early.calls.reloads===1);early.close();
for(const response of [{ok:false},{ok:true,json:async()=>({name:'captive portal'})},{ok:true,json:async()=>{throw Error('invalid JSON');}}]){
 const e=await setup();e.state.fetcher=async()=>response;await e.tick();ok('unhealthy or unrelated response does not cause a reload',e.calls.reloads===0&&e.timers.size===1);e.close();
}
const pending=await setup();let release;
pending.state.fetcher=()=>new Promise(r=>release=r);const inFlight=pending.listeners.online();await settle();
await pending.listeners.focus();ok('overlapping connectivity events share one in-flight probe',pending.calls.fetches.length===1);
pending.doc.querySelector('#connection-recovery button').click();release({ok:true,json:async()=>({name:'GoTrue'})});await inFlight;
ok('manual retry remains immediate and late probe cannot double-reload',pending.calls.reloads===1&&pending.timers.size===0);pending.close();
const hung=await setup();hung.state.fetcher=(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));
const hanging=hung.listeners.online();await settle();await hung.tick(5000);await hanging;
ok('hung request times out and schedules a later probe',hung.calls.reloads===0&&[...hung.timers.values()].some(t=>t.ms===3000));hung.close();
const background=await setup({reachable:true});background.visibility('hidden');await background.listeners.online();
ok('hidden app pauses connectivity polling',background.calls.fetches.length===0&&background.timers.size===0);
background.visibility('visible');await settle();ok('foreground return checks connectivity without an online event',background.calls.reloads===1);background.close();
const unloaded=await setup();unloaded.close();ok('page exit cancels scheduled polling',unloaded.timers.size===0);
const storage=new Map();
for(let n=0;n<2;n++){const e=await setup({storage,reachable:true});await e.tick();assert.equal(e.calls.reloads,1);e.close();}
const limited=await setup({storage,reachable:true});await limited.listeners.online();
ok('persistent startup failure cannot create an automatic reload loop',limited.calls.reloads===0&&limited.timers.size===0);
limited.doc.querySelector('#connection-recovery button').click();ok('manual retry works after automatic limit',limited.calls.reloads===1&&!storage.has('huoyitong:connection-reloads'));limited.close();
const successful=await setup({storage:new Map([['huoyitong:connection-reloads','2']])});successful.ctx.DashboardSession.ready();
ok('successful dashboard startup resets the automatic recovery budget',!successful.storage.has('huoyitong:connection-reloads')&&successful.timers.size===0);successful.close();
const noConfig=await setup({config:false});await noConfig.tick();ok('SDK/config loading delay is retried without crashing',noConfig.calls.fetches.length===0&&noConfig.timers.size===1);noConfig.close();
const noStorage=await setup();noStorage.ctx.sessionStorage.getItem=()=>{throw Error('blocked');};await noStorage.listeners.online();noStorage.doc.querySelector('button').click();
ok('unavailable retry storage still permits manual recovery',noStorage.calls.reloads===1);noStorage.close();
const styled=await setup();const outer=styled.dom.window.getComputedStyle(styled.doc.querySelector('.loginbox'));
ok('login recovery removes the extra outer card',outer.backgroundColor==='rgba(0, 0, 0, 0)'&&outer.padding==='0px'&&outer.boxShadow==='none');styled.close();
console.log(`RESULT: ${checks} reconnect checks passed`);

import {JSDOM} from 'jsdom';
import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
let checks=0;const ok=(name,condition)=>{assert.ok(condition,name);checks++;console.log('PASS:',name);};
async function setup({page='vehicles',online=true,userError,throwUser,profileError,throwProfile,profile={id:'test-user',role:'dispatcher',active:true,display_name:'Test'},noUser=false}={}){
 const dom=new JSDOM(read(`ui-${page}.html`),{runScripts:'outside-only'});await new Promise(r=>dom.window.addEventListener('load',r));
 const calls={auth:0,profile:0,signouts:0,reloads:0,redirects:[],data:0};const listeners={};
 const ctx={setTimeout:()=>1,clearTimeout(){},AbortController,sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',fetch:async()=>({ok:true,json:async()=>({name:'GoTrue'})}),console:{error(){}},document:dom.window.document,navigator:{onLine:online},location:{replace:p=>calls.redirects.push(p),reload:()=>calls.reloads++},addEventListener:(name,fn)=>listeners[name]=fn,DashboardAccess146:{load:async()=>false,finance:()=>false}};ctx.window=ctx;
 ctx.db={auth:{async getUser(){calls.auth++;if(throwUser)throw throwUser;return {data:{user:noUser?null:{id:'test-user'}},error:userError};},async signOut(){calls.signouts++;return {error:null};},async getSession(){return {data:{session:{user:{id:'test-user'}}},error:null};}},from(table){assert.equal(table,'profiles');return {select(){return this;},eq(k,id){assert.equal(id,'test-user');return this;},async single(){calls.profile++;if(throwProfile)throw throwProfile;return {data:profileError?null:profile,error:profileError};}};}};
 vm.createContext(ctx);vm.runInContext(read('js/dashboard-session.js'),ctx);ctx.loadPage=async()=>{calls.data++;};
 if(page==='routes')vm.runInContext(read('js/ui-routes-live.js'),ctx);else {vm.runInContext(read('js/production-common.js'),ctx);await ctx.init();}
 await new Promise(r=>setImmediate(r));
 return {ctx,calls,listeners,dom,doc:dom.window.document,close:()=>dom.window.close()};
}
for(const page of ['attendance','vehicles','monthly','accounts','routes']){
 const e=await setup({page,online:false});ok(`${page}: offline navigation stays put without checking Auth, signing out, or loading data`,e.calls.auth===0&&e.calls.data===0&&e.calls.signouts===0&&e.calls.redirects.length===0&&!!e.doc.querySelector('#connection-recovery'));
 e.ctx.DashboardSession.showRecovery();ok(`${page}: only one recovery panel`,e.doc.querySelectorAll('#connection-recovery').length===1);
 e.ctx.navigator.onLine=true;e.listeners.online();e.doc.querySelector('#connection-recovery button').click();ok(`${page}: reconnect and repeated clicks trigger one reload`,e.calls.reloads===1);e.close();
}
for(const opts of [
 {userError:{name:'AuthRetryableFetchError',status:0}},
 {userError:{status:503}},
 {userError:{status:429}},
 {throwUser:new TypeError('Failed to fetch')},
 {profileError:{message:'Failed to fetch'}},
 {profileError:{status:403,message:'permission denied'}},
 {throwProfile:new TypeError('Failed to fetch')}
]){
 for(const page of ['vehicles','routes']){
  const e=await setup({page,...opts});ok(`${page}: temporary/unknown verification failure preserves session and blocks data`,e.calls.signouts===0&&e.calls.redirects.length===0&&e.calls.data===0&&e.doc.body.dataset.connectionState==='blocked');
  e.doc.querySelector('#connection-recovery button').click();ok(`${page}: manual retry works even without an online event`,e.calls.reloads===1);e.close();
 }
}
for(const userError of [{name:'AuthSessionMissingError'},{status:401},{code:'refresh_token_not_found'}]){
 const e=await setup({userError});ok('confirmed invalid authentication goes to login and never loads data',e.calls.redirects[0]==='index.html'&&e.calls.data===0);e.close();
}
const missing=await setup({noUser:true});ok('missing authenticated user goes to login',missing.calls.redirects[0]==='index.html');missing.close();
for(const profile of [null,{active:false,role:'dispatcher'},{active:true,role:'unknown'}]){
 const e=await setup({profile});ok('verified unavailable/disabled account cannot enter dashboard',e.calls.signouts===1&&e.calls.redirects[0]==='index.html'&&e.calls.data===0);e.close();
}
const missingProfile=await setup({profileError:{code:'PGRST116'}});ok('missing profile row fails closed as an unavailable account',missingProfile.calls.signouts===1&&missingProfile.calls.redirects[0]==='index.html');missingProfile.close();
for(const role of ['driver','dispatcher']){
 const e=await setup({profile:{id:'test-user',role,active:true,display_name:'Test'}});ok(`${role}: online retry verifies both Auth and profile before loading`,e.calls.auth===1&&e.calls.profile===1&&e.calls.data===1&&e.doc.body.dataset.accountRole===role&&!e.doc.querySelector('#connection-recovery'));e.close();
}
const loading=await setup();loading.ctx.loadPage=async()=>{throw Error('network interrupted during loading');};await loading.ctx.init();ok('connection lost after authentication shows recovery instead of an empty board',!!loading.doc.querySelector('#connection-recovery')&&loading.calls.signouts===0);loading.close();
for(const page of ['attendance','vehicles','monthly','accounts','routes']){
 const html=read(`ui-${page}.html`);ok(`${page}: recovery guard and CSS are included before page logic`,html.includes('css/connection-recovery.css?v=1447')&&html.indexOf('js/dashboard-session.js')<html.indexOf(page==='routes'?'js/ui-routes-live.js':'js/production-common.js'));
}
console.log(`RESULT: ${checks} offline/session checks passed`);

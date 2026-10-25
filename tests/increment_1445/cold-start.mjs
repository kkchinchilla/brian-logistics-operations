import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

const read=p=>fs.readFileSync(p,'utf8');
let checks=0;
function ok(name,value){assert.ok(value,name);checks++;console.log('PASS:',name);}
async function launch({online=true,sdk=true,state={session:true},sessionError,userError,profileError,role='driver',active=true,page='index'}={}){
 const dom=new JSDOM(read(`${page}.html`),{runScripts:'outside-only'});
 await new Promise(resolve=>dom.window.addEventListener('load',resolve));
 const style=dom.window.document.createElement('style');style.textContent=read('css/connection-recovery.css');dom.window.document.head.append(style);
 const calls={order:[],redirects:[],reloads:0,signouts:0};const listeners={};
 const ctx={setTimeout:()=>1,clearTimeout(){},AbortController,sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',fetch:async()=>{if(ctx.navigator.onLine===false)throw Error('offline');return {ok:true,json:async()=>({name:'GoTrue'})};},document:dom.window.document,navigator:{onLine:online},console,
  location:{replace:url=>calls.redirects.push(url),reload:()=>calls.reloads++},
  addEventListener:(type,fn)=>listeners[type]=fn};ctx.window=ctx;
 const client={auth:{
  async getSession(){calls.order.push('session');return {data:{session:state.session?{user:{role:'untrusted-cache'}}:null},error:sessionError};},
  async getUser(){calls.order.push('user');return {data:{user:{id:'test-user'}},error:userError};},
  async signOut(){calls.signouts++;state.session=false;}
 },from(table){assert.equal(table,'profiles');return {select(){return this;},eq(key,id){assert.equal(id,'test-user');return this;},
  async single(){calls.order.push('profile');return {data:{role,active},error:profileError};},async maybeSingle(){return this.single();}};}};
 if(sdk)ctx.db=client;
 vm.createContext(ctx);vm.runInContext(read('js/dashboard-session.js'),ctx);
 if(page==='index'){vm.runInContext(read('js/login.js'),ctx);await vm.runInContext('sessionRestore',ctx);}
 else await ctx.DashboardSession.verify(client);
 return {ctx,calls,state,listeners,dom,blocked:()=>ctx.document.body.dataset.connectionState==='blocked',close:()=>dom.window.close()};
}

// Recreate the WebView with the SAME saved session across offline and online starts.
const state={session:true};
const offline=await launch({online:false,sdk:false,state});
ok('cold offline launch works even when the remote SDK is unavailable',offline.blocked()&&!!offline.ctx.document.querySelector('#connection-recovery'));
ok('offline launch neither verifies nor removes the saved session',offline.calls.order.length===0&&offline.calls.signouts===0&&state.session);
ok('offline launch hides the password form',offline.dom.window.getComputedStyle(offline.ctx.document.querySelector('#login-form')).display==='none');
offline.ctx.navigator.onLine=true;offline.listeners.online();
offline.ctx.document.querySelector('#connection-recovery button').click();
ok('online event and repeated manual retry request one restart',offline.calls.reloads===1);offline.close();
for(const role of ['driver','dispatcher']){
 const restored=await launch({state,role});
 ok(`${role}: reconnect restores session without a password`,restored.calls.redirects[0]==='ui-attendance.html'&&restored.calls.signouts===0);
 ok(`${role}: cached session does not authorize access`,restored.calls.order.join(',')==='session,user,profile');restored.close();
}
for(const options of [
 {sessionError:{name:'AuthRetryableFetchError',status:0}},
 {userError:{status:503}},
 {profileError:{status:403}},
 {sdk:false}
]){
 const e=await launch(options);
 ok('temporary startup failure shows recovery and preserves session',e.blocked()&&e.state.session&&e.calls.signouts===0&&e.calls.redirects.length===0);
 await e.listeners.focus();ok('returning to an online app retries when online event was missed',e.calls.reloads===1);e.close();
}
const stillOffline=await launch({online:false});await stillOffline.listeners.focus();
ok('focus while offline does not cause a reload loop',stillOffline.calls.reloads===0);stillOffline.close();
const retry=await launch({sessionError:{status:503}});retry.ctx.document.querySelector('#connection-recovery button').click();
ok('manual retry remains available without a connectivity event',retry.calls.reloads===1);retry.close();
const loggedOut=await launch({state:{session:false}});
ok('explicitly logged-out launch presents the login form',!loggedOut.blocked()&&loggedOut.calls.redirects.length===0&&loggedOut.dom.window.getComputedStyle(loggedOut.ctx.document.querySelector('#login-form')).display!=='none');loggedOut.close();
for(const extra of [{active:false},{role:'unknown'}]){
 const e=await launch(extra);ok('server-confirmed inactive or unauthorized accounts cannot resume',e.calls.signouts===1&&e.calls.redirects.length===0&&!e.blocked());e.close();
}
const invalid=await launch({sessionError:{code:'refresh_token_not_found'}});
ok('revoked session requires login rather than endless recovery',!invalid.blocked()&&invalid.calls.redirects.length===0&&invalid.ctx.document.querySelector('#error-message').textContent.includes('重新登入'));invalid.close();
for(const page of ['ui-attendance','ui-routes','ui-vehicles','ui-monthly','ui-accounts']){
 const e=await launch({page,sessionError:{name:'AuthRetryableFetchError',status:0}});
 ok(`${page}: failed token refresh blocks access without a login redirect`,e.blocked()&&e.calls.order.join(',')==='session'&&e.calls.redirects.length===0&&e.calls.signouts===0);e.close();
 const online=await launch({page});ok(`${page}: retry refreshes before online identity/profile checks`,online.calls.order.join(',')==='session,user,profile'&&!online.blocked());online.close();
}
for(const page of ['index','ui-attendance','ui-routes','ui-vehicles','ui-monthly','ui-accounts']){
 const html=read(`${page}.html`);
 ok(`${page}: recovery is available before any remote SDK request`,html.indexOf('js/dashboard-session.js?v=1446')<html.indexOf('https://cdn.jsdelivr.net/npm/@supabase'));
}
console.log(`RESULT: ${checks} cold-start recovery checks passed`);

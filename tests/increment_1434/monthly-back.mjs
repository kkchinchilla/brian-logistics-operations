import fs from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const root=new URL('../../',import.meta.url);
const source=fs.readFileSync(new URL('js/monthly-android-back.js',root),'utf8');
const common=fs.readFileSync(new URL('js/production-common.js',root),'utf8');
const html=fs.readFileSync(new URL('ui-monthly.html',root),'utf8');
assert.ok(html.includes('js/monthly-android-back.js?v=1434'));
async function setup(platform='android',available=true){
 const dom=new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g,''),{runScripts:'outside-only',url:'https://localhost/ui-monthly.html'}),w=dom.window;
 await new Promise(r=>w.addEventListener('load',r));
 let back,navigation=0,minimized=0;
 const app={async addListener(name,fn){assert.equal(name,'backButton');back=fn;},async minimizeApp(){minimized++;}};
 w.Capacitor={getPlatform:()=>platform,isPluginAvailable:()=>available,registerPlugin:name=>{assert.equal(name,'App');return app}};
 w.history.back=()=>navigation++;
 w.eval(common);w.document.querySelector('#modal-cancel').onclick=()=>w.eval('closeModal()');
 w.eval(source);
 return {w,back:()=>back,navigation:()=>navigation,minimized:()=>minimized,close:()=>w.close()};
}
const e=await setup(),w=e.w,d=w.document;
d.body.insertAdjacentHTML('beforeend','<div id="monthly-overlay"></div><aside id="monthly-detail" class="open"><button id="close-detail">Close</button><div id="daily-view">Saved daily tab</div></aside>');
d.querySelector('#close-detail').onclick=()=>{d.querySelector('#monthly-detail').remove();d.querySelector('#monthly-overlay').remove();};
w.eval("modal('新增薪資加給或獎懲','<input id=reason value=draft>',async()=>{})");
e.back()({canGoBack:true});assert.ok(!d.querySelector('#modal.open'));assert.ok(d.querySelector('#daily-view'));assert.equal(e.navigation(),0);
e.back()({canGoBack:true});assert.ok(!d.querySelector('#monthly-detail'));assert.ok(!d.querySelector('#monthly-overlay'));assert.equal(e.navigation(),0);
e.back()({canGoBack:true});assert.equal(e.navigation(),1);
e.back()({canGoBack:false});assert.equal(e.minimized(),1);
// Actual common modal lifecycle: suppress Back during saves and allow it after failure.
let release;w.pending=new Promise((resolve,reject)=>{release=reject;});
w.eval("modal('編輯薪資調整','<input id=reason value=unchanged>',()=>window.pending)");
const saving=d.querySelector('#modal-save').onclick();e.back()({canGoBack:true});assert.ok(d.querySelector('#modal.open'));assert.equal(e.navigation(),1);
release(new Error('save failed'));await saving;assert.equal(d.querySelector('#modal-error').textContent,'save failed');assert.equal(d.querySelector('#reason').value,'unchanged');
e.back()({canGoBack:true});assert.ok(!d.querySelector('#modal.open'));assert.equal(e.navigation(),1);
w.eval("modal('租車費用設定','',async()=>{})");e.back()({canGoBack:false});assert.ok(!d.querySelector('#modal.open'));assert.equal(e.minimized(),1);e.close();
for(const [platform,available] of [['web',true],['ios',true],['android',false]]){const x=await setup(platform,available);assert.equal(x.back(),undefined);x.close();}
console.log('PASS: nested adjustment/detail dismissal, save protection, failure recovery, rental modal, history/minimize and non-Android behavior');

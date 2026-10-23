import {JSDOM} from 'jsdom';
import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('ui-accounts.html','utf8');
let checks=0;const ok=(name,v=true)=>{assert.ok(v,name);checks++;console.log('PASS:',name);};
const users=[{id:'owner',display_name:'Brian',role:'dispatcher',is_owner:true,active:true,phone:'886900000001',phone_confirmed:true},{id:'driver',display_name:'Test driver',role:'driver',is_owner:false,active:true,phone:'',phone_confirmed:false},{id:'deleted',display_name:'Former driver',role:'driver',active:false,phone:'',deleted:true}];
async function setup(allowed=true){
 const dom=new JSDOM(html,{url:'https://example.invalid/ui-accounts.html',runScripts:'outside-only'}),ctx=dom.getInternalVMContext(),calls=[];
 // Production initializes through DOMContentLoaded. Fire it manually only after mocks are installed.
 await new Promise(resolve=>dom.window.addEventListener('load',resolve));
 ctx.TextEncoder=TextEncoder;
 let nextResult=null,hold=null;
 ctx.db={functions:{invoke:async(name,{body})=>{calls.push(structuredClone(body));if(hold)await hold;if(nextResult){const r=nextResult;nextResult=null;return r;}return body.action==='list'?{data:{users:structuredClone(users),actor_id:'owner'}}:{data:{ok:true,message:'已儲存'}};}},auth:{signOut:async()=>({})}};
 ctx.DashboardAccess146={load:async()=>allowed,finance:()=>allowed};
 vm.runInContext(fs.readFileSync('js/production-common.js','utf8'),ctx);
 vm.runInContext("currentProfile={role:'dispatcher',display_name:'Brian'};",ctx);
 vm.runInContext(fs.readFileSync('js/accounts-1419.js','utf8'),ctx);
 await ctx.loadPage();
 const doc=dom.window.document,el=id=>doc.getElementById(id),submit=()=>el('account-form').onsubmit({preventDefault(){}});
 return {ctx,dom,el,calls,submit,fail:message=>{nextResult={error:{context:{json:async()=>({error:message})}}};},hold:p=>{hold=p;}};
}
let e=await setup(false);ok('direct navigation by non-owner never calls account endpoint',e.calls.length===0&&e.el('page').textContent.includes('僅限 Brian'));e.dom.window.close();
e=await setup();ok('existing users render and deleted users are excluded by default',e.el('account-list').textContent.includes('Test driver')&&!e.el('account-list').textContent.includes('Former driver'));ok('unconfigured phones show an actionable state',e.el('account-list').textContent.includes('待設定手機'));
assert.equal(e.dom.window.document.querySelector('[data-account-action="delete"][data-id="owner"]'),null);ok('owner has no delete control');
e.el('account-filter').value='deleted';e.ctx.renderAccounts();ok('deleted accounts remain read-only in history view',e.el('account-list').textContent.includes('Former driver')&&e.dom.window.document.querySelectorAll('[data-account-action]').length===0);
e.el('account-filter').value='all';e.el('account-search').value='0900000001';e.ctx.renderAccounts();ok('Taiwan local format searches stored international numbers',e.el('account-list').textContent.includes('Brian')&&!e.el('account-list').textContent.includes('Test driver'));
e.ctx.openAccountEditor('create');e.el('account-name-input').value='New driver';e.el('account-phone-input').value='0912345678';e.el('account-phone-verified').checked=true;e.el('account-password').value='Test-password-123!';e.el('account-password-confirm').value='mismatch';await e.submit();ok('mismatched passwords stay in dialog without a request',e.calls.length===1&&e.el('modal-error').textContent.includes('不一致'));
e.el('account-password-confirm').value='Test-password-123!';await e.submit();const created=e.calls.find(c=>c.action==='create');assert.equal(created.phone,'+886912345678');assert.equal(created.role,'driver');ok('create form submits validated phone-only account data');ok('successful save clears password fields and refreshes list',!e.el('account-password')&&!e.el('modal').classList.contains('open')&&e.calls.filter(c=>c.action==='list').length===2);
e.ctx.openAccountEditor('phone','driver');e.el('account-phone-input').value='0912345678';e.el('account-phone-verified').checked=true;e.fail('此手機號碼已被其他帳號使用。');await e.submit();ok('duplicate phone stays editable and displays server error',e.el('modal').classList.contains('open')&&e.el('modal-error').textContent.includes('已被其他帳號'));
e.ctx.closeModal();e.ctx.openAccountEditor('password','driver');e.el('account-password').value='Temporary-secret';e.dom.window.document.querySelector('[data-reveal="account-password"]').click();ok('password visibility toggles without sending credentials',e.el('account-password').type==='text');e.ctx.closeModal();ok('cancel removes password from DOM',!e.el('account-password'));
e.ctx.openAccountEditor('delete','driver');e.el('account-delete-name').value='wrong';const before=e.calls.length;await e.submit();ok('delete requires exact displayed name before request',e.calls.length===before);e.el('account-delete-name').value='Test driver';await e.submit();ok('confirmed deletion sends the intended user ID only',e.calls.some(c=>c.action==='delete'&&c.user_id==='driver'&&c.confirm_name==='Test driver'));
e.ctx.openAccountEditor('edit','owner');ok('own name is editable while owner role is locked',e.el('account-role').disabled&&!!e.el('account-name-input'));e.ctx.closeModal();e.ctx.openAccountEditor('password','owner');ok('own credential change explains the relogin step',e.el('modal-fields').textContent.includes('儲存後會登出'));e.ctx.closeModal();
e.ctx.openAccountEditor('password','driver');e.el('account-password').value='Test-password-123!';e.el('account-password-confirm').value='Test-password-123!';let release;e.hold(new Promise(r=>release=r));const first=e.submit();await new Promise(r=>setImmediate(r));const count=e.calls.length;await e.submit();e.ctx.closeModal();ok('duplicate submission and dismissing an in-flight save are blocked',e.calls.length===count&&e.el('modal').classList.contains('open'));release();await first;e.hold(null);
for(const page of ['ui-attendance.html','ui-vehicles.html','ui-routes.html','ui-monthly.html','ui-accounts.html']){const doc=new JSDOM(fs.readFileSync(page,'utf8')).window.document;assert.equal(doc.querySelectorAll('[data-account-nav]').length,2);}
ok('all dashboards include desktop and mobile account navigation');
const css=fs.readFileSync('css/access-146.css','utf8');ok('account links fail closed until owner capability resolves',css.includes('body:not([data-finance-access="allowed"]) [data-account-nav]{display:none!important}'));
e.dom.window.close();console.log(`RESULT: ${checks} account UI checks passed`);

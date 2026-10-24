import assert from 'node:assert/strict';
import {createAccountHandler,normalizePhone} from '../../supabase/functions/account-admin/handler.mjs';
let checks=0;const ok=(name,v=true)=>{assert.ok(v,name);checks++;console.log('PASS:',name);};
const owner={id:'owner',display_name:'Brian',role:'dispatcher',active:true,is_owner:true,phone:'886900000001'},driver={id:'driver',display_name:'Test driver',role:'driver',active:true,is_owner:false,phone:''};
const secret='test-server-key',url='https://example.supabase.co',origin='https://kkchinchilla.github.io';
function setup(config={}){
 const calls=[],users=structuredClone([owner,driver]);let privileged=0;
 const createClient=(_,key,options)=>{
  if(key!==secret)return {auth:{getUser:async(token)=>{calls.push(['verify',token]);return config.noUser?{error:{}}:{data:{user:{id:config.actor||'owner',user_metadata:{can_manage_finance:true}}}};}},rpc:async()=>config.denied?{error:{}}:{data:{actor_id:config.actor||'owner'}}};
  privileged++;
  return {rpc:async(name,args)=>{
   calls.push([name,args]);
   if(name==='dashboard_account_directory')return {data:users};
   if(config.applyError===args.p_action)return {error:{message:'private SQL detail'}};
   if(args.p_action==='delete_requested')users.find(u=>u.id===args.p_target).active=false;
   return {data:null};
  },auth:{admin:{
   createUser:async attrs=>{calls.push(['create',attrs]);return config.authError?{error:config.authError}:{data:{user:{id:'created'}}};},
   updateUserById:async(id,attrs)=>{calls.push(['update',id,attrs]);return config.authError?{error:config.authError}:{data:{user:{id}}};},
   deleteUser:async(id,soft)=>{calls.push(['delete',id,soft]);return config.deleteError?{error:{}}:{data:{}};}
  }}};
 };
 const handle=createAccountHandler({createClient,url,publicKey:'public',secretKey:secret,allowedOrigins:[origin,'https://localhost']});
 async function run(body,headers={}){const response=await handle(new Request(url,{method:'POST',headers:{Origin:origin,Authorization:'Bearer test-session','Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)}));return {status:response.status,body:await response.json(),headers:response.headers};}
 return {run,handle,calls,users,get privileged(){return privileged;}};
}
for(const [input,result] of [['0912345678','+886912345678'],['886912345678','+886912345678'],['+1 (234) 567-8900','+12345678900'],['person@example.com',null],['+886012345678',null]])assert.equal(normalizePhone(input),result);ok('phone normalization follows phone-login rules');
let e=setup({noUser:true});assert.equal((await e.run({action:'list'})).status,401);ok('invalid JWT never constructs privileged client',e.privileged===0);
e=setup({actor:'driver',denied:true});assert.equal((await e.run({action:'create',can_manage_finance:true,actor_id:'owner'})).status,403);ok('spoofed body and user metadata cannot grant administration',e.privileged===0);
e=setup();assert.equal((await e.run({action:'list'},{Origin:'https://evil.invalid'})).status,403);ok('unexpected browser origins refused',e.privileged===0);
e=setup();assert.equal((await e.run({action:'list'},{Authorization:''})).status,401);ok('missing authorization refused',e.privileged===0);
e=setup();let response=await e.run({action:'list'});assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');ok('directory requires authorization and is never cached',response.body.users.length===2&&!JSON.stringify(response.body).includes(secret));
const create={action:'create',name:' New driver ',role:'driver',phone:'0912345678',phone_verified:true,password:'Test-password-123!'};
e=setup();response=await e.run(create);assert.equal(response.status,200);assert.deepEqual(e.calls.find(c=>c[0]==='create')[1],{phone:'+886912345678',phone_confirm:true,password:create.password});ok('phone-only account uses Auth Admin API and a separate profile');
assert.equal(e.calls.find(c=>c[0]==='dashboard_account_apply')[1].p_name,'New driver');ok('profile receives only validated name, role and verified actor');
for(const patch of [{role:'admin'},{phone_verified:false},{password:'short'},{phone:'invalid'},{name:''}]){e=setup();assert.equal((await e.run({...create,...patch})).status,400);assert.ok(!e.calls.some(c=>c[0]==='create'));}ok('invalid account input is rejected before Auth mutation');
e=setup({authError:{code:'phone_exists'}});response=await e.run(create);assert.equal(response.status,409);ok('duplicate phone has an actionable error',response.body.error.includes('已被其他帳號'));
e=setup({applyError:'create'});response=await e.run(create);assert.equal(response.status,409);ok('failed provisioning removes only the just-created empty Auth account',e.calls.some(c=>c[0]==='delete'&&c[1]==='created'&&c[2]===undefined));
e=setup({applyError:'create',deleteError:true});response=await e.run(create);assert.equal(response.status,503);ok('failed cleanup reports incomplete provisioning honestly',response.body.error.includes('未開通'));
e=setup();response=await e.run({action:'edit',user_id:'owner',name:'Brian',role:'driver'});assert.equal(response.status,403);response=await e.run({action:'delete',user_id:'owner',confirm_name:'Brian'});assert.equal(response.status,403);ok('owner cannot self-delete or demote himself',!e.calls.some(c=>c[0]==='delete'));
e=setup();response=await e.run({action:'delete',user_id:'driver',confirm_name:'wrong'});assert.equal(response.status,400);ok('deletion requires matching account-name confirmation',!e.calls.some(c=>c[0]==='delete'));
e=setup();response=await e.run({action:'delete',user_id:'driver',confirm_name:'Test driver'});assert.equal(response.status,200);ok('existing users are soft-deleted, retaining profile IDs',e.calls.some(c=>c[0]==='delete'&&c[1]==='driver'&&c[2]===true));const deletion=e.calls.filter(c=>c[0]==='delete'||c[0]==='dashboard_account_apply');assert.deepEqual(deletion.map(c=>c[0]==='delete'?'auth':c[1].p_action),['delete_requested','auth','delete']);ok('application access is disabled before Auth deletion');
e=setup({deleteError:true});response=await e.run({action:'delete',user_id:'driver',confirm_name:'Test driver'});assert.equal(response.status,502);ok('failed delete leaves access disabled and explains retry',!e.users[1].active&&response.body.error.includes('重試刪除'));
for(const action of ['phone','password']){e=setup();response=await e.run({...create,action,user_id:'owner'});assert.equal(response.status,200);assert.equal(response.body.self_relogin,true);const attrs=e.calls.find(c=>c[0]==='update')[2];assert.deepEqual(Object.keys(attrs).sort(),action==='phone'?['phone','phone_confirm']:['password']);}ok('own phone and password updates change only requested credentials and require relogin');
e=setup({applyError:'password'});response=await e.run({action:'password',user_id:'driver',password:create.password});ok('credential success is not falsely reported as failure when audit fails',response.status===200&&response.body.audit_saved===false);
e=setup({authError:{code:'weak_password',message:'internal private credential detail'}});response=await e.run({action:'password',user_id:'driver',password:create.password});ok('provider errors do not leak internal details or credentials',response.status===400&&!JSON.stringify(response.body).includes('private'));
e=setup();assert.equal((await e.run('{bad json')).status,400);ok('malformed bodies return a controlled response');
for(const allowed of [origin,'https://localhost']){
 e=setup();const preflight=await e.handle(new Request(url,{method:'OPTIONS',headers:{Origin:allowed,'Access-Control-Request-Method':'POST'}}));
 ok('preflight accepts exact app or web origin without privileged access',preflight.status===204&&preflight.headers.get('Access-Control-Allow-Origin')===allowed&&e.privileged===0);
 response=await e.run({action:'list'},{Origin:allowed});ok('authorized list returns matching CORS header',response.status===200&&response.headers.get('Access-Control-Allow-Origin')===allowed);
 e=setup({actor:'driver',denied:true});response=await e.run({action:'list'},{Origin:allowed});ok('app origin does not grant non-owner access',response.status===403&&e.privileged===0);
 e=setup();response=await e.run({action:'list'},{Origin:allowed,Authorization:''});ok('app origin still requires authentication',response.status===401&&e.privileged===0);
}
for(const blocked of ['http://localhost','https://localhost:444','https://localhost.evil.invalid','null']){
 e=setup();const preflight=await e.handle(new Request(url,{method:'OPTIONS',headers:{Origin:blocked}}));
 ok('unlisted origins are rejected without CORS reflection',preflight.status===403&&!preflight.headers.has('Access-Control-Allow-Origin')&&e.privileged===0);
}
console.log(`RESULT: ${checks} account Edge Function checks passed`);

// No real credentials or requests: exercise the login boundary with a mock Auth client.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync(new URL('../../js/login.js','file://'+__filename),'utf8');
let checks=0;
const ok=(name,v=true)=>{assert.ok(v,name);console.log('PASS:',name);checks++};
function setup(options={}){
 const elements=new Map();const calls=[];let submit,signouts=0;
 for(const id of ['login-form','phone','password','error-message','login-submit'])elements.set('#'+id,{value:'',textContent:'',disabled:false,addEventListener(name,fn){submit=fn;}});
 elements.get('#phone').value='0912345678';elements.get('#password').value='synthetic-password-only';
 const ctx={document:{querySelector:s=>elements.get(s)},window:{location:{href:''}},db:{auth:{
  async signInWithPassword(input){calls.push(input);if(options.wait)await options.wait;if(options.throwAuth)throw Error('network');return options.auth||{data:{user:{id:'synthetic-user'}},error:null};},
  async signOut(){signouts++;}
 },from(table){assert.equal(table,'profiles');return {select(){return this;},eq(key,id){assert.equal(key,'id');assert.equal(id,'synthetic-user');return this;},async single(){if(options.throwProfile)throw Error('network');return options.profileResult||{data:{active:true,role:options.role||'driver'},error:null};}};}}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,e:id=>elements.get('#'+id),calls,signouts:()=>signouts,submit:()=>submit({preventDefault(){}}),normalize:v=>ctx.normalizeLoginPhone(v)};
}
(async()=>{
 for(const text of ['0912345678','0912-345-678',' 0912 345 678 ','０９１２３４５６７８','+886912345678','886912345678']){const e=setup();ok('Taiwan formatting is normalized: '+text,e.normalize(text)==='+886912345678');}
 for(const text of ['','user@example.test','912345678','091234567','09123456789','+8860912345678','+88691234','+0123456789','+1234567890123456','0912345678ext1','++886912345678']){const e=setup();e.e('phone').value=text;await e.submit();ok('invalid identifier is rejected before authentication: '+text,e.calls.length===0&&!!e.e('error-message').textContent);}
 ok('international phone with explicit country code accepted',setup().normalize('+1 (202) 555-0123')==='+12025550123');
 for(const role of ['driver','dispatcher']){const e=setup({role});await e.submit();ok(role+' signs in by phone and retains the attendance landing page',e.ctx.window.location.href==='ui-attendance.html'&&e.calls[0].phone==='+886912345678'&&!('email' in e.calls[0])&&e.calls[0].password==='synthetic-password-only');}
 const blank=setup();blank.e('password').value='';await blank.submit();ok('blank password causes no authentication request',blank.calls.length===0);
 const wrong=setup({auth:{data:{user:null},error:{code:'invalid_credentials',status:400}}});await wrong.submit();ok('invalid credentials have a non-enumerating Traditional Chinese message',wrong.e('error-message').textContent==='手機號碼或密碼不正確。'&&!wrong.ctx.window.location.href);
 for(const [code,word] of [['phone_not_confirmed','尚未完成帳號設定'],['phone_provider_disabled','尚未啟用'],['over_request_rate_limit','稍後再試']]){const e=setup({auth:{data:null,error:{code}}});await e.submit();ok(code+' is actionable without exposing identifiers',e.e('error-message').textContent.includes(word));}
 for(const profileResult of [{data:{active:false,role:'driver'},error:null},{data:null,error:{message:'missing'}},{data:{active:true,role:'unknown'},error:null}]){const e=setup({profileResult});await e.submit();ok('unusable profile signs out and never opens a dashboard',e.signouts()===1&&!e.ctx.window.location.href);}
 const network=setup({throwAuth:true});await network.submit();ok('network failure re-enables sign-in without navigating',!network.e('login-submit').disabled&&!network.ctx.window.location.href&&network.e('error-message').textContent.includes('網路'));
 const profileNetwork=setup({throwProfile:true});await profileNetwork.submit();ok('profile read exception clears the new session',profileNetwork.signouts()===1&&!profileNetwork.ctx.window.location.href);
 let release;const wait=new Promise(r=>release=r),duplicate=setup({wait});const pending=duplicate.submit();await duplicate.submit();ok('duplicate submissions produce only one request',duplicate.calls.length===1&&duplicate.e('login-submit').disabled);release();await pending;
 const html=fs.readFileSync(new URL('../../index.html','file://'+__filename),'utf8');ok('phone form keeps password autofill and has no email input',html.includes('id="phone"')&&html.includes('type="tel"')&&html.includes('autocomplete="current-password"')&&!html.includes('type="email"')&&html.includes('js/login.js?v=1417'));
 console.log(`RESULT: ${checks} phone-login checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1});

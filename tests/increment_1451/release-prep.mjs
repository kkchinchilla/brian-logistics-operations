import fs from 'node:fs';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const {createClient}=Function(fs.readFileSync('js/vendor/supabase-2.118.0.js','utf8')+';return supabase;')();
const storage=new Map(),requests=[];
const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',phone:'886900000000',created_at:'2026-10-26T00:00:00Z'};
const jwt=['e30',Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'signature'].join('.');
const fakeFetch=async(url,opts)=>{
 requests.push({url:String(url),opts});
 if(String(url).includes('/token'))return new Response(JSON.stringify({access_token:jwt,refresh_token:'synthetic-only',expires_in:3600,token_type:'bearer',user}),{status:200,headers:{'Content-Type':'application/json'}});
 if(String(url).endsWith('/user'))return new Response(JSON.stringify(user),{status:200,headers:{'Content-Type':'application/json'}});
 if(String(url).includes('/logout'))return new Response(null,{status:204});
 throw Error('Unexpected request '+url);
};
const options={global:{fetch:fakeFetch},auth:{storageKey:'isolated-test',storage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},autoRefreshToken:false,detectSessionInUrl:false}};
const client=createClient('https://example.invalid','sb_publishable_synthetic',options);
const result=await client.auth.signInWithPassword({phone:'+886900000000',password:'synthetic-password'});
assert.equal(result.error,null);
assert.equal(result.data.user.id,user.id);
assert.equal(JSON.parse(requests[0].opts.body).phone,'+886900000000');
assert.equal(JSON.parse(requests[0].opts.body).password,'synthetic-password');
assert.ok(storage.has('isolated-test'));
const restored=createClient('https://example.invalid','sb_publishable_synthetic',options);
assert.equal((await restored.auth.getSession()).data.session.user.id,user.id);
assert.equal((await restored.auth.getUser()).data.user.id,user.id);
assert.equal((await restored.auth.signOut()).error,null);
assert.equal((await restored.auth.getSession()).data.session,null);
assert.ok(!storage.has('isolated-test'));
console.log('PASS: actual bundled SDK phone/password login, persistence, server verification and logout using synthetic HTTP responses');
for(const page of ['index','ui-attendance','ui-routes','ui-vehicles','ui-monthly','ui-accounts']){
 const dom=new JSDOM(fs.readFileSync(page+'.html','utf8')),doc=dom.window.document;
 assert.ok(doc.querySelector('.privacy-links a[href="privacy.html"]'));
 assert.ok(doc.querySelector('.privacy-links a[href="account-data.html"]'));
 if(page!=='index')assert.ok(doc.querySelector('.dashboard-footer .privacy-links').compareDocumentPosition(doc.querySelector('[data-session-logout]'))&4,'Links must precede logout');
 dom.window.close();
}
for(const page of ['privacy','account-data']){
 const html=fs.readFileSync(page+'.html','utf8');
 assert.ok(!/supabase|config\.js/i.test(html.match(/<script[^>]+>/g).join('')));
 for(const [referrer,expected] of [['https://example.invalid/app/ui-routes.html','/app/ui-routes.html'],['https://evil.invalid/ui-routes.html','index.html'],['https://example.invalid/other/ui-routes.html','index.html']]){
  const dom=new JSDOM(html,{url:'https://example.invalid/app/'+page+'.html',referrer,runScripts:'outside-only'});
  dom.window.eval(fs.readFileSync('js/public-information.js','utf8'));
  assert.equal(dom.window.document.getElementById('information-back').getAttribute('href'),expected);
  assert.ok(dom.window.document.querySelector('a[href^="mailto:tangguanjia.support@gmail.com"]'));
  dom.window.close();
 }
}
console.log('PASS: support/privacy accessible across roles and before login, safe return targets, logout remains final footer action');

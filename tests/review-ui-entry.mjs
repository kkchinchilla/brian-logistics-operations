import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {PROJECT} from '../scripts/create-review-accounts.mjs';

const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'dist');
const read=(name)=>fs.readFileSync(path.join(out,name),'utf8');
function config(file){
 let args;
 vm.runInNewContext(read(file),{supabase:{createClient(...input){args=input;return {};}}});
 return args;
}
const company=config('js/config.js'),review=config('reviewer/js/config.js');
assert.equal(review[0],`https://${PROJECT}.supabase.co`);
assert.notEqual(company[0],review[0],'Normal release must retain its company backend');
assert(company[1].startsWith('sb_publishable_'));assert(review[1].startsWith('sb_publishable_'));
assert.equal(company.length,2,'Preserve existing company Auth defaults and saved sessions');
assert.equal(review[2].auth.storageKey,`sb-${PROJECT}-auth-token`);
assert.equal(review[2].auth.detectSessionInUrl,false,'Do not import sessions from a URL');
assert(!review[2].auth.storageKey.includes(new URL(company[0]).hostname.split('.')[0]));

// Use the bundled SDK with shared browser-like storage and synthetic HTTP only.
// Signing out of a reviewer account must leave the company session intact.
const {createClient}=Function(read('js/vendor/supabase-2.118.0.js')+';return supabase;')();
const saved=new Map(),requests=[];
const clients=[company,review].map(([url,key,options={}],i)=>{
 const id=i?'22222222-2222-4222-8222-222222222222':'11111111-1111-4111-8111-111111111111';
 const user={id,aud:'authenticated',role:'authenticated',created_at:'2026-10-29T00:00:00Z'};
 const jwt=['e30',Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic'].join('.');
 return createClient(url,key,{auth:{...options.auth,autoRefreshToken:false,detectSessionInUrl:false,storage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)}},global:{fetch:async(target,opts)=>{
  assert.equal(new URL(target).origin,url);
  requests.push({target:String(target),headers:opts.headers});
  if(String(target).includes('/token'))return new Response(JSON.stringify({access_token:jwt,refresh_token:'synthetic-'+i,expires_in:3600,token_type:'bearer',user}),{status:200,headers:{'Content-Type':'application/json'}});
  if(String(target).includes('/logout')){assert.equal(opts.headers.Authorization,'Bearer '+jwt);return new Response(null,{status:204});}
  throw Error('Unexpected synthetic SDK request');
 }}});
});
for(const client of clients)assert.equal((await client.auth.signInWithPassword({phone:'+12025550100',password:'synthetic-only'})).error,null);
assert.equal(saved.size,2,'Both environments persist independent sessions');
assert.equal((await clients[1].auth.signOut({scope:'local'})).error,null);
assert.equal(saved.size,1);
assert.equal((await clients[0].auth.getSession()).data.session.user.id,'11111111-1111-4111-8111-111111111111');
assert.equal((await clients[1].auth.getSession()).data.session,null);
await clients[0].auth.signOut({scope:'local'});
assert.equal(saved.size,0);assert.equal(requests.length,4);

for(const prefix of ['', 'reviewer/']){
 for(const file of fs.readdirSync(path.join(out,prefix)).filter(f=>f.endsWith('.html'))){
  const dom=new JSDOM(read(prefix+file)),doc=dom.window.document;
  for(const el of doc.querySelectorAll('[src],[href]')){
   const ref=el.getAttribute('src')??el.getAttribute('href');
   if(/^(?:https?:|data:|#|mailto:|javascript:)/.test(ref))continue;
   const target=path.resolve(out,prefix,ref.split(/[?#]/)[0]);
   assert(fs.existsSync(target),`${prefix+file}: missing ${ref}`);
   if(prefix&&ref.endsWith('.html')&&ref!=='../index.html')assert(target.startsWith(path.join(out,'reviewer')+path.sep),'Navigation stays in the selected environment');
  }
  if(file==='index.html'){
   const entry=doc.querySelector('.environment-entry');
   assert.equal(entry.getAttribute('href'),prefix?'../index.html':'reviewer/index.html');
   assert(doc.querySelector('#login-submit').compareDocumentPosition(entry)&4);
   assert(entry.compareDocumentPosition(doc.querySelector('.privacy-links'))&4);
   assert.equal(doc.querySelector('#password').getAttribute('autocomplete'),'current-password');
   assert.equal(doc.querySelectorAll('.reviewer-notice').length,prefix?1:0);
  }
  if(/^ui-(attendance|routes|vehicles|monthly|accounts)\.html$/.test(file)){
   assert.equal(doc.querySelectorAll('.main > .reviewer-notice').length,prefix?1:0,file);
   if(prefix)assert(doc.querySelector('link[href="css/reviewer-environment.css?v=1461"]'));
  }
  dom.window.close();
 }
 for(const name of ['tests','scripts','supabase','docs','config','reviewer-accounts.json'])assert(!fs.existsSync(path.join(out,prefix,name)));
}
// Configuration is loaded late on routes; keep its paths relative too.
assert(read('reviewer/js/ui-routes-entry.js').includes("'js/config.js'"));
assert.equal(read('reviewer/js/login.js'),read('js/login.js'),'Same phone login, validation and role checks');
assert.equal(read('reviewer/js/accounts-1419.js'),read('js/accounts-1419.js'),'Same account management implementation');
assert.equal(read('reviewer/js/dashboard-android-back.js'),read('js/dashboard-android-back.js'));
const style=read('css/reviewer-environment.css');
assert(style.includes('flex:0 0 auto'),'Route flex layout must not shrink the banner');
assert(style.includes('overflow-wrap:anywhere'),'Narrow screens and larger fonts can wrap');
assert(!/position\s*:\s*(fixed|absolute)/.test(style),'Notice does not cover content or navigation');
console.log('Reviewer UI package passed: separate backends/sessions, same app, scoped navigation, all five notices and public assets only.');

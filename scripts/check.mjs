import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
for(const f of fs.readdirSync(path.join(root,'js')).filter(f=>f.endsWith('.js'))){
 const r=spawnSync(process.execPath,['--check',path.join(root,'js',f)],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
}
const out=path.join(root,'dist');
for(const f of fs.readdirSync(out).filter(f=>f.endsWith('.html'))){
 const html=fs.readFileSync(path.join(out,f),'utf8');
 for(const [,ref] of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
  if(/^(?:https?:|data:|#|mailto:|javascript:)/.test(ref))continue;
  const target=ref.split(/[?#]/)[0];if(target)assert.ok(fs.existsSync(path.resolve(out,target)),`${f}: missing ${target}`);
 }
}
for(const name of ['tests','sql','supabase','docs','prototypes','config'])assert.ok(!fs.existsSync(path.join(out,name)),`${name} must not be deployed`);
console.log('Application syntax, deployment asset links and package exclusions passed');

const vendor=JSON.parse(fs.readFileSync(path.join(root,'js/vendor/supabase-manifest.json'),'utf8'));
const sdk=fs.readFileSync(path.join(out,`js/vendor/supabase-${vendor.version}.js`));
assert.equal(createHash('sha256').update(sdk).digest('hex'),vendor.sha256,'Bundled authentication SDK checksum');
for(const f of fs.readdirSync(out).filter(f=>f.endsWith('.html'))){
 assert.ok(!fs.readFileSync(path.join(out,f),'utf8').includes('cdn.jsdelivr.net/npm/@supabase'),'Authentication SDK must be bundled');
}
console.log('Pinned authentication SDK integrity passed');

const fonts=JSON.parse(fs.readFileSync(path.join(root,'assets/fonts/manifest.json'),'utf8'));
for(const prefix of ['', 'reviewer/']){
 for(const font of fonts.fonts){
  const data=fs.readFileSync(path.join(out,prefix,'assets/fonts',font.file));
  assert.equal(data.length,font.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),font.sha256);
 }
 for(const page of fs.readdirSync(path.join(out,prefix)).filter(f=>f.endsWith('.html'))){
  const html=fs.readFileSync(path.join(out,prefix,page),'utf8');
  assert(html.includes('css/typography.css?v=1464'),`${prefix+page}: missing bundled typography`);
  assert(!/fonts\.(googleapis|gstatic)\.com/.test(html),'No remote font dependency');
 }
}
console.log('Bundled font integrity and typography links passed for company/reviewer pages');

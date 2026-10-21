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

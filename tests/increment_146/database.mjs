import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'../..');
import {cases} from './regression_cases.mjs';
const pg=new PGlite();
try{
 await pg.exec(fs.readFileSync(here+'/baseline_fixture.sql','utf8'));console.log('PASS: baseline schema rebuilt in isolated PostgreSQL');
 for(const inc of ['146','147','148','149']){const file=fs.readdirSync(root+'/supabase/migrations').find(f=>f.includes('increment_'+inc+'_'));await pg.exec(fs.readFileSync(root+'/supabase/migrations/'+file,'utf8'));}console.log('PASS: migrations through 148 apply');
 await cases(pg);
}catch(e){console.error(e.message, e.detail||'',e.where||'',e.query?.slice(0,600)||'');process.exitCode=1;}
await pg.close();

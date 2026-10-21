import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const c=JSON.parse(fs.readFileSync(path.join(root,'supabase/schema/catalog-1.4.15.json'),'utf8'));
const q=s=>'"'+s.replaceAll('"','""')+'"';
const target=o=>q(o.schema)+'.'+q(o.name);
const role=s=>s==='PUBLIC'?'PUBLIC':q(s);
const out=['-- Schema only: accepted 1.4.15. No operational data or Auth accounts.',
 '-- Apply only to a NEW empty Supabase project. Do not apply to the existing project.',
 '-- Finance access is disabled until an administrator binds the verified Brian Auth UUID.',
 'BEGIN;','CREATE SCHEMA IF NOT EXISTS private;','SET LOCAL check_function_bodies=off;'];
for(const t of c.tables){
 const columns=t.columns.map(a=>q(a.name)+' '+a.type+(a.identity?' GENERATED '+(a.identity==='a'?'ALWAYS':'BY DEFAULT')+' AS IDENTITY':a.generated?' GENERATED ALWAYS AS ('+a.default+') STORED':a.default?' DEFAULT '+a.default:'')+(a.not_null?' NOT NULL':''));
 out.push('CREATE TABLE '+target(t)+' ('+columns.join(',')+');');
}
for(const f of c.functions)out.push(f.definition+';');
for(const k of [...c.constraints].sort((a,b)=>(a.type==='f')-(b.type==='f')))out.push('ALTER TABLE '+q(k.schema)+'.'+q(k.table)+' ADD CONSTRAINT '+q(k.name)+' '+k.definition+';');
for(const i of c.indexes)out.push(i.definition+';');
for(const t of c.tables){if(t.rls)out.push('ALTER TABLE '+target(t)+' ENABLE ROW LEVEL SECURITY;');if(t.force_rls)out.push('ALTER TABLE '+target(t)+' FORCE ROW LEVEL SECURITY;');}
for(const p of c.policies)out.push('CREATE POLICY '+q(p.policyname)+' ON '+q(p.schemaname)+'.'+q(p.tablename)+' AS '+p.permissive+' FOR '+p.cmd+' TO '+p.roles.map(role).join(',')+(p.qual?' USING ('+p.qual+')':'')+(p.with_check?' WITH CHECK ('+p.with_check+')':'')+';');
for(const t of c.triggers)out.push(t.definition+';');
// Clear platform default grants before restoring the captured ACLs.
for(const t of c.tables)out.push('REVOKE ALL ON '+target(t)+' FROM PUBLIC,anon,authenticated,service_role;');
const seqs=new Map(c.grants.filter(g=>g.kind==='S').map(g=>[target(g),g]));
for(const s of seqs.keys())out.push('REVOKE ALL ON SEQUENCE '+s+' FROM PUBLIC,anon,authenticated,service_role;');
for(const g of c.grants)out.push('GRANT '+g.privilege+' ON '+(g.kind==='S'?'SEQUENCE ':'TABLE ')+target(g)+' TO '+role(g.grantee)+(g.grantable?' WITH GRANT OPTION':'')+';');
for(const f of c.functions){
 const name=target(f)+'('+f.args+')';out.push('REVOKE ALL ON FUNCTION '+name+' FROM PUBLIC,anon,authenticated,service_role;');
 for(const a of f.acl||[])out.push('GRANT '+a.privilege+' ON FUNCTION '+name+' TO '+role(a.grantee)+(a.grantable?' WITH GRANT OPTION':'')+';');
}
for(const s of ['public','private'])out.push('REVOKE ALL ON SCHEMA '+q(s)+' FROM PUBLIC,anon,authenticated,service_role;');
for(const g of c.schema_grants)out.push('GRANT '+g.privilege+' ON SCHEMA '+q(g.schema)+' TO '+role(g.grantee)+';');
out.push('COMMIT;');
fs.writeFileSync(path.join(root,'supabase/schema/1.4.15.sql'),out.join('\n')+'\n');
console.log(`Generated schema: ${c.tables.length} tables, ${c.functions.length} functions, ${c.policies.length} policies`);

import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const pg=new PGlite();
try{
 await pg.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE supabase_admin;CREATE ROLE supabase_auth_admin;CREATE ROLE dashboard_user;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO anon,authenticated;");
 await pg.exec(fs.readFileSync(new URL('../supabase/schema/1.4.15.sql',import.meta.url),'utf8'));
 const n=await pg.query("select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r'");assert.equal(n.rows[0].n,41);
 const f=await pg.query('select private.dashboard146_finance_owner() as owner');assert.equal(f.rows[0].owner,null);
 await pg.exec('SET ROLE anon;');
 await assert.rejects(()=>pg.query("select dashboard_get_calculated_payroll('2026-10-01')"));
 console.log('Portable schema restores 41 tables; finance binding defaults closed; anonymous payroll access denied');
}finally{await pg.close();}

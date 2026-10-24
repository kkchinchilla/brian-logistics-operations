import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const pg=new PGlite();
try{
 await pg.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE supabase_admin;CREATE ROLE supabase_auth_admin;CREATE ROLE dashboard_user;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz);CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,not_after timestamptz);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO anon,authenticated;");
 await pg.exec(fs.readFileSync(new URL('../supabase/schema/1.4.15.sql',import.meta.url),'utf8'));
 // The portable baseline is immutable; apply subsequent migrations exactly once.
 const migrations=new URL('../supabase/migrations/',import.meta.url);
 for(const name of fs.readdirSync(migrations).filter(n=>/_increment_(1416|1418|1419|1421|1424|1431)_/.test(n)).sort())await pg.exec(fs.readFileSync(new URL(name,migrations),'utf8'));
 const body=await pg.query("select prosrc from pg_proc where oid='private.dashboard147_monthly(date)'::regprocedure");assert.ok(body.rows[0].prosrc.includes('pending_reclose'));
 const n=await pg.query("select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r'");assert.equal(n.rows[0].n,43);
 const f=await pg.query('select private.dashboard146_finance_owner() as owner');assert.equal(f.rows[0].owner,null);
 const policy=await pg.query("select qual from pg_policies where tablename='delivery_region_zone_rates' and policyname='drz_select'");assert.ok(policy.rows[0].qual.includes('can_manage_finance'));
 const period=await pg.query("select private.dashboard1418_known_period(null,null,'[)') is null as unknown");assert.equal(period.rows[0].unknown,true);
 await pg.exec('SET ROLE anon;');
 await assert.rejects(()=>pg.query("select dashboard_get_calculated_payroll('2026-10-01')"));
 console.log('Portable schema restores 43 tables; finance binding defaults closed; anonymous payroll access denied');
}finally{await pg.close();}

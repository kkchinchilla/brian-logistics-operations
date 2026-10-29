import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const pg = new PGlite();
const binding = fs.readFileSync(new URL('../supabase/reviewer/migrations/20261029020531_reviewer_bind_accounts.sql', import.meta.url), 'utf8');
try {
  await pg.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE supabase_admin;CREATE ROLE supabase_auth_admin;CREATE ROLE dashboard_user;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,phone text,phone_confirmed_at timestamptz,deleted_at timestamptz,raw_app_meta_data jsonb);CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid,not_after timestamptz);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO anon,authenticated;");
  await pg.exec(fs.readFileSync(new URL('../supabase/schema/1.4.15.sql', import.meta.url), 'utf8'));
  const migrations = new URL('../supabase/migrations/', import.meta.url);
  for (const name of fs.readdirSync(migrations).filter(n => /_increment_(1416|1418|1419|1421|1424|1431|1451)_/.test(n)).sort()) await pg.exec(fs.readFileSync(new URL(name,migrations),'utf8'));
  await assert.rejects(pg.exec(binding), /exactly three/);
  await pg.exec(`INSERT INTO auth.users VALUES
    ('11111111-1111-4111-8111-111111111111','12025550101',now(),null,'{"review_role":"owner","review_bootstrap":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}'),
    ('22222222-2222-4222-8222-222222222222','12025550102',now(),null,'{"review_role":"supervisor","review_bootstrap":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}'),
    ('33333333-3333-4333-8333-333333333333','12025550103',now(),null,'{"review_role":"driver","review_bootstrap":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}');`);
  await assert.rejects(pg.exec(binding), /one confirmed bootstrap batch/);
  assert.equal((await pg.query('select private.dashboard146_finance_owner() as owner')).rows[0].owner, null);
  await pg.exec(`UPDATE auth.users SET raw_app_meta_data=jsonb_set(raw_app_meta_data,'{review_bootstrap}','"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"');`);
  await pg.exec(binding);
  const profiles = (await pg.query('select display_name,role,active,can_manage_finance from public.profiles order by id')).rows;
  assert.deepEqual(profiles.map(p => [p.role,p.active,p.can_manage_finance]), [['dispatcher',true,true],['dispatcher',true,false],['driver',true,false]]);
  assert.equal((await pg.query('select private.dashboard146_finance_owner() as owner')).rows[0].owner, '11111111-1111-4111-8111-111111111111');
  await assert.rejects(pg.exec(binding), /unbound empty/);
  await assert.rejects(pg.exec("update public.profiles set can_manage_finance=true where role='driver'"), /月度報表僅限/);
  for (const [id, expected] of [['11111111-1111-4111-8111-111111111111',true],['22222222-2222-4222-8222-222222222222',false],['33333333-3333-4333-8333-333333333333',false]]) {
    await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
    await pg.exec('SET ROLE authenticated');
    assert.equal((await pg.query('select public.dashboard_get_capabilities() as c')).rows[0].c.can_manage_finance, expected);
    await assert.rejects(pg.query('select public.dashboard_account_admin_context()'), /登入已失效|帳號管理僅限/);
    await pg.exec('RESET ROLE');
  }
  await pg.exec('SET ROLE anon');
  await assert.rejects(pg.query('select public.dashboard_get_capabilities()'));
  console.log('Reviewer role binding passed: guarded bootstrap, fixed owner, role boundaries, escalation/replay denied, live session still required.');
} finally { await pg.close(); }

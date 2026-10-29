import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createReviewAccounts, PROJECT } from '../scripts/create-review-accounts.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-bootstrap-'));
const key = 'sb_secret_' + 'x'.repeat(40);
function harness(name) {
  const file = path.join(root, name, 'reviewer-accounts.json');
  const h = { file, users: [], calls: [], logs: [], timeoutAfterCreate: false, status: 200 };
  h.run = () => createReviewAccounts({ key, file, log: line => h.logs.push(line), fetchImpl: async (url, options) => {
    assert.equal(new URL(url).origin, `https://${PROJECT}.supabase.co`);
    assert.equal(options.headers.apikey, key);
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.redirect, 'error');
    h.calls.push(options.method);
    if (h.status !== 200) return { ok: false, status: h.status, json: async () => { throw new Error('Must not inspect failed response secrets'); } };
    if (options.method === 'GET') return { ok: true, json: async () => ({ users: structuredClone(h.users) }) };
    assert.equal(options.method, 'POST');
    assert.equal(new URL(url).pathname, '/auth/v1/admin/users');
    const body = JSON.parse(options.body);
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(state.accounts.find(a => a.phone === body.phone).password, body.password, 'Password must already be durably saved');
    assert.equal(body.phone_confirm, true);
    assert.equal(body.email, undefined);
    assert.equal(Object.hasOwn(body.app_metadata, 'can_manage_finance'), false);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);
    const user = { id: randomUUID(), phone: body.phone.slice(1), phone_confirmed_at: new Date().toISOString(), app_metadata: body.app_metadata };
    h.users.push(user);
    if (h.timeoutAfterCreate) { h.timeoutAfterCreate = false; throw new Error('Network failure after server committed'); }
    return { ok: true, json: async () => user };
  } });
  return h;
}

try {
  const fresh = harness('fresh');
  await fresh.run();
  const saved = fs.readFileSync(fresh.file, 'utf8');
  assert.equal(fresh.users.length, 3);
  assert.equal(fresh.calls.filter(x => x === 'POST').length, 3);
  assert(!saved.includes(key));
  assert(!fresh.logs.join('\n').includes(key));
  const state = JSON.parse(saved);
  for (const account of state.accounts) assert(!fresh.logs.join('\n').includes(account.password));
  await fresh.run();
  assert.equal(fresh.calls.filter(x => x === 'POST').length, 3, 'Rerun must not recreate/reset users');
  assert.equal(fs.readFileSync(fresh.file, 'utf8'), saved);

  const partial = harness('partial');
  partial.timeoutAfterCreate = true;
  await assert.rejects(partial.run(), /network error or timeout/);
  assert.equal(partial.users.length, 1);
  const originalPasswords = JSON.parse(fs.readFileSync(partial.file, 'utf8')).accounts.map(a => a.password);
  await partial.run();
  assert.equal(partial.users.length, 3);
  assert.equal(partial.calls.filter(x => x === 'POST').length, 3);
  assert.deepEqual(JSON.parse(fs.readFileSync(partial.file, 'utf8')).accounts.map(a => a.password), originalPasswords);

  const occupied = harness('occupied');
  occupied.users = [{ id: randomUUID(), phone: '12025550101' }];
  await assert.rejects(occupied.run(), /already has accounts/);
  assert.deepEqual(occupied.calls, ['GET']);
  assert(!fs.existsSync(occupied.file));

  fresh.users[0].app_metadata.review_bootstrap = randomUUID();
  const postCount = fresh.calls.filter(x => x === 'POST').length;
  await assert.rejects(fresh.run(), /do not match/);
  assert.equal(fresh.calls.filter(x => x === 'POST').length, postCount);

  const denied = harness('denied');
  denied.status = 401;
  await assert.rejects(denied.run(), /^Error: GET: HTTP 401/);
  assert(!fs.existsSync(denied.file));
  await assert.rejects(createReviewAccounts({ key: 'sbp_wrong', file: denied.file }), /No complete project secret key/);

  const link = harness('symlink');
  fs.mkdirSync(path.dirname(link.file));
  const target = path.join(root, 'unrelated.json');
  fs.writeFileSync(target, 'keep');
  fs.symlinkSync(target, link.file);
  await assert.rejects(link.run(), /regular file/);
  assert.equal(fs.readFileSync(target, 'utf8'), 'keep');
  assert.deepEqual(link.calls, []);
  console.log('Reviewer bootstrap passed: fixed project, private credentials, recovery, no credential logging, account mismatch and failure guards.');
} finally { fs.rmSync(root, { recursive: true, force: true }); }

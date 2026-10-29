// Private operator check. Passwords stay in the Mac's existing credentials file.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { PROJECT } from './create-review-accounts.mjs';

const BASE = `https://${PROJECT}.supabase.co`;
// Public client key, intentionally NOT a secret/service-role key.
const PUBLIC_KEY = 'sb_publishable_VFhyCnpVRaLk2_pryTAIlQ_74gwx22F';
const ROLES = ['owner', 'supervisor', 'driver'];
const LABELS = ['審查管理員', '審查主管', '審查司機'];
class CheckError extends Error {}
const stop = message => { throw new CheckError(message); };

export async function checkReviewAccess(state, { fetchImpl = fetch, log = console.log } = {}) {
  if (state?.project !== PROJECT || !Array.isArray(state.accounts) || state.accounts.length !== 3 ||
      state.accounts.some((a,i) => a.role !== ROLES[i] || a.phone !== `+1202555010${i+1}` ||
        typeof a.password !== 'string' || a.password.length < 8 ||
        !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(a.id || ''))) stop('The private credentials file is incomplete or belongs to another project.');

  async function request(endpoint, { method = 'POST', token, body } = {}) {
    let response;
    try {
      response = await fetchImpl(BASE + endpoint, {
        method, headers: { apikey: PUBLIC_KEY, 'Content-Type': 'application/json',
          Origin: 'https://localhost', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'error', signal: AbortSignal.timeout(20000)
      });
    } catch { stop('Connection failed or timed out. No private values were printed.'); }
    let data = null;
    if (response.status !== 204) {
      try { data = await response.json(); }
      catch { stop(`Unexpected response format (HTTP ${response.status}).`); }
    }
    return { status: response.status, data };
  }
  function expect(result, statuses, label) {
    if (!statuses.includes(result.status)) stop(`${label}: unexpected HTTP ${result.status}.`);
    return result.data;
  }
  expect(await request('/functions/v1/account-admin', { body: { action: 'list' } }), [401], 'Anonymous account access');
  expect(await request('/rest/v1/rpc/dashboard_get_capabilities', { body: {} }), [401,403], 'Anonymous permissions access');

  for (const [i, account] of state.accounts.entries()) {
    let token;
    try {
      const signedIn = expect(await request('/auth/v1/token?grant_type=password', {
        body: { phone: account.phone, password: account.password }
      }), [200], `${LABELS[i]} login`);
      token = signedIn.access_token;
      if (typeof token !== 'string' || !token || signedIn.user?.id !== account.id) stop(`${LABELS[i]}: login identity mismatch.`);
      const profile = expect(await request(`/rest/v1/profiles?id=eq.${account.id}&select=id,role,active,can_manage_finance`, { method: 'GET', token }), [200], `${LABELS[i]} profile`);
      const owner = account.role === 'owner';
      if (!Array.isArray(profile) || profile.length !== 1 || profile[0].id !== account.id ||
          profile[0].role !== (account.role === 'driver' ? 'driver' : 'dispatcher') ||
          profile[0].active !== true || profile[0].can_manage_finance !== owner) stop(`${LABELS[i]}: profile permissions mismatch.`);
      const caps = expect(await request('/rest/v1/rpc/dashboard_get_capabilities', { token, body: {} }), [200], `${LABELS[i]} capabilities`);
      if (caps?.can_manage_finance !== owner) stop(`${LABELS[i]}: finance permission mismatch.`);
      const context = expect(await request('/rest/v1/rpc/dashboard_account_admin_context', { token, body: {} }), [owner ? 200 : 403], `${LABELS[i]} account permissions`);
      if (owner && context?.actor_id !== account.id) stop('Administrator live-session identity mismatch.');
      const directory = expect(await request('/functions/v1/account-admin', { token, body: { action: 'list' } }), [owner ? 200 : 403], `${LABELS[i]} account management`);
      if (owner && (directory?.actor_id !== account.id || !Array.isArray(directory.users) || directory.users.length !== 3 ||
          state.accounts.some(a => !directory.users.some(u => u.id === a.id && u.active && !u.deleted && u.is_owner === (a.role === 'owner'))))) stop('Administrator account directory mismatch.');
    } finally {
      if (token) expect(await request('/auth/v1/logout?scope=local', { token }), [204], `${LABELS[i]} test-session logout`);
    }
    log(`${LABELS[i]}: login and role permissions passed`);
  }
  log('Verified: all 3 reviewer logins and account-management permissions passed.');
  log('Test sessions signed out. Passwords and keys were not printed.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  (async () => {
    if (process.argv.length > 2) stop('This command takes no arguments.');
    const file = path.join(os.homedir(), 'huoyitong-review-private', 'reviewer-accounts.json');
    let state;
    try { state = JSON.parse(fs.readFileSync(file,'utf8')); }
    catch { stop('Cannot read the private reviewer credentials file on this computer.'); }
    await checkReviewAccess(state);
  })().catch(error => {
    console.error(error instanceof CheckError ? error.message : 'Review access check stopped. No private values were printed.');
    process.exitCode = 1;
  });
}

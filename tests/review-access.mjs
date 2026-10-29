import assert from 'node:assert/strict';
import { checkReviewAccess } from '../scripts/check-review-access.mjs';
import { PROJECT } from '../scripts/create-review-accounts.mjs';
const state = { project: PROJECT, accounts: ['owner','supervisor','driver'].map((role,i) => ({ role, phone: `+1202555010${i+1}`, password: `private-password-${i}`, id: `${i+1}1111111-1111-4111-8111-111111111111` })) };
function harness(leak = false) {
  const logs = [], signedOut = [];
  const result = (status,data) => ({ status, json: async () => data });
  const fetchImpl = async (url, opts) => {
    assert.equal(new URL(url).origin, `https://${PROJECT}.supabase.co`);
    assert(opts.headers.apikey.startsWith('sb_publishable_'));
    assert.equal(opts.redirect,'error');
    const token = opts.headers.Authorization?.replace('Bearer ','');
    const i = token ? Number(token.split('-').at(-1)) : -1;
    const account = state.accounts[i];
    if (url.includes('/token?')) {
      const body = JSON.parse(opts.body);
      const n = state.accounts.findIndex(a => a.phone === body.phone && a.password === body.password);
      assert(n >= 0);
      return result(200,{access_token:`private-token-${n}`,user:{id:state.accounts[n].id}});
    }
    if (url.includes('/logout?')) { assert(url.endsWith('scope=local'));signedOut.push(i);return result(204); }
    if (!token) return result(401,{});
    if (url.includes('/profiles?')) return result(200,[{id:account.id,role:i===2?'driver':'dispatcher',active:true,can_manage_finance:i===0}]);
    if (url.endsWith('/dashboard_get_capabilities')) return result(200,{can_manage_finance: leak || i===0});
    if (url.endsWith('/dashboard_account_admin_context')) return result(i===0?200:403,{actor_id:account.id});
    assert(url.endsWith('/functions/v1/account-admin'));
    assert.deepEqual(JSON.parse(opts.body),{action:'list'});
    return result(i===0?200:403,{actor_id:account.id,users:state.accounts.map((a,j)=>({id:a.id,active:true,deleted:false,is_owner:j===0}))});
  };
  return { logs,signedOut,options:{fetchImpl,log:s=>logs.push(s)} };
}
const good = harness();
await checkReviewAccess(state,good.options);
assert.deepEqual(good.signedOut,[0,1,2]);
assert(!good.logs.join('\n').includes('private-'));
const leak = harness(true);
await assert.rejects(checkReviewAccess(state,leak.options),/finance permission mismatch/);
assert.deepEqual(leak.signedOut,[0,1], 'Even a failed permission check must log out its session');
await assert.rejects(checkReviewAccess({...state,project:'operational'},good.options),/another project/);
console.log('Reviewer access check passed: fixed project, role denials, no credential logging and local session cleanup.');

// Operator-only bootstrap. Never included in the web/Android build.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const PROJECT = 'vfnpgecoewtyyzukizgu';
const BASE = `https://${PROJECT}.supabase.co/auth/v1`;
const ACCOUNTS = [
  { role: 'owner', name: '審查管理員', phone: '+12025550101' },
  { role: 'supervisor', name: '審查主管', phone: '+12025550102' },
  { role: 'driver', name: '審查司機', phone: '+12025550103' }
];
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const phone = value => String(value || '').replace(/^\+/, '');
class SetupError extends Error {}
const stop = message => { throw new SetupError(message); };

function validateState(state) {
  if (state?.project !== PROJECT || state.version !== 1 || !uuid(state.batch) ||
      !Array.isArray(state.accounts) || state.accounts.length !== 3) stop('Private credentials file is not recognized. No accounts changed.');
  for (const [i, account] of state.accounts.entries()) {
    const expected = ACCOUNTS[i];
    if (account.role !== expected.role || account.name !== expected.name || account.phone !== expected.phone ||
        typeof account.password !== 'string' || !/^aA1![A-Za-z0-9_-]{24}$/.test(account.password) ||
        (account.id !== null && !uuid(account.id))) stop('Private credentials file is not recognized. No accounts changed.');
  }
}

function prepareDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (!fs.lstatSync(directory).isDirectory() || fs.lstatSync(directory).isSymbolicLink()) stop('Private credentials directory must not be a symbolic link.');
  fs.chmodSync(directory, 0o700);
}

function saveState(file, state) {
  // Atomic replacement leaves the previous complete file intact if writing fails.
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try {
      fs.writeFileSync(fd, JSON.stringify(state, null, 2) + '\n');
      fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
    fs.renameSync(temporary, file);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

export async function createReviewAccounts({ key, file, fetchImpl = fetch, log = console.log }) {
  if (typeof key !== 'string' || !key.startsWith('sb_secret_') || key.length < 30 || /\s/.test(key)) stop('No complete project secret key found in the clipboard. Nothing changed.');
  prepareDirectory(path.dirname(file));
  let state;
  if (fs.existsSync(file) || (() => { try { return fs.lstatSync(file).isSymbolicLink(); } catch { return false; } })()) {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) stop('Private credentials file must be a regular file.');
    fs.chmodSync(file, 0o600);
    try { state = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { stop('Cannot read the private credentials file. Keep it for recovery.'); }
    validateState(state);
  }

  async function request(method, endpoint, body) {
    let response;
    try {
      response = await fetchImpl(BASE + endpoint, {
        method, headers: { apikey: key, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'error', signal: AbortSignal.timeout(20000)
      });
    } catch { stop(`${method}: network error or timeout. Keep the private file and rerun this command to resume.`); }
    if (!response.ok) stop(`${method}: HTTP ${response.status}. Keep the private file; no passwords were printed.`);
    try { return await response.json(); }
    catch { stop('Unexpected server response. Keep the private file and check account status before continuing.'); }
  }
  async function listUsers() {
    const result = await request('GET', '/admin/users?page=1&per_page=1000');
    if (!Array.isArray(result.users) || result.users.length > 3 || Number(result.total || 0) > 3) stop('Unexpected account inventory. No existing accounts will be changed.');
    return result.users;
  }
  function matches(user, account) {
    return uuid(user.id) && !user.deleted_at && phone(user.phone) === phone(account.phone) &&
      user.app_metadata?.review_bootstrap === state.batch && user.app_metadata?.review_role === account.role &&
      (!account.id || user.id === account.id) && Boolean(user.phone_confirmed_at);
  }
  const existing = await listUsers();
  if (!state) {
    if (existing.length) stop('This project already has accounts, but the private credentials file is missing. Nothing changed.');
    state = {
      version: 1, project: PROJECT, batch: randomUUID(),
      note: 'PRIVATE. Fictional reviewer credentials. Application roles are configured separately. Never commit or upload this file.',
      accounts: ACCOUNTS.map(account => ({ ...account, password: 'aA1!' + randomBytes(18).toString('base64url'), id: null }))
    };
    // Persist every password BEFORE making any account-creation request.
    saveState(file, state);
  }
  const uniquePhones = new Set(existing.map(user => phone(user.phone)));
  if (uniquePhones.size !== existing.length || existing.some(user => !state.accounts.some(account => matches(user, account)))) stop('Existing accounts do not match this private setup file. Nothing changed.');
  if (state.accounts.some(account => account.id && !existing.some(user => matches(user, account)))) stop('A previously created account is missing or changed. No accounts changed.');

  for (const account of state.accounts) {
    let user = existing.find(user => matches(user, account));
    if (!user) {
      const result = await request('POST', '/admin/users', {
        phone: account.phone, password: account.password, phone_confirm: true,
        app_metadata: { review_bootstrap: state.batch, review_role: account.role }
      });
      user = result.user || result;
      if (!matches(user, account)) stop('Created account needs inspection. Keep the private credentials file.');
    }
    account.id = user.id;
    saveState(file, state);
    log(`${account.name}: Auth account ready`);
  }
  const verified = await listUsers();
  if (verified.length !== 3 || state.accounts.some(account => !verified.some(user => matches(user, account)))) stop('Final account verification did not match. Keep the private credentials file.');
  log('Verified: 3 reviewer Auth accounts. Application permissions are the next step.');
  log(`Private credentials saved to: ${file}`);
  log('Do not paste or upload the credentials file.');
}

async function main() {
  if (process.platform !== 'darwin') stop('Run this operator setup on your Mac.');
  if (process.argv.length > 2) stop('This command takes no arguments; its reviewer project is fixed.');
  console.log('Target: huoyitong-review (reviewer accounts only).');
  console.log('Copy the review_account_setup SECRET KEY now, then return here and press Enter. Do not paste it.');
  const tty = fs.openSync('/dev/tty', 'r');
  try {
    const byte = Buffer.alloc(1);
    while (fs.readSync(tty, byte, 0, 1, null) && byte[0] !== 10) {}
  } finally { fs.closeSync(tty); }
  const key = execFileSync('/usr/bin/pbpaste', { encoding: 'utf8' }).trim();
  if (!key.startsWith('sb_secret_') || key.length < 30 || /\s/.test(key)) stop('No complete project secret key found in the clipboard. Nothing changed.');
  execFileSync('/usr/bin/pbcopy', { input: '' });
  const file = path.join(os.homedir(), 'huoyitong-review-private', 'reviewer-accounts.json');
  await createReviewAccounts({ key, file });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof SetupError ? error.message : 'Setup stopped. Keep the private credentials file for recovery; no secret values were printed.');
    process.exitCode = 1;
  });
}

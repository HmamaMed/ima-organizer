import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/shared/auth/sessionManager.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } });
const { SessionManager } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const credentials = (version = 1) => ({ token: `access-${version}`, refreshToken: `refresh-${version}`, user: { userId: 'camille', locale: 'en' } });
const unauthorized = () => Object.assign(new Error('Session expired'), { status: 401 });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture(saved = null) {
  const disk = { token: saved, signedOut: false };
  const calls = { refresh: [], logout: [] };
  const persistence = {
    async read() { return { token: disk.token, restore: !!disk.token }; },
    async write(token) { disk.token = token; disk.signedOut = false; },
    async clear() { disk.token = null; disk.signedOut = true; },
  };
  const transport = {
    async login() { return credentials(); },
    async refresh(token) { calls.refresh.push(token); return credentials(2); },
    async logout(token) { calls.logout.push(token); },
  };
  return { disk, calls, persistence, transport, manager: new SessionManager(persistence, transport) };
}
test('login saves only a refresh token; a new process restores and persists its rotation', async () => {
  const f = fixture(); await f.manager.start();
  assert.equal(f.calls.refresh.length, 0);
  await f.manager.login('camille@example.test', 'password');
  assert.equal(f.disk.token, 'refresh-1');
  const restarted = new SessionManager(f.persistence, f.transport);
  await restarted.start();
  assert.deepEqual(f.calls.refresh, ['refresh-1']);
  assert.equal(restarted.getSnapshot().credentials.token, 'access-2');
  assert.equal(f.disk.token, 'refresh-2');
});
test('StrictMode-style repeated starts and concurrent 401 responses rotate only once', async () => {
  const f = fixture('refresh-1');
  const left = f.manager.start(), right = f.manager.start();
  assert.equal(left, right); await Promise.all([left, right]);
  f.calls.refresh.length = 0;
  f.transport.refresh = async token => { f.calls.refresh.push(token); return credentials(3); };
  const [a, b] = await Promise.all([f.manager.recover('access-2'), f.manager.recover('access-2')]);
  assert.equal(a, 'access-3'); assert.equal(b, a);
  assert.deepEqual(f.calls.refresh, ['refresh-2']);
  assert.equal(await f.manager.recover('access-2'), 'access-3');
  assert.equal(await f.manager.recover('another-account-token'), null);
});
test('offline startup keeps the saved token and supports retry without showing authenticated content', async () => {
  const f = fixture('refresh-1');
  f.transport.refresh = async () => { throw new TypeError('Failed to fetch'); };
  await f.manager.start();
  assert.deepEqual(f.manager.getSnapshot(), { credentials: null, status: 'unavailable' });
  assert.equal(f.disk.token, 'refresh-1');
  f.transport.refresh = async () => credentials(2);
  await f.manager.restore();
  assert.equal(f.manager.getSnapshot().credentials.token, 'access-2');
});
test('revoked or expired sessions erase saved credentials; transient renewal failures do not', async () => {
  const f = fixture('refresh-1'); await f.manager.start();
  f.transport.refresh = async () => { throw Object.assign(new Error('Unavailable'), { status: 503 }); };
  await assert.rejects(f.manager.recover('access-2'));
  assert.equal(f.disk.token, 'refresh-2');
  assert.equal(f.manager.getSnapshot().credentials.token, 'access-2');
  f.transport.refresh = async () => { throw unauthorized(); };
  await assert.rejects(f.manager.recover('access-2'));
  assert.equal(f.disk.token, null);
  assert.equal(f.manager.getSnapshot().credentials, null);
  const expired = fixture('refresh-expired'); expired.transport.refresh = async () => { throw unauthorized(); };
  await expired.manager.start();
  assert.equal(expired.manager.getSnapshot().status, 'ready');
  assert.equal(expired.disk.token, null);
});
test('logout during rotation revokes the newest token and cannot resurrect the disk session', async () => {
  const f = fixture(); await f.manager.login('camille@example.test', 'password');
  const started = deferred(), response = deferred();
  f.transport.refresh = async () => { started.resolve(); return response.promise; };
  const renewal = f.manager.recover('access-1'); await started.promise;
  const logout = f.manager.logout();
  assert.equal(f.manager.getSnapshot().credentials, null);
  response.resolve(credentials(2));
  assert.equal(await renewal, null); await logout;
  assert.equal(f.disk.token, null);
  assert.deepEqual(f.calls.logout, ['refresh-2']);
});
test('logout during startup prevents a late restore from signing the user back in', async () => {
  const f = fixture('refresh-1'), started = deferred(), response = deferred();
  f.transport.refresh = async () => { started.resolve(); return response.promise; };
  const restore = f.manager.start(); await started.promise;
  const logout = f.manager.logout(); response.resolve(credentials(2));
  await Promise.all([restore, logout]);
  assert.deepEqual(f.manager.getSnapshot(), { credentials: null, status: 'ready' });
  assert.equal(f.disk.token, null); assert.deepEqual(f.calls.logout, ['refresh-2']);
});
test('browser cookie transport restores without a JS token and preserves an offline sign-out marker', async () => {
  const f = fixture();
  f.persistence.read = async () => ({ token: null, restore: !f.disk.signedOut });
  f.transport.refresh = async token => { f.calls.refresh.push(token); return { ...credentials(2), refreshToken: null }; };
  await f.manager.start();
  assert.deepEqual(f.calls.refresh, [null]);
  assert.equal(f.manager.getSnapshot().credentials.refreshToken, null);
  f.transport.logout = async () => { throw new TypeError('Offline'); };
  await f.manager.logout();
  const restarted = new SessionManager(f.persistence, f.transport); await restarted.start();
  assert.equal(restarted.getSnapshot().credentials, null);
  assert.equal(f.calls.refresh.length, 1);
});
test('a failed disk write after rotation clears the old token and revokes the new server session', async () => {
  const f = fixture('refresh-1');
  f.persistence.write = async () => { throw new Error('Disk full'); };
  await f.manager.start();
  assert.equal(f.disk.token, null);
  assert.equal(f.manager.getSnapshot().credentials, null);
  assert.deepEqual(f.calls.logout, ['refresh-2']);
});
test('a storage failure cannot leave a revoked account visible or prevent server-side logout', async () => {
  const f = fixture(); await f.manager.login('camille@example.test', 'password');
  f.persistence.clear = async () => { throw new Error('Storage unavailable'); };
  await assert.rejects(f.manager.logout());
  assert.equal(f.manager.getSnapshot().credentials, null);
  assert.deepEqual(f.calls.logout, ['refresh-1']);
  const expired = fixture('refresh-expired');
  expired.transport.refresh = async () => { throw unauthorized(); };
  expired.persistence.clear = f.persistence.clear;
  await expired.manager.start();
  assert.deepEqual(expired.manager.getSnapshot(), { credentials: null, status: 'unavailable' });
});

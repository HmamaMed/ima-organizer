import { Capacitor, registerPlugin } from '@capacitor/core';
import { apiRequest } from '../api/client';
import { SessionManager, type SessionPersistence } from './sessionManager';
import type { Credentials } from '../../couples/sessionContext';

interface SessionVault {
  read(): Promise<{ token?: string }>;
  write(options: { token: string }): Promise<void>;
  clear(): Promise<void>;
}
const vault = registerPlugin<SessionVault>('SessionVault');
const SIGNED_OUT = 'between-us.signed-out';

export function createPersistentSession() {
  const native = Capacitor.isNativePlatform();
  const persistence: SessionPersistence = native ? {
    async read() { const { token } = await vault.read(); return { token: token ?? null, restore: !!token }; },
    async write(token) { if (!token) throw new Error('Missing refresh token'); await vault.write({ token }); },
    async clear() { await vault.clear(); },
  } : {
    async read() { return { token: null, restore: localStorage.getItem(SIGNED_OUT) !== '1' }; },
    async write() { localStorage.removeItem(SIGNED_OUT); },
    async clear() { localStorage.setItem(SIGNED_OUT, '1'); },
  };
  // Serialize cookie rotation between browser tabs. The cookie is read by fetch inside the lock.
  const request = <T>(path: string, body?: unknown): Promise<T> => {
    const send = () => apiRequest<T>(path, {
      method: 'POST', body, credentials: native ? 'omit' : 'include',
      headers: native ? {} : { 'X-Session-Transport': 'cookie' },
      signal: AbortSignal.timeout(20_000),
    });
    return !native && navigator.locks ? navigator.locks.request('between-us-session', send) : send();
  };
  return new SessionManager(persistence, {
    login: (email, password) => request<Credentials>('/api/identity/login', { email, password, deviceName: 'Between Us' }),
    refresh: token => request<Credentials>('/api/identity/refresh', native ? { token } : undefined),
    logout: token => request<void>('/api/identity/end-session', native && token ? { token } : undefined),
  });
}

export function watchSessionSignOut(manager: SessionManager) {
  if (Capacitor.isNativePlatform()) return () => {};
  const changed = (event: StorageEvent) => {
    if (event.key === SIGNED_OUT && event.newValue === '1') void manager.logout().catch(() => {});
  };
  window.addEventListener('storage', changed);
  return () => window.removeEventListener('storage', changed);
}

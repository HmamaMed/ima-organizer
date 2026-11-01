import { t, useI18n, getLanguage, hasLanguagePreference, setLanguage } from "../shared/i18n";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { apiRequest, setAuthenticationRecovery, setCoupleScopeProvider, setUnauthorizedHandler, setScopeChangeHandler } from '../shared/api/client';
import { AuthSessionProvider } from '../shared/auth/AuthContext';
import { createPersistentSession, watchSessionSignOut } from '../shared/auth/persistentSession';

import { Context, type Account, type AccessConfiguration, type Session, type Space } from './sessionContext';
export function CouplesSession({ children }: { children: ReactNode }) {
  const { language } = useI18n();
  const [manager] = useState(createPersistentSession);
  const { credentials, status } = useSyncExternalStore(manager.subscribe, manager.getSnapshot);
  const current = useMemo(() => ({ get current() { return manager.getSnapshot().credentials; } }), [manager]);
  const [space, setSpace] = useState<Space | null>(null);
  const scope = useRef<string | null>(null);
  const generation = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [access, setAccess] = useState<AccessConfiguration>({ emailEnabled: false, registrationEnabled: false });
  useEffect(() => { void apiRequest<AccessConfiguration>('/api/identity/config').then(setAccess).catch(() => {}); }, []);
  const login = useCallback(async (email: string, password: string) => {
    generation.current++; scope.current = null; setSpace(null);
    await manager.login(email, password);
    const locale = current.current?.user.locale;
    if (!hasLanguagePreference() && (locale === 'fr' || locale === 'en')) setLanguage(locale);
  }, [current, manager]);
  const logout = useCallback(async () => {
    generation.current++; scope.current = null; setSpace(null); setError(''); setLoading(false);
    await manager.logout();
  }, [manager]);
  const refreshState = useCallback(async () => {
    const active = current.current;
    if (!active) return;
    const version = generation.current; setLoading(true); setError('');
    try {
      const [user, nextSpace] = await Promise.all([
        apiRequest<Account>('/api/identity/me', { token: active.token }),
        apiRequest<Space>('/api/couples/current', { token: active.token }),
      ]);
      if (generation.current !== version || !current.current) return;
      manager.updateUser(user);
      scope.current = nextSpace.coupleId; setSpace(nextSpace);
    } catch { if (generation.current === version) setError(t("Impossible de retrouver votre espace. Réessayez.")); }
    finally { if (generation.current === version) setLoading(false); }
  }, [current, manager]);
  useEffect(() => {
    setCoupleScopeProvider(() => scope.current);
    setScopeChangeHandler(() => { void refreshState(); });
    setUnauthorizedHandler(manager.invalidate);
    setAuthenticationRecovery(manager.recover);
    return () => { setAuthenticationRecovery(null); setCoupleScopeProvider(null); setUnauthorizedHandler(null); setScopeChangeHandler(null); };
  }, [manager, refreshState]);
  useEffect(() => { void manager.start(); }, [manager]);
  useEffect(() => watchSessionSignOut(manager), [manager]);
  const userId = credentials?.user.userId;
  useEffect(() => { if (!userId) { scope.current = null; setSpace(null); setError(''); setLoading(false); } }, [userId]);
  useEffect(() => {
    const locale = credentials?.user.locale;
    if (!hasLanguagePreference() && (locale === 'fr' || locale === 'en')) setLanguage(locale);
  }, [credentials?.user.locale]);
  const syncingLanguage = useRef(false);
  useEffect(() => {
    if (syncingLanguage.current || !current.current || current.current.user.locale === language) return;
    syncingLanguage.current = true;
    const version = generation.current;
    void (async () => {
      try {
        // Serialize rapid flag changes, updating only the language and preserving account settings.
        while (current.current && generation.current === version && current.current.user.locale !== getLanguage()) {
          const account = await apiRequest<Account>('/api/identity/language', { token: current.current.token, method: 'PATCH', body: { locale: getLanguage() } });
          if (!current.current || generation.current !== version) return;
          manager.updateUser(account);
        }
      } catch { /* The local language remains available offline; the next account refresh retries. */ }
      finally { syncingLanguage.current = false; }
    })();
  }, [language, credentials, current, manager]);
  useEffect(() => { if (userId) void refreshState(); }, [userId, refreshState]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void refreshState(); };
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [refreshState]);
  const value = useMemo<Session>(() => ({ token: credentials?.token ?? null, user: credentials?.user ?? null, space, loading, error, access, login, logout, refreshState, restoring: status === 'restoring', restoreFailed: status === 'unavailable', retryRestore: manager.restore }), [credentials, space, loading, error, access, login, logout, refreshState, status, manager]);
  const legacy = useMemo(() => ({ token: value.token, user: value.user ? { userId: value.user.userId, name: value.user.name, timeZone: value.user.timeZone, role: 'MEMBER' as const } : null, isAuthenticated: !!value.token, login, logout: () => { void logout(); } }), [value.token, value.user, login, logout]);
  return <Context.Provider value={value}><AuthSessionProvider value={legacy}>{children}</AuthSessionProvider></Context.Provider>;
}

import { t, useI18n, getLanguage, hasLanguagePreference, setLanguage } from "../shared/i18n";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, apiRequest, setAuthenticationRecovery, setCoupleScopeProvider, setUnauthorizedHandler, setScopeChangeHandler } from '../shared/api/client';
import { AuthSessionProvider } from '../shared/auth/AuthContext';

import { Context, type Account, type AccessConfiguration, type Credentials, type Session, type Space } from './sessionContext';
/** Credentials stay in memory. Restarting the app requires login until a Keystore-backed integration is shipped. */
export function CouplesSession({ children }: { children: ReactNode }) {
  const { language } = useI18n();
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const current = useRef<Credentials | null>(null);
  const [space, setSpace] = useState<Space | null>(null);
  const scope = useRef<string | null>(null);
  const previousTokens = useRef(new Set<string>());
  const renewing = useRef<Promise<string | null> | null>(null);
  const generation = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [access, setAccess] = useState<AccessConfiguration>({ emailEnabled: false, registrationEnabled: false });
  useEffect(() => { void apiRequest<AccessConfiguration>('/api/identity/config').then(setAccess).catch(() => {}); }, []);
  const clear = useCallback(() => {
    generation.current++; current.current = null; scope.current = null; previousTokens.current.clear();
    setCredentials(null); setSpace(null); setError(''); setLoading(false);
  }, []);
  const login = useCallback(async (email: string, password: string) => {
    const response = await apiRequest<Credentials>('/api/identity/login', { method: 'POST', body: { email, password, deviceName: 'Entre Nous' } });
    if (!hasLanguagePreference() && (response.user.locale === 'fr' || response.user.locale === 'en')) setLanguage(response.user.locale);
    generation.current++; previousTokens.current.clear(); scope.current = null; setSpace(null);
    current.current = response; setCredentials(response);
  }, []);
  const logout = useCallback(async () => {
    const old = current.current; clear();
    if (old) await apiRequest('/api/identity/logout', { method: 'POST', token: old.token }).catch(() => {});
  }, [clear]);
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
      current.current = { ...current.current, user }; setCredentials(current.current);
      scope.current = nextSpace.coupleId; setSpace(nextSpace);
    } catch { if (generation.current === version) setError(t("Impossible de retrouver votre espace. Réessayez.")); }
    finally { if (generation.current === version) setLoading(false); }
  }, []);
  useEffect(() => {
    setCoupleScopeProvider(() => scope.current);
    setScopeChangeHandler(() => { void refreshState(); });
    setUnauthorizedHandler(expired => { if (expired && (current.current?.token === expired || previousTokens.current.has(expired))) clear(); });
    setAuthenticationRecovery(async usedToken => {
      const active = current.current;
      if (!active) return null;
      if (usedToken !== active.token) return previousTokens.current.has(usedToken) ? active.token : null;
      if (renewing.current) return renewing.current;
      const version = generation.current;
      renewing.current = (async () => {
        try {
          const next = await apiRequest<Credentials>('/api/identity/refresh', { method: 'POST', body: { token: active.refreshToken } });
          if (generation.current !== version) return null;
          previousTokens.current.add(active.token);
          current.current = next; setCredentials(next); return next.token;
        } catch (failure) {
          if (generation.current === version && failure instanceof ApiError && failure.status === 401) clear();
          throw failure;
        }
        finally { renewing.current = null; }
      })();
      return renewing.current;
    });
    return () => { setAuthenticationRecovery(null); setCoupleScopeProvider(null); setUnauthorizedHandler(null); setScopeChangeHandler(null); };
  }, [clear, refreshState]);
  const userId = credentials?.user.userId;
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
          current.current = { ...current.current, user: account }; setCredentials(current.current);
        }
      } catch { /* The local language remains available offline; the next account refresh retries. */ }
      finally { syncingLanguage.current = false; }
    })();
  }, [language, credentials]);
  useEffect(() => { if (userId) void refreshState(); }, [userId, refreshState]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void refreshState(); };
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [refreshState]);
  const value = useMemo<Session>(() => ({ token: credentials?.token ?? null, user: credentials?.user ?? null, space, loading, error, access, login, logout, refreshState }), [credentials, space, loading, error, access, login, logout, refreshState]);
  const legacy = useMemo(() => ({ token: value.token, user: value.user ? { userId: value.user.userId, name: value.user.name, timeZone: value.user.timeZone, role: 'MEMBER' as const } : null, isAuthenticated: !!value.token, login, logout: () => { void logout(); } }), [value.token, value.user, login, logout]);
  return <Context.Provider value={value}><AuthSessionProvider value={legacy}>{children}</AuthSessionProvider></Context.Provider>;
}

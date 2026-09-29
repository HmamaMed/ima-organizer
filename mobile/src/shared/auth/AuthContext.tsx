import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest, setUnauthorizedHandler } from '../api/client';

export type Role = 'OWNER' | 'RECIPIENT';

export interface AuthUser {
  userId: string;
  role: Role;
  name: string;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string, fcmToken?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'life-organizer.token';
const USER_KEY = 'life-organizer.user';

interface LoginResponse {
  token: string;
  userId: string;
  role: Role;
  name: string;
}

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  const login = useCallback(async (username: string, password: string, fcmToken?: string) => {
    const response = await apiRequest<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { username, password, fcmToken },
    });

    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({ userId: response.userId, role: response.role, name: response.name }),
    );
    setToken(response.token);
    setUser({ userId: response.userId, role: response.role, name: response.name });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // A token can go stale without the app doing anything wrong — it expires,
  // or the backend's JWT secret rotates on redeploy. Without this, a stale
  // token sits in localStorage looking valid client-side (isAuthenticated
  // only checks presence, not validity) until whichever screen happens to
  // make the first API call gets a 401. Bounce to the login screen the
  // moment that happens, from any request, anywhere in the app.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: token !== null && user !== null,
      login,
      logout,
    }),
    [token, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

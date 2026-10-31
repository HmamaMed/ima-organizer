import { createContext, useContext, type ReactNode } from 'react';

export type Role = 'OWNER' | 'RECIPIENT' | 'MEMBER';

export interface AuthUser {
  userId: string;
  role: Role;
  name: string;
  timeZone?: string;
}

export interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string, fcmToken?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthSessionProvider');
  }
  return context;
}

/** Supply the current memory-only session to shared notebook components. */
export function AuthSessionProvider({ value, children }: { value: AuthContextValue; children: ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

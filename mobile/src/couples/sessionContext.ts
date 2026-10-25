import { createContext, useContext } from 'react';
export interface Account { userId: string; name: string; email: string; emailVerified: boolean; locale: string; timeZone: string }
export interface Space { coupleId: string | null; status: 'UNPAIRED' | 'DISCONNECTED' | 'WAITING' | 'ACTIVE'; members: { userId: string; name: string }[] }
export interface Credentials { token: string; refreshToken: string; user: Account }
export interface Session {
  token: string | null; user: Account | null; space: Space | null; loading: boolean; error: string;
  login: (email: string, password: string) => Promise<void>; logout: () => Promise<void>; refreshState: () => Promise<void>;
}
export const Context = createContext<Session | null>(null);
export function useCouplesSession() { const value = useContext(Context); if (!value) throw new Error('Couples session is unavailable'); return value; }


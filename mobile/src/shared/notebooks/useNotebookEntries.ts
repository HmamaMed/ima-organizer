import { useCallback, useEffect, useRef, useState } from 'react';
import { useIonViewDidLeave, useIonViewWillEnter } from '@ionic/react';
import { useAuth } from '../auth/AuthContext';

/** Shared notebooks refresh on entry/foreground and ignore superseded reads after writes. */
export function useNotebookEntries<T extends { id: string; createdAt: string }>(fetchEntries: (token: string) => Promise<T[]>) {
  const { token } = useAuth();
  const [entries, setEntries] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const version = useRef(0);
  const active = useRef(false);
  const load = useCallback(async () => {
    if (!token) return;
    const request = ++version.current; setLoading(true);
    try {
      const data = await fetchEntries(token);
      if (request === version.current) { setEntries(data); setError(false); }
    } catch { if (request === version.current) setError(true); }
    finally { if (request === version.current) setLoading(false); }
  }, [token, fetchEntries]);
  useIonViewWillEnter(() => { active.current = true; void load(); });
  useIonViewDidLeave(() => { active.current = false; });
  useEffect(() => {
    const requests = version;
    const refresh = () => { if (active.current && document.visibilityState === 'visible') void load(); };
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { ++requests.current; window.clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);
  const saved = (entry: T) => {
    ++version.current; setLoading(false); setError(false);
    setEntries(previous => [entry, ...(previous ?? []).filter(item => item.id !== entry.id)]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id)));
  };
  const removed = (id: string) => {
    ++version.current; setLoading(false);
    setEntries(previous => (previous ?? []).filter(item => item.id !== id));
  };
  return { token, entries, loading, error, load, saved, removed };
}

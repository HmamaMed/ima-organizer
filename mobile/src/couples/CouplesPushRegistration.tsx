import { useEffect, useRef } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { useHistory } from 'react-router-dom';
import { apiRequest } from '../shared/api/client';
import { useCouplesSession } from './sessionContext';

const ROUTES = new Set(['/notes', '/memories', '/notifications', '/inbox']);
export default function CouplesPushRegistration() {
  const session = useCouplesSession(); const latest = useRef(session); latest.current = session;
  const history = useHistory();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false; const handles: PluginListenerHandle[] = [];
    async function keep(listener: Promise<PluginListenerHandle>) { const handle = await listener; if (disposed) await handle.remove(); else handles.push(handle); }
    async function register(request: boolean) {
      if (!latest.current.token) return;
      let permission = await PushNotifications.checkPermissions();
      if (request && (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale')) permission = await PushNotifications.requestPermissions();
      if (!disposed && permission.receive === 'granted') await PushNotifications.register();
    }
    async function setup() {
      await keep(PushNotifications.addListener('registration', result => {
        const token = latest.current.token;
        if (token) void apiRequest('/api/identity/devices', { token, method: 'POST', body: { token: result.value, platform: 'ANDROID' } }).catch(() => {});
      }));
      await keep(PushNotifications.addListener('pushNotificationActionPerformed', action => {
        const data = action.notification.data as { route?: string; coupleId?: string } | undefined;
        if (!data?.route || !ROUTES.has(data.route)) return;
        if (!latest.current.token) { sessionStorage.setItem('life-organizer.pending-push', JSON.stringify({ route: data.route, coupleId: data.coupleId })); return; }
        if (data.coupleId && data.coupleId !== latest.current.space?.coupleId) { void latest.current.refreshState(); history.push('/home'); return; }
        history.push(data.route);
      }));
      await keep(App.addListener('appUrlOpen', event => {
        try {
          const url = new URL(event.url); const allowed = [window.location.origin, import.meta.env.VITE_APP_LINK_ORIGIN].filter(Boolean);
          if (!allowed.includes(url.origin) || !['/join', '/verify', '/reset', '/delete-account'].includes(url.pathname)) return;
          window.location.assign(url.pathname + url.hash);
        } catch { /* Ignore unrelated deep links. */ }
      }));
      await register(false);
    }
    const enable = () => { void register(true).catch(() => {}); };
    window.addEventListener('couples:enable-push', enable);
    void setup().catch(() => {});
    return () => { disposed = true; window.removeEventListener('couples:enable-push', enable); handles.forEach(handle => { void handle.remove(); }); };
  }, [history]);
  const activeCouple = session.space?.coupleId;
  const hasSpace = !!session.space;
  useEffect(() => {
    const active = latest.current;
    if (!active.token || !active.space) return;
    if (Capacitor.isNativePlatform()) void PushNotifications.checkPermissions().then(permission => { if (permission.receive === 'granted') return PushNotifications.register(); }).catch(() => {});
    try {
      const pending = JSON.parse(sessionStorage.getItem('life-organizer.pending-push') ?? 'null') as { route: string; coupleId?: string } | null;
      if (!pending) return;
      sessionStorage.removeItem('life-organizer.pending-push');
      if (ROUTES.has(pending.route) && (!pending.coupleId || pending.coupleId === active.space.coupleId)) history.push(pending.route);
    } catch { sessionStorage.removeItem('life-organizer.pending-push'); }
  }, [session.token, activeCouple, hasSpace, history]);
  return null;
}

import { useEffect, useRef, useState } from 'react';
import { IonToast } from '@ionic/react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { useHistory } from 'react-router-dom';
import { apiRequest } from '../shared/api/client';
import { useCouplesSession } from './sessionContext';
import { t, useI18n } from '../shared/i18n';

const ROUTES = new Set(['/notes', '/memories', '/notifications', '/inbox']);
const PERMISSION_REQUESTED = 'between-us.push-permission-requested';
export default function CouplesPushRegistration() {
  useI18n();
  const [message, setMessage] = useState('');
  const session = useCouplesSession(); const latest = useRef(session); latest.current = session;
  const registerDevice = useRef<(() => void) | null>(null);
  const history = useHistory();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false; let requested = false; const handles: PluginListenerHandle[] = [];
    function failed() {
      if (!disposed && requested) setMessage('Impossible d’activer les notifications. Vérifiez votre connexion et réessayez.');
      requested = false;
    }
    async function keep(listener: Promise<PluginListenerHandle>) { const handle = await listener; if (disposed) await handle.remove(); else handles.push(handle); }
    async function register(request: boolean, automatic = false) {
      if (disposed) return;
      if (request) { requested = true; setMessage('Activation des notifications…'); }
      let permission = await PushNotifications.checkPermissions();
      if (disposed) return;
      // Ask once on opening, including before sign-in. Manual retries remain available in Profile.
      let asked = true;
      try { asked = localStorage.getItem(PERMISSION_REQUESTED) === '1'; } catch { /* Manual requests still work if storage is unavailable. */ }
      if ((request && (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale')) || (automatic && !asked && permission.receive === 'prompt')) {
        try { localStorage.setItem(PERMISSION_REQUESTED, '1'); } catch { /* Android still controls whether another prompt is allowed. */ }
        permission = await PushNotifications.requestPermissions();
      }
      if (!disposed && permission.receive === 'granted' && latest.current.token) await PushNotifications.register();
      else if (!disposed && requested) {
        setMessage('Autorisez les notifications dans les paramètres Android de Between Us, puis réessayez.');
        requested = false;
      }
    }
    async function setup() {
      await keep(PushNotifications.addListener('registration', result => {
        const token = latest.current.token;
        if (!disposed && token) void apiRequest('/api/identity/devices', { token, method: 'POST', body: { token: result.value, platform: 'ANDROID' } }).then(() => {
          if (!disposed && requested && latest.current.token === token) setMessage('Cet appareil est enregistré pour les notifications.');
          requested = false;
        }).catch(failed);
      }));
      await keep(PushNotifications.addListener('registrationError', failed));
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
      // Retry registration after returning from Android settings or an offline start.
      await keep(App.addListener('appStateChange', state => {
        if (state.isActive) void register(false).catch(failed);
      }));
      if (disposed) return;
      registerDevice.current = () => { void register(false).catch(failed); };
      await register(false, true);
    }
    const enable = () => { void register(true).catch(failed); };
    const online = () => { void register(false).catch(failed); };
    window.addEventListener('couples:enable-push', enable);
    window.addEventListener('online', online);
    void setup().catch(failed);
    return () => { disposed = true; registerDevice.current = null; window.removeEventListener('couples:enable-push', enable); window.removeEventListener('online', online); handles.forEach(handle => { void handle.remove(); }); };
  }, [history]);
  const activeCouple = session.space?.coupleId;
  const hasSpace = !!session.space;
  useEffect(() => {
    const active = latest.current;
    if (!active.token || !active.space) return;
    registerDevice.current?.();
    try {
      const pending = JSON.parse(sessionStorage.getItem('life-organizer.pending-push') ?? 'null') as { route: string; coupleId?: string } | null;
      if (!pending) return;
      sessionStorage.removeItem('life-organizer.pending-push');
      if (ROUTES.has(pending.route) && (!pending.coupleId || pending.coupleId === active.space.coupleId)) history.push(pending.route);
    } catch { sessionStorage.removeItem('life-organizer.pending-push'); }
  }, [session.token, activeCouple, hasSpace, history]);
  return <IonToast isOpen={!!message} message={t(message)} duration={0} buttons={[{ text: t('Fermer'), role: 'cancel' }]} onDidDismiss={() => setMessage('')} />;
}

import { useEffect, useRef } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

/** Listen before registering; remove only this hook's listeners when it unmounts. */
export function usePushNotifications(onToken: (token: string) => void, onOpen?: (route: string) => void) {
  const onTokenRef = useRef(onToken);
  const onOpenRef = useRef(onOpen);
  onTokenRef.current = onToken;
  onOpenRef.current = onOpen;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    const handles: PluginListenerHandle[] = [];
    async function keep(listener: Promise<PluginListenerHandle>) {
      const handle = await listener;
      if (cancelled) await handle.remove();
      else handles.push(handle);
    }
    async function register() {
      try {
        await keep(PushNotifications.addListener('registration', token => {
          if (!cancelled) onTokenRef.current(token.value);
        }));
        await keep(PushNotifications.addListener('registrationError', () => {
          console.warn('Push registration failed.');
        }));
        await keep(PushNotifications.addListener('pushNotificationActionPerformed', action => {
          const route = action.notification.data?.route;
          if (!cancelled && typeof route === 'string') onOpenRef.current?.(route);
        }));
        if (cancelled) return;
        let permission = await PushNotifications.checkPermissions();
        if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
          permission = await PushNotifications.requestPermissions();
        }
        if (!cancelled && permission.receive === 'granted') await PushNotifications.register();
      } catch { console.warn('Could not register this device for push notifications.'); }
    }
    void register();
    return () => {
      cancelled = true;
      for (const handle of handles) void handle.remove();
    };
  }, []);
}

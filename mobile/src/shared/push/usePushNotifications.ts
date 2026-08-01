import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

/**
 * Registers the device for push notifications and surfaces the FCM token.
 *
 * The token is handed back via the onToken callback so the caller can send it
 * to the backend (e.g. attached to the login request). Incoming notifications
 * are logged for now — module-specific handling (deep-linking to a feed) comes
 * later.
 */
export function usePushNotifications(onToken: (token: string) => void) {
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    // Push registration only makes sense on a real device (or emulator).
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let cancelled = false;

    const register = async () => {
      try {
        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== 'granted') {
          console.warn('Push notification permission not granted');
          return;
        }

        await PushNotifications.register();

        PushNotifications.addListener('registration', (token) => {
          if (!cancelled) {
            onTokenRef.current(token.value);
          }
        });

        PushNotifications.addListener('registrationError', (err) => {
          console.error('Push registration error', err);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received', notification);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('Push action performed', action);
        });
      } catch (err) {
        console.error('Failed to set up push notifications', err);
      }
    };

    register();

    return () => {
      cancelled = true;
    };
  }, []);
}

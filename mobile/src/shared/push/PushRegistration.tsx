import { useHistory } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiRequest } from '../api/client';
import { usePushNotifications } from './usePushNotifications';

/** Refresh the signed-in account's device token on each native app launch. */
export default function PushRegistration() {
  const { token } = useAuth();
  const history = useHistory();
  usePushNotifications((deviceToken) => {
    if (token) {
      void apiRequest('/api/auth/push-token', { method: 'PUT', token, body: { token: deviceToken } })
        .catch(() => console.warn('Could not update this device for push reminders.'));
    }
  }, (route) => {
    if (route === '/birthdays') history.push('/birthdays');
    if (route === '/notifications') history.push('/notifications');
  });
  return null;
}

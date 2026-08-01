import { useRef, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonText,
} from '@ionic/react';
import { useAuth } from './AuthContext';
import { ApiError } from '../api/client';
import { usePushNotifications } from '../push/usePushNotifications';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Capture the device's FCM token so it can be attached to the login request.
  const fcmTokenRef = useRef<string | undefined>(undefined);
  usePushNotifications((token) => {
    fcmTokenRef.current = token;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password, fcmTokenRef.current);
    } catch (err) {
      if (err instanceof ApiError) {
        setError('Incorrect username or password.');
      } else {
        setError('Could not reach the server. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="login-screen">
          <div className="login-mark" aria-hidden="true">
            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <clipPath id="loginHeart">
                  <path d="M100 172 C 44 128, 14 90, 14 58 C 14 26, 38 8, 64 8 C 82 8, 94 18, 100 32 C 106 18, 118 8, 136 8 C 162 8, 186 26, 186 58 C 186 90, 156 128, 100 172 Z" />
                </clipPath>
              </defs>
              <rect x="0" y="0" width="100" height="200" fill="#E14F73" clipPath="url(#loginHeart)" />
              <rect x="100" y="0" width="100" height="200" fill="#EAA857" clipPath="url(#loginHeart)" />
            </svg>
          </div>

          <h1 className="font-display login-title">Life Organizer</h1>
          <IonText className="login-subtitle">
            <p>Welcome back.</p>
          </IonText>

          <form onSubmit={handleSubmit} className="login-form">
            <IonItem>
              <IonLabel position="stacked">Username</IonLabel>
              <IonInput
                value={username}
                onIonInput={(e) => setUsername(String(e.detail.value ?? ''))}
                autocomplete="username"
                required
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Password</IonLabel>
              <IonInput
                type="password"
                value={password}
                onIonInput={(e) => setPassword(String(e.detail.value ?? ''))}
                autocomplete="current-password"
                required
              />
            </IonItem>

            {error && (
              <IonText color="danger" className="login-error">
                <p>{error}</p>
              </IonText>
            )}

            <IonButton type="submit" expand="block" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </IonButton>
          </form>
        </div>
      </IonContent>
    </IonPage>
  );
}

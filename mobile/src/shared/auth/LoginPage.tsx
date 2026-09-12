import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonPage,
  IonText,
} from '@ionic/react';
import { eyeOffOutline, eyeOutline, lockClosedOutline, personOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ApiError } from '../api/client';
import { usePushNotifications } from '../push/usePushNotifications';
import HeartMark from '../ui/HeartMark';

export default function LoginPage() {
  const { login } = useAuth();
  const history = useHistory();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

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
      history.push('/home');
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
          <div className="login-mark">
            <HeartMark />
          </div>

          <h1 className="font-display-italic login-title">Welcome back</h1>
          <IonText className="login-subtitle">
            <p>Everything in here is just for you.</p>
          </IonText>

          <form onSubmit={handleSubmit} className="login-form">
            <IonInput
              className="login-input"
              fill="outline"
              shape="round"
              placeholder="Username"
              value={username}
              onIonInput={(e) => setUsername(String(e.detail.value ?? ''))}
              autocomplete="username"
              required
            >
              <IonIcon slot="start" icon={personOutline} aria-hidden="true" />
            </IonInput>

            <IonInput
              className="login-input"
              fill="outline"
              shape="round"
              placeholder="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onIonInput={(e) => setPassword(String(e.detail.value ?? ''))}
              autocomplete="current-password"
              required
            >
              <IonIcon slot="start" icon={lockClosedOutline} aria-hidden="true" />
              <button
                type="button"
                slot="end"
                className="login-input__eye"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} />
              </button>
            </IonInput>

            {error && (
              <IonText color="danger" className="login-error">
                <p>{error}</p>
              </IonText>
            )}

            <IonButton type="submit" expand="block" shape="round" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </IonButton>
            <div className="login-forgot-wrap">
              <button type="button" className="login-forgot" onClick={() => setShowForgot(true)}>
                Forgot password?
              </button>
            </div>
          </form>

          <p className="login-note">This app was written for one person only.</p>
        </div>
      </IonContent>

      {showForgot && createPortal(
        <div className="forgot-popup" onClick={() => setShowForgot(false)}>
          <div className="forgot-popup__card" onClick={(e) => e.stopPropagation()}>
            <div className="forgot-popup__mark">
              <HeartMark />
            </div>
            <p className="forgot-popup__title font-display-italic">Forgot your password?</p>
            <p className="forgot-popup__body">Ask your man for it. He's the one who set it up for you.</p>
            <IonButton expand="block" shape="round" onClick={() => setShowForgot(false)}>
              Okay
            </IonButton>
          </div>
        </div>,
        document.body,
      )}
    </IonPage>
  );
}

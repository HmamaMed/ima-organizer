import { useRef, useState } from 'react';
import { IonContent, IonIcon, IonInput, IonPage, IonModal } from '@ionic/react';
import { eyeOffOutline, eyeOutline, lockClosedOutline, personOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ApiError } from '../api/client';
import { usePushNotifications } from '../push/usePushNotifications';
import HeartMark from '../ui/HeartMark';
import AppButton from '../ui/AppButton';
import FeedbackState from '../ui/FeedbackState';

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
    if (submitting || !username.trim() || !password) return;
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
      <IonContent className="ion-padding content-safe-top">
        <div className="login-screen">
          <div className="login-brand">
            <HeartMark />
            <span>Life Organizer</span>
          </div>
          <h1 className="login-title">Your little corner.</h1>
          <p className="login-subtitle">
            Everything in here is just for you.
            <br />
            Come in and make yourself at home.
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <span className="login-field__label" id="username-label">
                Username
              </span>
              <IonInput
                aria-labelledby="username-label"
                className="login-input"
                fill="outline"
                placeholder="Username"
                value={username}
                onIonInput={(e) => setUsername(String(e.detail.value ?? ''))}
                autocomplete="username"
                required
              >
                <IonIcon slot="start" icon={personOutline} aria-hidden="true" />
              </IonInput>
            </div>

            <div className="login-field">
              <span className="login-field__label" id="password-label">
                Password
              </span>
              <IonInput
                aria-labelledby="password-label"
                className="login-input"
                fill="outline"
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
            </div>

            {error && <FeedbackState kind="failure" heading={error} />}
            <AppButton type="submit" busy={submitting} disabled={!username.trim() || !password}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </AppButton>
            <div className="login-forgot-wrap">
              <button type="button" className="login-forgot" onClick={() => setShowForgot(true)}>
                Forgot your password?
              </button>
            </div>
          </form>

          <p className="login-note">Made for one person. Kept close, every day.</p>
        </div>
      </IonContent>

      <IonModal
        className="help-modal"
        isOpen={showForgot}
        onDidDismiss={() => setShowForgot(false)}
        aria-labelledby="password-help-title"
      >
        <IonContent>
          <div className="help-modal__body">
            <div className="forgot-popup__mark">
              <HeartMark />
            </div>
            <h2 id="password-help-title" className="forgot-popup__title">
              Forgot your password?
            </h2>
            <p className="forgot-popup__body">
              Ask your man for it. He's the one who set it up for you.
            </p>
            <AppButton onClick={() => setShowForgot(false)}>Okay</AppButton>
          </div>
        </IonContent>
      </IonModal>
    </IonPage>
  );
}

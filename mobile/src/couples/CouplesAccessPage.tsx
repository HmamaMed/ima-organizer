import { t, useI18n, getLanguage } from "../shared/i18n";
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { IonIcon, IonPage } from '@ionic/react';
import { eyeOffOutline, eyeOutline, lockClosedOutline, mailOutline, personOutline } from 'ionicons/icons';
import { apiRequest, ApiError } from '../shared/api/client';
import AppScreen from '../shared/ui/AppScreen';
import BrandLogo from '../shared/ui/BrandLogo';
import LanguageSwitcher from '../shared/i18n/LanguageSwitcher';
import AppButton from '../shared/ui/AppButton';
import { useCouplesSession } from './sessionContext';
import type { HardwareBackEvent } from '../shared/navigation/useAppBack';

type AccessMode = 'login' | 'register' | 'forgot';

export default function CouplesAccessPage({ action, actionToken, onActionDone }: {
  action: 'verify' | 'reset' | null;
  actionToken: string;
  onActionDone: () => void;
}) {
  useI18n();
  const { login, logout, user, refreshState, access } = useCouplesSession();
  const [mode, setMode] = useState<AccessMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(() => new URLSearchParams(window.location.search).get('requested') === '1'
    ? t("Demande de suppression enregistrée. Vos connexions ont été révoquées. La suppression de vos données se poursuivra automatiquement.")
    : '');

  function changeMode(next: AccessMode) {
    if (busy) return;
    setMode(next);
    setPassword('');
    setShowPassword(false);
    setError('');
    setMessage('');
  }

  async function perform(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try { await task(); }
    catch (failure) { setError(failure instanceof ApiError ? failure.message : t("Connexion impossible. Réessayez.")); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await perform(async () => {
      if (action) {
        await apiRequest(action === 'verify' ? '/api/identity/verify' : '/api/identity/reset-password', {
          method: 'POST',
          body: action === 'verify' ? { token: actionToken } : { token: actionToken, password },
        });
        onActionDone();
        setPassword('');
        setMessage(action === 'verify' ? t("Adresse confirmée. Vous pouvez vous connecter.") : t("Mot de passe modifié. Reconnectez-vous."));
        if (user) {
          if (action === 'reset') await logout();
          else await refreshState();
        }
      } else if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'register') {
        if (!access.registrationEnabled) {
          setMessage(t("La création de compte n’est pas encore ouverte. Aucun compte n’a été créé."));
          return;
        }
        await apiRequest('/api/identity/register', {
          method: 'POST',
          body: { email, password, name, locale: getLanguage(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' },
        });
        setMode('login');
        setPassword('');
        setMessage(t("Consultez votre boîte e-mail pour confirmer votre compte, puis connectez-vous."));
      } else {
        if (!access.emailEnabled) {
          setMessage(t("La récupération par e-mail n’est pas encore disponible. Aucun e-mail n’a été envoyé."));
          return;
        }
        await apiRequest('/api/identity/password-email', { method: 'POST', body: { email } });
        setMessage(t("Si un compte correspond, un lien de réinitialisation vous sera envoyé."));
      }
    });
  }

  const verificationNeeded = !!user && !user.emailVerified && user.emailVerificationRequired !== false && !action;
  useEffect(() => {
    if (verificationNeeded || !action && mode === 'login') return;
    const handleBack = (event: Event) => {
      (event as HardwareBackEvent).detail.register(20, () => {
        if (busy) return;
        if (action) onActionDone();
        else { setMode('login'); setPassword(''); setShowPassword(false); setError(''); setMessage(''); }
      });
    };
    document.addEventListener('ionBackButton', handleBack);
    return () => document.removeEventListener('ionBackButton', handleBack);
  }, [action, mode, busy, verificationNeeded, onActionDone]);
  const formTitle = action === 'verify' ? t("Confirmer mon adresse")
    : action === 'reset' ? t("Nouveau mot de passe")
    : mode === 'register' ? t("Créer mon compte")
    : mode === 'forgot' ? t("Retrouver mon compte") : t("Se connecter");
  const unavailable = !action && mode === 'register' && !access.registrationEnabled
    ? t("La création de compte n’est pas encore ouverte. Vous pouvez découvrir le formulaire, mais aucun compte ne sera créé pour le moment.")
    : !action && mode === 'forgot' && !access.emailEnabled
      ? t("Vous pouvez découvrir ce formulaire. La récupération par e-mail sera disponible prochainement.") : '';

  return (
    <IonPage lang={getLanguage()}>
      <AppScreen className="couple-access-screen content-safe-top">
        <div className="couple-access login-screen">
          <div className="login-brand"><BrandLogo variant="stacked" /></div>
          <header className="couple-access__intro">
            <h1 className="login-title">{t("Votre espace à deux.")}</h1>
            <p className="login-subtitle">{t("Des mots, des moments et des projets à partager.")}<br />{t("Entrez, et faites comme chez vous.")}</p>
          </header>
          {window.location.pathname === '/delete-account' && <p>{t("Pour supprimer votre compte sans l’application, connectez-vous ici puis confirmez la suppression dans « Mes données ».")}</p>}
          {action && !access.emailEnabled ? (
            <section className="couple-card">
              <p>{t("Ce lien n’est pas disponible pour le moment.")}</p>
              <AppButton onClick={onActionDone}>{t("Retour à la connexion")}</AppButton>
            </section>
          ) : verificationNeeded ? (
            <section className="couple-card">
              <h2>{t("Confirmez votre adresse e-mail")}</h2>
              <p>{t("Un lien vous attend dans la boîte de") + " "}{user.email}{t(". Vérifiez aussi les courriers indésirables.")}</p>
              <AppButton busy={busy} onClick={() => { void perform(async () => {
                await apiRequest('/api/identity/verification-email', { method: 'POST', body: { email: user.email } });
                setMessage(t("Un nouveau lien a été demandé."));
              }); }}>{t("Renvoyer le lien")}</AppButton>
              <AppButton variant="secondary" onClick={() => { void refreshState(); }}>{t("J’ai confirmé mon adresse")}</AppButton>
              <AppButton variant="quiet" onClick={() => { void logout(); }}>{t("Changer de compte")}</AppButton>
            </section>
          ) : (
            <form onSubmit={submit} className="couple-form login-form" aria-labelledby="access-form-title">
              <h2 id="access-form-title" className={!action && mode === 'login' ? 'couple-access__sr-only' : 'couple-access__form-title'}>{formTitle}</h2>
              {mode === 'forgot' && !action && <p className="couple-access__description">{t("Indiquez l’adresse e-mail de votre compte pour recevoir un lien de réinitialisation.")}</p>}
              {unavailable && <p className="couple-access__notice" id="access-availability">{unavailable}</p>}
              {!action && mode === 'register' && (
                <div className="login-field">
                  <label htmlFor="access-name">{t("Votre prénom")}</label>
                  <div className="couple-access__input">
                    <IonIcon icon={personOutline} aria-hidden="true" />
                    <input id="access-name" autoComplete="given-name" value={name} onChange={e => setName(e.target.value)} required maxLength={100} />
                  </div>
                </div>
              )}
              {!action && (
                <div className="login-field">
                  <label htmlFor="access-email">{t("Adresse e-mail")}</label>
                  <div className="couple-access__input">
                    <IonIcon icon={mailOutline} aria-hidden="true" />
                    <input id="access-email" type="email" inputMode="email" autoComplete={mode === 'login' ? 'username' : 'email'} autoCapitalize="none" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} required maxLength={320} placeholder="vous@exemple.com" />
                  </div>
                </div>
              )}
              {(action === 'reset' || (!action && mode !== 'forgot')) && (
                <div className="login-field">
                  <label htmlFor="access-password">{t("Mot de passe")}</label>
                  <div className="couple-access__input">
                    <IonIcon icon={lockClosedOutline} aria-hidden="true" />
                    <input id="access-password" type={showPassword ? 'text' : 'password'} autoComplete={action === 'reset' || mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} minLength={action === 'reset' || mode === 'register' ? 12 : 1} maxLength={72} required aria-describedby={action === 'reset' || mode === 'register' ? 'access-password-hint' : undefined} />
                    <button type="button" className="login-input__eye" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? t("Masquer le mot de passe") : t("Afficher le mot de passe")} aria-pressed={showPassword}><IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} aria-hidden="true" /></button>
                  </div>
                  {(action === 'reset' || mode === 'register') && <small id="access-password-hint">{t("Au moins 12 caractères.")}</small>}
                </div>
              )}
              {error && <p className="couple-error" role="alert">{error}</p>}
              {message && <p className="couple-message" role="status">{message}</p>}
              <AppButton type="submit" busy={busy} aria-describedby={unavailable ? 'access-availability' : undefined}>
                {action === 'verify' ? t("Confirmer mon adresse") : action === 'reset' ? t("Enregistrer le mot de passe") : mode === 'register' ? t("Créer mon compte") : mode === 'forgot' ? t("Recevoir un lien") : t("Entrer dans mon espace")}
              </AppButton>
              {!action && mode === 'login' ? (
                <div className="couple-access__navigation">
                  <button type="button" className="login-forgot" disabled={busy} onClick={() => changeMode('forgot')}>{t("Mot de passe oublié ?")}</button>
                  <p className="couple-access__signup">{t("Pas encore de compte ?") + " "}<button type="button" className="couple-access__text-button" disabled={busy} onClick={() => changeMode('register')}>{t("Créer un compte")}</button></p>
                </div>
              ) : !action ? (
                <AppButton variant="quiet" disabled={busy} onClick={() => changeMode('login')}>{mode === 'register' ? t("J’ai déjà un compte") : t("Retour à la connexion")}</AppButton>
              ) : <AppButton variant="quiet" onClick={onActionDone}>{t("Retour à la connexion")}</AppButton>}
            </form>
          )}
          {(verificationNeeded || action && !access.emailEnabled) && <>{error && <p className="couple-error" role="alert">{error}</p>}{message && <p className="couple-message" role="status">{message}</p>}</>}
          <footer className="couple-access__footer">
            <LanguageSwitcher compact />
            <Link className="couple-privacy-link" to={{ pathname: '/privacy', state: { privacyReturnTo: window.location.pathname === '/delete-account' ? '/delete-account' : '/' } }}>{t("Votre espace et vos données")}</Link>
          </footer>
        </div>
      </AppScreen>
    </IonPage>
  );
}

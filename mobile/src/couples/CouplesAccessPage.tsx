import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IonPage } from '@ionic/react';
import { apiRequest, ApiError } from '../shared/api/client';
import AppScreen from '../shared/ui/AppScreen';
import BrandLogo from '../shared/ui/BrandLogo';
import AppButton from '../shared/ui/AppButton';
import { useCouplesSession } from './sessionContext';

export default function CouplesAccessPage({ action, actionToken, onActionDone }: { action: 'verify' | 'reset' | null; actionToken: string; onActionDone: () => void }) {
  const { login, logout, user, refreshState } = useCouplesSession();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(() => new URLSearchParams(window.location.search).get('requested') === '1' ? 'Demande de suppression enregistrée. Vos connexions ont été révoquées. La suppression de vos données se poursuivra automatiquement.' : '');
  async function perform(task: () => Promise<void>) { if (busy) return; setBusy(true); setError(''); setMessage(''); try { await task(); } catch (failure) { setError(failure instanceof ApiError ? failure.message : 'Connexion impossible. Réessayez.'); } finally { setBusy(false); } }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await perform(async () => {
      if (action) {
        await apiRequest(action === 'verify' ? '/api/identity/verify' : '/api/identity/reset-password', { method: 'POST', body: action === 'verify' ? { token: actionToken } : { token: actionToken, password } });
        onActionDone(); setPassword(''); setMessage(action === 'verify' ? 'Adresse confirmée. Vous pouvez vous connecter.' : 'Mot de passe modifié. Reconnectez-vous.');
        if (user) { if (action === 'reset') await logout(); else await refreshState(); }
      } else if (mode === 'login') await login(email, password);
      else if (mode === 'register') {
        await apiRequest('/api/identity/register', { method: 'POST', body: { email, password, name, locale: 'fr', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } });
        setMode('login'); setPassword(''); setMessage('Consultez votre boîte e-mail pour confirmer votre compte, puis connectez-vous.');
      } else { await apiRequest('/api/identity/password-email', { method: 'POST', body: { email } }); setMessage('Si un compte correspond, un lien de réinitialisation vous sera envoyé.'); }
    });
  }
  const verificationNeeded = !!user && !user.emailVerified && !action;
  return <IonPage lang="fr"><AppScreen title="Votre espace à deux." subtitle="Des mots, des moments et des projets à partager.">
    <div className="couple-access"><BrandLogo variant="stacked" />{window.location.pathname === '/delete-account' && <p>Pour supprimer votre compte sans l’application, connectez-vous ici puis confirmez la suppression dans « Mes données ».</p>}
      {verificationNeeded ? <section className="couple-card"><h2>Confirmez votre adresse e-mail</h2><p>Un lien vous attend dans la boîte de {user.email}. Vérifiez aussi les courriers indésirables.</p>
        <AppButton busy={busy} onClick={() => { void perform(async () => { await apiRequest('/api/identity/verification-email', { method: 'POST', body: { email: user.email } }); setMessage('Un nouveau lien a été demandé.'); }); }}>Renvoyer le lien</AppButton>
        <AppButton variant="secondary" onClick={() => { void refreshState(); }}>J’ai confirmé mon adresse</AppButton><AppButton variant="quiet" onClick={() => { void logout(); }}>Changer de compte</AppButton>
      </section> : <form onSubmit={submit} className="couple-form">
        <h2>{action === 'verify' ? 'Confirmer mon adresse' : action === 'reset' ? 'Nouveau mot de passe' : mode === 'register' ? 'Créer mon compte' : mode === 'forgot' ? 'Retrouver mon compte' : 'Se connecter'}</h2>
        {!action && <label>Adresse e-mail<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={320} /></label>}
        {!action && mode === 'register' && <label>Votre prénom<input autoComplete="given-name" value={name} onChange={e => setName(e.target.value)} required maxLength={100} /></label>}
        {(action === 'reset' || (!action && mode !== 'forgot')) && <label>Mot de passe<input type="password" autoComplete={action === 'reset' || mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} minLength={action === 'reset' || mode === 'register' ? 12 : 1} maxLength={72} required />{(action === 'reset' || mode === 'register') && <small>Au moins 12 caractères.</small>}</label>}
        <AppButton type="submit" busy={busy}>{action === 'verify' ? 'Confirmer mon adresse' : action === 'reset' ? 'Enregistrer le mot de passe' : mode === 'register' ? 'Créer mon compte' : mode === 'forgot' ? 'Recevoir un lien' : 'Entrer dans mon espace'}</AppButton>
        {!action && <div className="couple-actions"><AppButton variant="quiet" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(''); }}>{mode === 'register' ? 'J’ai déjà un compte' : 'Créer un compte'}</AppButton><AppButton variant="quiet" onClick={() => { setMode(mode === 'forgot' ? 'login' : 'forgot'); setError(''); }}>{mode === 'forgot' ? 'Retour à la connexion' : 'Mot de passe oublié'}</AppButton></div>}
        {action && <AppButton variant="quiet" onClick={onActionDone}>Retour</AppButton>}
      </form>}
      <Link to="/privacy">Votre espace et vos données</Link>
      {error && <p className="couple-error" role="alert">{error}</p>}{message && <p className="couple-message" role="status">{message}</p>}
    </div>
  </AppScreen></IonPage>;
}

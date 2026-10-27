import { t, useI18n, getLanguage } from '../shared/i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Link } from 'react-router-dom';
import { IonIcon, IonPage, IonToast } from '@ionic/react';
import { chevronForwardOutline, downloadOutline, heartOutline, helpCircleOutline, languageOutline, logOutOutline, notificationsOutline, personOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import BrandHeader from '../shared/ui/BrandHeader';
import AppScreen from '../shared/ui/AppScreen';
import AppButton from '../shared/ui/AppButton';
import FeedbackState from '../shared/ui/FeedbackState';
import LanguageSwitcher from '../shared/i18n/LanguageSwitcher';
import { apiRequest, ApiError } from '../shared/api/client';
import { useCouplesSession } from './sessionContext';

interface Preferences { notesEnabled: boolean; memoriesEnabled: boolean; previewsEnabled: boolean }
function AccountSection({ title, description, icon, children, initiallyOpen = false }: { title: string; description: string; icon: string; children: ReactNode; initiallyOpen?: boolean }) {
  return <details className="account-section" open={initiallyOpen || undefined}>
    <summary><IonIcon icon={icon} aria-hidden="true" /><span><strong>{title}</strong><span>{description}</span></span><IonIcon className="account-section__chevron" icon={chevronForwardOutline} aria-hidden="true" /></summary>
    <div className="account-section__body">{children}</div>
  </details>;
}
export default function CoupleAccountPage() {
  useI18n();
  const { token, user, space, refreshState, logout } = useCouplesSession();
  const [name, setName] = useState(user?.name ?? '');
  const [zone, setZone] = useState(user?.timeZone ?? 'UTC');
  const [preferences, setPreferences] = useState<Preferences>({ notesEnabled: true, memoriesEnabled: true, previewsEnabled: false });
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [preferencesError, setPreferencesError] = useState(false);
  const [preferencesVersion, setPreferencesVersion] = useState(0);
  const [password, setPassword] = useState('');
  const [disconnect, setDisconnect] = useState(false);
  const [deletion, setDeletion] = useState(window.location.pathname === '/delete-account');
  const [report, setReport] = useState('');
  const [reportKind, setReportKind] = useState<'PROBLEM' | 'UNWANTED_PARTNER'>('PROBLEM');
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const busy = working !== null;
  useEffect(() => {
    let active = true;
    setPreferencesReady(false); setPreferencesError(false);
    void apiRequest<Preferences>('/api/inbox/preferences', { token }).then(value => {
      if (active) { setPreferences(value); setPreferencesReady(true); }
    }).catch(() => { if (active) setPreferencesError(true); });
    return () => { active = false; };
  }, [token, preferencesVersion]);
  async function perform(key: string, task: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setWorking(key); setError(''); setMessage('');
    try { await task(); }
    catch (failure) { setError(failure instanceof ApiError ? failure.message : t('Connexion impossible. Réessayez.')); }
    finally { pending.current = false; setWorking(null); }
  }
  return <IonPage lang={getLanguage()}>
    <BrandHeader icon={personOutline} title={t('Mon compte')} accent="muted" />
    <AppScreen className="account-screen" title={t('Votre compte, vos choix.')} subtitle={user?.email}>
      <section className="couple-card account-language" aria-labelledby="account-language-title">
        <div className="account-language__heading"><IonIcon icon={languageOutline} aria-hidden="true" /><div><h2 id="account-language-title">{t('Langue de l’application')}</h2><p className="couple-meta">{t('Choisissez la langue qui vous ressemble.')}</p></div></div>
        <LanguageSwitcher />
      </section>
      <AccountSection title={t('Mes informations')} description={t('Prénom et fuseau horaire')} icon={personOutline}>
        <form className="couple-form" onSubmit={event => { event.preventDefault(); void perform('profile', async () => {
          await apiRequest('/api/identity/me', { token, method: 'PUT', body: { name, locale: getLanguage(), timeZone: zone } });
          await refreshState(); setMessage(t('Compte mis à jour.'));
        }); }}>
          <fieldset className="account-fields couple-form" disabled={busy}>
            <label>{t('Votre prénom')}<input autoComplete="given-name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label>
            <label>{t('Fuseau horaire')}<input required maxLength={100} value={zone} onChange={event => setZone(event.target.value)} list="account-timezones" placeholder="Africa/Casablanca" /><small>{t('Utilisé pour les dates et les rappels.')}</small></label>
            <datalist id="account-timezones"><option value="Africa/Casablanca" /><option value="Europe/Paris" /><option value="Europe/London" /><option value="UTC" /></datalist>
            <button type="button" className="account-text-button" onClick={() => setZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')}>{t('Utiliser le fuseau de cet appareil')}</button>
          </fieldset>
          <AppButton type="submit" disabled={busy} busy={working === 'profile'}>{t('Enregistrer')}</AppButton>
        </form>
      </AccountSection>
      <AccountSection title={t('Mes notifications')} description={t('Messages, moments et aperçus')} icon={notificationsOutline}>
        <form className="couple-form" onSubmit={event => { event.preventDefault(); if (!preferencesReady) return; void perform('preferences', async () => {
          await apiRequest('/api/inbox/preferences', { token, method: 'PUT', body: preferences }); setMessage(t('Préférences enregistrées.'));
        }); }}>
          {preferencesError && <FeedbackState kind="failure" heading={t('Impossible de charger vos préférences.')} onRetry={() => setPreferencesVersion(value => value + 1)} />}
          {!preferencesReady && !preferencesError && <FeedbackState kind="loading" heading={t('Chargement…')} />}
          {Capacitor.isNativePlatform() && <AppButton variant="secondary" disabled={busy} onClick={() => window.dispatchEvent(new Event('couples:enable-push'))}>{t('Autoriser les notifications sur cet appareil')}</AppButton>}
          <fieldset className="account-fields couple-form" disabled={busy || !preferencesReady}>
            {([{ key: 'notesEnabled', label: t('Les notes de mon partenaire') }, { key: 'memoriesEnabled', label: t('Ses nouveaux moments') }, { key: 'previewsEnabled', label: t('Afficher le contenu dans les notifications') }] as const).map(item => <label className="couple-check" key={item.key}><input type="checkbox" checked={preferences[item.key]} onChange={event => setPreferences(old => ({ ...old, [item.key]: event.target.checked }))} />{item.label}</label>)}
          </fieldset>
          <p className="couple-meta">{t('Les aperçus restent génériques par défaut. Votre boîte de réception garde vos notifications même sans autorisation système.')}</p>
          <AppButton type="submit" variant="secondary" disabled={busy || !preferencesReady} busy={working === 'preferences'}>{t('Enregistrer mes préférences')}</AppButton>
        </form>
      </AccountSection>
      {space?.coupleId && <AccountSection title={t('Notre espace')} description={space.members.map(member => member.name).join(t(' et '))} icon={heartOutline}>
        {!disconnect ? <><p>{t('Vos contenus partagés restent dans votre espace à deux.')}</p><AppButton variant="secondary" disabled={busy} onClick={() => setDisconnect(true)}>{t('Déconnecter notre couple')}</AppButton></> : <form className="couple-form" onSubmit={event => { event.preventDefault(); void perform('disconnect', async () => {
          await apiRequest('/api/identity/reauthenticate', { token, method: 'POST', body: { password } });
          await apiRequest('/api/couples/disconnect', { token, method: 'POST' }); await refreshState();
        }); }}>
          <p>{t('Vous perdrez tous les deux l’accès à cet espace. Les invitations et les notes à venir seront annulées. Un futur couple créera un espace séparé.')}</p>
          <label className="couple-field">{t('Confirmez votre mot de passe')}<input type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>
          <AppButton type="submit" variant="danger" disabled={busy} busy={working === 'disconnect'}>{t('Confirmer la déconnexion du couple')}</AppButton>
          <AppButton variant="secondary" disabled={busy} onClick={() => setDisconnect(false)}>{t('Garder notre espace')}</AppButton>
        </form>}
      </AccountSection>}
      <AccountSection title={t('Mes données')} description={t('Exporter ou supprimer mon compte')} icon={downloadOutline} initiallyOpen={window.location.pathname === '/delete-account'}>
        <p>{t('Vous pouvez exporter vos propres contributions à votre espace actuel. Les moments sont fournis avec des liens temporaires. Les anciens espaces fermés restent inaccessibles.')}</p>
        <label className="couple-field">{t('Votre mot de passe pour confirmer les actions sensibles')}<input type="password" autoComplete="current-password" value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>
        <AppButton variant="secondary" disabled={busy} busy={working === 'export'} onClick={() => { void perform('export', async () => {
          if (password) await apiRequest('/api/identity/reauthenticate', { token, method: 'POST', body: { password } });
          const data = await apiRequest('/api/privacy/export', { token });
          const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
          const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'entre-nous-export.json'; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          setMessage(t('Export préparé. Gardez ce fichier dans un endroit privé.'));
        }); }}>{t('Exporter mes contributions')}</AppButton>
        {!deletion && <button className="account-text-button account-text-button--danger" type="button" disabled={busy} onClick={() => setDeletion(true)}>{t('Supprimer mon compte')}</button>}
        {deletion && <form className="couple-form account-danger" onSubmit={event => { event.preventDefault(); void perform('delete', async () => {
          await apiRequest('/api/identity/reauthenticate', { token, method: 'POST', body: { password } });
          await apiRequest('/api/privacy/deletion', { token, method: 'POST' }); await logout(); window.location.assign('/delete-account?requested=1');
        }); }}>
          <p>{t('Votre couple sera déconnecté et vos connexions révoquées immédiatement. Votre compte, vos propres contributions et vos fichiers seront supprimés par un traitement avec reprise en cas d’erreur. Les notes échangées avec votre compte seront supprimées. Les contributions de votre partenaire à l’espace fermé resteront séparées de tout futur couple.')}</p>
          <AppButton type="submit" variant="danger" disabled={busy || !password} busy={working === 'delete'}>{t('Confirmer la suppression de mon compte')}</AppButton>
          <AppButton variant="secondary" disabled={busy} onClick={() => setDeletion(false)}>{t('Garder mon compte')}</AppButton>
        </form>}
      </AccountSection>
      <AccountSection title={t('Aide et signalement')} description={t('Un problème ou une question ?')} icon={helpCircleOutline}>
        <form className="couple-form" onSubmit={event => { event.preventDefault(); void perform('report', async () => {
          if (reportKind === 'UNWANTED_PARTNER') await apiRequest('/api/identity/reauthenticate', { token, method: 'POST', body: { password } });
          await apiRequest('/api/privacy/reports', { token, method: 'POST', body: { kind: reportKind, message: report } }); setReport(''); await refreshState(); setMessage(t('Signalement enregistré.'));
        }); }}>
          <fieldset className="account-fields couple-form" disabled={busy}>
            <label>{t('Votre demande')}<select value={reportKind} onChange={event => setReportKind(event.target.value as typeof reportKind)}><option value="PROBLEM">{t('Signaler un problème')}</option><option value="UNWANTED_PARTNER">{t('Signaler et arrêter les échanges avec mon partenaire')}</option></select></label>
            <label>{t('Votre message')}<textarea required maxLength={2000} value={report} onChange={event => setReport(event.target.value)} /></label>
            {reportKind === 'UNWANTED_PARTNER' && <><p>{t('Votre couple sera déconnecté. Confirmez votre mot de passe pour continuer.')}</p><label>{t('Confirmez votre mot de passe')}<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label></>}
          </fieldset>
          <AppButton type="submit" variant={reportKind === 'UNWANTED_PARTNER' ? 'danger' : 'secondary'} disabled={busy} busy={working === 'report'}>{t('Envoyer mon signalement')}</AppButton>
        </form>
      </AccountSection>
      <AccountSection title={t('Mes connexions')} description={t('Gérer mes appareils connectés')} icon={logOutOutline}>
        <p className="couple-meta">{t('Les identifiants restent en mémoire. Après fermeture complète de l’application, reconnectez-vous pour retrouver votre espace.')}</p>
        <AppButton variant="secondary" disabled={busy} busy={working === 'logout'} onClick={() => { void perform('logout', logout); }}>{t('Me déconnecter')}</AppButton>
        <AppButton variant="quiet" disabled={busy} busy={working === 'logout-all'} onClick={() => { void perform('logout-all', async () => { await apiRequest('/api/identity/logout-all', { token, method: 'POST' }); await logout(); }); }}>{t('Déconnecter tous mes appareils')}</AppButton>
      </AccountSection>
      <Link className="couple-settings-link" to={{ pathname: '/privacy', state: { privacyReturnTo: '/profile' } }}><IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" /><span><strong>{t('Confidentialité')}</strong><span>{t('Votre espace et vos données')}</span></span><IonIcon icon={chevronForwardOutline} aria-hidden="true" /></Link>
    </AppScreen>
    <IonToast isOpen={!!error || !!message} message={t(error || message)} duration={error ? 0 : 3500} buttons={[{ text: t('Fermer'), role: 'cancel' }]} onDidDismiss={() => { setError(''); setMessage(''); }} />
  </IonPage>;
}

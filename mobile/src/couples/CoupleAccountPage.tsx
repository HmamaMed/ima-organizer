import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Link } from 'react-router-dom';
import { IonIcon, IonPage } from '@ionic/react';
import { chevronForwardOutline, personOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import BrandHeader from '../shared/ui/BrandHeader';
import AppScreen from '../shared/ui/AppScreen';
import AppButton from '../shared/ui/AppButton';
import { apiRequest, ApiError } from '../shared/api/client';
import { useCouplesSession } from './sessionContext';

interface Preferences { notesEnabled: boolean; memoriesEnabled: boolean; previewsEnabled: boolean }
export default function CoupleAccountPage() {
  const { token, user, space, refreshState, logout } = useCouplesSession();
  const [name, setName] = useState(user?.name ?? ''); const [zone, setZone] = useState(user?.timeZone ?? 'UTC');
  const [preferences, setPreferences] = useState<Preferences>({ notesEnabled: true, memoriesEnabled: true, previewsEnabled: false });
  const [password, setPassword] = useState(''); const [disconnect, setDisconnect] = useState(false);
  const [deletion, setDeletion] = useState(window.location.pathname === '/delete-account');
  const [report, setReport] = useState(''); const [reportKind, setReportKind] = useState<'PROBLEM' | 'UNWANTED_PARTNER'>('PROBLEM');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { let active = true; void apiRequest<Preferences>('/api/inbox/preferences', { token }).then(value => { if (active) setPreferences(value); }).catch(() => { if (active) setError('Impossible de charger vos préférences.'); }); return () => { active = false; }; }, [token]);
  async function perform(task: () => Promise<void>) { if (busy) return; setBusy(true); setError(''); setMessage(''); try { await task(); } catch (failure) { setError(failure instanceof ApiError ? failure.message : 'Connexion impossible. Réessayez.'); } finally { setBusy(false); } }
  return <IonPage lang="fr"><BrandHeader icon={personOutline} title="Mon compte" accent="muted" /><AppScreen title="Votre compte, vos choix." subtitle={user?.email}>
    <form className="couple-card couple-form" onSubmit={e => { e.preventDefault(); void perform(async () => { await apiRequest('/api/identity/me', { token, method: 'PUT', body: { name, locale: 'fr', timeZone: zone } }); await refreshState(); setMessage('Compte mis à jour.'); }); }}>
      <label>Votre prénom<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><label>Fuseau horaire IANA<input required maxLength={100} value={zone} onChange={e => setZone(e.target.value)} placeholder="Africa/Casablanca" /></label><AppButton type="submit" busy={busy}>Enregistrer</AppButton>
    </form>
    <form className="couple-card couple-form" onSubmit={e => { e.preventDefault(); void perform(async () => { await apiRequest('/api/inbox/preferences', { token, method: 'PUT', body: preferences }); setMessage('Préférences enregistrées.'); }); }}><h2>Mes notifications</h2>{Capacitor.isNativePlatform() && <AppButton variant="secondary" onClick={() => window.dispatchEvent(new Event('couples:enable-push'))}>Autoriser les notifications sur cet appareil</AppButton>}
      {([{ key: 'notesEnabled', label: 'Les notes de mon partenaire' }, { key: 'memoriesEnabled', label: 'Ses nouveaux moments' }, { key: 'previewsEnabled', label: 'Afficher le contenu dans les notifications' }] as const).map(item => <label className="couple-check" key={item.key}><input type="checkbox" checked={preferences[item.key]} onChange={e => setPreferences(old => ({ ...old, [item.key]: e.target.checked }))} />{item.label}</label>)}
      <p className="couple-meta">Les aperçus restent génériques par défaut. Votre boîte de réception garde vos notifications même sans autorisation système.</p><AppButton type="submit" variant="secondary" busy={busy}>Enregistrer mes préférences</AppButton>
    </form>
    {space?.coupleId && <section className="couple-card"><h2>Notre espace</h2><p>{space.members.map(member => member.name).join(' et ')}</p><AppButton variant="quiet" onClick={() => setDisconnect(true)}>Déconnecter notre couple</AppButton>
      {disconnect && <form className="couple-form" onSubmit={e => { e.preventDefault(); void perform(async () => { await apiRequest('/api/identity/reauthenticate', { token, method: 'POST', body: { password } }); await apiRequest('/api/couples/disconnect', { token, method: 'POST' }); await refreshState(); }); }}><p>Vous perdrez tous les deux l’accès à cet espace. Les invitations et les notes à venir seront annulées. Un futur couple créera un espace séparé.</p><label>Confirmez votre mot de passe<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label><AppButton type="submit" variant="danger" busy={busy}>Confirmer la déconnexion du couple</AppButton><AppButton variant="quiet" disabled={busy} onClick={() => setDisconnect(false)}>Garder notre espace</AppButton></form>}
    </section>}
    <section className="couple-card"><h2>Mes données</h2><p>Vous pouvez exporter vos propres contributions à votre espace actuel. Les moments sont fournis avec des liens temporaires. Les anciens espaces fermés restent inaccessibles.</p>
      <label>Votre mot de passe pour confirmer les actions sensibles<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      <AppButton variant="secondary" busy={busy} onClick={() => { void perform(async () => {
        if (password) await apiRequest('/api/identity/reauthenticate', { token, method: 'POST', body: { password } });
        const data = await apiRequest('/api/privacy/export', { token });
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'life-organizer-export.json'; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage('Export préparé. Gardez ce fichier dans un endroit privé.');
      }); }}>Exporter mes contributions</AppButton>
      <AppButton variant="quiet" onClick={() => setDeletion(true)}>Supprimer mon compte</AppButton>
      {deletion && <form className="couple-form" onSubmit={e => { e.preventDefault(); void perform(async () => {
        await apiRequest('/api/identity/reauthenticate', { token, method: 'POST', body: { password } });
        await apiRequest('/api/privacy/deletion', { token, method: 'POST' }); await logout(); window.location.assign('/delete-account?requested=1');
      }); }}><p>Votre couple sera déconnecté et vos connexions révoquées immédiatement. Votre compte, vos propres contributions et vos fichiers seront supprimés par un traitement avec reprise en cas d’erreur. Les notes échangées avec votre compte seront supprimées. Les contributions de votre partenaire à l’espace fermé resteront séparées de tout futur couple.</p><AppButton type="submit" variant="danger" busy={busy} disabled={!password}>Confirmer la suppression de mon compte</AppButton><AppButton variant="quiet" disabled={busy} onClick={() => setDeletion(false)}>Garder mon compte</AppButton></form>}
    </section>
    <form className="couple-card couple-form" onSubmit={e => { e.preventDefault(); void perform(async () => {
      if (reportKind === 'UNWANTED_PARTNER') await apiRequest('/api/identity/reauthenticate', { token, method: 'POST', body: { password } });
      await apiRequest('/api/privacy/reports', { token, method: 'POST', body: { kind: reportKind, message: report } }); setReport(''); await refreshState(); setMessage('Signalement enregistré.');
    }); }}><h2>Aide et signalement</h2><label>Votre demande<select value={reportKind} onChange={e => setReportKind(e.target.value as typeof reportKind)}><option value="PROBLEM">Signaler un problème</option><option value="UNWANTED_PARTNER">Signaler et arrêter les échanges avec mon partenaire</option></select></label><label>Votre message<textarea required maxLength={2000} value={report} onChange={e => setReport(e.target.value)} /></label>{reportKind === 'UNWANTED_PARTNER' && <p>Votre couple sera déconnecté. Confirmez votre mot de passe dans la section « Mes données » avant d’envoyer.</p>}<AppButton type="submit" variant="secondary" busy={busy}>Envoyer mon signalement</AppButton></form>
    <section className="couple-card"><h2>Mes connexions</h2><p className="couple-meta">Les identifiants restent en mémoire. Après fermeture complète de l’application, reconnectez-vous pour retrouver votre espace.</p><AppButton variant="secondary" onClick={() => { void logout(); }}>Me déconnecter</AppButton><AppButton variant="quiet" busy={busy} onClick={() => { void perform(async () => { await apiRequest('/api/identity/logout-all', { token, method: 'POST' }); await logout(); }); }}>Déconnecter tous mes appareils</AppButton></section>
    <Link className="couple-settings-link" to={{ pathname: '/privacy', state: { privacyReturnTo: '/profile' } }}><IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" /><span><strong>Confidentialité</strong><span>Votre espace et vos données</span></span><IonIcon icon={chevronForwardOutline} aria-hidden="true" /></Link>
    {error && <p className="couple-error" role="alert">{error}</p>}{message && <p className="couple-message" role="status">{message}</p>}
  </AppScreen></IonPage>;
}

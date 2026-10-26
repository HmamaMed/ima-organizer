import { t, useI18n } from "../shared/i18n";
import { useState } from 'react';
import { apiRequest, ApiError } from '../shared/api/client';
import AppButton from '../shared/ui/AppButton';
import { useCouplesSession } from './sessionContext';

import { INVITATION_KEY, rememberInvitation } from './invitation';
export default function CouplePairing() {
  useI18n();
  const { token, space, refreshState } = useCouplesSession();
  const [invitation, setInvitation] = useState(() => sessionStorage.getItem(INVITATION_KEY) ?? '');
  const [preview, setPreview] = useState<{ inviterName: string; expiresAt: string } | null>(null);
  const [link, setLink] = useState(''); const [email, setEmail] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  async function perform(task: () => Promise<void>) { if (!token || busy) return; setBusy(true); setError(''); setMessage(''); try { await task(); } catch (failure) { setError(failure instanceof ApiError ? failure.message : t("Connexion impossible. Réessayez.")); } finally { setBusy(false); } }
  function extract(value: string) {
    let raw = value.trim();
    try { raw = new URLSearchParams(new URL(raw).hash.slice(1)).get('invitation') ?? raw; } catch { /* Copy/paste tokens are supported too. */ }
    setInvitation(raw); setPreview(null); rememberInvitation(raw);
  }
  if (space?.status === 'ACTIVE') return null;
  return <section className="couple-card"><h2>{space?.status === 'WAITING' ? t("Invitez votre partenaire") : space?.status === 'DISCONNECTED' ? t("Un nouveau départ") : t("Commencez votre espace")}</h2>
    <p>{space?.status === 'WAITING' ? t("Partagez un lien privé, valable 24 heures. Votre partenaire confirmera avant de vous rejoindre.") : t("Créez un espace ou ouvrez l’invitation de votre partenaire. Vos anciens espaces restent séparés.")}</p>
    {!space?.coupleId && <AppButton busy={busy} onClick={() => { void perform(async () => { await apiRequest('/api/couples', { token, method: 'POST' }); await refreshState(); }); }}>{t("Créer notre espace")}</AppButton>}
    {space?.status === 'WAITING' ? <>
      <label>{t("Son e-mail (facultatif)")}<input type="email" maxLength={320} value={email} onChange={e => setEmail(e.target.value)} /></label>
      <AppButton busy={busy} onClick={() => { void perform(async () => { const result = await apiRequest<{ url: string }>('/api/couples/invitations', { token, method: 'POST', body: { email: email || null } }); setLink(result.url); }); }}>{t("Créer un lien d’invitation")}</AppButton>
      {link && <div className="couple-invite"><label>{t("Lien privé")}<input readOnly value={link} onFocus={e => e.target.select()} /></label><AppButton variant="secondary" onClick={() => { void perform(async () => { await navigator.clipboard.writeText(link); setMessage(t("Lien copié.")); }); }}>{t("Copier le lien")}</AppButton><AppButton variant="quiet" onClick={() => { void perform(async () => { await apiRequest('/api/couples/invitations', { token, method: 'DELETE' }); setLink(''); setMessage(t("Invitation révoquée.")); }); }}>{t("Révoquer ce lien")}</AppButton></div>}
    </> : <form onSubmit={e => { e.preventDefault(); void perform(async () => { setPreview(await apiRequest('/api/couples/invitations/preview', { token, method: 'POST', body: { token: invitation } })); }); }} className="couple-form">
      <label>{t("Lien ou code d’invitation")}<input value={invitation} onChange={e => extract(e.target.value)} autoComplete="off" spellCheck={false} /></label>
      <AppButton type="submit" variant="secondary" busy={busy} disabled={!invitation}>{t("Vérifier l’invitation")}</AppButton>
      {preview && <div><p>{t("Rejoindre l’espace de") + " "}<strong>{preview.inviterName}</strong> {" " + t("? Chacun pourra partager ses notes et ses moments.")}</p><AppButton busy={busy} onClick={() => { void perform(async () => { await apiRequest('/api/couples/invitations/accept', { token, method: 'POST', body: { token: invitation } }); sessionStorage.removeItem(INVITATION_KEY); await refreshState(); }); }}>{t("Confirmer et rejoindre")}</AppButton></div>}
    </form>}
    {error && <p role="alert" className="couple-error">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}

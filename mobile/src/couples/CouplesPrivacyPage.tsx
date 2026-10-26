import { t, useI18n, getLanguage } from "../shared/i18n";
import { useEffect, useState } from 'react';
import { IonPage } from '@ionic/react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { shieldCheckmarkOutline } from 'ionicons/icons';
import AppScreen from '../shared/ui/AppScreen';
import BrandHeader from '../shared/ui/BrandHeader';
import FeedbackState from '../shared/ui/FeedbackState';
import { apiRequest } from '../shared/api/client';
import { useCouplesSession } from './sessionContext';

interface Policy { temporaryMemoryHours: number; closedSpaceRetentionDays: number; supportEmail: string; endToEndEncrypted: boolean; accountDeletionPath: string; sentNoteRetentionDays: number }
export default function CouplesPrivacyPage() {
  useI18n();
  const { user } = useCouplesSession();
  const history = useHistory();
  const location = useLocation<{ privacyReturnTo?: string }>();
  const accountReady = !!user && (user.emailVerified || user.emailVerificationRequired === false);
  const requestedReturn = location.state?.privacyReturnTo;
  const backTo = requestedReturn === '/' || requestedReturn === '/delete-account' ? requestedReturn : accountReady ? '/profile' : '/';
  const [policy, setPolicy] = useState<Policy | null>(null); const [error, setError] = useState(false);
  useEffect(() => { let active = true; void apiRequest<Policy>('/api/privacy/policy').then(value => { if (active) setPolicy(value); }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, []);
  return <IonPage lang={getLanguage()}><BrandHeader icon={shieldCheckmarkOutline} title={t("Confidentialité")} accent="muted" showBack backLabel={backTo === '/profile' ? t("Retour au profil") : t("Retour à la connexion")} onBack={() => history.replace(backTo, { direction: 'back' })} /><AppScreen className="couple-privacy" title={t("Votre espace et vos données")} subtitle={t("Comprendre ce qui est partagé, conservé et supprimé.")}>
    {!policy && <FeedbackState kind={error ? 'failure' : 'loading'} heading={error ? t("Impossible de charger les règles actuelles.") : t("On retrouve les règles de votre espace…")} />}
    {policy && <><section className="couple-card"><h2>{t("Un espace privé pour deux")}</h2><p>{t("Les contenus partagés sont accessibles aux deux membres actuels de votre couple. Les brouillons de notes, les anniversaires personnels et votre boîte de réception restent privés.")}</p><p>{t("Le service traite des contenus lisibles pour les stocker et les transmettre. Il n’utilise pas de chiffrement de bout en bout.")}</p></section>
      <section className="couple-card"><h2>{t("Durée des contenus")}</h2><p>{t("Les messages envoyés sont supprimés après {days} jours. Vos brouillons et messages programmés restent privés jusqu’à l’envoi.", { days: policy.sentNoteRetentionDays ?? 7 })}</p><p>{t("Les groupes de moments et leurs fichiers expirent") + " "}{policy.temporaryMemoryHours} {" " + t("heures après la création du groupe. Les photos d’envies suivent la durée de vie de l’envie.")}</p><p>{t("Après déconnexion du couple, les deux partenaires perdent immédiatement l’accès à l’espace. La suppression des contenus partagés restants est programmée après") + " "}{policy.closedSpaceRetentionDays} {" " + t("jours. Un futur couple crée un nouvel espace.")}</p><p>{t("Les suppressions de fichiers sont reprises automatiquement en cas de panne. Les copies déjà téléchargées et les liens temporaires déjà émis peuvent rester accessibles jusqu’à leur expiration.")}</p></section>
      <section className="couple-card"><h2>{t("Supprimer ou exporter")}</h2><p>{t("Depuis votre compte, vous pouvez exporter vos propres contributions à l’espace actuel ou demander sa suppression. La suppression du compte révoque immédiatement vos connexions et ferme le couple. Les fichiers sont ensuite retirés avec reprise en cas d’erreur.")}</p><div className="couple-policy-actions"><Link to={accountReady ? '/profile' : policy.accountDeletionPath}>{accountReady ? t("Gérer mes données dans mon compte") : t("Supprimer mon compte sans l’application")}</Link>{policy.supportEmail && <a href={`mailto:${policy.supportEmail}`}>{t("Contacter l’assistance")}</a>}</div></section>
    </>}
  </AppScreen></IonPage>;
}

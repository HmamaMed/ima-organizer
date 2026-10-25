import { useEffect, useState } from 'react';
import { IonPage } from '@ionic/react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { shieldCheckmarkOutline } from 'ionicons/icons';
import AppScreen from '../shared/ui/AppScreen';
import BrandHeader from '../shared/ui/BrandHeader';
import FeedbackState from '../shared/ui/FeedbackState';
import { apiRequest } from '../shared/api/client';
import { useCouplesSession } from './sessionContext';

interface Policy { temporaryMemoryHours: number; closedSpaceRetentionDays: number; supportEmail: string; endToEndEncrypted: boolean; accountDeletionPath: string }
export default function CouplesPrivacyPage() {
  const { user } = useCouplesSession();
  const history = useHistory();
  const location = useLocation<{ privacyReturnTo?: string }>();
  const accountReady = !!user && (user.emailVerified || user.emailVerificationRequired === false);
  const requestedReturn = location.state?.privacyReturnTo;
  const backTo = requestedReturn === '/' || requestedReturn === '/delete-account' ? requestedReturn : accountReady ? '/profile' : '/';
  const [policy, setPolicy] = useState<Policy | null>(null); const [error, setError] = useState(false);
  useEffect(() => { let active = true; void apiRequest<Policy>('/api/privacy/policy').then(value => { if (active) setPolicy(value); }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, []);
  return <IonPage lang="fr"><BrandHeader icon={shieldCheckmarkOutline} title="Confidentialité" accent="muted" showBack backLabel={backTo === '/profile' ? 'Retour au profil' : 'Retour à la connexion'} onBack={() => history.replace(backTo, { direction: 'back' })} /><AppScreen className="couple-privacy" title="Votre espace et vos données" subtitle="Comprendre ce qui est partagé, conservé et supprimé.">
    {!policy && <FeedbackState kind={error ? 'failure' : 'loading'} heading={error ? 'Impossible de charger les règles actuelles.' : 'On retrouve les règles de votre espace…'} />}
    {policy && <><section className="couple-card"><h2>Un espace privé pour deux</h2><p>Les contenus partagés sont accessibles aux deux membres actuels de votre couple. Les brouillons de notes, les anniversaires personnels et votre boîte de réception restent privés.</p><p>Le service traite des contenus lisibles pour les stocker et les transmettre. Il n’utilise pas de chiffrement de bout en bout.</p></section>
      <section className="couple-card"><h2>Durée des contenus</h2><p>Les groupes de moments et leurs fichiers expirent {policy.temporaryMemoryHours} heures après la création du groupe. Les photos d’envies suivent la durée de vie de l’envie.</p><p>Après déconnexion du couple, les deux partenaires perdent immédiatement l’accès à l’espace. La suppression des contenus partagés restants est programmée après {policy.closedSpaceRetentionDays} jours. Un futur couple crée un nouvel espace.</p><p>Les suppressions de fichiers sont reprises automatiquement en cas de panne. Les copies déjà téléchargées et les liens temporaires déjà émis peuvent rester accessibles jusqu’à leur expiration.</p></section>
      <section className="couple-card"><h2>Supprimer ou exporter</h2><p>Depuis votre compte, vous pouvez exporter vos propres contributions à l’espace actuel ou demander sa suppression. La suppression du compte révoque immédiatement vos connexions et ferme le couple. Les fichiers sont ensuite retirés avec reprise en cas d’erreur.</p><div className="couple-policy-actions"><Link to={accountReady ? '/profile' : policy.accountDeletionPath}>{accountReady ? 'Gérer mes données dans mon compte' : 'Supprimer mon compte sans l’application'}</Link>{policy.supportEmail && <a href={`mailto:${policy.supportEmail}`}>Contacter l’assistance</a>}</div></section>
    </>}
  </AppScreen></IonPage>;
}

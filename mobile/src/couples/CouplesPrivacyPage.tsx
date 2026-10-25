import { useEffect, useState } from 'react';
import { IonPage } from '@ionic/react';
import { Link } from 'react-router-dom';
import AppScreen from '../shared/ui/AppScreen';
import FeedbackState from '../shared/ui/FeedbackState';
import { apiRequest } from '../shared/api/client';

interface Policy { temporaryMemoryHours: number; closedSpaceRetentionDays: number; supportEmail: string; endToEndEncrypted: boolean; accountDeletionPath: string }
export default function CouplesPrivacyPage() {
  const [policy, setPolicy] = useState<Policy | null>(null); const [error, setError] = useState(false);
  useEffect(() => { let active = true; void apiRequest<Policy>('/api/privacy/policy').then(value => { if (active) setPolicy(value); }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, []);
  return <IonPage lang="fr"><AppScreen title="Votre espace et vos données." subtitle="Les règles de fonctionnement de cet environnement.">
    {!policy && <FeedbackState kind={error ? 'failure' : 'loading'} heading={error ? 'Impossible de charger les règles actuelles.' : 'On retrouve les règles de votre espace…'} />}
    {policy && <><section className="couple-card"><h2>Un espace privé pour deux</h2><p>Les contenus partagés sont accessibles aux deux membres actuels de votre couple. Les brouillons de notes, les anniversaires personnels et votre boîte de réception restent privés.</p><p>Le service traite des contenus lisibles pour les stocker et les transmettre. Il n’utilise pas de chiffrement de bout en bout.</p></section>
      <section className="couple-card"><h2>Durée des contenus</h2><p>Les groupes de moments et leurs fichiers expirent {policy.temporaryMemoryHours} heures après la création du groupe. Les photos d’envies suivent la durée de vie de l’envie.</p><p>Après déconnexion du couple, les deux partenaires perdent immédiatement l’accès à l’espace. La suppression des contenus partagés restants est programmée après {policy.closedSpaceRetentionDays} jours. Un futur couple crée un nouvel espace.</p><p>Les suppressions de fichiers sont reprises automatiquement en cas de panne. Les copies déjà téléchargées et les liens temporaires déjà émis peuvent rester accessibles jusqu’à leur expiration.</p></section>
      <section className="couple-card"><h2>Supprimer ou exporter</h2><p>Depuis votre compte, vous pouvez exporter vos propres contributions à l’espace actuel ou demander sa suppression. La suppression du compte révoque immédiatement vos connexions et ferme le couple. Les fichiers sont ensuite retirés avec reprise en cas d’erreur.</p><Link to={policy.accountDeletionPath}>Supprimer mon compte sans l’application</Link>{policy.supportEmail && <a href={`mailto:${policy.supportEmail}`}>Contacter l’assistance : {policy.supportEmail}</a>}</section>
    </>}
    <Link to="/home">Retour à l’application</Link>
  </AppScreen></IonPage>;
}

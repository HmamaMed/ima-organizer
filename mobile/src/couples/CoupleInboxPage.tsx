import { t, useI18n, getLanguage } from "../shared/i18n";
import { useCallback, useEffect, useState } from 'react';
import { IonPage, useIonViewWillEnter } from '@ionic/react';
import { notificationsOutline } from 'ionicons/icons';
import { Link } from 'react-router-dom';
import BrandHeader from '../shared/ui/BrandHeader';
import AppScreen from '../shared/ui/AppScreen';
import AppButton from '../shared/ui/AppButton';
import FeedbackState from '../shared/ui/FeedbackState';
import { apiRequest } from '../shared/api/client';
import { useCouplesSession } from './sessionContext';

interface Notice { id: string; kind: 'NOTE' | 'MEMORY'; resourceId: string; authorName: string; createdAt: string }
export default function CoupleInboxPage() {
  useI18n();
  const { token } = useCouplesSession();
  const [items, setItems] = useState<Notice[]>([]); const [page, setPage] = useState(0); const [more, setMore] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async (next = 0) => { if (!token) return; setLoading(true); setError(''); try { const data = await apiRequest<Notice[]>(`/api/inbox?page=${next}&size=30`, { token }); setItems(old => next ? [...old, ...data] : data); setPage(next); setMore(data.length === 30); } catch { setError(t("Impossible de charger vos notifications.")); } finally { setLoading(false); } }, [token]);
  useEffect(() => { void load(); }, [load]); useIonViewWillEnter(() => { void load(); });
  return <IonPage lang={getLanguage()}><BrandHeader title={t("Pour vous")} icon={notificationsOutline} accent="rose" showBack /><AppScreen title={t("Les attentions de votre partenaire.")}>
    {error && <p role="alert" className="couple-error">{error}</p>}{loading && !items.length && <FeedbackState kind="loading" heading={t("On retrouve vos notifications…")} />}{!loading && !items.length && <FeedbackState kind="empty" heading={t("Tout est calme ici.")} detail={t("Les nouveaux mots et moments de votre partenaire apparaîtront ici.")} />}
    {items.map(item => <article className="couple-card" key={item.id}><p>{item.authorName} {item.kind === 'NOTE' ? t("vous a laissé une note.") : t("a partagé un moment.")}</p><Link to={item.kind === 'NOTE' ? '/notes' : '/memories'}>{t("Ouvrir") + " "}{item.kind === 'NOTE' ? t("mes notes") : t("nos moments")}</Link><AppButton variant="quiet" onClick={() => { void apiRequest(`/api/inbox/${item.id}`, { token, method: 'DELETE' }).then(() => setItems(old => old.filter(row => row.id !== item.id))).catch(() => setError(t("Impossible de masquer cette notification."))); }}>{t("Masquer")}</AppButton></article>)}
    <div className="couple-actions"><AppButton variant="quiet" busy={loading} onClick={() => { void load(); }}>{t("Actualiser")}</AppButton>{more && <AppButton variant="secondary" busy={loading} onClick={() => { void load(page + 1); }}>{t("Voir plus")}</AppButton>}</div>
  </AppScreen></IonPage>;
}

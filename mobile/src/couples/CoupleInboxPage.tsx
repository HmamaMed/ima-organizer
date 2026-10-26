import { useI18n } from '../shared/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IonIcon, IonPage, IonRefresher, IonRefresherContent, useIonViewWillEnter } from '@ionic/react';
import { chevronForwardOutline, closeOutline, imagesOutline, mailOutline, notificationsOutline } from 'ionicons/icons';
import { Link } from 'react-router-dom';
import BrandHeader from '../shared/ui/BrandHeader';
import AppScreen from '../shared/ui/AppScreen';
import AppButton from '../shared/ui/AppButton';
import FeedbackState from '../shared/ui/FeedbackState';
import { apiRequest } from '../shared/api/client';
import { useCouplesSession } from './sessionContext';

interface Notice { id: string; kind: 'NOTE' | 'MEMORY'; resourceId: string; authorName: string; createdAt: string }
export default function CoupleInboxPage() {
  const { t, language } = useI18n();
  const { token, user } = useCouplesSession();
  const [items, setItems] = useState<Notice[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hiding, setHiding] = useState<string | null>(null);
  const [error, setError] = useState('');
  const version = useRef(0), pending = useRef(false);
  const load = useCallback(async (next = 0) => {
    if (!token) return;
    const read = ++version.current;
    setLoading(true); setError('');
    try {
      const data = await apiRequest<Notice[]>(`/api/inbox?page=${next}&size=30`, { token });
      if (read !== version.current) return;
      setItems(old => next ? [...new Map([...old, ...data].map(item => [item.id, item])).values()] : data);
      setPage(next); setMore(data.length === 30);
    } catch { if (read === version.current) setError(t('Impossible de charger vos notifications.')); }
    finally { if (read === version.current) setLoading(false); }
  }, [token, t]);
  useEffect(() => { const reads = version; void load(); return () => { reads.current++; }; }, [load]);
  useIonViewWillEnter(() => { void load(); });
  async function hide(item: Notice) {
    if (!token || pending.current) return;
    pending.current = true; setHiding(item.id);
    try {
      await apiRequest(`/api/inbox/${item.id}`, { token, method: 'DELETE' });
      version.current++; setLoading(false); setItems(old => old.filter(row => row.id !== item.id));
    } catch { setError(t('Impossible de masquer cette notification.')); }
    finally { pending.current = false; setHiding(null); }
  }
  return <IonPage lang={language}>
    <BrandHeader title={t('Pour vous')} icon={notificationsOutline} accent="rose" showBack />
    <AppScreen title={t('Les attentions de votre partenaire.')} subtitle={t('Un accès direct à ses mots et aux moments partagés.')}
      fixedContent={<IonRefresher slot="fixed" onIonRefresh={event => { void load().finally(() => event.detail.complete()); }}><IonRefresherContent /></IonRefresher>}>
      {error && <FeedbackState kind="failure" heading={t(error)} onRetry={() => { void load(); }} />}
      {loading && !items.length && <FeedbackState kind="loading" heading={t('On retrouve vos notifications…')} />}
      {!loading && !error && !items.length && <FeedbackState kind="empty" heading={t('Tout est calme ici.')} detail={t('Les nouveaux mots et moments de votre partenaire apparaîtront ici.')} />}
      <ul className="partner-inbox" aria-busy={loading}>
        {items.map(item => <li className="partner-notice" key={item.id}>
          <Link className="partner-notice__link" to={item.kind === 'NOTE' ? '/notes' : '/memories'}>
            <span className={`partner-notice__icon partner-notice__icon--${item.kind.toLowerCase()}`}><IonIcon icon={item.kind === 'NOTE' ? mailOutline : imagesOutline} aria-hidden="true" /></span>
            <span><strong>{item.kind === 'NOTE' ? t('Un petit mot de {name}', { name: item.authorName }) : t('Un moment partagé par {name}', { name: item.authorName })}</strong><time dateTime={item.createdAt}>{new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short', timeZone: user?.timeZone ?? 'UTC' }).format(new Date(item.createdAt))}</time></span>
            <IonIcon className="partner-notice__arrow" icon={chevronForwardOutline} aria-hidden="true" />
          </Link>
          <button type="button" className="icon-btn partner-notice__hide" aria-label={t('Masquer cette notification')} aria-busy={hiding === item.id} disabled={!!hiding} onClick={() => { void hide(item); }}><IonIcon icon={closeOutline} aria-hidden="true" /></button>
        </li>)}
      </ul>
      {more && <AppButton variant="secondary" busy={loading} onClick={() => { void load(page + 1); }}>{t('Voir plus')}</AppButton>}
    </AppScreen>
  </IonPage>;
}

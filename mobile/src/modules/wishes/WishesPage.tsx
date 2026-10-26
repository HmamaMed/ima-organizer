import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { IonContent, IonIcon, IonModal, IonPage, IonRefresher, IonRefresherContent, IonToast, useIonViewDidLeave, useIonViewWillEnter } from '@ionic/react';
import { addOutline, bookOutline, checkmarkCircle, checkmarkCircleOutline, createOutline, giftOutline, openOutline, sparklesOutline, trashOutline } from 'ionicons/icons';
import { useCouplesSession } from '../../couples/sessionContext';
import { useI18n } from '../../shared/i18n';
import AppScreen from '../../shared/ui/AppScreen';
import BrandHeader from '../../shared/ui/BrandHeader';
import AppButton from '../../shared/ui/AppButton';
import FeedbackState from '../../shared/ui/FeedbackState';
import ConfirmSheet from '../../shared/ui/ConfirmSheet';
import { ApiError } from '../../shared/api/client';
import WishEditor from './WishEditor';
import { completeWish, deleteWish, fetchWishes, WISH_CATEGORIES, type Wish, type WishCategory } from './wishesApi';
import './wishes.css';

const ICONS = { OBJECT: giftOutline, BOOK: bookOutline, EXPERIENCE: sparklesOutline };
export default function WishesPage() {
  const { t, language } = useI18n();
  const { user, token, space } = useCouplesSession();
  const partner = space?.members.find(member => member.userId !== user?.userId);
  const [owner, setOwner] = useState<'mine' | 'partner'>('mine');
  const [entries, setEntries] = useState<Wish[] | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<WishCategory | 'ALL'>('ALL');
  const [status, setStatus] = useState<'all' | 'open' | 'done'>('all');
  const [editor, setEditor] = useState<{ entry: Wish | null } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Wish | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const version = useRef(0), pending = useRef(false), active = useRef(false);
  const load = useCallback(async (next = 0) => {
    if (!token) return;
    const request = ++version.current; setLoading(true);
    try {
      const data = await fetchWishes(token, next, owner);
      if (request === version.current) { setEntries(old => next ? [...new Map([...(old ?? []), ...data].map(entry => [entry.id, entry])).values()] : data); setPage(next); setMore(data.length === 50); setError(null); }
    } catch { if (request === version.current) setError(t('Impossible de charger les envies.')); }
    finally { if (request === version.current) setLoading(false); }
  }, [token, owner, t]);
  useEffect(() => { const reads = version; setEntries(null); setMore(false); setFilter('ALL'); void load(); return () => { reads.current++; }; }, [load]);
  useIonViewWillEnter(() => { active.current = true; void load(); });
  useIonViewDidLeave(() => { active.current = false; });
  useEffect(() => {
    const refresh = () => { if (active.current && document.visibilityState === 'visible') void load(); };
    const interval = window.setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);
  const openEditor = (entry: Wish | null = null) => { setEditor({ entry }); setEditorOpen(true); };
  function saved(entry: Wish) {
    version.current++; setLoading(false); setError(null);
    setEntries(previous => [entry, ...(previous ?? []).filter(item => item.id !== entry.id)]);
    setFilter('ALL'); setStatus('all'); setEditorOpen(false); setToast(t('Une jolie envie, bien gardée.'));
  }
  async function toggleComplete(entry: Wish) {
    if (!token || pending.current) return;
    pending.current = true; setChanging(entry.id);
    try {
      const updated = await completeWish(token, entry.id, !entry.completedAt);
      version.current++; setLoading(false);
      setEntries(previous => (previous ?? []).map(item => item.id === updated.id ? updated : item));
      setToast(updated.completedAt ? t('Une envie réalisée !') : t('Envie remise dans les idées à réaliser.'));
    } catch { setError(t('Impossible de mettre à jour cette envie. Réessayez.')); }
    finally { pending.current = false; setChanging(null); }
  }
  async function remove() {
    if (!token || !selected || pending.current) return;
    pending.current = true; setDeleting(true); setDeleteError(null);
    try {
      try { await deleteWish(token, selected.id); }
      catch (cause) { if (!(cause instanceof ApiError && cause.status === 404)) throw cause; }
      version.current++; setLoading(false);
      setEntries(previous => (previous ?? []).filter(item => item.id !== selected.id));
      setSelected(null); setToast(t('Envie supprimée.'));
    } catch { setDeleteError(t('Impossible de supprimer cette envie. Réessayez.')); }
    finally { pending.current = false; setDeleting(false); }
  }
  function changeTab(event: KeyboardEvent<HTMLButtonElement>) {
    if (pending.current) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'mine' : event.key === 'End' ? 'partner' : owner === 'mine' ? 'partner' : 'mine';
    setOwner(next); document.getElementById(`wishes-tab-${next}`)?.focus();
  }
  const visible = entries?.filter(entry => (filter === 'ALL' || entry.category === filter) && (status === 'all' || (status === 'done') === !!entry.completedAt))
    .sort((a, b) => Number(!!a.completedAt) - Number(!!b.completedAt) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return <IonPage lang={language}>
    <BrandHeader icon={giftOutline} title={t('Nos envies')} accent="rose" showBack />
    <AppScreen eyebrow={t('Des idées à garder')} title={t('Les petits « j’aimerais ».')} subtitle={t('Deux carnets, et plein de petites attentions à réaliser.')}
      fixedContent={<IonRefresher slot="fixed" onIonRefresh={event => { void load().finally(() => event.detail.complete()); }}><IonRefresherContent /></IonRefresher>}>
      <div className="wishes">
        <div className="wish-owner-tabs" role="tablist" aria-label={t('Choisir un carnet d’envies')}>
          <button id="wishes-tab-mine" type="button" role="tab" aria-selected={owner === 'mine'} aria-controls="wishes-panel" tabIndex={owner === 'mine' ? 0 : -1} onKeyDown={changeTab} disabled={!!changing || deleting || saving} onClick={() => { if (!pending.current) setOwner('mine'); }}>{t('Mes envies')}</button>
          <button id="wishes-tab-partner" type="button" role="tab" aria-selected={owner === 'partner'} aria-controls="wishes-panel" tabIndex={owner === 'partner' ? 0 : -1} onKeyDown={changeTab} disabled={!!changing || deleting || saving} onClick={() => { if (!pending.current) setOwner('partner'); }}>{partner?.name ? t('Les envies de {name}', { name: partner.name }) : t('Ses envies')}</button>
        </div>
        <section id="wishes-panel" role="tabpanel" aria-labelledby={`wishes-tab-${owner}`} aria-busy={loading} className="wish-panel">
          {owner === 'mine' && <AppButton icon={addOutline} onClick={() => openEditor()}>{t('Ajouter une envie')}</AppButton>}
          {loading && !entries && <FeedbackState kind="loading" heading={t('On retrouve les petites envies…')} />}
          {error && <FeedbackState kind="failure" heading={error} onRetry={load} />}
          {!!entries?.length && <>
            <div className="wish-list-heading"><h2>{owner === 'mine' ? t('Mon carnet d’envies') : t('Son carnet d’envies')}</h2><select className="wish-status-filter" aria-label={t('Afficher les envies')} value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="all">{t('Toutes les envies')}</option><option value="open">{t('À réaliser')}</option><option value="done">{t('Réalisées')}</option></select></div>
            <div className="wish-filters" role="group" aria-label={t('Filtrer les envies')}>{[{ value: 'ALL', label: 'Tout' }, ...WISH_CATEGORIES].map(item => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value as WishCategory | 'ALL')}>{t(item.label)}</button>)}</div>
            {visible?.length === 0 && <FeedbackState kind="empty" heading={t('Aucune envie avec ces filtres.')} />}
            <div className="wish-grid">{visible?.map(entry => <article className={`wish-card ${entry.completedAt ? 'wish-card--done' : ''}`} key={entry.id}>
              {entry.photoUrl ? <img className="wish-card__photo" src={entry.photoUrl} alt={entry.title} loading="lazy" referrerPolicy="no-referrer" /> : <div className="wish-card__placeholder" aria-hidden="true"><IonIcon icon={ICONS[entry.category]} /></div>}
              <div className="wish-card__body"><span className="wish-tag">{t(WISH_CATEGORIES.find(item => item.value === entry.category)?.label ?? '')}</span><h3>{entry.title}</h3>{entry.details && <p className="wish-card__details">{entry.details}</p>}
                {entry.link && <a className="wish-link" href={entry.link} target="_blank" rel="noopener noreferrer"><span>{t('Voir le lien')}</span><IonIcon icon={openOutline} aria-hidden="true" /><span className="wish-sr-only">{t('pour {title} (nouvelle fenêtre)', { title: entry.title })}</span></a>}
                <button type="button" className="wish-complete" aria-pressed={!!entry.completedAt} aria-label={entry.completedAt ? t('Marquer {title} comme à réaliser', { title: entry.title }) : t('Marquer {title} comme réalisée', { title: entry.title })} disabled={!!changing} aria-busy={changing === entry.id} onClick={() => { void toggleComplete(entry); }}><IonIcon icon={entry.completedAt ? checkmarkCircle : checkmarkCircleOutline} aria-hidden="true" />{entry.completedAt ? t('Réalisée') : t('Marquer comme réalisée')}</button>
                {entry.ownerId === user?.userId && <div className="wish-card__actions"><button type="button" className="icon-btn" aria-label={t('Modifier {title}', { title: entry.title })} onClick={() => openEditor(entry)}><IonIcon icon={createOutline} /></button><button type="button" className="icon-btn wish-delete" aria-label={t('Supprimer {title}', { title: entry.title })} onClick={() => { setSelected(entry); setDeleteError(null); }}><IonIcon icon={trashOutline} /></button></div>}
              </div>
            </article>)}</div>
          </>}
          {more && <AppButton variant="secondary" busy={loading} onClick={() => { void load(page + 1); }}>{t('Voir plus d’envies')}</AppButton>}
          {entries?.length === 0 && !error && <section className="wish-empty"><span className="wish-symbol"><IonIcon icon={sparklesOutline} aria-hidden="true" /></span><h2>{t('Les belles idées commencent ici.')}</h2><p>{owner === 'mine' ? t('Ce livre repéré, ce joli objet, cette sortie à deux… Gardez votre première envie.') : t('Les envies de votre partenaire apparaîtront dans ce carnet.')}</p></section>}
        </section>
        <p className="wish-footnote">{t('Un carnet à deux, pour les petites et les grandes attentions.')}</p>
      </div>
    </AppScreen>
    <IonModal isOpen={editorOpen} className="wish-editor" canDismiss={!saving} aria-labelledby="wish-editor-title" onDidPresent={() => document.getElementById('wish-title')?.focus()} onDidDismiss={() => { setEditorOpen(false); setEditor(null); }}><IonContent>{editor && token && <WishEditor entry={editor.entry} token={token} onSaved={saved} onClose={() => setEditorOpen(false)} onBusyChange={setSaving} />}</IonContent></IonModal>
    <ConfirmSheet open={!!selected} title={t('Supprimer cette envie ?')} detail={deleteError ?? t('« {title} » et sa photo seront supprimés du carnet.', { title: selected?.title ?? '' })} confirmLabel={t('Supprimer l’envie')} cancelLabel={t('Annuler')} busy={deleting} onConfirm={() => { void remove(); }} onClose={() => { setSelected(null); setDeleteError(null); }} />
    <IonToast isOpen={!!toast} message={toast} duration={2400} onDidDismiss={() => setToast('')} />
  </IonPage>;
}

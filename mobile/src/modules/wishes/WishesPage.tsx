import { useCallback, useEffect, useRef, useState } from 'react';
import { IonContent, IonIcon, IonModal, IonPage, IonRefresher, IonRefresherContent, IonToast, useIonViewDidLeave, useIonViewWillEnter } from '@ionic/react';
import { addOutline, bookOutline, createOutline, giftOutline, openOutline, sparklesOutline, trashOutline } from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import AppScreen from '../../shared/ui/AppScreen';
import BrandHeader from '../../shared/ui/BrandHeader';
import AppButton from '../../shared/ui/AppButton';
import FeedbackState from '../../shared/ui/FeedbackState';
import ConfirmSheet from '../../shared/ui/ConfirmSheet';
import { ApiError } from '../../shared/api/client';
import WishEditor from './WishEditor';
import { deleteWish, fetchWishes, WISH_CATEGORIES, type Wish, type WishCategory } from './wishesApi';
import './wishes.css';

const ICONS = { OBJECT: giftOutline, BOOK: bookOutline, EXPERIENCE: sparklesOutline };

export default function WishesPage() {
  const { user, token } = useAuth();
  const canEdit = user?.role === 'RECIPIENT';
  const [entries, setEntries] = useState<Wish[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<WishCategory | 'ALL'>('ALL');
  const [editor, setEditor] = useState<{ entry: Wish | null } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Wish | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const version = useRef(0);
  const pending = useRef(false);
  const active = useRef(false);
  const load = useCallback(async () => {
    if (!token) return;
    const request = ++version.current; setLoading(true);
    try {
      const data = await fetchWishes(token);
      if (request === version.current) { setEntries(data); setError(null); }
    } catch { if (request === version.current) setError('Impossible de charger les envies.'); }
    finally { if (request === version.current) setLoading(false); }
  }, [token]);
  useIonViewWillEnter(() => { active.current = true; void load(); });
  useIonViewDidLeave(() => { active.current = false; });
  useEffect(() => {
    const requests = version;
    const refresh = () => { if (active.current && document.visibilityState === 'visible') void load(); };
    const interval = window.setInterval(refresh, 5 * 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { ++requests.current; window.clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);
  const openEditor = (entry: Wish | null = null) => { setEditor({ entry }); setEditorOpen(true); };
  function saved(entry: Wish) {
    ++version.current; setLoading(false); setError(null);
    setEntries(previous => [entry, ...(previous ?? []).filter(item => item.id !== entry.id)]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id)));
    setFilter('ALL'); setEditorOpen(false); setToast('Une jolie envie, bien gardée.');
  }
  async function remove() {
    if (!token || !selected || pending.current) return;
    pending.current = true; setDeleting(true); setDeleteError(null);
    try {
      try { await deleteWish(token, selected.id); }
      catch (cause) { if (!(cause instanceof ApiError && cause.status === 404)) throw cause; }
      ++version.current; setLoading(false);
      setEntries(previous => (previous ?? []).filter(item => item.id !== selected.id));
      setSelected(null); setToast('Envie supprimée.');
    } catch { setDeleteError('Impossible de supprimer cette envie. Réessayez.'); }
    finally { pending.current = false; setDeleting(false); }
  }
  const visible = entries?.filter(entry => filter === 'ALL' || entry.category === filter);
  return <IonPage lang="fr">
    <BrandHeader icon={giftOutline} title="Mes envies" accent="rose" showBack />
    <AppScreen eyebrow="Des idées à garder" title={canEdit ? 'Les petits « j’aimerais ».' : 'Ce qui lui ferait plaisir.'}
      subtitle={canEdit ? 'Un objet, un livre, une expérience… Une place pour tout ce qui vous fait envie.' : 'Ses envies, ses petits détails. De jolies pistes pour un prochain cadeau.'}
      fixedContent={<IonRefresher slot="fixed" onIonRefresh={event => { void load().finally(() => event.detail.complete()); }}><IonRefresherContent /></IonRefresher>}>
      <div className="wishes" aria-busy={loading}>
        <section className="wish-intro"><span className="wish-symbol"><IonIcon icon={giftOutline} aria-hidden="true" /></span><div><h2>{canEdit ? 'Une envie aujourd’hui, un sourire demain.' : 'Des attentions qui tombent juste.'}</h2><p>{canEdit ? 'Gardez l’idée, votre partenaire pourra la retrouver ici.' : 'Une liste imaginée par elle, à retrouver quand vous cherchez une idée.'}</p></div></section>
        {canEdit && <AppButton icon={addOutline} onClick={() => openEditor()}>Ajouter une envie</AppButton>}
        {loading && !entries && <FeedbackState kind="loading" heading="On retrouve les petites envies…" />}
        {error && <FeedbackState kind="failure" heading={error} onRetry={load} />}
        {!!entries?.length && <>
          <div className="wish-list-heading"><h2>{canEdit ? 'Mon carnet d’envies' : 'Son carnet d’envies'}</h2><span>{entries.length} {entries.length === 1 ? 'idée' : 'idées'}</span></div>
          <div className="wish-filters" role="group" aria-label="Filtrer les envies">
            {[{ value: 'ALL', label: 'Tout' }, ...WISH_CATEGORIES].map(item => <button key={item.value} type="button" aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value as WishCategory | 'ALL')}>{item.label}</button>)}
          </div>
          {visible?.length === 0 && <FeedbackState kind="empty" heading="Pas encore d’envie dans cette catégorie." />}
          <div className="wish-grid">{visible?.map(entry => <article className="wish-card" key={entry.id}>
            {entry.photoUrl ? <img className="wish-card__photo" src={entry.photoUrl} alt={entry.title} loading="lazy" referrerPolicy="no-referrer" />
              : <div className="wish-card__placeholder" aria-hidden="true"><IonIcon icon={ICONS[entry.category]} /></div>}
            <div className="wish-card__body"><span className="wish-tag">{WISH_CATEGORIES.find(item => item.value === entry.category)?.label}</span>
              <h3>{entry.title}</h3>{entry.details && <p className="wish-card__details">{entry.details}</p>}
              {entry.link && <a className="wish-link" href={entry.link} target="_blank" rel="noopener noreferrer"><span>Voir le lien</span><IonIcon icon={openOutline} aria-hidden="true" /><span className="wish-sr-only"> pour {entry.title} (nouvelle fenêtre)</span></a>}
              {canEdit && <div className="wish-card__actions">
                <button type="button" className="icon-btn" aria-label={`Modifier ${entry.title}`} onClick={() => openEditor(entry)}><IonIcon icon={createOutline} /></button>
                <button type="button" className="icon-btn wish-delete" aria-label={`Supprimer ${entry.title}`} onClick={() => { setSelected(entry); setDeleteError(null); }}><IonIcon icon={trashOutline} /></button>
              </div>}
            </div>
          </article>)}</div>
        </>}
        {entries?.length === 0 && !error && <section className="wish-empty"><span className="wish-symbol"><IonIcon icon={sparklesOutline} aria-hidden="true" /></span>
          <h2>Les belles idées commencent ici.</h2><p>{canEdit ? 'Ce livre repéré, ce joli objet, cette sortie à deux… Gardez votre première envie.' : 'Ses premières envies apparaîtront ici. Un peu de patience, les idées vont venir.'}</p></section>}
        <p className="wish-footnote">Un carnet à deux, pour les petites et les grandes attentions.</p>
      </div>
    </AppScreen>
    <IonModal isOpen={editorOpen} className="wish-editor" canDismiss={!saving} aria-labelledby="wish-editor-title"
      onDidPresent={() => document.getElementById('wish-title')?.focus()} onDidDismiss={() => { setEditorOpen(false); setEditor(null); }}>
      <IonContent>{editor && token && <WishEditor entry={editor.entry} token={token} onSaved={saved} onClose={() => setEditorOpen(false)} onBusyChange={setSaving} />}</IonContent>
    </IonModal>
    <ConfirmSheet open={!!selected} title="Supprimer cette envie ?" detail={deleteError ?? `« ${selected?.title ?? ''} » et sa photo seront supprimés du carnet.`}
      confirmLabel="Supprimer l’envie" cancelLabel="Annuler" busy={deleting} onConfirm={() => { void remove(); }} onClose={() => { setSelected(null); setDeleteError(null); }} />
    <IonToast isOpen={!!toast} message={toast} duration={2400} onDidDismiss={() => setToast('')} />
  </IonPage>;
}

import { t, useI18n, getLanguage } from "../../shared/i18n";
import { useCallback, useRef, useState } from 'react';
import { IonContent, IonIcon, IonModal, IonPage, IonRefresher, IonRefresherContent, IonToast } from '@ionic/react';
import { addOutline, createOutline, filmOutline, star, trashOutline, tvOutline } from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import AppScreen from '../../shared/ui/AppScreen';
import BrandHeader from '../../shared/ui/BrandHeader';
import AppButton from '../../shared/ui/AppButton';
import FeedbackState from '../../shared/ui/FeedbackState';
import NotebookDeleteSheet from '../../shared/notebooks/NotebookDeleteSheet';
import { useNotebookEntries } from '../../shared/notebooks/useNotebookEntries';
import WatchEditor from './WatchEditor';
import WatchReviewEditor from './WatchReviewEditor';
import { changeWatchStatus, fetchWatchlist, WATCH_STATUSES, type WatchItem, type WatchKind, type WatchStatus } from './watchlistApi';
import '../../shared/notebooks/notebooks.css';
import './watchlist.css';

export default function WatchlistPage() {
  useI18n();
  const { user } = useAuth();
  const [filter, setFilter] = useState<WatchStatus | 'ALL'>('ALL');
  const [kind, setKind] = useState<WatchKind | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const fetchEntries = useCallback((token: string, page = 0) => fetchWatchlist(token, page, { q: search, kind, status: filter }), [search, kind, filter]);
  const collection = useNotebookEntries(fetchEntries);
  const [editor, setEditor] = useState<{ entry: WatchItem | null } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [review, setReview] = useState<WatchItem | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<WatchItem | null>(null);
  const [changing, setChanging] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const pending = useRef(false);
  const entries = collection.entries;
  const visible = entries?.filter(entry => (filter === 'ALL' || entry.status === filter) && (kind === 'ALL' || entry.kind === kind)
    && `${entry.title} ${entry.notes ?? ''}`.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr')));
  const openEditor = (entry: WatchItem | null = null) => { setEditor({ entry }); setEditorOpen(true); };
  function saved(entry: WatchItem) {
    collection.saved(entry); setEditorOpen(false); setReviewOpen(false); setMutationError(null); setToast(t("Bien gardé dans notre sélection."));
  }
  async function changeStatus(entry: WatchItem, status: WatchStatus) {
    if (!collection.token || pending.current) return;
    pending.current = true; setChanging(entry.id); setMutationError(null);
    try { collection.saved(await changeWatchStatus(collection.token, entry.id, status)); }
    catch { setMutationError(t("Le statut n’a pas pu être modifié. Réessayez.")); }
    finally { pending.current = false; setChanging(null); }
  }
  return <IonPage lang={getLanguage()} className="notebook--plum">
    <BrandHeader icon={filmOutline} title={t("On regarde quoi ?")} accent="plum" showBack />
    <AppScreen eyebrow={t("Notre sélection")} title={t("Une soirée. Deux regards.")} subtitle={t("Les films et les séries qu’on se promet de découvrir ensemble.")}
      fixedContent={<IonRefresher slot="fixed" onIonRefresh={event => { void collection.load().finally(() => event.detail.complete()); }}><IonRefresherContent /></IonRefresher>}>
      <div className="notebook watchlist" aria-busy={collection.loading}>
        <section className="notebook-feature"><span className="notebook-symbol"><IonIcon icon={filmOutline} aria-hidden="true" /></span><div><h2>{t("Le plaisir de choisir à deux.")}</h2><p>{t("À voir, en cours ou déjà vu. Et, après le générique, chacun son avis.")}</p></div></section>
        <AppButton icon={addOutline} onClick={() => openEditor()}>{t("Ajouter un film ou une série")}</AppButton>
        {collection.loading && !entries && <FeedbackState kind="loading" heading={t("On retrouve notre sélection…")} />}
        {collection.error && <FeedbackState kind="failure" heading={t("Impossible de charger la sélection.")} onRetry={collection.load} retryLabel="Réessayer" />}
        {mutationError && <p className="notebook-error" role="alert">{mutationError}</p>}
        {!!entries?.length && <>
          <div className="notebook-heading"><h2>{t("Notre liste")}</h2><span>{entries.length} {entries.length === 1 ? 'titre' : 'titres'}</span></div>
          <div className="notebook-filters" role="group" aria-label={t("Filtrer par statut")}>{[{ value: 'ALL', label: t("Tout") }, ...WATCH_STATUSES].map(item => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value as WatchStatus | 'ALL')}>{t(item.label)}</button>)}</div>
          <div className="notebook-search-row"><label><span className="notebook-sr-only">{t("Rechercher un titre")}</span><input type="search" aria-label={t("Rechercher un titre")} placeholder={t("Un titre en tête ?")} value={search} onChange={event => setSearch(event.target.value)} /></label>
            <select aria-label={t("Filtrer par format")} value={kind} onChange={event => setKind(event.target.value as WatchKind | 'ALL')}><option value="ALL">{t("Tous les formats")}</option><option value="FILM">{t("Films")}</option><option value="SERIES">{t("Séries")}</option></select></div>
          {visible?.length === 0 && <FeedbackState kind="empty" heading={t("Aucun titre ici pour le moment.")} detail={t("Essayez un autre filtre ou une autre recherche.")} />}
          <div className="notebook-grid">{visible?.map(entry => <article className="notebook-card watch-card" key={entry.id}>
            <div className="notebook-card__top"><span className="notebook-symbol"><IonIcon icon={entry.kind === 'FILM' ? filmOutline : tvOutline} aria-hidden="true" /></span><div><p className="notebook-card__kind">{entry.kind === 'FILM' ? t("Film") : t("Série")}</p><h3>{entry.title}</h3></div></div>
            {entry.notes && <p className="notebook-copy">{entry.notes}</p>}
            {!!entry.reviews.length && <section className="watch-reviews" aria-label={t("Avis sur {v0}", { v0: entry.title })}>{entry.reviews.map(opinion => <div className="watch-opinion" key={opinion.userId}>
              <div className="watch-opinion__heading"><strong>{opinion.userId === user?.userId ? t("Votre avis") : opinion.name}</strong><span aria-label={t("{v0} sur 5", { v0: opinion.rating })}><IonIcon icon={star} aria-hidden="true" />{opinion.rating}/5</span></div>
              {opinion.comment && <p className="notebook-copy">{opinion.comment}</p>}
            </div>)}</section>}
            {entry.status === 'WATCHED' ? <AppButton variant="secondary" icon={star} disabled={!!changing} onClick={() => { setReview(entry); setReviewOpen(true); }}>{entry.reviews.some(opinion => opinion.userId === user?.userId) ? t("Modifier mon avis") : t("Donner mon avis")}</AppButton>
              : <p className="watch-review-hint">{t("Votre avis après la séance.")}</p>}
            <div className="notebook-card__footer"><select className="notebook-status" aria-label={t("Statut de {v0}", { v0: entry.title })} value={entry.status} disabled={!!changing} onChange={event => { void changeStatus(entry, event.target.value as WatchStatus); }}>
              {WATCH_STATUSES.map(item => <option key={item.value} value={item.value}>{t(item.label)}</option>)}
            </select><div className="notebook-actions"><button className="icon-btn" type="button" aria-label={t("Modifier {v0}", { v0: entry.title })} disabled={changing === entry.id} onClick={() => openEditor(entry)}><IonIcon icon={createOutline} /></button><button className="icon-btn notebook-delete" type="button" aria-label={t("Supprimer {v0}", { v0: entry.title })} disabled={changing === entry.id} onClick={() => setToDelete(entry)}><IonIcon icon={trashOutline} /></button></div></div>
          </article>)}</div>
        </>}
        {entries?.length === 0 && !collection.error && <section className="notebook-empty"><span className="notebook-symbol"><IonIcon icon={tvOutline} aria-hidden="true" /></span><h2>{t("Le canapé vous attend.")}</h2><p>{t("Gardez ce film conseillé par un ami ou cette série dont vous parlez depuis des semaines.")}</p></section>}
        {collection.more && <AppButton variant="secondary" busy={collection.loading} onClick={() => { void collection.loadMore(); }}>{t("Voir plus de titres")}</AppButton>}
        <p className="notebook-footnote">{t("Une liste partagée. Des avis qui vous ressemblent.")}</p>
      </div>
    </AppScreen>
    <IonModal isOpen={editorOpen} className="notebook-editor notebook--plum" canDismiss={!saving} aria-labelledby="watch-editor-title" onDidPresent={() => document.getElementById('watch-title')?.focus()} onDidDismiss={() => { setEditorOpen(false); setEditor(null); }}><IonContent>{editor && collection.token && <WatchEditor entry={editor.entry} token={collection.token} onSaved={saved} onClose={() => setEditorOpen(false)} onBusyChange={setSaving} />}</IonContent></IonModal>
    <IonModal isOpen={reviewOpen} className="notebook-editor notebook--plum" canDismiss={!saving} aria-labelledby="watch-review-title" onDidPresent={() => document.getElementById('watch-review-comment')?.focus()} onDidDismiss={() => { setReviewOpen(false); setReview(null); }}><IonContent>{review && collection.token && user && <WatchReviewEditor entry={review} userId={user.userId} token={collection.token} onSaved={saved} onClose={() => setReviewOpen(false)} onBusyChange={setSaving} />}</IonContent></IonModal>
    <NotebookDeleteSheet entry={toDelete} resource="/api/watchlist" title={t("Retirer ce titre ?")} detail={t("le titre et vos deux avis seront retirés de la sélection.")} onDeleted={id => { collection.removed(id); setToast(t("Titre retiré.")); }} onClose={() => setToDelete(null)} />
    <IonToast isOpen={!!toast} message={toast} duration={2400} onDidDismiss={() => setToast('')} />
  </IonPage>;
}

import { useCallback, useRef, useState } from 'react';
import { IonContent, IonIcon, IonModal, IonPage, IonRefresher, IonRefresherContent, IonToast } from '@ionic/react';
import { addOutline, createOutline, heartOutline, peopleOutline, restaurantOutline, timeOutline, trashOutline } from 'ionicons/icons';
import AppScreen from '../../shared/ui/AppScreen';
import BrandHeader from '../../shared/ui/BrandHeader';
import AppButton from '../../shared/ui/AppButton';
import FeedbackState from '../../shared/ui/FeedbackState';
import NotebookDeleteSheet from '../../shared/notebooks/NotebookDeleteSheet';
import { useNotebookEntries } from '../../shared/notebooks/useNotebookEntries';
import RecipeEditor from './RecipeEditor';
import RecipeDetail from './RecipeDetail';
import { changeRecipeStatus, fetchRecipes, RECIPE_STATUSES, type Recipe, type RecipeStatus } from './recipesApi';
import '../../shared/notebooks/notebooks.css';
import './recipes.css';

export default function RecipesPage() {
  const [filter, setFilter] = useState<RecipeStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const fetchEntries = useCallback((token: string, page = 0) => fetchRecipes(token, page, search), [search]);
  const collection = useNotebookEntries(fetchEntries);
  const [editor, setEditor] = useState<{ entry: Recipe | null } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Recipe | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Recipe | null>(null);
  const [changing, setChanging] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const pending = useRef(false);
  const entries = collection.entries;
  const visible = entries?.filter(entry => (filter === 'ALL' || entry.status === filter)
    && `${entry.title} ${entry.ingredients.map(item => item.name).join(' ')} ${entry.tips ?? ''}`.toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr')));
  const openEditor = (entry: Recipe | null = null) => { setEditor({ entry }); setEditorOpen(true); };
  function saved(entry: Recipe) {
    collection.saved(entry); setEditorOpen(false); setMutationError(null); setToast('Une recette de plus à partager.');
  }
  async function toggleFavorite(entry: Recipe) {
    if (!collection.token || pending.current) return;
    pending.current = true; setChanging(entry.id); setMutationError(null);
    try { collection.saved(await changeRecipeStatus(collection.token, entry.id, entry.status === 'FAVORITE' ? 'TO_TRY' : 'FAVORITE')); }
    catch { setMutationError('La catégorie n’a pas pu être modifiée. Réessayez.'); }
    finally { pending.current = false; setChanging(null); }
  }
  return <IonPage lang="fr" className="notebook--gold">
    <BrandHeader icon={restaurantOutline} title="Nos recettes" accent="gold" showBack />
    <AppScreen eyebrow="Notre carnet de cuisine" title="Ça se partage, ça se savoure." subtitle="Les plats qu’on aime, ceux qu’on veut essayer, et nos petits secrets en cuisine."
      fixedContent={<IonRefresher slot="fixed" onIonRefresh={event => { void collection.load().finally(() => event.detail.complete()); }}><IonRefresherContent /></IonRefresher>}>
      <div className="notebook recipes" aria-busy={collection.loading}>
        <section className="notebook-feature"><span className="notebook-symbol"><IonIcon icon={restaurantOutline} aria-hidden="true" /></span><div><h2>Les bonnes choses se gardent.</h2><p>Une recette à tester, un plat devenu un classique. Tout notre carnet, à deux.</p></div></section>
        <AppButton icon={addOutline} onClick={() => openEditor()}>Ajouter une recette</AppButton>
        {collection.loading && !entries && <FeedbackState kind="loading" heading="On ouvre le carnet…" />}
        {collection.error && <FeedbackState kind="failure" heading="Impossible de charger les recettes." onRetry={collection.load} retryLabel="Réessayer" />}
        {mutationError && <p className="notebook-error" role="alert">{mutationError}</p>}
        {!!entries?.length && <>
          <div className="notebook-heading"><h2>Dans notre carnet</h2><span>{entries.length} {entries.length === 1 ? 'recette' : 'recettes'}</span></div>
          <div className="notebook-filters" role="group" aria-label="Filtrer les recettes">{[{ value: 'ALL', label: 'Tout' }, ...RECIPE_STATUSES].map(item => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value as RecipeStatus | 'ALL')}>{item.label}</button>)}</div>
          <div className="notebook-search-row"><label><span className="notebook-sr-only">Rechercher une recette ou un ingrédient</span><input type="search" aria-label="Rechercher une recette ou un ingrédient" placeholder="Un plat, un ingrédient…" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
          {visible?.length === 0 && <FeedbackState kind="empty" heading="Aucune recette ici pour le moment." detail="Essayez un autre filtre ou un autre ingrédient." />}
          <div className="notebook-grid">{visible?.map(entry => <article className="notebook-card recipe-card" key={entry.id}>
            <div className="notebook-card__top"><span className="notebook-symbol"><IonIcon icon={entry.status === 'FAVORITE' ? heartOutline : restaurantOutline} aria-hidden="true" /></span><div><p className="notebook-card__kind">{RECIPE_STATUSES.find(item => item.value === entry.status)?.label}</p><h3>{entry.title}</h3></div></div>
            <div className="recipe-meta"><span><IonIcon icon={peopleOutline} aria-hidden="true" />{entry.servings} {entry.servings === 1 ? 'personne' : 'personnes'}</span>{entry.minutes && <span><IonIcon icon={timeOutline} aria-hidden="true" />{entry.minutes} min</span>}<span>{entry.ingredients.length} {entry.ingredients.length === 1 ? 'ingrédient' : 'ingrédients'}</span></div>
            {entry.tips && <p className="notebook-copy recipe-card__tip">{entry.tips}</p>}
            <AppButton variant="secondary" onClick={() => { setDetail(entry); setDetailOpen(true); }}>Voir la recette</AppButton>
            <div className="notebook-card__footer"><button type="button" className="recipe-favorite" disabled={!!changing} onClick={() => { void toggleFavorite(entry); }} aria-label={`${entry.status === 'FAVORITE' ? 'Remettre à essayer' : 'Mettre en favori'} : ${entry.title}`}><IonIcon icon={heartOutline} aria-hidden="true" />{entry.status === 'FAVORITE' ? 'À essayer' : 'Mettre en favori'}</button>
              <div className="notebook-actions"><button type="button" className="icon-btn" aria-label={`Modifier ${entry.title}`} disabled={changing === entry.id} onClick={() => openEditor(entry)}><IonIcon icon={createOutline} /></button><button type="button" className="icon-btn notebook-delete" aria-label={`Supprimer ${entry.title}`} disabled={changing === entry.id} onClick={() => setToDelete(entry)}><IonIcon icon={trashOutline} /></button></div>
            </div>
          </article>)}</div>
        </>}
        {entries?.length === 0 && !collection.error && <section className="notebook-empty"><span className="notebook-symbol"><IonIcon icon={restaurantOutline} aria-hidden="true" /></span><h2>La première page sent déjà bon.</h2><p>Ajoutez ce plat que vous aimez préparer ou la recette qu’on essaiera ensemble.</p></section>}
        {collection.more && <AppButton variant="secondary" busy={collection.loading} onClick={() => { void collection.loadMore(); }}>Voir plus de recettes</AppButton>}
        <p className="notebook-footnote">Nos idées, nos astuces, nos petits classiques.</p>
      </div>
    </AppScreen>
    <IonModal isOpen={editorOpen} className="notebook-editor notebook--gold" canDismiss={!saving} aria-labelledby="recipe-editor-title" onDidPresent={() => document.getElementById('recipe-title')?.focus()} onDidDismiss={() => { setEditorOpen(false); setEditor(null); }}><IonContent>{editor && collection.token && <RecipeEditor entry={editor.entry} token={collection.token} onSaved={saved} onClose={() => setEditorOpen(false)} onBusyChange={setSaving} />}</IonContent></IonModal>
    <IonModal isOpen={detailOpen} className="notebook-editor notebook--gold" aria-labelledby="recipe-detail-title" onDidDismiss={() => { setDetailOpen(false); setDetail(null); }}><IonContent>{detail && <RecipeDetail recipe={detail} onClose={() => setDetailOpen(false)} />}</IonContent></IonModal>
    <NotebookDeleteSheet entry={toDelete} resource="/api/recipes" title="Supprimer cette recette ?" detail="les ingrédients, les étapes et les astuces seront retirés du carnet partagé." onDeleted={id => { collection.removed(id); setToast('Recette supprimée.'); }} onClose={() => setToDelete(null)} />
    <IonToast isOpen={!!toast} message={toast} duration={2400} onDidDismiss={() => setToast('')} />
  </IonPage>;
}

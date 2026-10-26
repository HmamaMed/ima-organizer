import { t, useI18n } from "../../shared/i18n";
import { useRef, useState, type FormEvent } from 'react';
import { IonIcon } from '@ionic/react';
import { addOutline, trashOutline } from 'ionicons/icons';
import AppButton from '../../shared/ui/AppButton';
import NotebookEditorFrame from '../../shared/notebooks/NotebookEditorFrame';
import { RECIPE_STATUSES, saveRecipe, type Recipe, type RecipeStatus } from './recipesApi';

export default function RecipeEditor({ entry, token, onSaved, onClose, onBusyChange }: {
  entry: Recipe | null; token: string; onSaved: (entry: Recipe) => void; onClose: () => void; onBusyChange: (busy: boolean) => void;
}) {
  useI18n();
  const [title, setTitle] = useState(entry?.title ?? '');
  const [status, setStatus] = useState<RecipeStatus>(entry?.status ?? 'TO_TRY');
  const [servings, setServings] = useState(String(entry?.servings ?? 2));
  const [minutes, setMinutes] = useState(entry?.minutes ? String(entry.minutes) : '');
  const [tips, setTips] = useState(entry?.tips ?? '');
  const [ingredients, setIngredients] = useState(() => (entry?.ingredients ?? [{ name: '', amount: '' }]).map((item, index) => ({ key: `initial-${index}`, name: item.name, amount: item.amount ?? '' })));
  const [steps, setSteps] = useState(() => (entry?.steps ?? ['']).map((text, index) => ({ key: `initial-${index}`, text })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const rowId = useRef(0);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    if (!title.trim() || ingredients.some(item => !item.name.trim()) || steps.some(item => !item.text.trim())) {
      setError(t("Ajoutez un titre, un nom pour chaque ingrédient et les étapes de la recette.")); return;
    }
    pending.current = true; setBusy(true); onBusyChange(true); setError(null);
    try {
      onSaved(await saveRecipe(token, { title: title.trim(), status, servings: Number(servings), minutes: minutes ? Number(minutes) : null,
        ingredients: ingredients.map(item => ({ name: item.name.trim(), amount: item.amount.trim() || null })),
        steps: steps.map(item => item.text.trim()), tips: tips.trim() || null }, entry?.id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Impossible d’enregistrer la recette. Réessayez.")); }
    finally { pending.current = false; setBusy(false); onBusyChange(false); }
  }
  return <NotebookEditorFrame title={entry ? t("La recette, à votre façon.") : t("Qu’est-ce qu’on cuisine ?")} titleId="recipe-editor-title" eyebrow={t("Notre carnet de cuisine")}
    busy={busy} error={error} submitLabel={entry ? t("Enregistrer les modifications") : t("Garder cette recette")} onClose={onClose} onSubmit={submit}>
    <label className="notebook-field" htmlFor="recipe-title"><span>{t("Nom de la recette *")}</span><input id="recipe-title" required maxLength={150} value={title} onChange={event => setTitle(event.target.value)} placeholder={t("Nos pâtes du dimanche…")} autoComplete="off" /></label>
    <label className="notebook-field" htmlFor="recipe-status"><span>{t("Dans le carnet")}</span><select id="recipe-status" value={status} onChange={event => setStatus(event.target.value as RecipeStatus)}>{RECIPE_STATUSES.map(item => <option key={item.value} value={item.value}>{t(item.label)}</option>)}</select></label>
    <div className="notebook-field-row"><label className="notebook-field" htmlFor="recipe-servings"><span>{t("Personnes *")}</span><input id="recipe-servings" type="number" required min={1} max={50} step={1} inputMode="numeric" value={servings} onChange={event => setServings(event.target.value)} /></label>
      <label className="notebook-field" htmlFor="recipe-minutes"><span>{t("Durée en minutes") + " "}<small>{t("facultatif")}</small></span><input id="recipe-minutes" type="number" min={1} max={1440} step={1} inputMode="numeric" value={minutes} onChange={event => setMinutes(event.target.value)} placeholder="30" /></label></div>
    <section className="recipe-form-section" aria-labelledby="recipe-ingredients-heading"><h3 id="recipe-ingredients-heading">{t("Les ingrédients *")}</h3><p>{t("Un ingrédient par ligne, avec sa quantité si vous la connaissez.")}</p>
      {ingredients.map((item, index) => <div className="recipe-ingredient-editor" key={item.key}>
        <label className="notebook-field" htmlFor={`recipe-ingredient-${item.key}`}><span>{t("Ingrédient") + " "}{index + 1}</span><input className="recipe-ingredient-name" id={`recipe-ingredient-${item.key}`} required maxLength={120} value={item.name} placeholder={t("Tomates")} onChange={event => setIngredients(previous => previous.map(row => row.key === item.key ? { ...row, name: event.target.value } : row))} /></label>
        <label className="notebook-field" htmlFor={`recipe-amount-${item.key}`}><span>{t("Quantité")}</span><input className="recipe-ingredient-amount" id={`recipe-amount-${item.key}`} maxLength={80} value={item.amount} placeholder="250 g" onChange={event => setIngredients(previous => previous.map(row => row.key === item.key ? { ...row, amount: event.target.value } : row))} /></label>
        <button type="button" className="icon-btn notebook-delete" aria-label={t("Retirer l’ingrédient {v0}", { v0: index + 1 })} disabled={ingredients.length === 1} onClick={() => setIngredients(previous => previous.filter(row => row.key !== item.key))}><IonIcon icon={trashOutline} /></button>
      </div>)}
      <AppButton variant="secondary" icon={addOutline} disabled={ingredients.length >= 100} onClick={() => setIngredients(previous => [...previous, { key: `new-${++rowId.current}`, name: '', amount: '' }])}>{t("Ajouter un ingrédient")}</AppButton>
    </section>
    <section className="recipe-form-section" aria-labelledby="recipe-steps-heading"><h3 id="recipe-steps-heading">{t("La préparation *")}</h3>
      {steps.map((item, index) => <div className="recipe-step-editor" key={item.key}><label className="notebook-field" htmlFor={`recipe-step-${item.key}`}><span>{t("Étape") + " "}{index + 1}</span><textarea className="recipe-step-text" id={`recipe-step-${item.key}`} required rows={3} maxLength={2000} value={item.text} placeholder={t("On commence par…")} onChange={event => setSteps(previous => previous.map(row => row.key === item.key ? { ...row, text: event.target.value } : row))} /></label>
        <button type="button" className="icon-btn notebook-delete" aria-label={t("Retirer l’étape {v0}", { v0: index + 1 })} disabled={steps.length === 1} onClick={() => setSteps(previous => previous.filter(row => row.key !== item.key))}><IonIcon icon={trashOutline} /></button></div>)}
      <AppButton variant="secondary" icon={addOutline} disabled={steps.length >= 40} onClick={() => setSteps(previous => [...previous, { key: `new-${++rowId.current}`, text: '' }])}>{t("Ajouter une étape")}</AppButton>
    </section>
    <label className="notebook-field" htmlFor="recipe-tips"><span>{t("Notre petit truc en plus") + " "}<small>{t("facultatif")}</small></span><textarea id="recipe-tips" rows={4} maxLength={2000} value={tips} onChange={event => setTips(event.target.value)} placeholder={t("Le zeste de citron à la fin, la cuisson parfaite, ce qu’on changerait…")} /></label>
  </NotebookEditorFrame>;
}

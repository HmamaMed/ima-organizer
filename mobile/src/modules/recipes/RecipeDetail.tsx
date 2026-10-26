import { t, useI18n, getLanguage } from "../../shared/i18n";
import { IonIcon } from '@ionic/react';
import { closeOutline, peopleOutline, timeOutline } from 'ionicons/icons';
import { RECIPE_STATUSES, type Recipe } from './recipesApi';

export default function RecipeDetail({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  useI18n();
  return <div className="notebook-editor__body recipe-detail__body" lang={getLanguage()}>
    <div className="notebook-editor__top"><p className="lo-eyebrow">{t("Nos recettes")}</p><button type="button" className="icon-btn" aria-label={t("Fermer la recette")} onClick={onClose}><IonIcon icon={closeOutline} /></button></div>
    <span className="notebook-tag">{t(RECIPE_STATUSES.find(item => item.value === recipe.status)?.label ?? '')}</span>
    <h2 id="recipe-detail-title">{recipe.title}</h2>
    <div className="recipe-meta"><span><IonIcon icon={peopleOutline} aria-hidden="true" />{recipe.servings} {recipe.servings === 1 ? t('personne') : t('personnes')}</span>{recipe.minutes && <span><IonIcon icon={timeOutline} aria-hidden="true" />{recipe.minutes} min</span>}</div>
    <section className="recipe-detail-section"><h3>{t("Sur le plan de travail")}</h3><ul className="recipe-ingredients">{recipe.ingredients.map((item, index) => <li key={index}><span>{item.name}</span>{item.amount && <strong>{item.amount}</strong>}</li>)}</ul></section>
    <section className="recipe-detail-section"><h3>{t("À nous de jouer")}</h3><ol className="recipe-steps">{recipe.steps.map((step, index) => <li key={index}><span className="recipe-step-number" aria-hidden="true">{index + 1}</span><p>{step}</p></li>)}</ol></section>
    {recipe.tips && <section className="recipe-tips"><h3>{t("Notre petit truc en plus")}</h3><p className="notebook-copy">{recipe.tips}</p></section>}
  </div>;
}

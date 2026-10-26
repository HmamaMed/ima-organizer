import { t, useI18n } from "../../shared/i18n";
import { useRef, useState, type FormEvent } from 'react';
import { IonIcon } from '@ionic/react';
import { star, starOutline } from 'ionicons/icons';
import AppButton from '../../shared/ui/AppButton';
import NotebookEditorFrame from '../../shared/notebooks/NotebookEditorFrame';
import { removeWatchReview, saveWatchReview, type WatchItem } from './watchlistApi';

export default function WatchReviewEditor({ entry, userId, token, onSaved, onClose, onBusyChange }: {
  entry: WatchItem; userId: string; token: string; onSaved: (entry: WatchItem) => void; onClose: () => void; onBusyChange: (busy: boolean) => void;
}) {
  useI18n();
  const mine = entry.reviews.find(review => review.userId === userId);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [comment, setComment] = useState(mine?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  async function perform(remove: boolean) {
    if (pending.current) return;
    if (!remove && !rating) { setError(t("Choisissez une note entre 1 et 5 étoiles.")); return; }
    pending.current = true; setBusy(true); onBusyChange(true); setError(null);
    try { onSaved(remove ? await removeWatchReview(token, entry.id) : await saveWatchReview(token, entry.id, rating, comment.trim() || null)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("Impossible d’enregistrer votre avis. Réessayez.")); }
    finally { pending.current = false; setBusy(false); onBusyChange(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void perform(false); }
  return <NotebookEditorFrame title={entry.title} titleId="watch-review-title" eyebrow={t("Et vous, vous en avez pensé quoi ?")} busy={busy} error={error}
    submitLabel="Garder mon avis" onClose={onClose} onSubmit={submit}>
    <div className="watch-rating"><span id="watch-rating-label">{t("Votre note *")}</span><div role="group" aria-labelledby="watch-rating-label" className="watch-stars">
      {[1,2,3,4,5].map(value => <button type="button" key={value} aria-label={`${value} ${value === 1 ? t("étoile") : t("étoiles")}`} aria-pressed={rating === value} onClick={() => setRating(value)}><IonIcon icon={value <= rating ? star : starOutline} /></button>)}
    </div><span className="watch-rating__caption" aria-live="polite">{rating ? `${rating}/5` : t("À vous de choisir")}</span></div>
    <label className="notebook-field" htmlFor="watch-review-comment"><span>{t("Votre avis") + " "}<small>{t("facultatif")}</small></span><textarea id="watch-review-comment" rows={5} maxLength={2000} value={comment} onChange={event => setComment(event.target.value)} placeholder={t("Ce qui vous a plu, la scène qui reste, l’envie de le revoir…")} /></label>
    {mine && <AppButton variant="quiet" onClick={() => { void perform(true); }} disabled={busy}>{t("Retirer mon avis")}</AppButton>}
  </NotebookEditorFrame>;
}

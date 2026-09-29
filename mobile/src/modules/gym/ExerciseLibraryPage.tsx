import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IonContent,
  IonIcon,
  IonInput,
  IonModal,
  IonPage,
  IonSpinner,
  IonText,
  IonTextarea,
  IonToast,
} from '@ionic/react';
import {
  addOutline,
  closeOutline,
  createOutline,
  imageOutline,
  libraryOutline,
  trashOutline,
} from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import BrandHeader from '../../shared/ui/BrandHeader';
import { ApiError } from '../../shared/api/client';
import {
  createExercise,
  deleteExercise,
  fetchExercises,
  MUSCLE_GROUPS,
  muscleGroupLabel,
  updateExercise,
  type LibraryExercise,
  type MuscleGroup,
} from './gymApi';
import './gym.css';

interface FormState {
  id: string | null;
  name: string;
  muscleGroup: MuscleGroup;
  imageUrl: string;
  videoUrl: string;
  instructions: string;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: '',
  muscleGroup: 'LEGS',
  imageUrl: '',
  videoUrl: '',
  instructions: '',
};

/** Owner-only: the reusable exercise catalogue that programmes are built from. */
export default function ExerciseLibraryPage() {
  const { token } = useAuth();

  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<MuscleGroup | 'ALL'>('ALL');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setLibrary(await fetchExercises(token));
      setError(null);
    } catch {
      setError('Could not load your exercises.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(
    () => (filter === 'ALL' ? library : library.filter((e) => e.muscleGroup === filter)),
    [library, filter],
  );

  const canSave = !!form && form.name.trim() !== '' && form.instructions.trim() !== '';

  const save = async () => {
    if (!token || !form || !canSave) return;
    setSaving(true);
    try {
      const input = {
        name: form.name.trim(),
        muscleGroup: form.muscleGroup,
        imageUrl: form.imageUrl.trim() || null,
        videoUrl: form.videoUrl.trim() || null,
        instructions: form.instructions.trim(),
      };
      if (form.id) {
        await updateExercise(token, form.id, input);
        setToast('Exercise updated.');
      } else {
        await createExercise(token, input);
        setToast('Exercise added to your library.');
      }
      setForm(null);
      await load();
    } catch {
      setToast('Could not save that exercise.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (exercise: LibraryExercise) => {
    if (!token) return;
    try {
      await deleteExercise(token, exercise.id);
      setToast(`Removed “${exercise.name}”.`);
      await load();
    } catch (e) {
      // 409 carries the "still used in a programme" explanation from the server.
      setToast(e instanceof ApiError ? e.message : 'Could not delete that exercise.');
    }
  };

  return (
    <IonPage>
      <BrandHeader icon={libraryOutline} title="Exercises" accent="gold" showBack backTo="/gym" />

      <IonContent className="ion-padding">
        {loading ? (
          <div className="centered"><IonSpinner /></div>
        ) : error ? (
          <IonText color="danger"><p>{error}</p></IonText>
        ) : (
          <div className="library">
            <button type="button" className="primary-cta" onClick={() => setForm({ ...EMPTY_FORM })}>
              <IonIcon icon={addOutline} /> New exercise
            </button>

            <div className="picker__chips library__chips">
              <button
                type="button"
                className={`chip ${filter === 'ALL' ? 'chip--on' : ''}`}
                onClick={() => setFilter('ALL')}
              >
                All ({library.length})
              </button>
              {MUSCLE_GROUPS.map((g) => {
                const count = library.filter((e) => e.muscleGroup === g.value).length;
                if (count === 0) return null;
                return (
                  <button
                    key={g.value}
                    type="button"
                    className={`chip ${filter === g.value ? 'chip--on' : ''}`}
                    onClick={() => setFilter(g.value)}
                  >
                    {g.label} ({count})
                  </button>
                );
              })}
            </div>

            {visible.length === 0 ? (
              <p className="empty-state">
                {library.length === 0
                  ? 'No exercises yet. Add your first one — name, a picture from the web, and how to do it.'
                  : 'Nothing in this group yet.'}
              </p>
            ) : (
              <div className="library__grid">
                {visible.map((exercise) => (
                  <div key={exercise.id} className="lib-card">
                    {exercise.imageUrl ? (
                      <img className="lib-card__image" src={exercise.imageUrl} alt="" />
                    ) : (
                      <div className="lib-card__image lib-card__image--empty">
                        <IonIcon icon={imageOutline} />
                      </div>
                    )}
                    <div className="lib-card__body">
                      <span className="lib-card__name">{exercise.name}</span>
                      <span className="lib-card__group">{muscleGroupLabel(exercise.muscleGroup)}</span>
                    </div>
                    <div className="lib-card__actions">
                      <button
                        type="button"
                        aria-label={`Edit ${exercise.name}`}
                        onClick={() =>
                          setForm({
                            id: exercise.id,
                            name: exercise.name,
                            muscleGroup: exercise.muscleGroup,
                            imageUrl: exercise.imageUrl ?? '',
                            videoUrl: exercise.videoUrl ?? '',
                            instructions: exercise.instructions,
                          })
                        }
                      >
                        <IonIcon icon={createOutline} />
                      </button>
                      <button type="button" aria-label={`Delete ${exercise.name}`} onClick={() => remove(exercise)}>
                        <IonIcon icon={trashOutline} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </IonContent>

      <IonModal isOpen={!!form} onDidDismiss={() => setForm(null)}>
        {form && (
          <div className="ex-form">
            <div className="picker__head">
              <button type="button" className="picker__close" onClick={() => setForm(null)} aria-label="Cancel">
                <IonIcon icon={closeOutline} />
              </button>
              <span className="picker__title font-display">{form.id ? 'Edit exercise' : 'New exercise'}</span>
              <button type="button" className="picker__done" disabled={!canSave || saving} onClick={save}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>

            <div className="ex-form__body">
              <label className="field">
                <span className="field__label">Name</span>
                <IonInput
                  className="field__input"
                  value={form.name}
                  placeholder="Bulgarian split squat"
                  onIonInput={(e) => setForm({ ...form, name: String(e.detail.value ?? '') })}
                />
              </label>

              <div className="field">
                <span className="field__label">Muscle group</span>
                <div className="picker__chips">
                  {MUSCLE_GROUPS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      className={`chip ${form.muscleGroup === g.value ? 'chip--on' : ''}`}
                      onClick={() => setForm({ ...form, muscleGroup: g.value })}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="field">
                <span className="field__label">Image URL</span>
                <IonInput
                  className="field__input"
                  value={form.imageUrl}
                  placeholder="https://…"
                  onIonInput={(e) => setForm({ ...form, imageUrl: String(e.detail.value ?? '') })}
                />
              </label>

              {form.imageUrl.trim() !== '' && (
                <img
                  className="ex-form__preview"
                  src={form.imageUrl}
                  alt="Preview"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                  onLoad={(e) => {
                    (e.target as HTMLImageElement).style.display = 'block';
                  }}
                />
              )}

              <label className="field">
                <span className="field__label">Video URL (optional)</span>
                <IonInput
                  className="field__input"
                  value={form.videoUrl}
                  placeholder="https://youtube.com/…"
                  onIonInput={(e) => setForm({ ...form, videoUrl: String(e.detail.value ?? '') })}
                />
              </label>

              <label className="field">
                <span className="field__label">How to do it</span>
                <IonTextarea
                  className="field__input"
                  value={form.instructions}
                  autoGrow
                  rows={4}
                  placeholder="Keep your front knee tracking over your ankle…"
                  onIonInput={(e) => setForm({ ...form, instructions: String(e.detail.value ?? '') })}
                />
              </label>
            </div>
          </div>
        )}
      </IonModal>

      <IonToast isOpen={!!toast} message={toast ?? ''} duration={2600} onDidDismiss={() => setToast(null)} />
    </IonPage>
  );
}

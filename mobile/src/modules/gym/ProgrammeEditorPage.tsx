import { useCallback, useEffect, useState } from 'react';
import { IonContent, IonIcon, IonInput, IonPage, IonSpinner, IonText, IonToast } from '@ionic/react';
import { useParams } from 'react-router-dom';
import {
  addOutline,
  arrowDownOutline,
  arrowUpOutline,
  barbellOutline,
  closeOutline,
  trashOutline,
} from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import BrandHeader from '../../shared/ui/BrandHeader';
import ExercisePickerSheet from './components/ExercisePickerSheet';
import {
  addDay,
  deleteDay,
  fetchExercises,
  fetchProgrammes,
  setDayExercises,
  updateDay,
  type DayExerciseInput,
  type LibraryExercise,
  type Programme,
} from './gymApi';
import './gym.css';

/** What a newly picked exercise starts at, so adding one is tap-tap-done. */
const DEFAULT_SETS = 3;
const DEFAULT_REPS = '12';

interface DraftExercise {
  exerciseId: string;
  name: string;
  imageUrl: string | null;
  sets: number;
  reps: string;
  /**
   * Not editable in this screen, but carried through the draft so re-saving a
   * day doesn't silently wipe rest timings and per-day notes that came from
   * the seeder or an earlier edit.
   */
  restSeconds: number | null;
  note: string | null;
}

interface DraftDay {
  id: string;
  label: string;
  coachNote: string;
  exercises: DraftExercise[];
  dirty: boolean;
}

/** Owner-only: fill a programme's days with exercises from the library. */
export default function ProgrammeEditorPage() {
  const { programmeId } = useParams<{ programmeId: string }>();
  const { token } = useAuth();

  const [programme, setProgramme] = useState<Programme | null>(null);
  const [days, setDays] = useState<DraftDay[]>([]);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  const [savingDayId, setSavingDayId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [all, libraryData] = await Promise.all([fetchProgrammes(token), fetchExercises(token)]);
      const found = all.find((p) => p.id === programmeId) ?? null;
      setProgramme(found);
      setLibrary(libraryData);
      setDays(
        (found?.days ?? []).map((day) => ({
          id: day.id,
          label: day.label,
          coachNote: day.coachNote ?? '',
          exercises: day.exercises.map((item) => ({
            exerciseId: item.exercise.id,
            name: item.exercise.name,
            imageUrl: item.exercise.imageUrl,
            sets: item.sets,
            reps: item.reps,
            restSeconds: item.restSeconds,
            note: item.note,
          })),
          dirty: false,
        })),
      );
      setError(found ? null : 'That programme no longer exists.');
    } catch {
      setError('Could not load the programme.');
    } finally {
      setLoading(false);
    }
  }, [token, programmeId]);

  useEffect(() => {
    load();
  }, [load]);

  const patchDay = (dayId: string, patch: Partial<DraftDay>) => {
    setDays((current) =>
      current.map((day) => (day.id === dayId ? { ...day, ...patch, dirty: true } : day)),
    );
  };

  const patchExercise = (dayId: string, index: number, patch: Partial<DraftExercise>) => {
    setDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? {
              ...day,
              dirty: true,
              exercises: day.exercises.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)),
            }
          : day,
      ),
    );
  };

  const moveExercise = (dayId: string, index: number, direction: -1 | 1) => {
    setDays((current) =>
      current.map((day) => {
        if (day.id !== dayId) return day;
        const target = index + direction;
        if (target < 0 || target >= day.exercises.length) return day;
        const reordered = [...day.exercises];
        [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
        return { ...day, exercises: reordered, dirty: true };
      }),
    );
  };

  const removeExercise = (dayId: string, index: number) => {
    setDays((current) =>
      current.map((day) =>
        day.id === dayId
          ? { ...day, dirty: true, exercises: day.exercises.filter((_, i) => i !== index) }
          : day,
      ),
    );
  };

  const addPicked = (ids: string[]) => {
    const dayId = pickerDayId;
    setPickerDayId(null);
    if (!dayId) return;

    setDays((current) =>
      current.map((day) => {
        if (day.id !== dayId) return day;
        const existing = new Set(day.exercises.map((e) => e.exerciseId));
        const additions = ids
          .filter((id) => !existing.has(id))
          .map((id) => library.find((e) => e.id === id))
          .filter((e): e is LibraryExercise => !!e)
          .map((e) => ({
            exerciseId: e.id,
            name: e.name,
            imageUrl: e.imageUrl,
            sets: DEFAULT_SETS,
            reps: DEFAULT_REPS,
            restSeconds: null,
            note: null,
          }));

        // Unticking in the picker removes it from the day too.
        const kept = day.exercises.filter((e) => ids.includes(e.exerciseId));
        return { ...day, exercises: [...kept, ...additions], dirty: true };
      }),
    );
  };

  const saveDay = async (day: DraftDay) => {
    if (!token) return;
    setSavingDayId(day.id);
    try {
      await updateDay(token, day.id, { label: day.label.trim(), coachNote: day.coachNote.trim() || null });
      const payload: DayExerciseInput[] = day.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets,
        reps: ex.reps.trim() || '1',
        restSeconds: ex.restSeconds,
        note: ex.note,
      }));
      await setDayExercises(token, day.id, payload);
      setDays((current) => current.map((d) => (d.id === day.id ? { ...d, dirty: false } : d)));
      setToast(`Saved “${day.label}”.`);
    } catch {
      setToast('Could not save that session.');
    } finally {
      setSavingDayId(null);
    }
  };

  const createDay = async () => {
    if (!token || !programme) return;
    try {
      await addDay(token, programme.id, {
        label: `Day ${days.length + 1}`,
        coachNote: null,
      });
      await load();
    } catch {
      setToast('Could not add a session.');
    }
  };

  const removeDay = async (day: DraftDay) => {
    if (!token) return;
    try {
      await deleteDay(token, day.id);
      setToast(`Removed “${day.label}”.`);
      await load();
    } catch {
      setToast('Could not remove that session.');
    }
  };

  const pickerDay = days.find((d) => d.id === pickerDayId);

  return (
    <IonPage>
      <BrandHeader icon={barbellOutline} title={programme?.name ?? 'Programme'} accent="gold" showBack backTo="/gym/programmes" />

      <IonContent className="ion-padding">
        {loading ? (
          <div className="centered"><IonSpinner /></div>
        ) : error ? (
          <IonText color="danger"><p>{error}</p></IonText>
        ) : (
          <div className="editor">
            {library.length === 0 && (
              <p className="editor__hint">
                Your exercise library is empty — add exercises first, then come back to build sessions from them.
              </p>
            )}

            {days.map((day) => (
              <div key={day.id} className="edit-day">
                <div className="edit-day__head">
                  <IonInput
                    className="edit-day__label"
                    value={day.label}
                    placeholder="Day 1 — Legs"
                    onIonInput={(e) => patchDay(day.id, { label: String(e.detail.value ?? '') })}
                  />
                  <button
                    type="button"
                    className="edit-day__delete"
                    aria-label={`Delete ${day.label}`}
                    onClick={() => removeDay(day)}
                  >
                    <IonIcon icon={trashOutline} />
                  </button>
                </div>

                <IonInput
                  className="edit-day__note"
                  value={day.coachNote}
                  placeholder="A line for her — “you got this ♥”"
                  onIonInput={(e) => patchDay(day.id, { coachNote: String(e.detail.value ?? '') })}
                />

                {day.exercises.length === 0 ? (
                  <p className="edit-day__empty">No exercises yet.</p>
                ) : (
                  <div className="edit-day__list">
                    {day.exercises.map((ex, index) => (
                      <div key={`${ex.exerciseId}-${index}`} className="edit-ex">
                        {ex.imageUrl ? (
                          <img className="edit-ex__thumb" src={ex.imageUrl} alt="" />
                        ) : (
                          <span className="edit-ex__thumb edit-ex__thumb--empty">{ex.name.charAt(0)}</span>
                        )}

                        <span className="edit-ex__name">{ex.name}</span>

                        <div className="edit-ex__fields">
                          <input
                            className="edit-ex__num"
                            type="number"
                            min={1}
                            value={ex.sets}
                            aria-label={`Sets for ${ex.name}`}
                            onChange={(e) =>
                              patchExercise(day.id, index, { sets: Math.max(1, Number(e.target.value) || 1) })
                            }
                          />
                          <span className="edit-ex__times">×</span>
                          <input
                            className="edit-ex__reps"
                            value={ex.reps}
                            aria-label={`Reps for ${ex.name}`}
                            onChange={(e) => patchExercise(day.id, index, { reps: e.target.value })}
                          />
                        </div>

                        <div className="edit-ex__order">
                          <button
                            type="button"
                            aria-label={`Move ${ex.name} up`}
                            disabled={index === 0}
                            onClick={() => moveExercise(day.id, index, -1)}
                          >
                            <IonIcon icon={arrowUpOutline} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${ex.name} down`}
                            disabled={index === day.exercises.length - 1}
                            onClick={() => moveExercise(day.id, index, 1)}
                          >
                            <IonIcon icon={arrowDownOutline} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${ex.name}`}
                            onClick={() => removeExercise(day.id, index)}
                          >
                            <IonIcon icon={closeOutline} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="edit-day__foot">
                  <button
                    type="button"
                    className="edit-day__add"
                    disabled={library.length === 0}
                    onClick={() => setPickerDayId(day.id)}
                  >
                    <IonIcon icon={addOutline} /> Add exercises
                  </button>
                  {day.dirty && (
                    <button
                      type="button"
                      className="edit-day__save"
                      disabled={savingDayId === day.id}
                      onClick={() => saveDay(day)}
                    >
                      {savingDayId === day.id ? 'Saving…' : 'Save session'}
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button type="button" className="primary-cta" onClick={createDay}>
              <IonIcon icon={addOutline} /> Add a session
            </button>
          </div>
        )}
      </IonContent>

      <ExercisePickerSheet
        open={!!pickerDayId}
        library={library}
        selectedIds={pickerDay?.exercises.map((e) => e.exerciseId) ?? []}
        onClose={() => setPickerDayId(null)}
        onConfirm={addPicked}
      />

      <IonToast isOpen={!!toast} message={toast ?? ''} duration={2600} onDidDismiss={() => setToast(null)} />
    </IonPage>
  );
}

import { useCallback, useState } from 'react';
import { IonIcon, IonInput, IonPage, IonToast, useIonViewWillEnter } from '@ionic/react';
import { Redirect, useParams } from 'react-router-dom';
import {
  addOutline,
  arrowDownOutline,
  arrowUpOutline,
  barbellOutline,
  closeOutline,
  createOutline,
  trashOutline,
} from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import BrandHeader from '../../shared/ui/BrandHeader';
import AppScreen from '../../shared/ui/AppScreen';
import AppButton from '../../shared/ui/AppButton';
import FeedbackState from '../../shared/ui/FeedbackState';
import ConfirmSheet from '../../shared/ui/ConfirmSheet';
import useUnsavedChanges from '../../shared/navigation/useUnsavedChanges';
import PrescriptionSheet from './components/PrescriptionSheet';
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
  /** Preserve the existing optional prescription fields in every replace-list write. */
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
  const { token, user } = useAuth();

  const [programme, setProgramme] = useState<Programme | null>(null);
  const [days, setDays] = useState<DraftDay[]>([]);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  const [savingDayId, setSavingDayId] = useState<string | null>(null);
  const [dayBusy, setDayBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DraftDay | null>(null);
  const [editing, setEditing] = useState<{ dayId: string; index: number } | null>(null);
  const [ordering, setOrdering] = useState<string | null>(null);
  const { confirmation } = useUnsavedChanges(
    days.some((day) => day.dirty),
    !!savingDayId || dayBusy,
    `/gym/programmes/${programmeId}`,
  );

  const load = useCallback(async () => {
    if (!token || user?.role !== 'OWNER') return;
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
  }, [token, programmeId, user?.role]);

  useIonViewWillEnter(() => {
    void load();
  });

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
    if (
      !token ||
      savingDayId ||
      dayBusy ||
      !day.label.trim() ||
      day.exercises.some((ex) => !ex.reps.trim() || ex.sets < 1)
    )
      return;
    setSavingDayId(day.id);
    try {
      await updateDay(token, day.id, {
        label: day.label.trim(),
        coachNote: day.coachNote.trim() || null,
      });
      const payload: DayExerciseInput[] = day.exercises.map((ex) => ({
        exerciseId: ex.exerciseId,
        sets: ex.sets,
        reps: ex.reps.trim(),
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
    if (!token || !programme || dayBusy || savingDayId) return;
    setDayBusy(true);
    try {
      const added = await addDay(token, programme.id, {
        label: `Day ${days.length + 1}`,
        coachNote: null,
      });
      setDays((current) => [
        ...current,
        {
          id: added.id,
          label: added.label,
          coachNote: added.coachNote ?? '',
          exercises: [],
          dirty: false,
        },
      ]);
    } catch {
      setToast('Could not add a session.');
    } finally {
      setDayBusy(false);
    }
  };

  const removeDay = async (day: DraftDay) => {
    if (!token || dayBusy || savingDayId) return;
    setDayBusy(true);
    try {
      await deleteDay(token, day.id);
      setToast(`Removed “${day.label}”.`);
      setDays((current) => current.filter((d) => d.id !== day.id));
      setDeleteTarget(null);
    } catch {
      setToast('Could not remove that session.');
    } finally {
      setDayBusy(false);
    }
  };

  const editingExercise = editing
    ? (days.find((d) => d.id === editing.dayId)?.exercises[editing.index] ?? null)
    : null;
  const pickerDay = days.find((d) => d.id === pickerDayId);

  if (user?.role !== 'OWNER') return <Redirect to="/gym" />;

  return (
    <IonPage>
      <BrandHeader
        icon={barbellOutline}
        title="Gym Coach"
        accent="gold"
        showBack
        backTo="/gym/programmes"
      />

      <AppScreen
        title={programme?.name ?? 'Programme'}
        eyebrow="Programme editor"
        subtitle="Changes stay here until you save each session."
      >
        {loading && !programme && (
          <FeedbackState kind="loading" heading="Finding your programme…" />
        )}
        {error && <FeedbackState kind="failure" heading={error} onRetry={load} />}
        {programme && (
          <div className="editor">
            {library.length === 0 && (
              <p className="editor__hint">
                Your exercise library is empty — add exercises first, then come back to build
                sessions from them.
              </p>
            )}

            {days.map((day) => (
              <fieldset key={day.id} className="edit-day" disabled={!!savingDayId || dayBusy}>
                <legend className="lo-eyebrow">Session {days.indexOf(day) + 1}</legend>
                <div className="edit-day__head">
                  <IonInput
                    className="edit-day__label"
                    value={day.label}
                    label="Session name"
                    labelPlacement="stacked"
                    placeholder="Day 1 — Legs"
                    onIonInput={(e) => patchDay(day.id, { label: String(e.detail.value ?? '') })}
                  />
                  <button
                    type="button"
                    className="edit-day__delete"
                    aria-label={`Delete ${day.label}`}
                    onClick={() => setDeleteTarget(day)}
                  >
                    <IonIcon icon={trashOutline} />
                  </button>
                </div>

                <IonInput
                  className="edit-day__note"
                  value={day.coachNote}
                  label="Coaching note (optional)"
                  labelPlacement="stacked"
                  placeholder="A line for her — “you got this ♥”"
                  onIonInput={(e) => patchDay(day.id, { coachNote: String(e.detail.value ?? '') })}
                />

                {day.exercises.length === 0 ? (
                  <p className="edit-day__empty">No exercises yet.</p>
                ) : (
                  <div className="edit-day__list">
                    {day.exercises.map((ex, index) => (
                      <div key={`${ex.exerciseId}-${index}`} className="edit-ex">
                        <button
                          type="button"
                          className="edit-ex__main"
                          aria-label={`Edit prescription for ${ex.name}`}
                          onClick={() => setEditing({ dayId: day.id, index })}
                        >
                          <span className="edit-ex__number">{index + 1}</span>
                          <span className="edit-ex__body">
                            <span className="edit-ex__name">{ex.name}</span>
                            <span className="edit-ex__prescription">
                              {ex.sets} sets × {ex.reps}
                              {ex.restSeconds == null ? '' : ` · ${ex.restSeconds}s rest`}
                            </span>
                            {ex.note && <span className="edit-ex__prescription">{ex.note}</span>}
                          </span>
                          <IonIcon icon={createOutline} />
                        </button>
                        {ordering === day.id && (
                          <div className="edit-ex__order">
                            <button
                              type="button"
                              aria-label={`Move ${ex.name} up`}
                              disabled={index === 0}
                              onClick={() => moveExercise(day.id, index, -1)}
                            >
                              <IonIcon icon={arrowUpOutline} /> Up
                            </button>
                            <button
                              type="button"
                              aria-label={`Move ${ex.name} down`}
                              disabled={index === day.exercises.length - 1}
                              onClick={() => moveExercise(day.id, index, 1)}
                            >
                              <IonIcon icon={arrowDownOutline} /> Down
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove ${ex.name}`}
                              onClick={() => removeExercise(day.id, index)}
                            >
                              <IonIcon icon={closeOutline} /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {day.exercises.length > 0 && (
                  <AppButton
                    variant="quiet"
                    aria-pressed={ordering === day.id}
                    onClick={() => setOrdering(ordering === day.id ? null : day.id)}
                  >
                    {ordering === day.id ? 'Done reordering' : 'Reorder or remove exercises'}
                  </AppButton>
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
                      disabled={!!savingDayId || !day.label.trim()}
                      onClick={() => saveDay(day)}
                    >
                      {savingDayId === day.id ? 'Saving…' : 'Save session'}
                    </button>
                  )}
                </div>
              </fieldset>
            ))}

            <AppButton
              icon={addOutline}
              variant="secondary"
              busy={dayBusy}
              disabled={!!savingDayId}
              onClick={createDay}
            >
              Add a session
            </AppButton>
          </div>
        )}
      </AppScreen>

      <ExercisePickerSheet
        open={!!pickerDayId}
        library={library}
        selectedIds={pickerDay?.exercises.map((e) => e.exerciseId) ?? []}
        onClose={() => setPickerDayId(null)}
        onConfirm={addPicked}
      />

      <PrescriptionSheet
        exercise={editingExercise}
        onClose={() => setEditing(null)}
        onApply={(value) => {
          if (editing) patchExercise(editing.dayId, editing.index, value);
          setEditing(null);
        }}
      />
      <ConfirmSheet
        open={!!deleteTarget}
        title="Delete this session?"
        detail="This session and its exercise prescriptions will be removed from the programme."
        confirmLabel="Delete session"
        busy={dayBusy}
        onConfirm={() => {
          if (deleteTarget) void removeDay(deleteTarget);
        }}
        onClose={() => setDeleteTarget(null)}
      />
      {confirmation}
      <IonToast
        isOpen={!!toast}
        message={toast ?? ''}
        duration={2600}
        onDidDismiss={() => setToast(null)}
      />
    </IonPage>
  );
}

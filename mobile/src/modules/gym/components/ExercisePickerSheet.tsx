import { useMemo, useState } from 'react';
import { IonIcon, IonModal, IonSearchbar } from '@ionic/react';
import { checkmarkCircle, closeOutline, ellipseOutline } from 'ionicons/icons';
import { MUSCLE_GROUPS, muscleGroupLabel, type LibraryExercise, type MuscleGroup } from '../gymApi';

interface ExercisePickerSheetProps {
  open: boolean;
  library: LibraryExercise[];
  /** Already on the day — shown ticked, tapping them again removes them. */
  selectedIds: string[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}

/**
 * Multi-select over the library for building a day. Search + muscle-group
 * chips, because scrolling a flat list gets old once there are more than a
 * dozen exercises.
 */
export default function ExercisePickerSheet({
  open,
  library,
  selectedIds,
  onClose,
  onConfirm,
}: ExercisePickerSheetProps) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | 'ALL'>('ALL');
  const [picked, setPicked] = useState<string[]>(selectedIds);

  // Re-seed from the day whenever the sheet is reopened.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setPicked(selectedIds);
      setQuery('');
      setGroup('ALL');
    }
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return library.filter((exercise) => {
      const matchesGroup = group === 'ALL' || exercise.muscleGroup === group;
      const matchesQuery = needle === '' || exercise.name.toLowerCase().includes(needle);
      return matchesGroup && matchesQuery;
    });
  }, [library, query, group]);

  const toggle = (id: string) => {
    setPicked((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  return (
    <IonModal isOpen={open} onDidDismiss={onClose}>
      <div className="picker">
        <div className="picker__head">
          <button type="button" className="picker__close" onClick={onClose} aria-label="Cancel">
            <IonIcon icon={closeOutline} />
          </button>
          <span className="picker__title font-display">Add exercises</span>
          <button type="button" className="picker__done" onClick={() => onConfirm(picked)}>
            Add {picked.length > 0 ? `(${picked.length})` : ''}
          </button>
        </div>

        <IonSearchbar
          className="picker__search"
          value={query}
          placeholder="Search exercises"
          onIonInput={(e) => setQuery(String(e.detail.value ?? ''))}
        />

        <div className="picker__chips">
          <button
            type="button"
            className={`chip ${group === 'ALL' ? 'chip--on' : ''}`}
            onClick={() => setGroup('ALL')}
          >
            All
          </button>
          {MUSCLE_GROUPS.map((g) => (
            <button
              key={g.value}
              type="button"
              className={`chip ${group === g.value ? 'chip--on' : ''}`}
              onClick={() => setGroup(g.value)}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="picker__list">
          {visible.length === 0 ? (
            <p className="picker__empty">
              {library.length === 0
                ? 'Your library is empty — create an exercise first.'
                : 'Nothing matches that.'}
            </p>
          ) : (
            visible.map((exercise) => {
              const on = picked.includes(exercise.id);
              return (
                <button
                  key={exercise.id}
                  type="button"
                  className={`picker__row ${on ? 'picker__row--on' : ''}`}
                  onClick={() => toggle(exercise.id)}
                >
                  <IonIcon
                    className="picker__check"
                    icon={on ? checkmarkCircle : ellipseOutline}
                  />
                  {exercise.imageUrl ? (
                    <img className="picker__thumb" src={exercise.imageUrl} alt="" />
                  ) : (
                    <span className="picker__thumb picker__thumb--empty">{exercise.name.charAt(0)}</span>
                  )}
                  <span className="picker__row-text">
                    <span className="picker__name">{exercise.name}</span>
                    <span className="picker__group">{muscleGroupLabel(exercise.muscleGroup)}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </IonModal>
  );
}

import { IonIcon, IonModal } from '@ionic/react';
import { closeOutline, playCircleOutline, timerOutline, repeatOutline } from 'ionicons/icons';
import type { DayExercise, LibraryExercise } from '../gymApi';
import { muscleGroupLabel } from '../gymApi';

interface ExerciseDetailSheetProps {
  /** The library entry to show. */
  exercise: LibraryExercise | null;
  /** Present when opened from a session, so the prescription can be shown too. */
  prescription?: DayExercise | null;
  onClose: () => void;
}

/**
 * Full-detail view of an exercise: the image, how to do it, and (when opened
 * from a session rather than the library) the sets/reps prescribed for the day.
 */
export default function ExerciseDetailSheet({ exercise, prescription, onClose }: ExerciseDetailSheetProps) {
  return (
    <IonModal isOpen={!!exercise} onDidDismiss={onClose} initialBreakpoint={0.9} breakpoints={[0, 0.9, 1]}>
      {exercise && (
        <div className="ex-sheet">
          <button type="button" className="ex-sheet__close" onClick={onClose} aria-label="Close">
            <IonIcon icon={closeOutline} />
          </button>

          {exercise.imageUrl ? (
            <img className="ex-sheet__image" src={exercise.imageUrl} alt="" />
          ) : (
            <div className="ex-sheet__image ex-sheet__image--empty" aria-hidden="true">
              <span>{exercise.name.charAt(0)}</span>
            </div>
          )}

          <div className="ex-sheet__body">
            <span className="ex-sheet__group">{muscleGroupLabel(exercise.muscleGroup)}</span>
            <h2 className="ex-sheet__title font-display">{exercise.name}</h2>

            {prescription && (
              <div className="ex-sheet__stats">
                <div className="ex-sheet__stat">
                  <IonIcon icon={repeatOutline} />
                  <span>{prescription.sets} × {prescription.reps}</span>
                </div>
                {prescription.restSeconds != null && (
                  <div className="ex-sheet__stat">
                    <IonIcon icon={timerOutline} />
                    <span>{prescription.restSeconds}s rest</span>
                  </div>
                )}
              </div>
            )}

            {prescription?.note && <p className="ex-sheet__note">“{prescription.note}”</p>}

            <p className="ex-sheet__instructions">{exercise.instructions}</p>

            {exercise.videoUrl && (
              <a className="ex-sheet__video" href={exercise.videoUrl} target="_blank" rel="noreferrer">
                <IonIcon icon={playCircleOutline} /> Watch the demo
              </a>
            )}
          </div>
        </div>
      )}
    </IonModal>
  );
}

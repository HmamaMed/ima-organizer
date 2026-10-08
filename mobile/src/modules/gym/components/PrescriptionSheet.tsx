import { useState } from 'react';
import { IonContent, IonFooter, IonHeader, IonIcon, IonModal, IonToolbar } from '@ionic/react';
import { closeOutline } from 'ionicons/icons';
import AppButton from '../../../shared/ui/AppButton';

export interface PrescriptionValues {
  sets: number;
  reps: string;
  restSeconds: number | null;
  note: string | null;
}

function PrescriptionForm({
  name,
  value,
  onApply,
  onClose,
}: {
  name: string;
  value: PrescriptionValues;
  onApply: (value: PrescriptionValues) => void;
  onClose: () => void;
}) {
  const [sets, setSets] = useState(String(value.sets));
  const [reps, setReps] = useState(value.reps);
  const [rest, setRest] = useState(value.restSeconds == null ? '' : String(value.restSeconds));
  const [note, setNote] = useState(value.note ?? '');
  const valid =
    Number.isInteger(Number(sets)) &&
    Number(sets) >= 1 &&
    reps.trim().length > 0 &&
    (rest === '' || (Number.isInteger(Number(rest)) && Number(rest) >= 0));
  return (
    <>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <div className="picker__head">
            <button
              type="button"
              className="picker__close"
              aria-label="Cancel prescription changes"
              onClick={onClose}
            >
              <IonIcon icon={closeOutline} />
            </button>
            <span className="picker__title">Edit prescription</span>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <h2 className="lo-screen__title">{name}</h2>
        <p className="compose-hint">
          Apply updates this session’s draft. Save the session to keep your changes.
        </p>
        <form
          id="prescription-form"
          className="prescription-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid)
              onApply({
                sets: Number(sets),
                reps: reps.trim(),
                restSeconds: rest === '' ? null : Number(rest),
                note: note.trim() || null,
              });
          }}
        >
          <label className="field">
            <span className="field__label">Sets</span>
            <input
              type="number"
              min="1"
              step="1"
              required
              value={sets}
              onChange={(e) => setSets(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Reps or duration</span>
            <input
              required
              value={reps}
              placeholder="12, 30 sec, or 10 per leg"
              onChange={(e) => setReps(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Rest in seconds (optional)</span>
            <input
              type="number"
              min="0"
              step="1"
              value={rest}
              onChange={(e) => setRest(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Coaching note (optional)</span>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </form>
      </IonContent>
      <IonFooter className="lo-action-footer">
        <AppButton type="submit" form="prescription-form" disabled={!valid}>
          Apply to session
        </AppButton>
      </IonFooter>
    </>
  );
}

export default function PrescriptionSheet({
  exercise,
  onApply,
  onClose,
}: {
  exercise: (PrescriptionValues & { name: string }) | null;
  onApply: (value: PrescriptionValues) => void;
  onClose: () => void;
}) {
  return (
    <IonModal isOpen={!!exercise} onDidDismiss={onClose}>
      {exercise && (
        <PrescriptionForm
          name={exercise.name}
          value={exercise}
          onApply={onApply}
          onClose={onClose}
        />
      )}
    </IonModal>
  );
}

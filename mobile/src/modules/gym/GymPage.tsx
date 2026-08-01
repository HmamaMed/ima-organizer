import { useCallback, useEffect, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { checkmarkCircleOutline, playCircleOutline } from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import { fetchLogs, fetchPlan, logCompletion, type WorkoutDay, type WorkoutLog } from './gymApi';

function ExerciseRow({ exercise }: { exercise: WorkoutDay['exercises'][number] }) {
  return (
    <div className="exercise-row">
      <div className="exercise-row__head">
        <span className="exercise-row__name">{exercise.name}</span>
        <span className="exercise-row__sets">{exercise.sets} × {exercise.reps}</span>
      </div>
      <p className="exercise-row__instructions">{exercise.instructions}</p>
      {exercise.videoUrl && (
        <a className="exercise-row__video" href={exercise.videoUrl} target="_blank" rel="noreferrer">
          <IonIcon icon={playCircleOutline} /> Watch demo
        </a>
      )}
    </div>
  );
}

export default function GymPage() {
  const { token } = useAuth();

  const [plan, setPlan] = useState<WorkoutDay[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [planData, logData] = await Promise.all([fetchPlan(token), fetchLogs(token)]);
      setPlan(planData);
      setLogs(logData);
      setError(null);
    } catch {
      setError('Could not load the workout plan.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const completedDayIds = new Set(logs.map((log) => log.workoutDayId));

  const handleComplete = async (dayId: string) => {
    if (!token) return;
    try {
      await logCompletion(token, dayId);
      setToast('Day marked complete. Nice work!');
      await load();
    } catch {
      setToast('Could not save completion.');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Gym Coach</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {loading ? (
          <div className="centered"><IonSpinner /></div>
        ) : error ? (
          <IonText color="danger"><p>{error}</p></IonText>
        ) : plan.length === 0 ? (
          <IonText className="empty-state"><p>No workout plan yet.</p></IonText>
        ) : (
          <div className="gym-plan">
            {plan.map((day) => {
              const done = completedDayIds.has(day.id);
              return (
                <div key={day.id} className={`gym-day ${done ? 'gym-day--done' : ''}`}>
                  <div className="gym-day__head">
                    <h3 className="gym-day__label">{day.dayLabel}</h3>
                    {done && <IonIcon icon={checkmarkCircleOutline} className="gym-day__check" />}
                  </div>
                  {day.notes && <p className="gym-day__notes">{day.notes}</p>}
                  <div className="gym-day__exercises">
                    {day.exercises.map((exercise) => (
                      <ExerciseRow key={exercise.id} exercise={exercise} />
                    ))}
                  </div>
                  {!done && (
                    <IonButton expand="block" fill="outline" onClick={() => handleComplete(day.id)}>
                      Mark complete
                    </IonButton>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </IonContent>

      <IonToast
        isOpen={!!toast}
        message={toast ?? ''}
        duration={2500}
        onDidDismiss={() => setToast(null)}
      />
    </IonPage>
  );
}

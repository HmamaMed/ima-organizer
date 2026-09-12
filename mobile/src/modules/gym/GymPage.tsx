import { useCallback, useEffect, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
  IonText,
  IonToast,
} from '@ionic/react';
import { barbellOutline, checkmarkCircleOutline, ellipseOutline, playCircleOutline } from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import BrandHeader from '../../shared/ui/BrandHeader';
import { isSameLocalDay, buildWeekdayStrip } from '../../shared/utils/date';
import { fetchLogs, fetchPlan, logCompletion, type WorkoutDay, type WorkoutLog } from './gymApi';

function WeekStrip({ logs }: { logs: WorkoutLog[] }) {
  const days = buildWeekdayStrip(logs.map((l) => l.completedAt));
  return (
    <div className="days-strip" aria-label="This week">
      {days.map((day, i) => (
        <div
          key={i}
          className={`day-pip ${day.isToday ? 'day-pip--today' : ''} ${day.hasLog ? 'day-pip--done' : ''}`}
        >
          {day.label}
        </div>
      ))}
    </div>
  );
}

function ExerciseRow({ exercise, done }: { exercise: WorkoutDay['exercises'][number]; done: boolean }) {
  return (
    <div className={`exercise-row ${done ? 'exercise-row--done' : ''}`}>
      <IonIcon icon={done ? checkmarkCircleOutline : ellipseOutline} className="exercise-row__marker" />
      <div className="exercise-row__body">
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

  const today = new Date().toISOString();
  const doneTodayIds = new Set(
    logs.filter((log) => isSameLocalDay(log.completedAt, today)).map((log) => log.workoutDayId),
  );

  const lastCompletedFor = (dayId: string): string | null => {
    const dayLogs = logs.filter((log) => log.workoutDayId === dayId);
    if (dayLogs.length === 0) return null;
    const mostRecent = dayLogs.reduce((latest, log) =>
      new Date(log.completedAt) > new Date(latest.completedAt) ? log : latest,
    );
    return new Date(mostRecent.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

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
      <BrandHeader icon={barbellOutline} title="Gym Coach" accent="gold" showBack />

      <IonContent className="ion-padding">
        {loading ? (
          <div className="centered"><IonSpinner /></div>
        ) : error ? (
          <IonText color="danger"><p>{error}</p></IonText>
        ) : plan.length === 0 ? (
          <IonText className="empty-state"><p>No workout plan yet.</p></IonText>
        ) : (
          <div className="gym-plan">
            <div className="gym-streak-wrap">
              <span className="gym-streak-label">This week</span>
              <WeekStrip logs={logs} />
            </div>
            {plan.map((day) => {
              const done = doneTodayIds.has(day.id);
              const lastCompleted = lastCompletedFor(day.id);
              return (
                <div key={day.id} className={`gym-day ${done ? 'gym-day--done' : ''}`}>
                  <div className="gym-day__head">
                    <h3 className="gym-day__label">{day.dayLabel}</h3>
                    {done && <IonIcon icon={checkmarkCircleOutline} className="gym-day__check" />}
                  </div>
                  {day.notes && <p className="gym-day__notes">{day.notes}</p>}
                  {lastCompleted && !done && (
                    <p className="gym-day__last">Last done {lastCompleted}</p>
                  )}
                  <div className="gym-day__exercises">
                    {day.exercises.map((exercise) => (
                      <ExerciseRow key={exercise.id} exercise={exercise} done={done} />
                    ))}
                  </div>
                  {!done && (
                    <IonButton expand="block" fill="outline" color="secondary" onClick={() => handleComplete(day.id)}>
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

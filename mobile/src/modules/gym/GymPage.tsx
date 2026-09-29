import { useCallback, useEffect, useState } from 'react';
import { IonContent, IonIcon, IonPage, IonSpinner, IonText } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import {
  addCircleOutline,
  barbellOutline,
  checkmarkCircle,
  chevronForwardOutline,
  libraryOutline,
  listOutline,
  trendingUpOutline,
} from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import BrandHeader from '../../shared/ui/BrandHeader';
import { buildWeekdayStrip, computeStreak, isSameLocalDay, localDateKey } from '../../shared/utils/date';
import {
  fetchActiveProgramme,
  fetchLogs,
  fetchTicks,
  type ExerciseTick,
  type Programme,
  type WorkoutLog,
} from './gymApi';
import './gym.css';

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

/**
 * Gym hub. Both roles see the active programme's sessions; the owner also gets
 * the two authoring entry points (library + programmes).
 */
export default function GymPage() {
  const { token, user } = useAuth();
  const history = useHistory();
  const isOwner = user?.role === 'OWNER';

  const [programme, setProgramme] = useState<Programme | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [ticks, setTicks] = useState<ExerciseTick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [activeProgramme, logData, tickData] = await Promise.all([
        fetchActiveProgramme(token),
        fetchLogs(token),
        fetchTicks(token, 2),
      ]);
      setProgramme(activeProgramme);
      setLogs(logData);
      setTicks(tickData);
      setError(null);
    } catch {
      setError('Could not load the plan.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const streak = computeStreak(logs.map((l) => l.completedAt));
  const today = localDateKey();
  const todayTickIds = new Set(ticks.filter((t) => t.tickDate === today).map((t) => t.dayExerciseId));
  const nowIso = new Date().toISOString();

  const doneTodayDayIds = new Set(
    logs.filter((log) => isSameLocalDay(log.completedAt, nowIso)).map((log) => log.programmeDayId),
  );

  const lastDoneFor = (dayId: string): string | null => {
    const forDay = logs.filter((log) => log.programmeDayId === dayId);
    if (forDay.length === 0) return null;
    const latest = forDay.reduce((best, log) =>
      new Date(log.completedAt) > new Date(best.completedAt) ? log : best,
    );
    return new Date(latest.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <IonPage>
      <BrandHeader icon={barbellOutline} title="Gym Coach" accent="gold" showBack />

      <IonContent className="ion-padding">
        {loading ? (
          <div className="centered"><IonSpinner /></div>
        ) : error ? (
          <IonText color="danger"><p>{error}</p></IonText>
        ) : (
          <div className="gym">
            <div className="gym-hero">
              <button type="button" className="gym-hero__streak" onClick={() => history.push('/gym/progress')}>
                <span className="gym-hero__flame">{streak > 0 ? '🔥' : '🌱'}</span>
                <span className="gym-hero__streak-text">
                  <span className="gym-hero__streak-num font-display">{streak}</span>
                  <span className="gym-hero__streak-label">day streak</span>
                </span>
                <IonIcon icon={chevronForwardOutline} className="gym-hero__chevron" />
              </button>
              <WeekStrip logs={logs} />
            </div>

            {isOwner && (
              <div className="coach-bar">
                <button type="button" className="coach-btn" onClick={() => history.push('/gym/exercises')}>
                  <IonIcon icon={libraryOutline} />
                  <span>Exercises</span>
                </button>
                <button type="button" className="coach-btn" onClick={() => history.push('/gym/programmes')}>
                  <IonIcon icon={listOutline} />
                  <span>Programmes</span>
                </button>
              </div>
            )}

            {programme ? (
              <>
                <div className="gym-programme">
                  <p className="gym-programme__name font-display">{programme.name}</p>
                  {programme.description && (
                    <p className="gym-programme__desc">{programme.description}</p>
                  )}
                </div>

                {programme.days.length === 0 ? (
                  <p className="empty-state">
                    {isOwner
                      ? 'This programme has no sessions yet — open Programmes to add some.'
                      : 'No sessions in this plan yet.'}
                  </p>
                ) : (
                  <div className="day-cards">
                    {programme.days.map((day) => {
                      const done = doneTodayDayIds.has(day.id);
                      const ticked = day.exercises.filter((e) => todayTickIds.has(e.id)).length;
                      const inProgress = !done && ticked > 0;
                      const lastDone = lastDoneFor(day.id);

                      return (
                        <button
                          key={day.id}
                          type="button"
                          className={`day-card ${done ? 'day-card--done' : ''}`}
                          onClick={() => history.push(`/gym/day/${day.id}`)}
                        >
                          <div className="day-card__main">
                            <span className="day-card__label font-display">{day.label}</span>
                            <span className="day-card__meta">
                              {day.exercises.length} exercise{day.exercises.length === 1 ? '' : 's'}
                              {inProgress && ` · ${ticked} done`}
                              {!inProgress && !done && lastDone && ` · last ${lastDone}`}
                            </span>
                          </div>
                          {done ? (
                            <IonIcon icon={checkmarkCircle} className="day-card__done-icon" />
                          ) : (
                            <IonIcon icon={chevronForwardOutline} className="day-card__chevron" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="gym-empty">
                <p className="gym-empty__text">
                  {isOwner
                    ? 'No programme yet. Build the first one — pick from your exercise library.'
                    : 'Your plan is being written. Check back soon ♥'}
                </p>
                {isOwner && (
                  <button
                    type="button"
                    className="gym-empty__cta"
                    onClick={() => history.push('/gym/programmes')}
                  >
                    <IonIcon icon={addCircleOutline} /> Create a programme
                  </button>
                )}
              </div>
            )}

            <button type="button" className="gym-progress-link" onClick={() => history.push('/gym/progress')}>
              <IonIcon icon={trendingUpOutline} />
              {isOwner ? 'See her progress' : 'See my progress'}
            </button>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}

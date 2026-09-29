import { useCallback, useEffect, useMemo, useState } from 'react';
import { IonContent, IonIcon, IonPage, IonSpinner, IonText, IonToast } from '@ionic/react';
import { useHistory, useParams } from 'react-router-dom';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { barbellOutline, checkmarkCircle, ellipseOutline, informationCircleOutline, timerOutline } from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import BrandHeader from '../../shared/ui/BrandHeader';
import { isSameLocalDay, localDateKey } from '../../shared/utils/date';
import ProgressRing from './components/ProgressRing';
import ExerciseDetailSheet from './components/ExerciseDetailSheet';
import Celebration from './components/Celebration';
import {
  fetchActiveProgramme,
  fetchLogs,
  fetchTicks,
  logCompletion,
  setTick,
  type DayExercise,
  type ProgrammeDay,
} from './gymApi';

const FINISH_LINES = [
  'You showed up today. That’s the whole thing ♥',
  'Session done. Proud of you.',
  'That’s another one in the bank 💪',
  'Strong today. Every single rep counted.',
];

/**
 * One workout session: tick exercises off as you go, ring fills, and finishing
 * the last one logs the day and throws confetti.
 */
export default function SessionPage() {
  const { dayId } = useParams<{ dayId: string }>();
  const { token } = useAuth();
  const history = useHistory();

  const [day, setDay] = useState<ProgrammeDay | null>(null);
  const [tickedIds, setTickedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [detail, setDetail] = useState<DayExercise | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [loggedToday, setLoggedToday] = useState(false);

  const today = localDateKey();

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [programme, ticks, logs] = await Promise.all([
        fetchActiveProgramme(token),
        fetchTicks(token, 2),
        fetchLogs(token),
      ]);
      const found = programme?.days.find((d) => d.id === dayId) ?? null;
      setDay(found);
      setTickedIds(
        new Set(ticks.filter((t) => t.tickDate === today).map((t) => t.dayExerciseId)),
      );
      const nowIso = new Date().toISOString();
      setLoggedToday(
        logs.some((log) => log.programmeDayId === dayId && isSameLocalDay(log.completedAt, nowIso)),
      );
      setError(found ? null : 'This session is no longer in the plan.');
    } catch {
      setError('Could not load this session.');
    } finally {
      setLoading(false);
    }
  }, [token, dayId, today]);

  useEffect(() => {
    load();
  }, [load]);

  const doneCount = useMemo(
    () => (day ? day.exercises.filter((e) => tickedIds.has(e.id)).length : 0),
    [day, tickedIds],
  );
  const total = day?.exercises.length ?? 0;

  const toggle = async (exercise: DayExercise) => {
    if (!token || !day) return;

    const wasOn = tickedIds.has(exercise.id);
    const next = new Set(tickedIds);
    if (wasOn) {
      next.delete(exercise.id);
    } else {
      next.add(exercise.id);
    }

    // Optimistic — a tick should feel instant, and it's recoverable if it fails.
    setTickedIds(next);
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {
      // Desktop browser / no haptics hardware — nothing to do.
    });

    try {
      await setTick(token, exercise.id, today, !wasOn);

      // Finishing the last one completes the session — but only once a day, so
      // unticking and re-ticking can't log the same session twice.
      if (!wasOn && next.size === day.exercises.length && !loggedToday) {
        await logCompletion(token, day.id);
        setLoggedToday(true);
        setCelebrating(true);
      }
    } catch {
      setTickedIds(tickedIds);
      setToast('Could not save that. Check your connection.');
    }
  };

  const finishLine = useMemo(() => FINISH_LINES[Math.floor(Math.random() * FINISH_LINES.length)], []);

  return (
    <IonPage>
      <BrandHeader icon={barbellOutline} title={day?.label ?? 'Session'} accent="gold" showBack />

      <IonContent className="ion-padding">
        {loading ? (
          <div className="centered"><IonSpinner /></div>
        ) : error ? (
          <IonText color="danger"><p>{error}</p></IonText>
        ) : day ? (
          <div className="session">
            <div className="session__ring">
              <ProgressRing done={doneCount} total={total} />
            </div>

            {day.coachNote && (
              <p className="session__coach-note font-display-italic">“{day.coachNote}”</p>
            )}

            <div className="session__list">
              {day.exercises.map((item) => {
                const on = tickedIds.has(item.id);
                return (
                  <div key={item.id} className={`ex-row ${on ? 'ex-row--done' : ''}`}>
                    <button
                      type="button"
                      className="ex-row__tick"
                      onClick={() => toggle(item)}
                      aria-label={on ? `Mark ${item.exercise.name} not done` : `Mark ${item.exercise.name} done`}
                      aria-pressed={on}
                    >
                      <IonIcon icon={on ? checkmarkCircle : ellipseOutline} />
                    </button>

                    {item.exercise.imageUrl ? (
                      <img className="ex-row__thumb" src={item.exercise.imageUrl} alt="" />
                    ) : (
                      <span className="ex-row__thumb ex-row__thumb--empty">
                        {item.exercise.name.charAt(0)}
                      </span>
                    )}

                    <div className="ex-row__body">
                      <span className="ex-row__name">{item.exercise.name}</span>
                      <span className="ex-row__meta">
                        {item.sets} × {item.reps}
                        {item.restSeconds != null && (
                          <>
                            {' · '}
                            <IonIcon icon={timerOutline} className="ex-row__meta-icon" />
                            {item.restSeconds}s
                          </>
                        )}
                      </span>
                      {item.note && <span className="ex-row__note">{item.note}</span>}
                    </div>

                    <button
                      type="button"
                      className="ex-row__info"
                      onClick={() => setDetail(item)}
                      aria-label={`How to do ${item.exercise.name}`}
                    >
                      <IonIcon icon={informationCircleOutline} />
                    </button>
                  </div>
                );
              })}
            </div>

            {total > 0 && doneCount === total && (
              <button type="button" className="session__finish" onClick={() => history.push('/gym')}>
                Back to the plan
              </button>
            )}
          </div>
        ) : null}
      </IonContent>

      <ExerciseDetailSheet
        exercise={detail?.exercise ?? null}
        prescription={detail}
        onClose={() => setDetail(null)}
      />

      <Celebration show={celebrating} message={finishLine} onDone={() => setCelebrating(false)} />

      <IonToast isOpen={!!toast} message={toast ?? ''} duration={2500} onDidDismiss={() => setToast(null)} />
    </IonPage>
  );
}

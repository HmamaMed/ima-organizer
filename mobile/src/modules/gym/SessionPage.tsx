import { useCallback, useMemo, useRef, useState } from 'react';
import { IonIcon, IonPage, IonToast, useIonViewWillEnter } from '@ionic/react';
import { useHistory, useParams } from 'react-router-dom';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
  barbellOutline,
  checkmarkCircle,
  ellipseOutline,
  informationCircleOutline,
  timerOutline,
} from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import BrandHeader from '../../shared/ui/BrandHeader';
import AppScreen from '../../shared/ui/AppScreen';
import { isSameLocalDay, localDateKey } from '../../shared/utils/date';
import FeedbackState from '../../shared/ui/FeedbackState';
import AppButton from '../../shared/ui/AppButton';
import './gym.css';
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
  const { token, user } = useAuth();
  const history = useHistory();

  const [day, setDay] = useState<ProgrammeDay | null>(null);
  const [tickedIds, setTickedIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const writeLock = useRef(false);
  const loadedDate = useRef(localDateKey());
  const [completionError, setCompletionError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [detail, setDetail] = useState<DayExercise | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [loggedToday, setLoggedToday] = useState(false);


  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const date = localDateKey();
    try {
      const [programme, ticks, logs] = await Promise.all([
        fetchActiveProgramme(token),
        fetchTicks(token, 2),
        fetchLogs(token),
      ]);
      const found = programme?.days.find((d) => d.id === dayId) ?? null;
      setDay(found);
      loadedDate.current = date;
      setCompletionError(false);
      setTickedIds(
        new Set(
          ticks
            .filter(
              (t) =>
                t.tickDate === date &&
                t.userId === user?.userId &&
                found?.exercises.some((ex) => ex.id === t.dayExerciseId),
            )
            .map((t) => t.dayExerciseId),
        ),
      );
      const nowIso = new Date().toISOString();
      setLoggedToday(
        logs.some(
          (log) =>
            log.userId === user?.userId &&
            log.programmeDayId === dayId &&
            isSameLocalDay(log.completedAt, nowIso),
        ),
      );
      setError(found ? null : 'This session is no longer in the plan.');
    } catch {
      setError('Could not load this session.');
    } finally {
      setLoading(false);
    }
  }, [token, user?.userId, dayId]);

  useIonViewWillEnter(() => {
    void load();
  });

  const doneCount = useMemo(
    () => (day ? day.exercises.filter((e) => tickedIds.has(e.id)).length : 0),
    [day, tickedIds],
  );
  const total = day?.exercises.length ?? 0;

  const finish = async () => {
    if (!token || !day || loggedToday) return;
    setCompletionError(false);
    try {
      await logCompletion(token, day.id);
      setLoggedToday(true);
      setCelebrating(true);
    } catch {
      // The ticks were saved. Keep them checked and offer a completion retry.
      setCompletionError(true);
    }
  };

  const retryCompletion = async () => {
    if (writeLock.current || loggedToday) return;
    if (loadedDate.current !== localDateKey()) {
      await load();
      return;
    }
    writeLock.current = true;
    setPending(true);
    try {
      await finish();
    } finally {
      writeLock.current = false;
      setPending(false);
    }
  };

  const toggle = async (exercise: DayExercise) => {
    if (!token || !day || writeLock.current) return;
    if (loadedDate.current !== localDateKey()) {
      await load();
      setToast('A new day started. Your session has been refreshed.');
      return;
    }
    writeLock.current = true;
    setPending(true);
    const wasOn = tickedIds.has(exercise.id);
    const previous = new Set(tickedIds);
    const next = new Set(tickedIds);
    if (wasOn) next.delete(exercise.id);
    else next.add(exercise.id);
    setTickedIds(next);
    setCompletionError(false);
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    try {
      await setTick(token, exercise.id, localDateKey(), !wasOn);
    } catch {
      setTickedIds(previous);
      setToast('Could not save that check. Please try again.');
      writeLock.current = false;
      setPending(false);
      return;
    }
    if (!wasOn && day.exercises.every((item) => next.has(item.id)) && !loggedToday) await finish();
    writeLock.current = false;
    setPending(false);
  };

  const finishLine = useMemo(
    () => FINISH_LINES[Math.floor(Math.random() * FINISH_LINES.length)],
    [],
  );

  return (
    <IonPage>
      <BrandHeader icon={barbellOutline} title="Gym Coach" accent="gold" showBack backTo="/gym" />

      <AppScreen
        title={day?.label ?? 'Your session.'}
        eyebrow="Gym Coach"
        subtitle="One movement at a time."
      >
        {loading && !day && <FeedbackState kind="loading" heading="Finding your session…" />}
        {error && <FeedbackState kind="failure" heading={error} onRetry={load} />}
        {day && (
          <div className="session">
            <div className="session-progress">
              <p className="session-progress__label">
                <span>{total > 0 ? `${doneCount} of ${total} exercises` : 'No exercises yet'}</span>
                <span>{total > 0 ? `${Math.round((doneCount / total) * 100)}%` : ''}</span>
              </p>
              <progress value={doneCount} max={total || 1} aria-label="Exercises checked" />
            </div>
            {total === 0 && (
              <FeedbackState
                kind="empty"
                heading="This session is still being written."
                detail="There are no exercises to complete yet."
              />
            )}

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
                      disabled={pending || loading}
                      aria-label={
                        on
                          ? `Mark ${item.exercise.name} not done`
                          : `Mark ${item.exercise.name} done`
                      }
                      aria-pressed={on}
                    >
                      <IonIcon icon={on ? checkmarkCircle : ellipseOutline} />
                    </button>

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

            {pending && <FeedbackState kind="loading" heading="Saving your progress…" />}
            {completionError && (
              <FeedbackState
                kind="failure"
                heading="Your checks are saved. The session could not be logged."
                detail="Try again to record your completed session."
              />
            )}
            {total > 0 && doneCount === total && !loggedToday && !pending && (
              <AppButton onClick={retryCompletion}>Save completed session</AppButton>
            )}
            {loggedToday && (
              <FeedbackState
                kind="success"
                heading="Session saved for today."
                detail="You showed up. That counts."
              />
            )}
            {loggedToday && (
              <button
                type="button"
                className="session__finish"
                onClick={() => history.push('/gym')}
              >
                Back to the plan
              </button>
            )}
          </div>
        )}
      </AppScreen>

      <ExerciseDetailSheet
        exercise={detail?.exercise ?? null}
        prescription={detail}
        onClose={() => setDetail(null)}
      />

      <Celebration show={celebrating} message={finishLine} onDone={() => setCelebrating(false)} />

      <IonToast
        isOpen={!!toast}
        message={toast ?? ''}
        duration={2500}
        onDidDismiss={() => setToast(null)}
      />
    </IonPage>
  );
}

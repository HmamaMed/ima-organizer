import { useCallback, useMemo, useState } from 'react';
import { IonPage, useIonViewWillEnter } from '@ionic/react';
import { useLocation } from 'react-router-dom';
import { trendingUpOutline } from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import BrandHeader from '../../shared/ui/BrandHeader';
import AppScreen from '../../shared/ui/AppScreen';
import FeedbackState from '../../shared/ui/FeedbackState';
import {
  buildHeatmap,
  buildWeekdayStrip,
  computeStreak,
  isSameLocalDay,
} from '../../shared/utils/date';
import { fetchLogs, type WorkoutLog } from './gymApi';
import './gym.css';

interface Badge {
  emoji: string;
  label: string;
  hint: string;
  earned: boolean;
}

function buildBadges(logs: WorkoutLog[], streak: number): Badge[] {
  const total = logs.length;
  const nowIso = new Date().toISOString();
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const inLastWeek = logs.filter((log) => new Date(log.completedAt) >= lastWeek).length;

  return [
    { emoji: '🌱', label: 'First step', hint: 'Finish one session', earned: total >= 1 },
    { emoji: '🔥', label: 'Week warrior', hint: '7-day streak', earned: streak >= 7 },
    { emoji: '💪', label: 'Ten strong', hint: '10 sessions done', earned: total >= 10 },
    {
      emoji: '👑',
      label: 'Consistency queen',
      hint: '4 sessions in a week',
      earned: inLastWeek >= 4,
    },
    { emoji: '🏆', label: 'Thirty club', hint: '30 sessions done', earned: total >= 30 },
    {
      emoji: '☀️',
      label: 'Today counts',
      hint: 'Train today',
      earned: logs.some((log) => isSameLocalDay(log.completedAt, nowIso)),
    },
  ];
}

/**
 * Progress view. The owner gets a Hers/Mine toggle since he trains alongside
 * her; the recipient just sees her own.
 */
export default function ProgressPage() {
  const { token, user } = useAuth();
  const isOwner = user?.role === 'OWNER';
  const location = useLocation<{ showing?: 'mine' | 'partner' }>();

  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showing, setShowing] = useState<'partner' | 'mine'>(isOwner ? 'partner' : 'mine');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setLogs(await fetchLogs(token));
      setLoaded(true);
      setError(null);
    } catch {
      setError('Could not load progress.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useIonViewWillEnter(() => {
    if (location.state?.showing) setShowing(location.state.showing);
    void load();
  });

  const visible = useMemo(() => {
    const myId = user?.userId;
    if (showing === 'mine') {
      return logs.filter((log) => log.userId === myId);
    }
    // Unattributed legacy logs are not evidence of either person's activity.
    return logs.filter((log) => log.userId != null && log.userId !== myId);
  }, [logs, showing, user?.userId]);

  const dates = visible.map((log) => log.completedAt);
  const streak = computeStreak(dates);
  const heatmap = buildHeatmap(dates, 12);
  const badges = buildBadges(visible, streak);

  const week = buildWeekdayStrip(dates);
  const thisWeek = visible.filter((log) =>
    week.some((d) => isSameLocalDay(log.completedAt, d.date.toISOString())),
  ).length;
  const legacyCount = logs.filter((log) => log.userId === null).length;

  return (
    <IonPage>
      <BrandHeader icon={trendingUpOutline} title="Progress" accent="gold" showBack backTo="/gym" />

      <AppScreen title="Your progress." eyebrow="Gym Coach" subtitle="Every little session counts.">
        {loading && !loaded && <FeedbackState kind="loading" heading="Finding your progress…" />}
        {error && <FeedbackState kind="failure" heading={error} onRetry={load} />}
        {loaded && (
          <div className="progress">
            {isOwner && (
              <div className="progress__toggle" role="group" aria-label="Whose progress">
                <button
                  type="button"
                  className={`progress__tab ${showing === 'partner' ? 'progress__tab--on' : ''}`}
                  aria-pressed={showing === 'partner'}
                  onClick={() => setShowing('partner')}
                >
                  Hers
                </button>
                <button
                  type="button"
                  className={`progress__tab ${showing === 'mine' ? 'progress__tab--on' : ''}`}
                  aria-pressed={showing === 'mine'}
                  onClick={() => setShowing('mine')}
                >
                  Mine
                </button>
              </div>
            )}

            <div className="progress__feature">
              <strong>{thisWeek}</strong>
              <p>session{thisWeek === 1 ? '' : 's'} this week</p>
            </div>
            <div className="progress__stats">
              <div className="stat">
                <span className="stat__value font-display">{streak}</span>
                <span className="stat__label">day streak</span>
              </div>
              <div className="stat">
                <span className="stat__value font-display">{visible.length}</span>
                <span className="stat__label">sessions</span>
              </div>
            </div>

            <section className="progress__section">
              <h2 className="progress__heading">This week</h2>
              <div className="days-strip">
                {week.map((day) => (
                  <div
                    key={day.date.toISOString()}
                    className={`day-pip ${day.isToday ? 'day-pip--today' : ''} ${day.hasLog ? 'day-pip--done' : ''}`}
                    aria-label={`${day.date.toLocaleDateString(undefined, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short',
                    })}${day.isToday ? ', today' : ''}, ${day.hasLog ? 'session completed' : 'no session logged'}`}
                  >
                    <span>{day.label}</span>
                    <span>{day.hasLog ? '✓' : day.date.getDate()}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="progress__section">
              <h2 className="progress__heading">Last 12 weeks</h2>
              <div className="heatmap" aria-label="Workout calendar">
                {heatmap.map((cell) => (
                  <span
                    key={cell.key}
                    className={`heatmap__cell ${cell.count > 0 ? 'heatmap__cell--on' : ''} ${
                      cell.isToday ? 'heatmap__cell--today' : ''
                    }`}
                    role="img"
                    aria-label={`${cell.key}: ${cell.count > 0 ? `${cell.count} sessions completed` : 'no session'}${cell.isToday ? ', today' : ''}`}
                    title={`${cell.key}${cell.count > 0 ? ` · ${cell.count} session${cell.count === 1 ? '' : 's'}` : ''}`}
                  />
                ))}
              </div>
              <div className="heatmap-legend">
                <span>
                  <i />
                  No session
                </span>
                <span>
                  <i />
                  Session completed
                </span>
                <span>Rose outline · Today</span>
              </div>
            </section>

            <section className="progress__section">
              <h2 className="progress__heading">Little milestones</h2>
              <div className="badges">
                {badges.map((badge) => (
                  <div key={badge.label} className={`badge ${badge.earned ? 'badge--earned' : ''}`}>
                    <span className="badge__emoji">{badge.emoji}</span>
                    <span className="badge__label">{badge.label}</span>
                    <span className="badge__hint">
                      {badge.earned ? 'Earned · ' : 'To unlock · '}
                      {badge.hint}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {legacyCount > 0 && (
              <p className="compose-hint">
                {legacyCount} older session{legacyCount === 1 ? ' has' : 's have'} no recorded
                person and {legacyCount === 1 ? 'is' : 'are'} excluded from these totals.
              </p>
            )}
            {visible.length === 0 && (
              <p className="empty-state">
                {showing === 'mine'
                  ? 'No sessions logged yet.'
                  : 'No sessions logged yet — first one soon ♥'}
              </p>
            )}
          </div>
        )}
      </AppScreen>
    </IonPage>
  );
}

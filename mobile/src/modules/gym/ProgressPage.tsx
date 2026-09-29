import { useCallback, useEffect, useMemo, useState } from 'react';
import { IonContent, IonPage, IonSpinner, IonText } from '@ionic/react';
import { trendingUpOutline } from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import BrandHeader from '../../shared/ui/BrandHeader';
import { buildHeatmap, computeStreak, isSameLocalDay } from '../../shared/utils/date';
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
    { emoji: '👑', label: 'Consistency queen', hint: '4 sessions in a week', earned: inLastWeek >= 4 },
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

  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showing, setShowing] = useState<'partner' | 'mine'>(isOwner ? 'partner' : 'mine');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setLogs(await fetchLogs(token));
      setError(null);
    } catch {
      setError('Could not load progress.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const myId = user?.userId;
    if (showing === 'mine') {
      return logs.filter((log) => log.userId === myId);
    }
    // "Partner" = the other person. Logs with no userId predate user tracking;
    // they're attributed here since the gym plan is the recipient's.
    return logs.filter((log) => log.userId !== myId);
  }, [logs, showing, user?.userId]);

  const dates = visible.map((log) => log.completedAt);
  const streak = computeStreak(dates);
  const heatmap = buildHeatmap(dates, 12);
  const badges = buildBadges(visible, streak);

  const thisWeek = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return visible.filter((log) => new Date(log.completedAt) >= weekAgo).length;
  }, [visible]);

  return (
    <IonPage>
      <BrandHeader icon={trendingUpOutline} title="Progress" accent="gold" showBack />

      <IonContent className="ion-padding">
        {loading ? (
          <div className="centered"><IonSpinner /></div>
        ) : error ? (
          <IonText color="danger"><p>{error}</p></IonText>
        ) : (
          <div className="progress">
            {isOwner && (
              <div className="progress__toggle">
                <button
                  type="button"
                  className={`progress__tab ${showing === 'partner' ? 'progress__tab--on' : ''}`}
                  onClick={() => setShowing('partner')}
                >
                  Hers
                </button>
                <button
                  type="button"
                  className={`progress__tab ${showing === 'mine' ? 'progress__tab--on' : ''}`}
                  onClick={() => setShowing('mine')}
                >
                  Mine
                </button>
              </div>
            )}

            <div className="progress__stats">
              <div className="stat">
                <span className="stat__value font-display">{streak}</span>
                <span className="stat__label">day streak</span>
              </div>
              <div className="stat">
                <span className="stat__value font-display">{visible.length}</span>
                <span className="stat__label">sessions</span>
              </div>
              <div className="stat">
                <span className="stat__value font-display">{thisWeek}</span>
                <span className="stat__label">this week</span>
              </div>
            </div>

            <section className="progress__section">
              <h2 className="progress__heading">Last 12 weeks</h2>
              <div className="heatmap" aria-label="Workout calendar">
                {heatmap.map((cell) => (
                  <span
                    key={cell.key}
                    className={`heatmap__cell ${cell.count > 0 ? 'heatmap__cell--on' : ''} ${
                      cell.isToday ? 'heatmap__cell--today' : ''
                    }`}
                    title={`${cell.key}${cell.count > 0 ? ` · ${cell.count} session${cell.count === 1 ? '' : 's'}` : ''}`}
                  />
                ))}
              </div>
            </section>

            <section className="progress__section">
              <h2 className="progress__heading">Badges</h2>
              <div className="badges">
                {badges.map((badge) => (
                  <div key={badge.label} className={`badge ${badge.earned ? 'badge--earned' : ''}`}>
                    <span className="badge__emoji">{badge.emoji}</span>
                    <span className="badge__label">{badge.label}</span>
                    <span className="badge__hint">{badge.hint}</span>
                  </div>
                ))}
              </div>
            </section>

            {visible.length === 0 && (
              <p className="empty-state">
                {showing === 'mine' ? 'No sessions logged yet.' : 'No sessions logged yet — first one soon ♥'}
              </p>
            )}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}

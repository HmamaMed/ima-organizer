import { useEffect, useState } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import HeartMark from '../../shared/ui/HeartMark';
import './BirthdayCountdownPage.css';

/**
 * Birthday unlock date: October 3rd, midnight Morocco time.
 * Morocco toggles between UTC+1 and standard UTC+0 around Ramadan; per the
 * tz database it's on UTC+0 from Sep 20, 2026 through the next transition
 * (well past Oct 3), so that's the offset hardcoded here. Re-verify the
 * offset against the current tz rules if this date ever moves to a different
 * year, since Morocco's schedule isn't fixed. The offset is hardcoded rather
 * than left timezone-less so `new Date(...)` doesn't parse it in the
 * device's local timezone instead of Morocco's.
 */
export const MEMORIES_UNLOCK_DATE = new Date('2026-10-03T00:00:00+00:00');

function formatUnlockDate(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  reached: boolean;
}

function diffFrom(target: Date, now: Date): Countdown {
  const totalMs = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    reached: totalMs <= 0,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

const SPARKS = Array.from({ length: 7 }, (_, i) => i);

export default function BirthdayCountdownPage() {
  const history = useHistory();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { days, hours, minutes, seconds, reached } = diffFrom(MEMORIES_UNLOCK_DATE, now);

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <div className="lock-screen">
          <div className="lock-screen__sparks" aria-hidden="true">
            {SPARKS.map((i) => (
              <span key={i} className={`lock-screen__spark lock-screen__spark--${i}`}>♥</span>
            ))}
          </div>

          <div className="lock-screen__mark">
            <HeartMark />
          </div>

          <p className="lock-screen__eyebrow">Memories</p>
          <p className="lock-screen__title font-display-italic">
            {reached ? 'It’s time.' : 'Something is waiting for you'}
          </p>

          {!reached && (
            <div className="lock-screen__countdown">
              <div className="lock-screen__unit">
                <span className="lock-screen__num font-display">{days}</span>
                <span className="lock-screen__label">days</span>
              </div>
              <span className="lock-screen__colon">:</span>
              <div className="lock-screen__unit">
                <span className="lock-screen__num font-display">{pad(hours)}</span>
                <span className="lock-screen__label">hrs</span>
              </div>
              <span className="lock-screen__colon">:</span>
              <div className="lock-screen__unit">
                <span className="lock-screen__num font-display">{pad(minutes)}</span>
                <span className="lock-screen__label">min</span>
              </div>
              <span className="lock-screen__colon">:</span>
              <div className="lock-screen__unit">
                <span className="lock-screen__num font-display">{pad(seconds)}</span>
                <span className="lock-screen__label">sec</span>
              </div>
            </div>
          )}

          <p className="lock-screen__sub">
            {reached
              ? 'Every memory is unlocked. Happy birthday.'
              : `Memories unlock on ${formatUnlockDate(MEMORIES_UNLOCK_DATE)}`}
          </p>

          <button type="button" className="lock-screen__testing-link" onClick={() => history.push('/memories')}>
            ← Testing: view the real memories page
          </button>
        </div>
      </IonContent>
    </IonPage>
  );
}

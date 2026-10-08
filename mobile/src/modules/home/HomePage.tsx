import { useEffect, useState } from 'react';
import { IonIcon, IonPage, useIonViewWillEnter } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import {
  arrowForwardOutline,
  barbellOutline,
  chatbubbleEllipsesOutline,
  imagesOutline,
  personOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import AppScreen from '../../shared/ui/AppScreen';
import HeartMark from '../../shared/ui/HeartMark';
import { fetchNotes, type Note } from '../notes/notesApi';
import { fetchMemories } from '../memories/memoriesApi';
import { isMemoriesLocked } from '../memories/BirthdayCountdownPage';
import { fetchLogs } from '../gym/gymApi';
import { buildWeekdayStrip } from '../../shared/utils/date';

const CHAPTERS = [
  {
    icon: chatbubbleEllipsesOutline,
    label: 'Notes',
    accent: 'rose',
    path: '/notes',
    description: 'Words to keep close',
  },
  {
    icon: imagesOutline,
    label: 'Memories',
    accent: 'plum',
    path: '/memories',
    description: 'Our moments, kept',
  },
  {
    icon: barbellOutline,
    label: 'Gym Coach',
    accent: 'gold',
    path: '/gym',
    description: 'One step at a time',
  },
];

function greeting(now: Date): string {
  if (now.getHours() < 12) return 'Good morning';
  if (now.getHours() < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomePage() {
  const { user, token } = useAuth();
  const history = useHistory();
  const [latestNote, setLatestNote] = useState<Note | null>(null);
  const [counts, setCounts] = useState<{
    memories: number | null;
    activeDays: number | null;
  }>({ memories: null, activeDays: null });
  const [now, setNow] = useState(() => new Date());
  const [visit, setVisit] = useState(0);
  useIonViewWillEnter(() => setVisit((v) => v + 1));

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    // Each chapter loads independently: navigation is usable immediately.
    fetchNotes(token)
      .then((notes) => {
        if (cancelled) return;
        const sent = notes
          .filter((n) => n.status === 'SENT')
          .sort(
            (a, b) => Date.parse(b.sentAt ?? b.createdAt) - Date.parse(a.sentAt ?? a.createdAt),
          );
        setLatestNote(sent[0] ?? null);
      })
      .catch(() => {});
    fetchMemories(token)
      .then((memories) => {
        if (!cancelled) setCounts((c) => ({ ...c, memories: memories.length }));
      })
      .catch(() => {});
    fetchLogs(token)
      .then((logs) => {
        if (cancelled) return;
        const mine = logs.filter((log) => log.userId === user?.userId);
        setCounts((c) => ({
          ...c,
          activeDays: buildWeekdayStrip(mine.map((l) => l.completedAt)).filter((d) => d.hasLog)
            .length,
        }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token, user?.userId, visit]);

  return (
    <IonPage>
      <AppScreen className="content-safe-top">
        <div className="home-screen">
          <div className="home-brand">
            <HeartMark />
            <span>Life Organizer</span>
            <button
              type="button"
              className="icon-btn"
              aria-label="Open profile"
              onClick={() => history.push('/profile')}
            >
              <IonIcon icon={personOutline} />
            </button>
          </div>
          <div className="home-greeting">
            <p className="lo-eyebrow">
              {now.toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            <h1 className="home-greeting__hi">
              {greeting(now)}
              {user ? `, ${user.name}.` : '.'}
            </h1>
            <p className="home-greeting__sub">A little space for your everyday.</p>
          </div>
          {latestNote && (
            <button type="button" className="home-note" onClick={() => history.push('/notes')}>
              <span className="home-note__label">
                <IonIcon icon={chatbubbleEllipsesOutline} />
                {user?.role === 'OWNER' ? 'Your latest sent note' : 'A little note for you'}
              </span>
              <span className="home-note__quote">{latestNote.content}</span>
              <span className="home-note__foot">
                <span>
                  {new Date(latestNote.sentAt ?? latestNote.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
                <IonIcon icon={arrowForwardOutline} />
              </span>
            </button>
          )}
          <h2 className="lo-section-heading">Your chapters</h2>
          <div className="modules">
            {CHAPTERS.map((chapter) => {
              const locked = chapter.path === '/memories' && isMemoriesLocked(user?.role, now);
              const count = chapter.path === '/memories' ? counts.memories : null;
              return (
                <button
                  key={chapter.path}
                  type="button"
                  className="mod-row"
                  onClick={() => history.push(locked ? '/memories/countdown' : chapter.path)}
                >
                  <span className={`mod-icon mod-icon--${chapter.accent}`}>
                    <IonIcon icon={chapter.icon} />
                  </span>
                  <span>
                    <span className="mod-row__title" style={{ display: 'block' }}>
                      {chapter.label}
                    </span>
                    <span className="mod-row__sub">
                      {locked ? 'Something is waiting for you' : chapter.description}
                      {!locked && chapter.path !== '/notes' && count !== null && count > 0
                        ? ` · ${count}`
                        : ''}
                    </span>
                  </span>
                </button>
              );
            })}
            <button type="button" className="mod-row" onClick={() => history.push('/more')}>
              <span className="mod-row__top">
                <span className="mod-icon mod-icon--soon">
                  <IonIcon icon={sparklesOutline} />
                </span>
                <span className="tag-soon">Soon</span>
              </span>
              <span>
                <span className="mod-row__title" style={{ display: 'block' }}>
                  More chapters
                </span>
                <span className="mod-row__sub">A little more, in time</span>
              </span>
            </button>
          </div>
          {counts.activeDays !== null && counts.activeDays > 0 && (
            <button
              type="button"
              className="home-glance"
              onClick={() => history.push('/gym/progress', { showing: 'mine' })}
            >
              <IonIcon icon={barbellOutline} />
              <span>
                You showed up on {counts.activeDays} day{counts.activeDays === 1 ? '' : 's'} this
                week.
              </span>
              <IonIcon icon={arrowForwardOutline} />
            </button>
          )}
          <p className="modules-foot">Made just for you. One chapter at a time.</p>
        </div>
      </AppScreen>
    </IonPage>
  );
}

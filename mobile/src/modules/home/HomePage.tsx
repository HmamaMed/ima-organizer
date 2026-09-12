import { useEffect, useState } from 'react';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import {
  barbellOutline,
  chatbubbleEllipsesOutline,
  imagesOutline,
  lockClosedOutline
} from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import HeartMark from '../../shared/ui/HeartMark';
import { fetchNotes } from '../notes/notesApi';
import { fetchMemories } from '../memories/memoriesApi';
import { fetchLogs } from '../gym/gymApi';
import { computeStreak } from '../../shared/utils/date';

type Accent = 'rose' | 'plum' | 'gold';

interface ModuleDef {
  icon: string;
  label: string;
  accent: Accent;
  path: string;
}

const MODULES: ModuleDef[] = [
  { icon: chatbubbleEllipsesOutline, label: 'Notes', accent: 'rose', path: '/notes' },
  { icon: imagesOutline, label: 'Memories', accent: 'plum', path: '/memories' },
  { icon: barbellOutline, label: 'Gym Coach', accent: 'gold', path: '/gym' },
];

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatToday(now: Date): string {
  return now.toLocaleDateString(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit' });
}

interface Counts {
  notes: number | null;
  memories: number | null;
  streak: number | null;
}

export default function HomePage() {
  const { user, token } = useAuth();
  const history = useHistory();
  const [counts, setCounts] = useState<Counts>({ notes: null, memories: null, streak: null });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      const [notes, memories, logs] = await Promise.allSettled([
        fetchNotes(token),
        fetchMemories(token),
        fetchLogs(token),
      ]);
      if (cancelled) return;
      setCounts({
        notes: notes.status === 'fulfilled' ? notes.value.length : null,
        memories: memories.status === 'fulfilled' ? memories.value.length : null,
        streak: logs.status === 'fulfilled' ? computeStreak(logs.value.map((l) => l.completedAt)) : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const subtitleFor = (mod: ModuleDef): string => {
    if (mod.path === '/notes') return counts.notes === null ? 'Notes' : `${counts.notes} note${counts.notes === 1 ? '' : 's'}`;
    if (mod.path === '/memories') return counts.memories === null ? 'Memories, kept safe' : `${counts.memories} memories · take a slow walk`;
    return 'Today’s plan';
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="home-screen">
          <div className="home-greeting">
            <div className="home-greeting__mark">
              <HeartMark />
            </div>
            <div>
              <p className="home-greeting__hi font-display-italic">{greeting(now)}{user ? `, ${user.name}` : ''}</p>
              <p className="home-greeting__date">{formatToday(now)}</p>
            </div>
          </div>

          {counts.streak !== null && counts.streak > 0 && (
            <div className="home-glance">
              <span className="home-glance__text">Gym Coach: <b>{counts.streak}-day streak</b></span>
              <span className="home-glance__badge">🔥</span>
            </div>
          )}

          <div className="modules">
            {MODULES.map((mod) => (
              <button
                key={mod.path}
                type="button"
                className="mod-row"
                onClick={() => history.push(mod.path)}
              >
                <div className={`mod-icon mod-icon--${mod.accent}`}>
                  <IonIcon icon={mod.icon} />
                </div>
                <div className="mod-row__text">
                  <p className="mod-row__title font-display">{mod.label}</p>
                  <p className="mod-row__sub">{subtitleFor(mod)}</p>
                </div>
              </button>
            ))}

            <div className="mod-row mod-row--soon" onClick={() => history.push('/more')}>
              <div className="mod-icon mod-icon--soon">
                <IonIcon icon={lockClosedOutline} />
              </div>
              <div className="mod-row__text">
                <p className="mod-row__title font-display">More</p>
                <p className="mod-row__sub">Coming soon</p>
              </div>
              <span className="tag-soon">Soon</span>
            </div>
          </div>

          <p className="modules-foot">This is chapter three. More get added here as they're written.</p>
        </div>
      </IonContent>
    </IonPage>
  );
}

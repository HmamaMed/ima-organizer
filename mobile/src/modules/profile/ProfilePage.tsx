import { useEffect, useState } from 'react';
import { IonContent, IonIcon, IonPage, IonToast } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import {
  personOutline,
  notificationsOutline,
  informationCircleOutline,
  logOutOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import { fetchNotes } from '../notes/notesApi';
import { fetchMemories } from '../memories/memoriesApi';
import { fetchLogs } from '../gym/gymApi';

interface Stats {
  notes: number | null;
  memories: number | null;
  workouts: number | null;
}

export default function ProfilePage() {
  const { user, token, logout } = useAuth();
  const history = useHistory();
  const [stats, setStats] = useState<Stats>({ notes: null, memories: null, workouts: null });
  const [toast, setToast] = useState<string | null>(null);

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
      setStats({
        notes: notes.status === 'fulfilled' ? notes.value.length : null,
        memories: memories.status === 'fulfilled' ? memories.value.length : null,
        workouts: logs.status === 'fulfilled' ? logs.value.length : null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleLogout = () => {
    logout();
    history.push('/login');
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <div className="profile-top">
          <div className="avatar">
            <IonIcon icon={personOutline} />
          </div>
          <p className="profile-top__name font-display-italic">{user?.name ?? 'You'}</p>
          <p className="profile-top__role">{user?.role === 'OWNER' ? 'Owner' : 'Recipient'}</p>
        </div>

        <div className="stat-row">
          <div className="stat"><b>{stats.notes ?? '–'}</b><span>notes</span></div>
          <div className="stat"><b>{stats.memories ?? '–'}</b><span>memories</span></div>
          <div className="stat"><b>{stats.workouts ?? '–'}</b><span>workouts</span></div>
        </div>

        <div className="settings-list">
          <button className="settings-row" onClick={() => setToast('Coming soon.')}>
            <IonIcon icon={personOutline} /> Edit profile
            <IonIcon icon={chevronForwardOutline} className="settings-row__chevron" />
          </button>
          <button className="settings-row" onClick={() => setToast('Coming soon.')}>
            <IonIcon icon={notificationsOutline} /> Notifications
            <IonIcon icon={chevronForwardOutline} className="settings-row__chevron" />
          </button>
          <button className="settings-row" onClick={() => setToast('A private, modular app — built one chapter at a time.')}>
            <IonIcon icon={informationCircleOutline} /> About this app
            <IonIcon icon={chevronForwardOutline} className="settings-row__chevron" />
          </button>
          <button className="settings-row settings-row--logout" onClick={handleLogout}>
            <IonIcon icon={logOutOutline} /> Log out
          </button>
        </div>
      </IonContent>

      <IonToast isOpen={!!toast} message={toast ?? ''} duration={2200} onDidDismiss={() => setToast(null)} />
    </IonPage>
  );
}

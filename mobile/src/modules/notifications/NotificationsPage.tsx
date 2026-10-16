import { useCallback, useEffect, useRef, useState } from 'react';
import { IonIcon, IonPage, IonRefresher, IonRefresherContent, IonToast, useIonViewWillEnter } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { giftOutline, notificationsOutline, trashOutline } from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import AppScreen from '../../shared/ui/AppScreen';
import BrandHeader from '../../shared/ui/BrandHeader';
import AppButton from '../../shared/ui/AppButton';
import ConfirmSheet from '../../shared/ui/ConfirmSheet';
import FeedbackState from '../../shared/ui/FeedbackState';
import { moroccoFormat } from '../../shared/utils/moroccoTime';
import { ApiError } from '../../shared/api/client';
import { deleteNotification, fetchNotifications, type InboxNotification } from './notificationsApi';
import './notifications.css';

export default function NotificationsPage() {
  const { token } = useAuth();
  const history = useHistory();
  const [entries, setEntries] = useState<InboxNotification[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InboxNotification | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const version = useRef(0);
  const pending = useRef(false);
  const load = useCallback(async () => {
    if (!token) return;
    const request = ++version.current;
    setLoading(true);
    try {
      const data = await fetchNotifications(token);
      if (request === version.current) { setEntries(data); setError(null); }
    } catch {
      if (request === version.current) setError('Could not load your notifications.');
    } finally { if (request === version.current) setLoading(false); }
  }, [token]);
  useIonViewWillEnter(() => { void load(); });
  useEffect(() => {
    const requests = version;
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', refresh);
    return () => { ++requests.current; document.removeEventListener('visibilitychange', refresh); };
  }, [load]);

  async function remove() {
    if (!token || !selected || pending.current) return;
    pending.current = true; setDeleting(true); setDeleteError(null);
    try {
      try { await deleteNotification(token, selected.id); }
      catch (cause) { if (!(cause instanceof ApiError && cause.status === 404)) throw cause; }
      ++version.current; setLoading(false);
      setEntries(previous => (previous ?? []).filter(entry => entry.id !== selected.id));
      setSelected(null); setToast('Notification deleted.');
    } catch { setDeleteError('Could not delete this notification. Please try again.'); }
    finally { pending.current = false; setDeleting(false); }
  }

  return <IonPage>
    <BrandHeader icon={notificationsOutline} title="Notifications" accent="rose" showBack backTo="/profile" />
    <AppScreen eyebrow="Your little reminders" title="A thoughtful heads-up." subtitle="Birthday reminders, kept here just for you."
      fixedContent={<IonRefresher slot="fixed" onIonRefresh={event => { void load().finally(() => event.detail.complete()); }}><IonRefresherContent /></IonRefresher>}>
      {loading && !entries && <FeedbackState kind="loading" heading="Finding your reminders…" />}
      {error && <FeedbackState kind="failure" heading={error} onRetry={load} />}
      <div className="notification-inbox" aria-busy={loading}>
        {entries?.length === 0 && !error && <section className="notification-empty">
          <span className="notification-symbol"><IonIcon icon={notificationsOutline} aria-hidden="true" /></span>
          <h2>All quiet for now.</h2>
          <p>Your birthday reminders will appear here 3 days before and 1 day before, around 7pm.</p>
          <AppButton variant="secondary" onClick={() => history.push('/birthdays')}>Your birthdays</AppButton>
        </section>}
        {!!entries?.length && <>
          <div className="notification-heading"><h2>Birthday reminders</h2><span>{entries.length} saved</span></div>
          <ul className="notification-list" aria-label="Birthday notifications">
            {entries.map(entry => <li className="notification-card" key={entry.id}>
              <span className="notification-symbol"><IonIcon icon={giftOutline} aria-hidden="true" /></span>
              <div className="notification-card__content">
                <h3>{entry.title}</h3><p>{entry.body}</p>
                <time dateTime={entry.createdAt}>{moroccoFormat(new Date(entry.createdAt), { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })} · Morocco</time>
              </div>
              <button type="button" className="icon-btn notification-delete" aria-label={`Delete notification: ${entry.body}`}
                onClick={() => { setSelected(entry); setDeleteError(null); }}><IonIcon icon={trashOutline} /></button>
            </li>)}
          </ul>
          <p className="notification-footnote">Reminders show when they arrived. Manage upcoming dates in <button type="button" onClick={() => history.push('/birthdays')}>your birthdays</button>.</p>
        </>}
      </div>
    </AppScreen>
    <ConfirmSheet open={!!selected} title="Delete this notification?" detail={deleteError ?? 'This message will be removed from your inbox. Your saved birthday and future reminders stay active.'}
      confirmLabel="Delete notification" busy={deleting} onConfirm={() => { void remove(); }} onClose={() => { setSelected(null); setDeleteError(null); }} />
    <IonToast isOpen={!!toast} message={toast} duration={2200} onDidDismiss={() => setToast('')} />
  </IonPage>;
}

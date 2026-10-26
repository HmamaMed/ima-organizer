import { t, useI18n, getLanguage } from "../../shared/i18n";
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

function notificationBody(body: string): string {
  // Translate the system sentence while preserving the exact user-entered occasion.
  const match = /^« (.*) » : dans ([13]) jours?\.$/s.exec(body) ?? /^“(.*)” is in ([13]) days?\.$/s.exec(body);
  if (!match) return body;
  return t(match[2] === '1' ? '« {name} » : dans 1 jour.' : '« {name} » : dans {days} jours.', { name: match[1], days: match[2] });
}

export default function NotificationsPage() {
  useI18n();
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
      if (request === version.current) setError(t("Could not load your notifications."));
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
      setSelected(null); setToast(t("Notification deleted."));
    } catch { setDeleteError(t("Could not delete this notification. Please try again.")); }
    finally { pending.current = false; setDeleting(false); }
  }

  return <IonPage>
    <BrandHeader icon={notificationsOutline} title="Notifications" accent="rose" showBack />
    <AppScreen eyebrow={t("Your little reminders")} title={t("A thoughtful heads-up.")} subtitle={t("Birthday reminders, kept here just for you.")}
      fixedContent={<IonRefresher slot="fixed" onIonRefresh={event => { void load().finally(() => event.detail.complete()); }}><IonRefresherContent /></IonRefresher>}>
      {loading && !entries && <FeedbackState kind="loading" heading={t("Finding your reminders…")} />}
      {error && <FeedbackState kind="failure" heading={error} onRetry={load} />}
      <div className="notification-inbox" aria-busy={loading}>
        {entries?.length === 0 && !error && <section className="notification-empty">
          <span className="notification-symbol"><IonIcon icon={notificationsOutline} aria-hidden="true" /></span>
          <h2>{t("All quiet for now.")}</h2>
          <p>{t("Your birthday reminders will appear here 3 days before and 1 day before, around 7pm.")}</p>
          <AppButton variant="secondary" onClick={() => history.push('/birthdays')}>{t("Your birthdays")}</AppButton>
        </section>}
        {!!entries?.length && <>
          <div className="notification-heading"><h2>{t("Birthday reminders")}</h2><span>{entries.length} {" " + t("saved")}</span></div>
          <ul className="notification-list" aria-label={t("Birthday notifications")}>
            {entries.map(entry => <li className="notification-card" key={entry.id}>
              <span className="notification-symbol"><IonIcon icon={giftOutline} aria-hidden="true" /></span>
              <div className="notification-card__content">
                <h3>{t(entry.title)}</h3><p>{notificationBody(entry.body)}</p>
                <time dateTime={entry.createdAt}>{moroccoFormat(new Date(entry.createdAt), { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }, getLanguage())} {" " + t("· Morocco")}</time>
              </div>
              <button type="button" className="icon-btn notification-delete" aria-label={t("Delete notification: {v0}", { v0: entry.body })}
                onClick={() => { setSelected(entry); setDeleteError(null); }}><IonIcon icon={trashOutline} /></button>
            </li>)}
          </ul>
          <p className="notification-footnote">{t("Reminders show when they arrived. Manage upcoming dates in") + " "}<button type="button" onClick={() => history.push('/birthdays')}>{t("your birthdays")}</button>.</p>
        </>}
      </div>
    </AppScreen>
    <ConfirmSheet open={!!selected} title={t("Delete this notification?")} detail={deleteError ?? t("This message will be removed from your inbox. Your saved birthday and future reminders stay active.")}
      confirmLabel={t("Delete notification")} busy={deleting} onConfirm={() => { void remove(); }} onClose={() => { setSelected(null); setDeleteError(null); }} />
    <IonToast isOpen={!!toast} message={toast} duration={2200} onDidDismiss={() => setToast('')} />
  </IonPage>;
}

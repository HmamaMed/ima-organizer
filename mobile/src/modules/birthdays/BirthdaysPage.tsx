import { t, useI18n, getLanguage } from "../../shared/i18n";
import { useCallback, useRef, useState, type FormEvent } from 'react';
import {
  IonContent, IonIcon, IonModal, IonPage, IonRefresher, IonRefresherContent,
  IonToast, useIonViewWillEnter,
} from '@ionic/react';
import { addOutline, checkmarkOutline, closeOutline, createOutline, giftOutline, lockClosedOutline, notificationsOutline, trashOutline } from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import AppScreen from '../../shared/ui/AppScreen';
import BrandHeader from '../../shared/ui/BrandHeader';
import AppButton from '../../shared/ui/AppButton';
import FeedbackState from '../../shared/ui/FeedbackState';
import ConfirmSheet from '../../shared/ui/ConfirmSheet';
import { deleteBirthday, fetchBirthdays, saveBirthday, type Birthday } from './birthdaysApi';
import { MOROCCO_TIME_ZONE, MOROCCO_TIME_LABEL } from '../../shared/utils/moroccoTime';
import './birthdays.css';

const months = () => Array.from({ length: 12 }, (_, month) =>
  new Date(2000, month, 1).toLocaleDateString(getLanguage(), { month: 'long' }));
const sortBirthdays = (entries: Birthday[]) => [...entries].sort((a, b) =>
  a.daysUntil - b.daysUntil || a.label.localeCompare(b.label));
const dateLabel = (entry: Birthday) => new Date(2000, entry.month - 1, entry.day)
  .toLocaleDateString(getLanguage(), { month: 'long', day: 'numeric' });
const countdown = (days: number) => days === 0 ? t("Today") : days === 1 ? t("Tomorrow") : t("In {v0} days", { v0: days });

function BirthdayEditor({ entry, token, onSaved, onClose, onBusyChange }: {
  entry: Birthday | null; token: string; onSaved: (entry: Birthday) => void;
  onClose: () => void; onBusyChange: (busy: boolean) => void;
}) {
  useI18n();
  const [label, setLabel] = useState(entry?.label ?? '');
  const [month, setMonth] = useState(entry ? String(entry.month) : '');
  const [day, setDay] = useState(entry ? String(entry.day) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const { user } = useAuth();
  const timeZone = entry?.timeZone ?? user?.timeZone ?? MOROCCO_TIME_ZONE;
  const daysInMonth = month ? new Date(2000, Number(month), 0).getDate() : 31;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    if (!label.trim() || !month || !day || Number(day) > daysInMonth) {
      setError(t("Add a name and choose a birthday date.")); return;
    }
    pending.current = true; setBusy(true); onBusyChange(true); setError(null);
    try {
      const saved = await saveBirthday(token, { label: label.trim(), month: Number(month), day: Number(day), timeZone }, entry?.id);
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Could not save this birthday. Please try again."));
    } finally { pending.current = false; setBusy(false); onBusyChange(false); }
  }

  return (
    <form className="birthday-editor__body" onSubmit={submit}>
      <div className="birthday-editor__top">
        <span className="birthday-mark"><IonIcon icon={giftOutline} aria-hidden="true" /></span>
        <button className="icon-btn" type="button" aria-label={t("Close birthday form")} disabled={busy} onClick={onClose}><IonIcon icon={closeOutline} /></button>
      </div>
      <div>
        <p className="lo-eyebrow">{t("A date to keep close")}</p>
        <h2 id="birthday-editor-title">{entry ? t("Edit a birthday.") : t("Someone worth remembering.")}</h2>
        <p className="birthday-muted">{t("A little heads-up, so you have time to make it special.")}</p>
      </div>
      <fieldset className="birthday-fields" disabled={busy}>
        <label className="birthday-field" htmlFor="birthday-label">
          <span>{t("Name or occasion")}</span>
          <input id="birthday-label" name="label" maxLength={100} required value={label}
            placeholder={t("Sister’s birthday")} autoComplete="off" onChange={event => setLabel(event.target.value)} />
        </label>
        <div className="birthday-date-fields">
          <label className="birthday-field" htmlFor="birthday-month"><span>{t("Month")}</span>
            <select id="birthday-month" name="month" required value={month} onChange={event => {
              const next = event.target.value; setMonth(next);
              if (day && Number(day) > new Date(2000, Number(next), 0).getDate()) setDay('');
            }}><option value="" disabled>{t("Choose month")}</option>{months().map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select>
          </label>
          <label className="birthday-field" htmlFor="birthday-day"><span>{t("Day")}</span>
            <select id="birthday-day" name="day" required value={day} onChange={event => setDay(event.target.value)}>
              <option value="" disabled>{t("Day")}</option>{Array.from({ length: daysInMonth }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}
            </select>
          </label>
        </div>
      </fieldset>
      <div className="birthday-reminder-note">
        <IonIcon icon={notificationsOutline} aria-hidden="true" />
        <div><strong>{t('3 days before · 1 day before')}</strong><p>{t("Every year, around 7pm ·") + " "}{timeZone === MOROCCO_TIME_ZONE && user?.role !== 'MEMBER' ? t(MOROCCO_TIME_LABEL) : timeZone.replaceAll('_', ' ')}</p></div>
      </div>
      {month === '2' && day === '29' && <p className="birthday-muted">{t("In years without February 29, we’ll use February 28.")}</p>}
      {error && <p className="birthday-error" role="alert">{error}</p>}
      <AppButton type="submit" icon={checkmarkOutline} busy={busy}>{entry ? t("Save changes") : t("Save birthday")}</AppButton>
      <p className="birthday-private"><IonIcon icon={lockClosedOutline} aria-hidden="true" /> {" " + t("Only you can see this birthday.")}</p>
    </form>
  );
}

export default function BirthdaysPage() {
  useI18n();
  const { token } = useAuth();
  const [entries, setEntries] = useState<Birthday[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ entry: Birthday | null } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Birthday | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const version = useRef(0);
  const deletePending = useRef(false);
  const load = useCallback(async () => {
    if (!token) return;
    const request = ++version.current;
    setLoading(true);
    try {
      const data = await fetchBirthdays(token);
      if (request === version.current) { setEntries(sortBirthdays(data)); setError(null); }
    } catch { if (request === version.current) setError(t("Could not load your birthdays.")); }
    finally { if (request === version.current) setLoading(false); }
  }, [token]);
  useIonViewWillEnter(() => { void load(); });

  function openEditor(entry: Birthday | null = null) { setEditor({ entry }); setEditorOpen(true); }
  function saved(entry: Birthday) {
    ++version.current; setLoading(false);
    setEntries(previous => sortBirthdays([...(previous ?? []).filter(item => item.id !== entry.id), entry]));
    setEditorOpen(false); setToast(t("Birthday saved. A little date, kept close."));
  }
  async function remove() {
    if (!token || !toDelete || deletePending.current) return;
    deletePending.current = true; setDeleting(true); setDeleteError(null);
    try {
      await deleteBirthday(token, toDelete.id);
      ++version.current; setLoading(false);
      setEntries(previous => (previous ?? []).filter(item => item.id !== toDelete.id));
      setToDelete(null); setToast(t("Birthday removed."));
    } catch { setDeleteError(t("Could not delete this birthday. Please try again.")); }
    finally { deletePending.current = false; setDeleting(false); }
  }
  const next = entries?.[0];

  return (
    <IonPage>
      <BrandHeader icon={giftOutline} title={t("Birthday Reminders")} accent="rose" showBack />
      <AppScreen eyebrow={t("Birthday reminders")} title={t("Their day. Remembered.")} subtitle={t("For the people who make your life a little brighter.")}
        fixedContent={<IonRefresher slot="fixed" onIonRefresh={event => { void load().finally(() => event.detail.complete()); }}><IonRefresherContent /></IonRefresher>}>
        {loading && !entries && <FeedbackState kind="loading" heading={t("Finding your special dates…")} />}
        {error && <FeedbackState kind="failure" heading={error} detail={entries ? t("Your saved birthdays are still here.") : undefined} onRetry={load} />}
        <div className="birthdays" aria-busy={loading}>
          {next && <section className="birthday-next" aria-label={t("Next birthday")}>
            <div className="birthday-next__top"><p className="lo-eyebrow">{t("Next little celebration")}</p><span className="birthday-mark"><IonIcon icon={giftOutline} aria-hidden="true" /></span></div>
            <h2>{next.label}</h2><p className="birthday-next__date">{dateLabel(next)}</p><span className="birthday-countdown">{countdown(next.daysUntil)}</span>
          </section>}
          <AppButton icon={addOutline} onClick={() => openEditor()}>{t("Add a birthday")}</AppButton>
          {entries?.length === 0 && <section className="birthday-empty">
            <span className="birthday-mark"><IonIcon icon={giftOutline} aria-hidden="true" /></span>
            <h2>{t("Good days start with remembering.")}</h2><p>{t("Add your first birthday. We’ll give you a nudge 3 days before, and again the day before.")}</p>
          </section>}
          {!!entries?.length && <section aria-label={t("Your birthdays")}><div className="birthday-list-heading"><h2>{t("Your birthdays")}</h2><span>{entries.length} {" " + t("kept close")}</span></div>
            <div className="birthday-list">{entries.map(entry => <article className="birthday-row" key={entry.id}>
              <div className="birthday-date" aria-hidden="true"><span>{months()[entry.month - 1].slice(0, 3)}</span><strong>{entry.day}</strong></div>
              <div className="birthday-row__detail"><h3>{entry.label}</h3><p>{dateLabel(entry)} · {countdown(entry.daysUntil)}</p></div>
              <div className="birthday-row__actions">
                <button className="icon-btn" type="button" aria-label={t("Edit {v0}", { v0: entry.label })} onClick={() => openEditor(entry)}><IonIcon icon={createOutline} /></button>
                <button className="icon-btn birthday-delete" type="button" aria-label={t("Delete {v0}", { v0: entry.label })} onClick={() => { setToDelete(entry); setDeleteError(null); }}><IonIcon icon={trashOutline} /></button>
              </div>
            </article>)}</div>
          </section>}
          <div className="birthday-how"><IonIcon icon={notificationsOutline} aria-hidden="true" /><p>{t("A heads-up") + " "}<strong>{t('3 days before')}</strong>{t(', then ')}<strong>{t('1 day before')}</strong>{t('. Year after year. Allow notifications on your phone to receive your reminders.')}</p></div>
          <p className="birthday-private"><IonIcon icon={lockClosedOutline} aria-hidden="true" /> {" " + t("Your dates, just for you. Your partner has their own list.")}</p>
        </div>
      </AppScreen>
      <IonModal isOpen={editorOpen} className="birthday-editor" canDismiss={!saving || !editorOpen} aria-labelledby="birthday-editor-title"
        onDidPresent={() => document.getElementById('birthday-label')?.focus()}
        onDidDismiss={() => { setEditorOpen(false); setEditor(null); }}>
        <IonContent>{editor && token && <BirthdayEditor entry={editor.entry} token={token} onSaved={saved} onClose={() => setEditorOpen(false)} onBusyChange={setSaving} />}</IonContent>
      </IonModal>
      <ConfirmSheet open={!!toDelete} title={t("Remove this birthday?")} detail={deleteError ?? t("“{v0}” and its future reminders will be removed from your list.", { v0: toDelete?.label ?? '' })}
        confirmLabel={t("Remove birthday")} busy={deleting} onConfirm={() => { void remove(); }} onClose={() => { setToDelete(null); setDeleteError(null); }} />
      <IonToast isOpen={!!toast} message={toast} duration={2600} onDidDismiss={() => setToast('')} />
    </IonPage>
  );
}

import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  IonContent, IonIcon, IonModal, IonPage, IonRefresher, IonRefresherContent,
  IonToast, useIonViewWillEnter,
} from '@ionic/react';
import {
  addOutline, arrowUpOutline, calendarOutline, checkmarkOutline, closeOutline,
  createOutline, leafOutline, peopleOutline, trashOutline,
} from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import AppScreen from '../../shared/ui/AppScreen';
import BrandHeader from '../../shared/ui/BrandHeader';
import AppButton from '../../shared/ui/AppButton';
import FeedbackState from '../../shared/ui/FeedbackState';
import ConfirmSheet from '../../shared/ui/ConfirmSheet';
import { deleteAgio, fetchAgios, saveAgio, type Agio, type AgiosParticipant, type AgiosTracker } from './agiosApi';
import {
  AGIOS_CURRENCY, amountInCents, creditDate, formatCreditDate, formatMoney,
  localDate, normalizeAmount, sortAgios,
} from './agiosUtils';
import './agios.css';

type View = 'partner' | 'mine';

function AgioEditor({
  participant, entry, token, onSaved, onClose, onBusyChange,
}: {
  participant: AgiosParticipant;
  entry: Agio | null;
  token: string;
  onSaved: (entry: Agio) => void;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [amount, setAmount] = useState(entry?.amount ?? '');
  const [date, setDate] = useState(entry?.date ?? localDate());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const amountRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const normalized = normalizeAmount(amount);
    if (!normalized) {
      setError('Enter an amount greater than zero, with up to two decimal places.');
      amountRef.current?.focus();
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > localDate()
      || Number.isNaN(creditDate(date).getTime()) || localDate(creditDate(date)) !== date) {
      setError('Choose the date the interest was credited, today or earlier.');
      return;
    }
    submitting.current = true;
    setSaving(true);
    onBusyChange(true);
    setError(null);
    try {
      const saved = await saveAgio(token, { userId: participant.userId, amount: normalized, date }, entry?.id);
      onSaved(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this entry. Please try again.');
    } finally {
      submitting.current = false;
      setSaving(false);
      onBusyChange(false);
    }
  }

  return (
    <form className="agios-editor__body" onSubmit={submit}>
      <div className="agios-editor__heading">
        <span className="agios-mark"><IonIcon icon={leafOutline} aria-hidden="true" /></span>
        <button type="button" className="icon-btn" onClick={onClose} disabled={saving} aria-label="Close entry form">
          <IonIcon icon={closeOutline} />
        </button>
      </div>
      <div>
        <p className="lo-eyebrow">Savings interest</p>
        <h2 id="agios-editor-title">{entry ? 'Edit agios.' : 'A little more saved.'}</h2>
        <p className="agios-editor__subtitle">{entry ? 'Update' : 'Add'} an interest credit for {participant.name}.</p>
      </div>
      <fieldset disabled={saving} className="agios-editor__fields">
        <label className="agios-field" htmlFor="agios-amount">
          <span>Amount</span>
          <span className="agios-amount-input">
            <input ref={amountRef} id="agios-amount" name="amount" inputMode="decimal" type="text"
              placeholder="0.00" autoComplete="off" required maxLength={15} value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-describedby={error ? 'agios-form-error' : undefined} />
            <span>{AGIOS_CURRENCY}</span>
          </span>
        </label>
        <label className="agios-field" htmlFor="agios-date">
          <span>Date credited</span>
          <input id="agios-date" name="date" type="date" required max={localDate()} value={date}
            onChange={(event) => setDate(event.target.value)} />
        </label>
      </fieldset>
      {error && <p id="agios-form-error" className="agios-form-error" role="alert">{error}</p>}
      <p className="agios-editor__hint"><IonIcon icon={peopleOutline} aria-hidden="true" /> Visible to both of you.</p>
      <AppButton type="submit" icon={checkmarkOutline} busy={saving}>{entry ? 'Save changes' : 'Save agios'}</AppButton>
    </form>
  );
}

export default function AgiosPage() {
  const { user, token } = useAuth();
  const [tracker, setTracker] = useState<AgiosTracker | null>(null);
  const [view, setView] = useState<View>('mine');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ participant: AgiosParticipant; entry: Agio | null } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Agio | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const requestVersion = useRef(0);
  const deletePending = useRef(false);

  const load = useCallback(async () => {
    if (!token) return;
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const data = await fetchAgios(token);
      if (version !== requestVersion.current) return;
      setTracker(data);
      setLoadError(null);
    } catch {
      if (version === requestVersion.current) setLoadError('Could not load your agios.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [token]);

  useIonViewWillEnter(() => { void load(); });

  const mine = tracker?.participants.find((person) => person.userId === user?.userId);
  const partner = tracker?.participants.find((person) => person.userId !== user?.userId);
  const selected = view === 'mine' ? mine : partner;
  const visible = useMemo(() => sortAgios(tracker?.entries.filter((entry) => entry.userId === selected?.userId) ?? []), [tracker, selected?.userId]);
  const total = visible.reduce((sum, entry) => sum + amountInCents(entry.amount), 0);
  const year = new Date().getFullYear();
  const yearTotal = visible.filter((entry) => entry.date.startsWith(`${year}-`))
    .reduce((sum, entry) => sum + amountInCents(entry.amount), 0);
  const months = useMemo(() => {
    const groups = new Map<string, Agio[]>();
    visible.forEach((entry) => {
      const key = entry.date.slice(0, 7);
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    });
    return [...groups];
  }, [visible]);

  function saved(entry: Agio) {
    // A refresh started before this write must not replace it with stale data.
    ++requestVersion.current;
    setLoading(false);
    setTracker((current) => current && ({ ...current, entries: [...current.entries.filter((item) => item.id !== entry.id), entry] }));
    setEditorOpen(false);
    setToast(editor?.entry ? 'Agios updated.' : 'Agios added. A little gain, kept.');
  }

  function openEditor(participant: AgiosParticipant, entry: Agio | null = null) {
    setEditor({ participant, entry });
    setEditorOpen(true);
  }

  async function remove() {
    if (!token || !toDelete || deletePending.current) return;
    deletePending.current = true;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAgio(token, toDelete.id);
      ++requestVersion.current;
      setLoading(false);
      setTracker((current) => current && ({ ...current, entries: current.entries.filter((entry) => entry.id !== toDelete.id) }));
      setToDelete(null);
      setToast('Agios entry deleted.');
    } catch {
      setDeleteError('Could not delete this entry. Please try again.');
    } finally {
      deletePending.current = false;
      setDeleting(false);
    }
  }

  return (
    <IonPage>
      <BrandHeader icon={leafOutline} title="Agios Tracker" accent="plum" showBack />
      <AppScreen title="Agios Tracker." eyebrow="Little gains" subtitle="Your savings interest, kept together."
        fixedContent={(
          <IonRefresher slot="fixed" onIonRefresh={(event) => { void load().finally(() => event.detail.complete()); }}>
            <IonRefresherContent />
          </IonRefresher>
        )}>
        <div className="agios-views" role="group" aria-label="Whose agios to view">
          {(['partner', 'mine'] as const).map((key) => {
            const person = key === 'mine' ? mine : partner;
            return (
              <button type="button" key={key} className={`agios-view ${view === key ? 'agios-view--active' : ''}`}
                aria-pressed={view === key} onClick={() => setView(key)}>
                <span>{key === 'mine' ? 'My agios' : 'Your agios'}</span>
                <small>{person?.name ?? (key === 'mine' ? user?.name : 'Your partner')}</small>
              </button>
            );
          })}
        </div>
        {loading && !tracker && <FeedbackState kind="loading" heading="Gathering your little gains…" />}
        {loadError && <FeedbackState kind="failure" heading={loadError} detail={tracker ? 'Showing the last loaded entries. Pull down to refresh.' : undefined} onRetry={load} />}
        {tracker && selected && (
          <section className="agios-tracker" aria-label={`${selected.name}'s agios`} aria-busy={loading}>
            <div className="agios-total">
              <div className="agios-total__top">
                <span className="lo-eyebrow">Total interest earned</span>
                <span className="agios-mark"><IonIcon icon={leafOutline} aria-hidden="true" /></span>
              </div>
              <p className="agios-total__amount">{formatMoney(total)}</p>
              <p className="agios-total__person">{selected.name}’s savings, growing little by little.</p>
              <div className="agios-total__stats">
                <div><span>{year} interest</span><strong>{formatMoney(yearTotal)}</strong></div>
                <div><span>Interest credits</span><strong>{visible.length}</strong></div>
              </div>
            </div>
            <div className="agios-history-heading">
              <div><h2>Interest history</h2><p>{visible[0] ? `Latest credit · ${formatCreditDate(visible[0].date)}` : 'Every little gain has a place.'}</p></div>
              <AppButton icon={addOutline} onClick={() => openEditor(selected)}>Add agios</AppButton>
            </div>
            {visible.length === 0 ? (
              <div className="agios-empty">
                <span className="agios-mark"><IonIcon icon={leafOutline} aria-hidden="true" /></span>
                <h3>A fresh little start.</h3>
                <p>No agios for {selected.name} yet. Add the amount and date of the first interest credit.</p>
              </div>
            ) : (
              <div className="agios-history">
                {months.map(([month, entries]) => (
                  <section key={month} aria-label={creditDate(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}>
                    <h3 className="agios-month">{creditDate(`${month}-01`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
                    <div className="agios-entries">
                      {entries.map((entry) => (
                        <article className="agios-entry" key={entry.id}>
                          <span className="agios-entry__icon"><IonIcon icon={arrowUpOutline} aria-hidden="true" /></span>
                          <div className="agios-entry__detail">
                            <strong>+{formatMoney(amountInCents(entry.amount))}</strong>
                            <span><IonIcon icon={calendarOutline} aria-hidden="true" /><time dateTime={entry.date}>{formatCreditDate(entry.date)}</time></span>
                          </div>
                          <div className="agios-entry__actions">
                            <button type="button" className="icon-btn" aria-label={`Edit ${formatMoney(amountInCents(entry.amount))} credited ${formatCreditDate(entry.date)}`} onClick={() => openEditor(selected, entry)}><IonIcon icon={createOutline} /></button>
                            <button type="button" className="icon-btn agios-entry__delete" aria-label={`Delete ${formatMoney(amountInCents(entry.amount))} credited ${formatCreditDate(entry.date)}`} onClick={() => { setDeleteError(null); setToDelete(entry); }}><IonIcon icon={trashOutline} /></button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
            <p className="agios-shared"><IonIcon icon={peopleOutline} aria-hidden="true" /> A shared view. You can both add and update entries.</p>
          </section>
        )}
        {tracker && !selected && <FeedbackState kind="empty" heading="This account is not available yet." detail="Try refreshing to find both accounts." onRetry={load} />}
      </AppScreen>
      <IonModal isOpen={editorOpen} className="agios-editor" canDismiss={!editorSaving}
        onDidDismiss={() => { setEditor(null); setEditorOpen(false); }}
        onDidPresent={() => document.getElementById('agios-amount')?.focus()} aria-labelledby="agios-editor-title">
        <IonContent>
          {editor && token && <AgioEditor participant={editor.participant} entry={editor.entry} token={token}
            onSaved={saved} onClose={() => setEditorOpen(false)} onBusyChange={setEditorSaving} />}
        </IonContent>
      </IonModal>
      <ConfirmSheet open={toDelete !== null} title="Delete this agios?"
        detail={deleteError ?? (toDelete ? `${formatMoney(amountInCents(toDelete.amount))} credited on ${formatCreditDate(toDelete.date)} will be removed from ${selected?.name ?? 'this account'}’s history and totals.` : '')}
        confirmLabel="Delete agios" busy={deleting} onConfirm={() => { void remove(); }} onClose={() => { setToDelete(null); setDeleteError(null); }} />
      <IonToast isOpen={Boolean(toast)} message={toast} duration={2600} onDidDismiss={() => setToast('')} />
    </IonPage>
  );
}

import { useCallback, useMemo, useState } from 'react';
import { IonIcon, IonPage, IonToast, useIonViewWillEnter } from '@ionic/react';
import { useHistory, useLocation } from 'react-router-dom';
import {
  trashOutline,
  calendarClearOutline,
  addOutline,
  chatbubbleEllipsesOutline,
} from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import BrandHeader from '../../shared/ui/BrandHeader';
import AppScreen from '../../shared/ui/AppScreen';
import AppButton from '../../shared/ui/AppButton';
import ConfirmSheet from '../../shared/ui/ConfirmSheet';
import FeedbackState from '../../shared/ui/FeedbackState';
import { moroccoDateKey, moroccoFormat } from '../../shared/utils/moroccoTime';
import { cancelNote, fetchNotes, type Note } from './notesApi';

function startOfDay(d: Date): Date {
  return new Date(`${moroccoDateKey(d)}T00:00:00Z`);
}

function formatTime(d: Date): string {
  return moroccoFormat(d, { hour: 'numeric', minute: '2-digit' });
}

/** "Today · 9:00 PM", "Tomorrow · ...", a weekday name within a week, else a short date. */
function formatRelativeDay(iso: string, base: Date, futureTense: boolean): string {
  const date = new Date(iso);
  const diffDays = Math.round(
    (startOfDay(futureTense ? date : base).getTime() -
      startOfDay(futureTense ? base : date).getTime()) /
      86_400_000,
  );
  const time = formatTime(date);
  if (diffDays === 0) return `Today · ${time}`;
  if (diffDays === 1) return `${futureTense ? 'Tomorrow' : 'Yesterday'} · ${time}`;
  if (diffDays > 1 && diffDays < 7)
    return `${moroccoFormat(date, { weekday: 'long' })} · ${time}`;
  return `${moroccoFormat(date, { month: 'short', day: 'numeric' })} · ${time}`;
}

function NoteCard({
  note,
  featured,
  onCancel,
}: {
  note: Note;
  featured?: boolean;
  onCancel?: () => void;
}) {
  const scheduled = note.status === 'SCHEDULED';
  const time = scheduled ? note.scheduledFor : (note.sentAt ?? note.createdAt);
  return (
    <article
      className={`note-row ${featured ? 'note-row--featured' : ''} ${featured && note.content.length <= 240 ? 'note-row--short' : ''}`}
    >
      <div className="note-row__meta">
        <span>
          {scheduled ? 'Scheduled · ' : ''}
          {formatRelativeDay(time ?? note.createdAt, new Date(), scheduled)}
        </span>
        {onCancel && (
          <button
            type="button"
            className="note-row__action"
            onClick={onCancel}
            aria-label="Cancel scheduled note"
          >
            <IonIcon icon={trashOutline} />
          </button>
        )}
      </div>
      <p className="note-row__text">{note.content}</p>
    </article>
  );
}

export default function NotesPage() {
  const { token, user } = useAuth();
  const history = useHistory();
  const location = useLocation<{ feedback?: string }>();
  const isOwner = user?.role === 'OWNER';
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setNotes(await fetchNotes(token));
      setLoaded(true);
      setError(null);
    } catch {
      setError('Could not refresh notes.');
    } finally {
      setLoading(false);
    }
  }, [token]);
  useIonViewWillEnter(() => {
    void load();
    if (location.state?.feedback) {
      setToast(location.state.feedback);
      history.replace(location.pathname, {});
    }
  });
  const sent = useMemo(
    () =>
      notes
        .filter((n) => n.status === 'SENT')
        .sort((a, b) => Date.parse(b.sentAt ?? b.createdAt) - Date.parse(a.sentAt ?? a.createdAt)),
    [notes],
  );
  const scheduled = useMemo(
    () =>
      notes
        .filter((n) => n.status === 'SCHEDULED')
        .sort((a, b) => Date.parse(a.scheduledFor!) - Date.parse(b.scheduledFor!)),
    [notes],
  );

  const cancel = async () => {
    if (!token || !cancelling || busy) return;
    setBusy(true);
    try {
      await cancelNote(token, cancelling.id);
      setNotes((current) => current.filter((n) => n.id !== cancelling.id));
      setCancelling(null);
      setToast('Note cancelled.');
    } catch {
      setToast('Could not cancel the note. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonPage>
      <BrandHeader icon={chatbubbleEllipsesOutline} title="Notes" accent="rose" showBack />
      <AppScreen
        title={isOwner ? 'Words to keep close.' : 'A little note for you.'}
        eyebrow="Notes"
        subtitle={
          isOwner
            ? 'A few words now. A little encouragement later.'
            : 'Words from me, whenever you need them.'
        }
        action={
          isOwner ? (
            <AppButton
              className="notes-write"
              icon={addOutline}
              onClick={() => history.push('/notes/compose')}
            >
              Write a note
            </AppButton>
          ) : undefined
        }
      >
        {loading && !loaded && <FeedbackState kind="loading" heading="Finding your notes…" />}
        {error && (
          <FeedbackState
            kind="failure"
            heading={error}
            detail={loaded ? 'Your saved notes are still here.' : undefined}
            onRetry={load}
          />
        )}
        {loaded && (
          <>
            {isOwner && scheduled.length > 0 && (
              <section className="notes-section">
                <h2 className="notes-section__title">
                  <IonIcon icon={calendarClearOutline} />
                  Scheduled
                </h2>
                <div className="notes-timeline">
                  {scheduled.map((note) => (
                    <NoteCard key={note.id} note={note} onCancel={() => setCancelling(note)} />
                  ))}
                </div>
              </section>
            )}
            {sent.length > 0 && (
              <section className="notes-section">
                {isOwner && <h2 className="notes-section__title">Sent</h2>}
                <div className="notes-timeline">
                  {sent.map((note, i) => (
                    <NoteCard key={note.id} note={note} featured={i === 0} />
                  ))}
                </div>
              </section>
            )}
            {sent.length === 0 && (!isOwner || scheduled.length === 0) && (
              <FeedbackState
                kind="empty"
                illustration="notes"
                heading={
                  isOwner ? 'Your first note starts here.' : 'A little note will find you here.'
                }
                detail={
                  isOwner
                    ? 'Write a few words and send them now, or choose a moment for later.'
                    : 'Come back when you feel like it.'
                }
              />
            )}
          </>
        )}
      </AppScreen>
      <ConfirmSheet
        open={!!cancelling}
        title="Cancel this scheduled note?"
        detail="It will be removed from the schedule and will not be sent."
        confirmLabel="Cancel note"
        busy={busy}
        onConfirm={cancel}
        onClose={() => setCancelling(null)}
      />
      <IonToast
        isOpen={!!toast}
        message={toast ?? ''}
        duration={2500}
        onDidDismiss={() => setToast(null)}
      />
    </IonPage>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { IonContent, IonIcon, IonPage, IonSpinner, IonText, IonToast } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { trashOutline, timeOutline, paperPlaneOutline, calendarClearOutline, addOutline, chatbubbleEllipsesOutline } from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import BrandHeader from '../../shared/ui/BrandHeader';
import { cancelNote, fetchNotes, type Note } from './notesApi';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "Today · 9:00 PM", "Tomorrow · ...", a weekday name within a week, else a short date. */
function formatRelativeDay(iso: string, base: Date, futureTense: boolean): string {
  const date = new Date(iso);
  const diffDays = Math.round(
    (startOfDay(futureTense ? date : base).getTime() - startOfDay(futureTense ? base : date).getTime())
      / 86_400_000,
  );
  const time = formatTime(date);
  if (diffDays === 0) return `Today · ${time}`;
  if (diffDays === 1) return `${futureTense ? 'Tomorrow' : 'Yesterday'} · ${time}`;
  if (diffDays > 1 && diffDays < 7) return `${date.toLocaleDateString(undefined, { weekday: 'long' })} · ${time}`;
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · ${time}`;
}

function NoteRow({ note, dotClass, timeLabel, onCancel }: {
  note: Note;
  dotClass: string;
  timeLabel: string;
  onCancel?: (note: Note) => void;
}) {
  return (
    <div className="note-row">
      <span className={`note-row__dot ${dotClass}`} />
      <div className="note-row__body">
        <p className="note-row__text">{note.content}</p>
        <div className="note-row__meta">
          <span className="note-row__badge">{timeLabel}</span>
          {onCancel && (
            <div className="note-row__actions">
              <button className="note-row__action" onClick={() => onCancel(note)} aria-label="Cancel">
                <IonIcon icon={trashOutline} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The owner's view: notes waiting to go out, then everything already delivered. */
function OwnerFeed({ notes, onChanged }: { notes: Note[]; onChanged: () => Promise<void> }) {
  const { token } = useAuth();
  const [toast, setToast] = useState<string | null>(null);
  const now = new Date();

  const scheduled = useMemo(
    () => notes.filter((n) => n.status === 'SCHEDULED')
      .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime()),
    [notes],
  );
  const sent = useMemo(
    () => notes.filter((n) => n.status === 'SENT')
      .sort((a, b) => new Date(b.sentAt!).getTime() - new Date(a.sentAt!).getTime()),
    [notes],
  );

  const handleCancel = async (note: Note) => {
    if (!token) return;
    try {
      await cancelNote(token, note.id);
      setToast('Note cancelled.');
      await onChanged();
    } catch {
      setToast('Could not cancel the note.');
    }
  };

  return (
    <>
      {scheduled.length > 0 && (
        <section className="notes-section">
          <h2 className="notes-section__title">
            <IonIcon icon={calendarClearOutline} /> Scheduled
          </h2>
          <div className="notes-timeline">
            {scheduled.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                dotClass="note-row__dot--filled note-row__dot--gold"
                timeLabel={formatRelativeDay(note.scheduledFor!, now, true)}
                onCancel={handleCancel}
              />
            ))}
          </div>
        </section>
      )}

      {sent.length > 0 && (
        <section className="notes-section">
          <h2 className="notes-section__title">
            <IonIcon icon={paperPlaneOutline} /> Sent
          </h2>
          <div className="notes-timeline">
            {sent.map((note, i) => (
              <NoteRow
                key={note.id}
                note={note}
                dotClass={i === 0 ? 'note-row__dot--filled' : ''}
                timeLabel={formatRelativeDay(note.sentAt!, now, false)}
              />
            ))}
          </div>
        </section>
      )}

      {scheduled.length === 0 && sent.length === 0 && (
        <IonText className="empty-state">
          <p>No notes yet. Tap + to write the first one.</p>
        </IonText>
      )}

      <IonToast isOpen={!!toast} message={toast ?? ''} duration={2500} onDidDismiss={() => setToast(null)} />
    </>
  );
}

/** The recipient's personal feed — delivered notes only, newest first. */
function RecipientFeed({ notes }: { notes: Note[] }) {
  const now = new Date();
  return (
    <div className="notes-timeline">
      {notes.map((note, i) => (
        <NoteRow
          key={note.id}
          note={note}
          dotClass={i === 0 ? 'note-row__dot--filled' : ''}
          timeLabel={formatRelativeDay(note.sentAt ?? note.createdAt, now, false)}
        />
      ))}
    </div>
  );
}

export default function NotesPage() {
  const { token, user } = useAuth();
  const history = useHistory();
  const isOwner = user?.role === 'OWNER';

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setNotes(await fetchNotes(token));
      setError(null);
    } catch {
      setError('Could not load notes.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <IonPage>
      <BrandHeader icon={chatbubbleEllipsesOutline} title="Notes" accent="rose" showBack />

      <IonContent className="ion-padding" style={{ position: 'relative' }}>
        {loading ? (
          <div className="centered">
            <IonSpinner />
          </div>
        ) : error ? (
          <IonText color="danger"><p>{error}</p></IonText>
        ) : isOwner ? (
          <OwnerFeed notes={notes} onChanged={load} />
        ) : notes.length === 0 ? (
          <IonText className="empty-state">
            <p><IonIcon icon={timeOutline} /> No notes yet. Check back soon.</p>
          </IonText>
        ) : (
          <RecipientFeed notes={notes} />
        )}

        {isOwner && (
          <button className="fab" onClick={() => history.push('/notes/compose')} aria-label="Write a note">
            <IonIcon icon={addOutline} />
          </button>
        )}
      </IonContent>
    </IonPage>
  );
}

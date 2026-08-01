import { useCallback, useEffect, useState } from 'react';
import {
  IonButton,
  IonContent,
  IonDatetime,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  IonSpinner,
  IonToast,
} from '@ionic/react';
import { trashOutline, createOutline, sendOutline, timeOutline } from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import { createNote, deleteNote, fetchNotes, type Note } from './notesApi';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function NoteCard({ note, onEdit, onDelete }: {
  note: Note;
  onEdit?: (note: Note) => void;
  onDelete?: (note: Note) => void;
}) {
  const isScheduled = note.status === 'SCHEDULED';
  return (
    <div className={`note-card ${isScheduled ? 'note-card--scheduled' : ''}`}>
      <p className="note-card__content">{note.content}</p>
      <div className="note-card__meta">
        {isScheduled ? (
          <span className="note-card__badge">
            <IonIcon icon={timeOutline} /> Scheduled · {formatDate(note.scheduledFor)}
          </span>
        ) : (
          <span className="note-card__badge">Sent · {formatDate(note.sentAt ?? note.createdAt)}</span>
        )}
        {onEdit && !isScheduled && (
          <button className="note-card__action" onClick={() => onEdit(note)} aria-label="Edit">
            <IonIcon icon={createOutline} />
          </button>
        )}
        {onDelete && (
          <button className="note-card__action" onClick={() => onDelete(note)} aria-label="Delete">
            <IonIcon icon={trashOutline} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function NotesPage() {
  const { token, user } = useAuth();
  const isOwner = user?.role === 'OWNER';

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Composer state
  const [showComposer, setShowComposer] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [content, setContent] = useState('');
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  const openComposer = (note?: Note) => {
    setEditing(note ?? null);
    setContent(note?.content ?? '');
    setScheduledFor(note?.scheduledFor ?? null);
    setShowComposer(true);
  };

  const handleSave = async () => {
    if (!token || !content.trim()) return;
    setSaving(true);
    try {
      await createNote(token, {
        content: content.trim(),
        scheduledFor: scheduledFor ?? null,
      });
      setToast(editing ? 'Note updated.' : 'Note sent.');
      setShowComposer(false);
      await load();
    } catch {
      setToast('Could not save the note.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (note: Note) => {
    if (!token) return;
    try {
      await deleteNote(token, note.id);
      setToast('Note deleted.');
      await load();
    } catch {
      setToast('Could not delete the note.');
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Notes</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {loading ? (
          <div className="centered">
            <IonSpinner />
          </div>
        ) : error ? (
          <IonText color="danger"><p>{error}</p></IonText>
        ) : notes.length === 0 ? (
          <IonText className="empty-state">
            <p>{isOwner ? 'No notes yet. Write the first one.' : 'No notes yet.'}</p>
          </IonText>
        ) : (
          <IonList className="notes-list">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={isOwner ? openComposer : undefined}
                onDelete={isOwner ? handleDelete : undefined}
              />
            ))}
          </IonList>
        )}

        {isOwner && (
          <div className="composer-fab">
            <IonButton expand="block" onClick={() => openComposer()}>
              <IonIcon slot="start" icon={sendOutline} />
              Write a note
            </IonButton>
          </div>
        )}
      </IonContent>

      <IonModal isOpen={showComposer} onDidDismiss={() => setShowComposer(false)}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{editing ? 'Edit note' : 'Write a note'}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <IonTextarea
            value={content}
            onIonInput={(e) => setContent(String(e.detail.value ?? ''))}
            placeholder="What do you want to say?"
            autoGrow
            rows={6}
          />
          <IonItem lines="none">
            <IonLabel>Schedule for later</IonLabel>
          </IonItem>
          <IonDatetime
            value={scheduledFor ?? undefined}
            onIonChange={(e) => setScheduledFor(String(e.detail.value ?? ''))}
            presentation="date-time"
          />
          <div className="composer-actions">
            <IonButton onClick={handleSave} disabled={saving || !content.trim()}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Send'}
            </IonButton>
            <IonButton fill="clear" onClick={() => setShowComposer(false)}>Cancel</IonButton>
          </div>
        </IonContent>
      </IonModal>

      <IonToast
        isOpen={!!toast}
        message={toast ?? ''}
        duration={2500}
        onDidDismiss={() => setToast(null)}
      />
    </IonPage>
  );
}

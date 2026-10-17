import { useRef, useState, type FormEvent } from 'react';
import NotebookEditorFrame from '../../shared/notebooks/NotebookEditorFrame';
import { saveWatchItem, WATCH_STATUSES, type WatchItem, type WatchKind, type WatchStatus } from './watchlistApi';

export default function WatchEditor({ entry, token, onSaved, onClose, onBusyChange }: {
  entry: WatchItem | null; token: string; onSaved: (entry: WatchItem) => void; onClose: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const [title, setTitle] = useState(entry?.title ?? '');
  const [kind, setKind] = useState<WatchKind>(entry?.kind ?? 'FILM');
  const [status, setStatus] = useState<WatchStatus>(entry?.status ?? 'TO_WATCH');
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    if (!title.trim()) { setError('Ajoutez le titre du film ou de la série.'); return; }
    pending.current = true; setBusy(true); onBusyChange(true); setError(null);
    try { onSaved(await saveWatchItem(token, { title: title.trim(), kind, status, notes: notes.trim() || null }, entry?.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossible d’enregistrer ce titre. Réessayez.'); }
    finally { pending.current = false; setBusy(false); onBusyChange(false); }
  }
  return <NotebookEditorFrame title={entry ? 'Un petit ajustement.' : 'Le prochain rendez-vous canapé.'} titleId="watch-editor-title" eyebrow="On regarde quoi ?"
    busy={busy} error={error} submitLabel={entry ? 'Enregistrer les modifications' : 'Ajouter à notre sélection'} onClose={onClose} onSubmit={submit}>
    <label className="notebook-field" htmlFor="watch-title"><span>Le titre *</span><input id="watch-title" required maxLength={150} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ce film dont on parlait…" autoComplete="off" /></label>
    <div className="notebook-field-row">
      <label className="notebook-field" htmlFor="watch-kind"><span>Format</span><select id="watch-kind" value={kind} onChange={event => setKind(event.target.value as WatchKind)}><option value="FILM">Film</option><option value="SERIES">Série</option></select></label>
      <label className="notebook-field" htmlFor="watch-status"><span>Où en est-on ?</span><select id="watch-status" value={status} onChange={event => setStatus(event.target.value as WatchStatus)}>{WATCH_STATUSES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    </div>
    <label className="notebook-field" htmlFor="watch-notes"><span>À garder en tête <small>facultatif</small></span><textarea id="watch-notes" rows={4} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Où le regarder, qui nous l’a conseillé, l’épisode où l’on s’est arrêtés…" /></label>
  </NotebookEditorFrame>;
}

import { t, useI18n } from "../../shared/i18n";
import { useRef, useState, type FormEvent } from 'react';
import NotebookEditorFrame from '../../shared/notebooks/NotebookEditorFrame';
import { saveWatchItem, WATCH_STATUSES, type WatchItem, type WatchKind, type WatchStatus } from './watchlistApi';

export default function WatchEditor({ entry, token, onSaved, onClose, onBusyChange }: {
  entry: WatchItem | null; token: string; onSaved: (entry: WatchItem) => void; onClose: () => void; onBusyChange: (busy: boolean) => void;
}) {
  useI18n();
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
    if (!title.trim()) { setError(t("Ajoutez le titre du film ou de la série.")); return; }
    pending.current = true; setBusy(true); onBusyChange(true); setError(null);
    try { onSaved(await saveWatchItem(token, { title: title.trim(), kind, status, notes: notes.trim() || null }, entry?.id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : t("Impossible d’enregistrer ce titre. Réessayez.")); }
    finally { pending.current = false; setBusy(false); onBusyChange(false); }
  }
  return <NotebookEditorFrame title={entry ? t("Un petit ajustement.") : t("Le prochain rendez-vous canapé.")} titleId="watch-editor-title" eyebrow={t("On regarde quoi ?")}
    busy={busy} error={error} submitLabel={entry ? t("Enregistrer les modifications") : t("Ajouter à notre sélection")} onClose={onClose} onSubmit={submit}>
    <label className="notebook-field" htmlFor="watch-title"><span>{t("Le titre *")}</span><input id="watch-title" required maxLength={150} value={title} onChange={event => setTitle(event.target.value)} placeholder={t("Ce film dont on parlait…")} autoComplete="off" /></label>
    <div className="notebook-field-row">
      <label className="notebook-field" htmlFor="watch-kind"><span>{t("Format")}</span><select id="watch-kind" value={kind} onChange={event => setKind(event.target.value as WatchKind)}><option value="FILM">{t("Film")}</option><option value="SERIES">{t("Série")}</option></select></label>
      <label className="notebook-field" htmlFor="watch-status"><span>{t("Où en est-on ?")}</span><select id="watch-status" value={status} onChange={event => setStatus(event.target.value as WatchStatus)}>{WATCH_STATUSES.map(item => <option key={item.value} value={item.value}>{t(item.label)}</option>)}</select></label>
    </div>
    <label className="notebook-field" htmlFor="watch-notes"><span>{t("À garder en tête") + " "}<small>{t("facultatif")}</small></span><textarea id="watch-notes" rows={4} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} placeholder={t("Où le regarder, qui nous l’a conseillé, l’épisode où l’on s’est arrêtés…")} /></label>
  </NotebookEditorFrame>;
}

import { useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ApiError, apiRequest } from '../api/client';
import ConfirmSheet from '../ui/ConfirmSheet';

export default function NotebookDeleteSheet({ entry, resource, title, detail, onDeleted, onClose }: {
  entry: { id: string; title: string } | null; resource: '/api/watchlist' | '/api/recipes'; title: string; detail: string;
  onDeleted: (id: string) => void; onClose: () => void;
}) {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  async function remove() {
    if (!entry || !token || pending.current) return;
    pending.current = true; setBusy(true); setError(false);
    try {
      try { await apiRequest(`${resource}/${entry.id}`, { token, method: 'DELETE' }); }
      catch (cause) { if (!(cause instanceof ApiError && cause.status === 404)) throw cause; }
      onDeleted(entry.id); onClose();
    } catch { setError(true); }
    finally { pending.current = false; setBusy(false); }
  }
  return <ConfirmSheet open={!!entry} title={title} detail={error ? 'La suppression a échoué. Réessayez.' : `« ${entry?.title ?? ''} » : ${detail}`}
    confirmLabel="Supprimer" cancelLabel="Annuler" busy={busy} onConfirm={() => { void remove(); }} onClose={() => { setError(false); onClose(); }} />;
}

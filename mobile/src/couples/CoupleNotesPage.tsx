import { useCallback, useEffect, useRef, useState } from 'react';
import { IonPage, useIonViewWillEnter } from '@ionic/react';
import { mailOutline } from 'ionicons/icons';
import BrandHeader from '../shared/ui/BrandHeader';
import AppScreen from '../shared/ui/AppScreen';
import AppButton from '../shared/ui/AppButton';
import FeedbackState from '../shared/ui/FeedbackState';
import ConfirmSheet from '../shared/ui/ConfirmSheet';
import { apiRequest, ApiError } from '../shared/api/client';
import { useCouplesSession } from './sessionContext';

interface Note { id: string; content: string; status: 'SENT' | 'DRAFT' | 'SCHEDULED'; senderId: string; senderName: string; recipientName: string | null; scheduledFor: string | null; sentAt: string | null; createdAt: string }
const PAGE_SIZE = 30;
export default function CoupleNotesPage() {
  const { token, user, space } = useCouplesSession();
  const [view, setView] = useState<'received' | 'sent' | 'drafts'>('received');
  const [entries, setEntries] = useState<Note[]>([]); const [page, setPage] = useState(0); const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [composer, setComposer] = useState(false); const [editing, setEditing] = useState<string | null>(null);
  const [content, setContent] = useState(''); const [mode, setMode] = useState<'DRAFT' | 'SEND' | 'SCHEDULE'>('DRAFT'); const [scheduled, setScheduled] = useState('');
  const [deleting, setDeleting] = useState<Note | null>(null);
  const request = useRef({ body: '', id: crypto.randomUUID() }); const version = useRef(0); const pending = useRef(false);
  const load = useCallback(async (next = 0) => {
    if (!token) return;
    const read = ++version.current; setLoading(true); setError('');
    try { const data = await apiRequest<Note[]>(`/api/notes?view=${view}&page=${next}&size=${PAGE_SIZE}`, { token }); if (read !== version.current) return; setEntries(old => next ? [...old, ...data] : data); setPage(next); setMore(data.length === PAGE_SIZE); }
    catch (failure) { if (read === version.current) setError(failure instanceof ApiError ? failure.message : 'Impossible de charger vos notes.'); }
    finally { if (read === version.current) setLoading(false); }
  }, [token, view]);
  useEffect(() => { const reads = version; void load(); return () => { reads.current++; }; }, [load]);
  useIonViewWillEnter(() => { void load(); });
  const date = (value: string) => new Intl.DateTimeFormat('fr', { dateStyle: 'medium', timeStyle: 'short', timeZone: user?.timeZone ?? 'UTC' }).format(new Date(value));
  function open(note?: Note) {
    setEditing(note?.id ?? null); setContent(note?.content ?? ''); setMode(note?.status === 'SCHEDULED' ? 'SCHEDULE' : 'DRAFT');
    const local = note?.scheduledFor ? new Date(note.scheduledFor) : null;
    setScheduled(local ? new Date(local.getTime() - local.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '');
    setComposer(true); setError('');
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!token || pending.current) return;
    const body = { content: content.trim(), mode, scheduledFor: mode === 'SCHEDULE' ? new Date(scheduled).toISOString() : null };
    const encoded = JSON.stringify(body); if (request.current.body !== encoded) request.current = { body: encoded, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setError('');
    try {
      await apiRequest(editing ? `/api/notes/${editing}` : '/api/notes', { token, method: editing ? 'PUT' : 'POST', headers: { 'Idempotency-Key': request.current.id }, body });
      setComposer(false); setContent(''); request.current = { body: '', id: crypto.randomUUID() }; setView(mode === 'SEND' ? 'sent' : 'drafts'); await load();
    } catch (failure) { setError(failure instanceof ApiError ? failure.message : 'Votre note n’a pas pu être enregistrée. Réessayez.'); }
    finally { pending.current = false; setBusy(false); }
  }
  async function remove() {
    if (!token || !deleting || pending.current) return;
    pending.current = true; setBusy(true);
    try { await apiRequest(`/api/notes/${deleting.id}`, { token, method: 'DELETE' }); setDeleting(null); await load(); }
    catch (failure) { setError(failure instanceof ApiError ? failure.message : 'Suppression impossible.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <IonPage lang="fr"><BrandHeader title="Nos petits mots" icon={mailOutline} accent="rose" showBack /><AppScreen title="Un mot, dans les deux sens." subtitle="Envoyez une pensée maintenant ou gardez-la pour le bon moment.">
    <AppButton onClick={() => open()}>Écrire une note</AppButton>
    {composer && <form className="couple-card couple-form" onSubmit={save}><h2>{editing ? 'Votre note' : 'Une pensée pour votre partenaire'}</h2>
      <label>Votre message<textarea maxLength={4000} required value={content} onChange={e => setContent(e.target.value)} /></label>
      <label>Quand la partager ?<select value={mode} onChange={e => setMode(e.target.value as typeof mode)}><option value="DRAFT">Garder en brouillon privé</option><option value="SEND" disabled={space?.status !== 'ACTIVE'}>Envoyer maintenant</option><option value="SCHEDULE" disabled={space?.status !== 'ACTIVE'}>Programmer</option></select></label>
      {space?.status !== 'ACTIVE' && <p>Vous pourrez envoyer vos notes quand votre partenaire aura rejoint l’espace.</p>}
      {mode === 'SCHEDULE' && <label>Date et heure sur cet appareil<input type="datetime-local" required value={scheduled} onChange={e => setScheduled(e.target.value)} /></label>}
      <p className="couple-meta">Vos brouillons et vos notes programmées restent privés jusqu’à l’envoi. Une note envoyée ne peut plus être modifiée.</p>
      <div className="couple-actions"><AppButton type="submit" busy={busy} disabled={!content.trim()}>{mode === 'SEND' ? 'Envoyer' : mode === 'SCHEDULE' ? 'Programmer' : 'Garder mon brouillon'}</AppButton><AppButton variant="quiet" disabled={busy} onClick={() => setComposer(false)}>Fermer</AppButton></div>
    </form>}
    <div className="couple-tabs" role="group" aria-label="Vos notes">{([{ value: 'received', label: 'Reçues' }, { value: 'sent', label: 'Envoyées' }, { value: 'drafts', label: 'Brouillons et à venir' }] as const).map(tab => <button type="button" key={tab.value} aria-pressed={view === tab.value} onClick={() => setView(tab.value)}>{tab.label}</button>)}</div>
    {error && <p className="couple-error" role="alert">{error}</p>}
    {loading && !entries.length && <FeedbackState kind="loading" heading="On retrouve vos petits mots…" />}
    {!loading && !entries.length && <FeedbackState kind="empty" illustration="notes" heading="Une place pour vos mots." detail={view === 'received' ? 'Les notes de votre partenaire apparaîtront ici après leur envoi.' : 'Votre prochaine pensée peut commencer ici.'} />}
    {entries.map(note => <article className="couple-card" key={note.id}><span className="couple-meta">{note.senderId === user?.userId ? `Pour ${note.recipientName ?? 'votre partenaire'}` : `De ${note.senderName}`} · {note.status === 'SCHEDULED' && note.scheduledFor ? `Prévue le ${date(note.scheduledFor)}` : note.status === 'DRAFT' ? 'Brouillon privé' : date(note.sentAt ?? note.createdAt)}</span><p>{note.content}</p>
      {note.senderId === user?.userId && note.status !== 'SENT' && <div className="couple-actions"><AppButton variant="secondary" onClick={() => open(note)}>Modifier</AppButton><AppButton variant="quiet" onClick={() => setDeleting(note)}>Annuler cette note</AppButton></div>}
    </article>)}
    <div className="couple-actions"><AppButton variant="quiet" busy={loading} onClick={() => { void load(); }}>Actualiser</AppButton>{more && <AppButton variant="secondary" busy={loading} onClick={() => { void load(page + 1); }}>Voir plus</AppButton>}</div>
  </AppScreen><ConfirmSheet open={!!deleting} title="Annuler cette note ?" detail="Elle ne sera pas envoyée à votre partenaire." confirmLabel="Annuler la note" busy={busy} onConfirm={() => { void remove(); }} cancelLabel="Garder" onClose={() => setDeleting(null)} /></IonPage>;
}

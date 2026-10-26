import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { IonContent, IonFooter, IonIcon, IonPage, useIonViewDidLeave, useIonViewWillEnter } from '@ionic/react';
import { chatbubblesOutline, chevronDownOutline, closeOutline, optionsOutline, sendOutline, timeOutline } from 'ionicons/icons';
import BrandHeader from '../shared/ui/BrandHeader';
import AppButton from '../shared/ui/AppButton';
import FeedbackState from '../shared/ui/FeedbackState';
import ConfirmSheet from '../shared/ui/ConfirmSheet';
import { apiRequest, ApiError } from '../shared/api/client';
import { useI18n } from '../shared/i18n';
import { useCouplesSession } from './sessionContext';
import './conversation.css';

interface Note { id: string; content: string; status: 'SENT' | 'DRAFT' | 'SCHEDULED'; senderId: string; senderName: string; recipientName: string | null; scheduledFor: string | null; sentAt: string | null; createdAt: string }
interface Conversation { messages: Note[]; hasMore: boolean; nextBefore: string | null; nextBeforeId: string | null }
const PAGE_SIZE = 10;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export default function CoupleNotesPage() {
  const { t, language } = useI18n();
  const { token, user, space } = useCouplesSession();
  const partner = space?.members.find(member => member.userId !== user?.userId);
  const [view, setView] = useState<'conversation' | 'drafts'>('conversation');
  const [entries, setEntries] = useState<Note[]>([]);
  const [cursor, setCursor] = useState<Pick<Conversation, 'hasMore' | 'nextBefore' | 'nextBeforeId'>>({ hasMore: false, nextBefore: null, nextBeforeId: null });
  const [loading, setLoading] = useState(true);
  const [newMessages, setNewMessages] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'DRAFT' | 'SEND' | 'SCHEDULE'>('SEND');
  const [scheduled, setScheduled] = useState('');
  const [options, setOptions] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Note | null>(null);
  const [draftPage, setDraftPage] = useState(0);
  const [now, setNow] = useState(Date.now());
  const contentRef = useRef<HTMLIonContentElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const active = useRef(false), reading = useRef(false), pending = useRef(false);
  const version = useRef(0);
  const request = useRef({ body: '', id: crypto.randomUUID() });
  const messages = useRef(entries); messages.current = entries;
  const scroll = useRef<'bottom' | { height: number; top: number } | null>(null);

  const load = useCallback(async (older = false, poll = false) => {
    if (!token || reading.current || (older && !cursor.hasMore)) return;
    let followBottom = true;
    if (poll) {
      const element = await contentRef.current?.getScrollElement();
      if (!element || reading.current) return;
      followBottom = element.scrollHeight - element.scrollTop - element.clientHeight <= 100;
      if (view === 'drafts' && !followBottom) return;
    }
    reading.current = true;
    const read = ++version.current;
    if (!poll) setLoading(true);
    const element = older ? await contentRef.current?.getScrollElement() : null;
    const previousScroll = element ? { height: element.scrollHeight, top: element.scrollTop } : null;
    try {
      if (view === 'conversation') {
        const query = new URLSearchParams({ size: String(PAGE_SIZE) });
        if (older && cursor.nextBefore && cursor.nextBeforeId) { query.set('before', cursor.nextBefore); query.set('beforeId', cursor.nextBeforeId); }
        const data = await apiRequest<Conversation>(`/api/notes/conversation?${query}`, { token });
        if (read !== version.current) return;
        if (poll && messages.current.at(-1)?.id === data.messages.at(-1)?.id) return;
        if (poll && !followBottom) { setNewMessages(true); return; }
        if (!older) setNewMessages(false);
        scroll.current = older ? previousScroll : 'bottom';
        setEntries(old => older ? [...new Map([...data.messages, ...old].map(note => [note.id, note])).values()] : data.messages);
        setCursor(data);
      } else {
        const next = older ? draftPage + 1 : 0;
        const data = await apiRequest<Note[]>(`/api/notes?view=drafts&page=${next}&size=${PAGE_SIZE}`, { token });
        if (read !== version.current) return;
        setEntries(old => older ? [...new Map([...old, ...data].map(note => [note.id, note])).values()] : data);
        setDraftPage(next); setCursor({ hasMore: data.length === PAGE_SIZE, nextBefore: null, nextBeforeId: null });
      }
      if (!poll) setError('');
    } catch (failure) {
      if (read === version.current && !poll) setError(failure instanceof ApiError ? failure.message : t('Impossible de charger vos notes.'));
    } finally { if (read === version.current) { reading.current = false; setLoading(false); } }
  }, [token, view, cursor.hasMore, cursor.nextBefore, cursor.nextBeforeId, draftPage, t]);
  const latestLoad = useRef(load); latestLoad.current = load;
  useEffect(() => { const reads = version; reads.current++; reading.current = false; setNewMessages(false); setEntries([]); setCursor({ hasMore: false, nextBefore: null, nextBeforeId: null }); void latestLoad.current(); return () => { reads.current++; }; }, [token, view]);
  useIonViewWillEnter(() => { active.current = true; void latestLoad.current(); });
  useIonViewDidLeave(() => { active.current = false; });
  useEffect(() => {
    const reads = version;
    const refresh = () => { setNow(Date.now()); if (active.current && document.visibilityState === 'visible') void latestLoad.current(false, true); };
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener('visibilitychange', refresh);
    return () => { reads.current++; window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  useEffect(() => {
    const plan = scroll.current; scroll.current = null;
    if (!plan || view !== 'conversation') return;
    const frame = requestAnimationFrame(() => {
      if (plan === 'bottom') void contentRef.current?.scrollToBottom(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
      else void contentRef.current?.getScrollElement().then(element => { element.scrollTop = plan.top + element.scrollHeight - plan.height; });
    });
    return () => cancelAnimationFrame(frame);
  }, [entries, view]);

  function edit(note: Note) {
    setEditing(note.id); setContent(note.content); setMode(note.status === 'SCHEDULED' ? 'SCHEDULE' : 'DRAFT'); setOptions(true);
    const local = note.scheduledFor ? new Date(note.scheduledFor) : null;
    setScheduled(local ? new Date(local.getTime() - local.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
    inputRef.current?.focus();
  }
  function resetComposer() { setEditing(null); setContent(''); setMode('SEND'); setOptions(false); setScheduled(''); if (inputRef.current) inputRef.current.style.height = ''; }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!token || pending.current || !content.trim()) return;
    if (mode === 'SCHEDULE' && (!scheduled || Number.isNaN(Date.parse(scheduled)))) { setOptions(true); setError(t('Choisissez une date et une heure pour votre message.')); return; }
    const body = { content: content.trim(), mode, scheduledFor: mode === 'SCHEDULE' ? new Date(scheduled).toISOString() : null };
    const encoded = JSON.stringify({ ...body, editing });
    if (request.current.body !== encoded) request.current = { body: encoded, id: crypto.randomUUID() };
    pending.current = true; setBusy(true); setError('');
    try {
      await apiRequest(editing ? `/api/notes/${editing}` : '/api/notes', { token, method: editing ? 'PUT' : 'POST', headers: { 'Idempotency-Key': request.current.id }, body });
      request.current = { body: '', id: crypto.randomUUID() };
      resetComposer();
      const next = mode === 'SEND' ? 'conversation' : 'drafts';
      version.current++; reading.current = false; if (view !== next) setView(next); else await latestLoad.current();
    } catch (failure) { setError(failure instanceof ApiError ? failure.message : t('Votre note n’a pas pu être enregistrée. Réessayez.')); }
    finally { pending.current = false; setBusy(false); }
  }
  async function remove() {
    if (!token || !deleting || pending.current) return;
    pending.current = true; setBusy(true);
    try { await apiRequest(`/api/notes/${deleting.id}`, { token, method: 'DELETE' }); if (editing === deleting.id) resetComposer(); setDeleting(null); version.current++; reading.current = false; await latestLoad.current(); }
    catch (failure) { setError(failure instanceof ApiError ? failure.message : t('Suppression impossible.')); }
    finally { pending.current = false; setBusy(false); }
  }
  const zone = user?.timeZone ?? 'UTC';
  const date = (value: string) => new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short', timeZone: zone }).format(new Date(value));
  const day = (value: string) => new Intl.DateTimeFormat(language, { weekday: 'long', month: 'short', day: 'numeric', timeZone: zone }).format(new Date(value));
  const visible = entries.filter(note => note.status !== 'SENT' || Date.parse(note.sentAt ?? note.createdAt) > now - RETENTION_MS);

  return <IonPage lang={language}>
    <BrandHeader title={t('Nos petits mots')} icon={chatbubblesOutline} accent="rose" showBack />
    <IonContent ref={contentRef} className="conversation-content">
      <div className="conversation">
        <div className="conversation-heading"><span className="conversation-avatar" aria-hidden="true">{partner?.name.slice(0, 1).toUpperCase() ?? '♡'}</span><div><h1>{partner?.name ?? t('Votre partenaire')}</h1><p><IonIcon icon={timeOutline} aria-hidden="true" />{t('Les messages disparaissent après 7 jours.')}</p></div></div>
        <div className="conversation-views" role="group" aria-label={t('Vos notes')}>
          <button type="button" aria-pressed={view === 'conversation'} onClick={() => setView('conversation')}>{t('Conversation')}</button>
          <button type="button" aria-pressed={view === 'drafts'} onClick={() => setView('drafts')}>{t('Brouillons et à venir')}</button>
        </div>
        {view === 'conversation' && cursor.hasMore && <button type="button" className="conversation-earlier" disabled={loading} onClick={() => { void load(true); }}>{loading ? t('Chargement…') : t('Voir les messages précédents')}</button>}
        {loading && !visible.length && <FeedbackState kind="loading" heading={t('On retrouve vos petits mots…')} />}
        {!loading && !visible.length && <FeedbackState kind="empty" illustration="notes" heading={t('Une place pour vos mots.')} detail={view === 'conversation' ? t('Commencez la conversation avec une petite pensée.') : t('Vos brouillons et vos messages programmés restent privés jusqu’à l’envoi.')} />}
        <div className="conversation-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label={t('Messages')}>
          {visible.map((note, index) => {
            const mine = note.senderId === user?.userId;
            const timestamp = note.sentAt ?? note.createdAt;
            const previous = visible[index - 1];
            return <div className="conversation-entry" key={note.id}>
              {view === 'conversation' && (!previous || day(previous.sentAt ?? previous.createdAt) !== day(timestamp)) && <p className="conversation-day">{day(timestamp)}</p>}
              <article className={`message-bubble ${mine ? 'message-bubble--mine' : 'message-bubble--partner'}`} aria-label={mine ? t('Votre message') : t('Message de {name}', { name: note.senderName })}>
                <p>{note.content}</p>
                <footer><time dateTime={timestamp}>{note.status === 'SENT' ? new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit', timeZone: zone }).format(new Date(timestamp)) : note.status === 'SCHEDULED' && note.scheduledFor ? t('Prévu le {date}', { date: date(note.scheduledFor) }) : t('Brouillon privé')}</time></footer>
                {note.status !== 'SENT' && <div className="message-draft-actions"><button type="button" onClick={() => edit(note)}>{t('Modifier')}</button><button type="button" onClick={() => setDeleting(note)}>{t('Annuler cette note')}</button></div>}
              </article>
            </div>;
          })}
        </div>
        {view === 'drafts' && cursor.hasMore && <AppButton variant="quiet" busy={loading} onClick={() => { void load(true); }}>{t('Voir plus')}</AppButton>}
      </div>
      {view === 'conversation' && newMessages && <button slot="fixed" type="button" className="conversation-new" disabled={loading} onClick={() => { version.current++; reading.current = false; void latestLoad.current(); }}><span>{t('Nouveaux messages')}</span><IonIcon icon={chevronDownOutline} aria-hidden="true" /></button>}
    </IonContent>
    <IonFooter className="conversation-composer ion-no-border">
      {error && <p className="conversation-error" role="alert">{error}</p>}
      <form ref={formRef} onSubmit={save}>
        {editing && <div className="conversation-editing"><span>{t('Modifier votre note')}</span><button type="button" aria-label={t('Annuler la modification')} disabled={busy} onClick={resetComposer}><IonIcon icon={closeOutline} /></button></div>}
        {options && <div className="conversation-options"><label htmlFor="note-mode">{t('Quand la partager ?')}</label><select id="note-mode" value={mode} disabled={busy} onChange={e => setMode(e.target.value as typeof mode)}><option value="SEND" disabled={space?.status !== 'ACTIVE'}>{t('Envoyer maintenant')}</option><option value="DRAFT">{t('Garder en brouillon privé')}</option><option value="SCHEDULE" disabled={space?.status !== 'ACTIVE'}>{t('Programmer')}</option></select>{mode === 'SCHEDULE' && <label>{t('Date et heure sur cet appareil')}<input type="datetime-local" required value={scheduled} onChange={e => setScheduled(e.target.value)} /></label>}</div>}
        {space?.status !== 'ACTIVE' && <p className="couple-meta">{t('Vous pourrez envoyer vos notes quand votre partenaire aura rejoint l’espace.')}</p>}
        <div className="conversation-compose-row">
          <button type="button" className="conversation-option-toggle" aria-label={t('Options du message')} aria-expanded={options} disabled={busy} onClick={() => setOptions(value => !value)}><IonIcon icon={options ? chevronDownOutline : optionsOutline} aria-hidden="true" /></button>
          <textarea ref={inputRef} rows={1} maxLength={4000} required aria-label={t('Votre message')} placeholder={t('Une pensée à partager…')} value={content} readOnly={busy} onChange={e => { setContent(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`; }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); if (!busy && content.trim()) formRef.current?.requestSubmit(); } }} />
          <AppButton type="submit" className="conversation-send" busy={busy} disabled={!content.trim() || mode !== 'DRAFT' && space?.status !== 'ACTIVE'} icon={sendOutline} aria-label={mode === 'SEND' ? t('Envoyer') : mode === 'DRAFT' ? t('Garder mon brouillon') : t('Programmer')}>{mode === 'SEND' ? t('Envoyer') : t('Garder')}</AppButton>
        </div>
      </form>
    </IonFooter>
    <ConfirmSheet open={!!deleting} title={t('Annuler cette note ?')} detail={t('Elle ne sera pas envoyée à votre partenaire.')} confirmLabel={t('Annuler la note')} cancelLabel={t('Garder')} busy={busy} onConfirm={() => { void remove(); }} onClose={() => setDeleting(null)} />
  </IonPage>;
}

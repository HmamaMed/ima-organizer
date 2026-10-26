import { t, useI18n, getLanguage } from "../shared/i18n";
import { useCallback, useEffect, useRef, useState } from 'react';
import { IonPage, useIonViewWillEnter } from '@ionic/react';
import { imagesOutline } from 'ionicons/icons';
import BrandHeader from '../shared/ui/BrandHeader';
import AppScreen from '../shared/ui/AppScreen';
import AppButton from '../shared/ui/AppButton';
import FeedbackState from '../shared/ui/FeedbackState';
import ConfirmSheet from '../shared/ui/ConfirmSheet';
import { apiRequest, apiUpload, ApiError } from '../shared/api/client';
import { useCouplesSession } from './sessionContext';

interface Group { id: string; name: string; description: string | null; creatorId: string; creatorName: string; createdAt: string; expiresAt: string }
interface Moment { id: string; groupId: string; creatorId: string; creatorName: string; caption: string | null; memoryDate: string; photoUrl: string; audioUrl: string | null; createdAt: string; expiresAt: string }
const PAGE_SIZE = 30;
function failureMessage(failure: unknown) { return failure instanceof ApiError ? failure.message : t("Connexion impossible. Réessayez."); }

function MomentComposer({ groups, onSaved, onClose }: { groups: Group[]; onSaved: () => void; onClose: () => void }) {
  useI18n();
  const { token } = useCouplesSession();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? ''); const [photo, setPhoto] = useState<File | null>(null); const [audio, setAudio] = useState<File | null>(null);
  const [caption, setCaption] = useState(''); const [memoryDate, setMemoryDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [preview, setPreview] = useState('');
  const uploads = useRef<{ photo?: string; audio?: string }>({}); const requestId = useRef(crypto.randomUUID()); const pending = useRef(false);
  useEffect(() => { if (!photo) return; const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!token || !photo || !groupId || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      if (!uploads.current.photo) uploads.current.photo = (await apiUpload<{ id: string }>(`/api/memories/groups/${groupId}/media`, photo, token)).id;
      if (audio && !uploads.current.audio) uploads.current.audio = (await apiUpload<{ id: string }>(`/api/memories/groups/${groupId}/media`, audio, token)).id;
      await apiRequest('/api/memories', { token, method: 'POST', headers: { 'Idempotency-Key': requestId.current }, body: { groupId, photoAssetId: uploads.current.photo, audioAssetId: audio ? uploads.current.audio : null, caption: caption || null, memoryDate } });
      onSaved();
    } catch (failure) { setError(failureMessage(failure)); }
    finally { pending.current = false; setBusy(false); }
  }
  return <form className="couple-card couple-form" onSubmit={save}><h2>{t("Partager un moment")}</h2>
    <label>{t("Votre groupe")}<select value={groupId} disabled={busy || !!uploads.current.photo} onChange={e => { setGroupId(e.target.value); uploads.current = {}; }} required>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
    <label>{t("Une photo JPEG ou PNG")}<input type="file" accept="image/jpeg,image/png" required={!photo} disabled={busy} onChange={e => { setPhoto(e.target.files?.[0] ?? null); uploads.current.photo = undefined; }} /></label>
    {photo && preview && <img className="couple-photo" src={preview} alt={t("Aperçu de votre photo")} />}
    <label>{t("Un enregistrement audio (facultatif, 60 secondes maximum)")}<input type="file" accept="audio/*" disabled={busy} onChange={e => { setAudio(e.target.files?.[0] ?? null); uploads.current.audio = undefined; }} /></label>
    <label>{t("Quelques mots")}<textarea maxLength={4000} value={caption} onChange={e => setCaption(e.target.value)} disabled={busy} /></label>
    <label>{t("Date du moment")}<input type="date" required value={memoryDate} onChange={e => setMemoryDate(e.target.value)} disabled={busy} /></label>
    <p className="couple-meta">{t("25 Mo par fichier, 16 mégapixels par photo. Ce moment expirera avec son groupe, 72 heures après la création du groupe.")}</p>
    {error && <p className="couple-error" role="alert">{error}</p>}
    <div className="couple-actions"><AppButton type="submit" busy={busy} disabled={!photo || !groupId}>{t("Partager avec mon partenaire")}</AppButton><AppButton variant="quiet" disabled={busy} onClick={onClose}>{t("Fermer")}</AppButton></div>
  </form>;
}
export default function CoupleMemoriesPage() {
  useI18n();
  const { token, user } = useCouplesSession();
  const [groups, setGroups] = useState<Group[]>([]); const [moments, setMoments] = useState<Moment[]>([]); const [selected, setSelected] = useState('');
  const [page, setPage] = useState(0); const [more, setMore] = useState(false); const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [composer, setComposer] = useState(false); const [groupForm, setGroupForm] = useState(false); const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [name, setName] = useState(''); const [description, setDescription] = useState('');
  const [edit, setEdit] = useState<Moment | null>(null); const [caption, setCaption] = useState(''); const [date, setDate] = useState('');
  const [deleting, setDeleting] = useState<{ kind: 'group' | 'moment'; id: string } | null>(null);
  const groupRequest = useRef(crypto.randomUUID()); const version = useRef(0); const pending = useRef(false);
  const load = useCallback(async (next = 0) => {
    if (!token) return;
    const read = ++version.current; setLoading(true); setError('');
    try {
      const [nextGroups, nextMoments] = await Promise.all([
        apiRequest<Group[]>('/api/memories/groups?size=100', { token }),
        apiRequest<Moment[]>(`/api/memories?page=${next}&size=${PAGE_SIZE}${selected ? `&groupId=${selected}` : ''}`, { token }),
      ]);
      if (read !== version.current) return;
      setGroups(nextGroups); setMoments(old => next ? [...old, ...nextMoments] : nextMoments); setPage(next); setMore(nextMoments.length === PAGE_SIZE);
    } catch (failure) { if (read === version.current) setError(failureMessage(failure)); }
    finally { if (read === version.current) setLoading(false); }
  }, [token, selected]);
  useEffect(() => { const reads = version; void load(); return () => { reads.current++; }; }, [load]);
  useIonViewWillEnter(() => { void load(); });
  useEffect(() => { const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60_000); return () => window.clearInterval(timer); }, [load]);
  async function perform(action: () => Promise<void>) { if (!token || pending.current) return; pending.current = true; setBusy(true); setError(''); try { await action(); } catch (failure) { setError(failureMessage(failure)); } finally { pending.current = false; setBusy(false); } }
  const ownGroups = groups.filter(group => group.creatorId === user?.userId && Date.parse(group.expiresAt) > Date.now());
  function openGroup(group?: Group) { setEditingGroup(group ?? null); setName(group?.name ?? ''); setDescription(group?.description ?? ''); groupRequest.current = crypto.randomUUID(); setGroupForm(true); }
  function expiry(value: string) { return new Intl.DateTimeFormat(getLanguage(), { dateStyle: 'short', timeStyle: 'short', timeZone: user?.timeZone ?? 'UTC' }).format(new Date(value)); }
  async function remove() {
    if (!deleting) return;
    await perform(async () => { await apiRequest(`/api/memories/${deleting.kind === 'group' ? 'groups/' : ''}${deleting.id}`, { token, method: 'DELETE' }); if (deleting.kind === 'group' && selected === deleting.id) setSelected(''); setDeleting(null); await load(); });
  }
  return <IonPage lang={getLanguage()}><BrandHeader title={t("Nos moments")} icon={imagesOutline} accent="gold" showBack /><AppScreen title={t("Vos moments, à deux.")} subtitle={t("Une photo, quelques mots, une voix. Des petits instants partagés pendant 72 heures.")}>
    <div className="couple-actions"><AppButton onClick={() => openGroup()}>{t("Créer un groupe")}</AppButton><AppButton variant="secondary" disabled={!ownGroups.length} onClick={() => setComposer(true)}>{t("Partager un moment")}</AppButton></div>
    {groupForm && <form className="couple-card couple-form" onSubmit={e => { e.preventDefault(); void perform(async () => { await apiRequest(editingGroup ? `/api/memories/groups/${editingGroup.id}` : '/api/memories/groups', { token, method: editingGroup ? 'PUT' : 'POST', headers: { 'Idempotency-Key': groupRequest.current }, body: { name, description: description || null } }); setGroupForm(false); await load(); }); }}>
      <h2>{editingGroup ? t("Modifier votre groupe") : t("Un groupe pour vos moments")}</h2><label>{t("Nom")}<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><label>{t("Description")}<input maxLength={500} value={description} onChange={e => setDescription(e.target.value)} /></label>
      <p className="couple-meta">{editingGroup ? t("Modifier le groupe ne prolonge pas son expiration.") : t("Le groupe et ses fichiers expirent 72 heures après sa création.")}</p><div className="couple-actions"><AppButton type="submit" busy={busy}>{t("Enregistrer")}</AppButton><AppButton variant="quiet" disabled={busy} onClick={() => setGroupForm(false)}>{t("Fermer")}</AppButton></div>
    </form>}
    {composer && <MomentComposer groups={ownGroups} onClose={() => setComposer(false)} onSaved={() => { setComposer(false); void load(); }} />}
    {error && <p role="alert" className="couple-error">{error}</p>}
    {!!groups.length && <div className="couple-card"><label>{t("Explorer les groupes")}<select value={selected} onChange={e => setSelected(e.target.value)}><option value="">{t("Tous nos moments")}</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name} · {group.creatorName}</option>)}</select></label>
      {groups.filter(group => group.id === selected).map(group => <div key={group.id}><p>{group.description}</p><p className="couple-meta">{t("Expire le") + " "}{expiry(group.expiresAt)}</p>{group.creatorId === user?.userId && <div className="couple-actions"><AppButton variant="quiet" onClick={() => openGroup(group)}>{t("Modifier le groupe")}</AppButton><AppButton variant="quiet" onClick={() => setDeleting({ kind: 'group', id: group.id })}>{t("Supprimer mon groupe")}</AppButton></div>}</div>)}
    </div>}
    {loading && !moments.length && <FeedbackState kind="loading" heading={t("On retrouve vos moments…")} />}
    {!loading && !moments.length && <FeedbackState kind="empty" illustration="memories" heading={t("Un instant à partager ?")} detail={t("Chacun peut créer son groupe et ajouter ses propres photos et enregistrements.")} />}
    {moments.filter(moment => Date.parse(moment.expiresAt) > Date.now()).map(moment => <article className="couple-card" key={moment.id}><span className="couple-meta">{moment.creatorName} · {moment.memoryDate} {" " + t("· Expire le") + " "}{expiry(moment.expiresAt)}</span><img className="couple-photo" src={moment.photoUrl} alt={moment.caption || t("Moment partagé par {v0}", { v0: moment.creatorName })} loading="lazy" referrerPolicy="no-referrer" />
      {moment.audioUrl && <audio controls preload="none" src={moment.audioUrl} />}{moment.caption && <p>{moment.caption}</p>}
      {edit?.id === moment.id ? <form className="couple-form" onSubmit={e => { e.preventDefault(); void perform(async () => { await apiRequest(`/api/memories/${moment.id}`, { token, method: 'PUT', body: { caption, memoryDate: date } }); setEdit(null); await load(); }); }}><label>{t("Vos mots")}<textarea maxLength={4000} value={caption} onChange={e => setCaption(e.target.value)} /></label><label>{t("Date")}<input type="date" value={date} required onChange={e => setDate(e.target.value)} /></label><div className="couple-actions"><AppButton type="submit" busy={busy}>{t("Enregistrer")}</AppButton><AppButton variant="quiet" onClick={() => setEdit(null)}>{t("Fermer")}</AppButton></div></form>
        : moment.creatorId === user?.userId && <div className="couple-actions"><AppButton variant="quiet" onClick={() => { setEdit(moment); setCaption(moment.caption ?? ''); setDate(moment.memoryDate); }}>{t("Modifier")}</AppButton><AppButton variant="quiet" onClick={() => setDeleting({ kind: 'moment', id: moment.id })}>{t("Retirer mon moment")}</AppButton></div>}
    </article>)}
    <div className="couple-actions"><AppButton variant="quiet" busy={loading} onClick={() => { void load(); }}>{t("Actualiser")}</AppButton>{more && <AppButton variant="secondary" busy={loading} onClick={() => { void load(page + 1); }}>{t("Voir plus")}</AppButton>}</div>
    <p className="couple-meta">{t("Les moments sont temporaires. Un fichier déjà téléchargé ou un lien temporaire déjà émis peut rester accessible jusqu’à son expiration.")}</p>
  </AppScreen><ConfirmSheet open={!!deleting} title={deleting?.kind === 'group' ? t("Supprimer votre groupe ?") : t("Retirer ce moment ?")} detail={t("Il disparaîtra de votre espace partagé. Les fichiers seront supprimés avec reprise automatique en cas d’erreur.")} confirmLabel={t("Supprimer")} cancelLabel={t("Garder")} busy={busy} onConfirm={() => { void remove(); }} onClose={() => setDeleting(null)} /></IonPage>;
}

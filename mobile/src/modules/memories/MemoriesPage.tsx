import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { useHistory, useParams, useLocation } from 'react-router-dom';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonImg,
  IonLabel,
  IonModal,
  IonPage,
  IonSegment,
  IonSegmentButton,
  useIonViewDidLeave,
  useIonViewWillEnter,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import {
  addOutline,
  cameraOutline,
  chevronBackOutline,
  closeOutline,
  imagesOutline,
  timeOutline,
  micOutline,
  playOutline,
  pauseOutline,
  stopOutline,
  trashOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import BrandHeader from '../../shared/ui/BrandHeader';
import AppScreen from '../../shared/ui/AppScreen';
import { uploadToStorage } from '../../shared/storage/mediaStorage';
import FeedbackState from '../../shared/ui/FeedbackState';
import AppButton from '../../shared/ui/AppButton';
import ConfirmSheet from '../../shared/ui/ConfirmSheet';
import { moroccoFormat } from '../../shared/utils/moroccoTime';
import { useInView } from '../../shared/utils/useInView';
import {
  createMemory,
  fetchMemories,
  createMemoryGroup,
  deleteMemoryGroup,
  fetchMemoryGroups,
  type Memory,
  type MemoryGroup,
} from './memoriesApi';
import './memories.css';

function remainingTime(expiresAt: string, now: number): string {
  const hours = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 3_600_000));
  return hours > 24 ? `${Math.ceil(hours / 24)} days left` : hours > 1 ? `${hours} hours left` : 'Less than an hour left';
}

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** The original story: oldest first, walking towards the newest memory. */
function groupByMonth(
  memories: Memory[],
): { label: string; entries: Memory[] }[] {
  const sorted = [...memories].sort(
    (a, b) =>
      new Date(a.memoryDate).getTime() - new Date(b.memoryDate).getTime(),
  );
  const groups: { label: string; entries: Memory[] }[] = [];
  for (const memory of sorted) {
    const label = monthLabel(memory.memoryDate);
    const current = groups[groups.length - 1];
    if (current && current.label === label) {
      current.entries.push(memory);
    } else {
      groups.push({ label, entries: [memory] });
    }
  }
  return groups;
}

function AudioPill({ src }: { src: string }) {
  const [audio] = useState(() => new Audio(src));
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  useEffect(() => {
    const stopped = () => setPlaying(false);
    const failed = () => {
      setPlaying(false);
      setError(true);
    };
    const metadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration * 1000);
    };
    const pauseOther = (event: Event) => {
      if ((event as CustomEvent).detail !== audio) {
        audio.pause();
        setPlaying(false);
      }
    };
    audio.addEventListener('ended', stopped);
    audio.addEventListener('pause', stopped);
    audio.addEventListener('error', failed);
    audio.addEventListener('loadedmetadata', metadata);
    window.addEventListener('lo-audio-play', pauseOther);
    return () => {
      audio.pause();
      audio.removeEventListener('ended', stopped);
      audio.removeEventListener('pause', stopped);
      audio.removeEventListener('error', failed);
      audio.removeEventListener('loadedmetadata', metadata);
      window.removeEventListener('lo-audio-play', pauseOther);
    };
  }, [audio]);
  const toggle = async () => {
    setError(false);
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    window.dispatchEvent(new CustomEvent('lo-audio-play', { detail: audio }));
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
      setError(true);
    }
  };
  return (
    <>
      <button
        type="button"
        className={`audio-pill ${playing ? 'audio-pill--playing' : ''}`}
        onClick={toggle}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        aria-pressed={playing}
      >
        <IonIcon icon={playing ? pauseOutline : playOutline} />
        Voice note{duration !== null && <span>{formatDuration(duration)}</span>}
      </button>
      {error && (
        <p className="audio-error" role="status">
          Could not play this voice note. Tap to try again.
        </p>
      )}
    </>
  );
}

interface RecordedAudio {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  return new Blob([array], { type: mimeType });
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Records a short voice note via the device mic, or lets you play back / discard what you just recorded. */
function AudioRecorder({
  value,
  onChange,
}: {
  value: RecordedAudio | null;
  onChange: (audio: RecordedAudio | null) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    },
    [],
  );

  const previewUrl = useMemo(
    () => (value ? URL.createObjectURL(value.blob) : null),
    [value],
  );
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const startRecording = async () => {
    setError(null);
    try {
      const canRecord = await VoiceRecorder.canDeviceVoiceRecord();
      if (!canRecord.value) {
        setError('This device cannot record audio.');
        return;
      }
      const permission = await VoiceRecorder.requestAudioRecordingPermission();
      if (!permission.value) {
        setError('Microphone permission denied.');
        return;
      }
      await VoiceRecorder.startRecording();
      setRecording(true);
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      timerRef.current = window.setInterval(
        () => setElapsedMs(Date.now() - startedAtRef.current),
        250,
      );
    } catch {
      setError('Could not start recording.');
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    try {
      const result = await VoiceRecorder.stopRecording();
      if (!result.value.recordDataBase64) {
        setError('Recording failed.');
        return;
      }
      onChange({
        blob: base64ToBlob(
          result.value.recordDataBase64,
          result.value.mimeType,
        ),
        mimeType: result.value.mimeType,
        durationMs: result.value.msDuration,
      });
    } catch {
      setError('Could not save the recording.');
    }
  };

  if (value && previewUrl) {
    return (
      <div className="audio-recorder">
        <div className="audio-recorder__playback">
          <AudioPill src={previewUrl} />
          <span className="audio-recorder__duration">
            {formatDuration(value.durationMs)}
          </span>
          <button
            type="button"
            className="audio-recorder__discard"
            onClick={() => onChange(null)}
          >
            <IonIcon icon={trashOutline} /> Re-record
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="audio-recorder">
      {error && <p className="audio-recorder__error">{error}</p>}
      {recording ? (
        <div className="audio-recorder__active">
          <button
            type="button"
            className="audio-recorder__stop"
            onClick={stopRecording}
            aria-label="Stop recording"
          >
            <IonIcon icon={stopOutline} />
          </button>
          <span className="audio-recorder__timer">
            {formatDuration(elapsedMs)}
          </span>
          <span className="audio-recorder__pulse" />
        </div>
      ) : (
        <button
          type="button"
          className="audio-recorder__start"
          onClick={startRecording}
        >
          <IonIcon icon={micOutline} />
          Tap to record a voice note
        </button>
      )}
    </div>
  );
}

function MemoryGroupCard({
  name,
  description,
  memories,
  expiresAt,
  now,
  onOpen,
}: {
  name: string;
  description: string | null;
  memories: Memory[];
  expiresAt: string;
  now: number;
  onOpen: () => void;
}) {
  const [brokenCover, setBrokenCover] = useState<string | null>(null);
  const cover = [...memories].sort((a, b) =>
    b.memoryDate.localeCompare(a.memoryDate),
  )[0]?.photoUrl;
  return (
    <button
      type="button"
      className="memory-collection"
      onClick={onOpen}
      aria-label={`Open ${name}`}
    >
      <span className="memory-collection__cover" aria-hidden="true">
        {cover && brokenCover !== cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            onError={() => setBrokenCover(cover)}
          />
        ) : (
          <span className="memory-collection__papers">
            <IonIcon icon={imagesOutline} />
          </span>
        )}
        <span className="memory-collection__count">
          {memories.length} {memories.length === 1 ? 'memory' : 'memories'}
        </span>
      </span>
      <span className="memory-collection__body">
        <span className="memory-collection__name">{name}</span>
        <span className="memory-collection__description">
          {description ||
            (memories.length
              ? 'Open this chapter of our story.'
              : 'Ready for its first memory.')}
        </span>
        <span className="memory-collection__expiry"><IonIcon icon={timeOutline} aria-hidden="true" />{remainingTime(expiresAt, now)}</span>
        <span className="memory-collection__open">
          Open collection{' '}
          <IonIcon icon={chevronForwardOutline} aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

function MemoryCard({
  memory,
  index,
  onOpen,
}: {
  memory: Memory;
  index: number;
  onOpen: (memory: Memory) => void;
}) {
  const { ref, inView } = useInView<HTMLElement>();
  const [photoError, setPhotoError] = useState(false);
  return (
    <article
      ref={ref}
      className={`memory-card memory-card--${index % 2 === 0 ? 'left' : 'right'} ${inView ? 'is-visible' : ''}`}
      style={
        { '--reveal-delay': `${Math.min(index, 5) * 70}ms` } as CSSProperties
      }
    >
      <button
        type="button"
        className="memory-card__photo-btn"
        onClick={() => onOpen(memory)}
        aria-label="View photo full-screen"
      >
        {photoError ? (
          <FeedbackState
            kind="failure"
            heading="Photo unavailable"
            detail="You can still read this memory below."
          />
        ) : (
          <IonImg
            src={memory.photoUrl}
            alt={memory.caption ?? 'Memory'}
            className="memory-card__photo"
            onIonError={() => setPhotoError(true)}
          />
        )}
      </button>
      <div className="memory-card__body">
        {memory.caption && (
          <p className="memory-card__caption font-display-italic">
            {memory.caption}
          </p>
        )}
        <span className="memory-card__date">
          {formatDate(memory.memoryDate)}
        </span>
        {memory.audioUrl && <AudioPill src={memory.audioUrl} />}
      </div>
    </article>
  );
}

function PhotoLightbox({
  memory,
  onClose,
}: {
  memory: Memory;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lightbox">
      <button
        type="button"
        className="lightbox__close"
        onClick={onClose}
        aria-label="Close"
      >
        <IonIcon icon={closeOutline} />
      </button>
      <img
        src={memory.photoUrl}
        alt={memory.caption ?? 'Memory'}
        className="lightbox__img"
        onClick={(e) => e.stopPropagation()}
      />
      {(memory.caption || memory.audioUrl) && (
        <div className="lightbox__meta" onClick={(e) => e.stopPropagation()}>
          {memory.caption && (
            <p className="lightbox__caption font-display-italic">
              {memory.caption}
            </p>
          )}
          <span className="lightbox__date">
            {formatDate(memory.memoryDate)}
          </span>
          {memory.audioUrl && <AudioPill src={memory.audioUrl} />}
        </div>
      )}
    </div>
  );
}

export default function MemoriesPage() {
  const history = useHistory();
  const location = useLocation();
  const [now, setNow] = useState(() => Date.now());
  const [removing, setRemoving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const groupSavingRef = useRef(false);
  const { groupId } = useParams<{ groupId?: string }>();
  const { token, user } = useAuth();
  const isOwner = user?.role === 'OWNER';

  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryGroups, setMemoryGroups] = useState<MemoryGroup[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [showGroupComposer, setShowGroupComposer] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupSaveError, setGroupSaveError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Composer state
  const [showComposer, setShowComposer] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [noteMode, setNoteMode] = useState<'caption' | 'audio'>('caption');
  const [caption, setCaption] = useState('');
  const [recordedAudio, setRecordedAudio] = useState<RecordedAudio | null>(
    null,
  );
  const [memoryDate, setMemoryDate] = useState<string>(
    new Date().toISOString(),
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Memory | null>(null);

  const activeGroups = memoryGroups.filter(group => Date.parse(group.expiresAt) > now);
  const activeGroup = activeGroups.find((group) => group.id === groupId);
  const isTimeline = !!groupId;
  const groupExists = !!activeGroup;
  const visibleMemories = groupExists ? memories.filter(memory => memory.groupId === groupId) : [];
  const timelineGroups = groupByMonth(visibleMemories);
  const order = new Map(
    timelineGroups
      .flatMap((group) => group.entries)
      .map((memory, index) => [memory.id, index]),
  );

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    // Expiry is also enforced by the API; cached data never extends a category's life.
    const [memoryResult, groupResult] = await Promise.allSettled([
      fetchMemories(token),
      fetchMemoryGroups(token),
    ]);
    if (memoryResult.status === 'fulfilled') {
      setMemories(memoryResult.value);
      setLoaded(true);
      setError(null);
    } else {
      setError('Could not load memories.');
    }
    if (groupResult.status === 'fulfilled') {
      setMemoryGroups(groupResult.value);
      setGroupsLoaded(true);
      setGroupsError(null);
    } else {
      setGroupsError('Could not load memory categories.');
    }
    setNow(Date.now());
    setLoading(false);
  }, [token]);

  useIonViewWillEnter(() => { setNow(Date.now()); void load(); });
  useEffect(() => {
    if (!location.pathname.startsWith('/memories')) return;
    const interval = window.setInterval(() => { setNow(Date.now()); }, 60_000);
    const refresh = window.setInterval(() => { void load(); }, 5 * 60_000);
    const visible = () => { if (!document.hidden) { setNow(Date.now()); void load(); } };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(interval); clearInterval(refresh); document.removeEventListener('visibilitychange', visible); };
  }, [load, location.pathname]);
  useEffect(() => {
    const deadline = Math.min(...memoryGroups.map(group => Date.parse(group.expiresAt)).filter(value => value > now));
    if (!Number.isFinite(deadline)) return;
    const timeout = window.setTimeout(() => {
      setNow(Date.now());
      const current = memoryGroups.find(group => group.id === groupId);
      if (current && Date.parse(current.expiresAt) <= Date.now()) {
        setLightbox(null); setShowComposer(false);
        window.dispatchEvent(new CustomEvent('lo-audio-play', { detail: null }));
      }
      void load();
    }, Math.min(Math.max(deadline - Date.now() + 20, 0), 2_147_483_647));
    return () => clearTimeout(timeout);
  }, [memoryGroups, now, load, groupId]);

  useIonViewDidLeave(() => {
    window.dispatchEvent(new CustomEvent('lo-audio-play', { detail: null }));
  });

  const pickPhoto = async (source: CameraSource) => {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source,
        quality: 85,
      });
      setPhotoDataUrl(photo.dataUrl ?? null);
    } catch {
      // user cancelled
    }
  };

  const closeComposer = () => {
    setShowComposer(false);
    setPhotoDataUrl(null);
    setCaption('');
    setNoteMode('caption');
    setRecordedAudio(null);
  };

  const closeGroupComposer = () => {
    setShowGroupComposer(false);
    setGroupName('');
    setGroupDescription('');
    setGroupSaveError(null);
  };

  const handleCreateGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !isOwner || groupSavingRef.current || !groupName.trim()) return;
    groupSavingRef.current = true;
    setGroupSaving(true);
    setGroupSaveError(null);
    try {
      const group = await createMemoryGroup(token, {
        name: groupName.trim(),
        description: groupDescription.trim() || null,
      });
      setMemoryGroups((groups) => [...groups, group]);
      setGroupSaving(false);
      closeGroupComposer();
      setToast('Category created. Add your first memory.');
      history.push(`/memories/groups/${group.id}`);
    } catch {
      setGroupSaveError(
        'Could not create this category. Your details are still here. Try again.',
      );
    } finally {
      groupSavingRef.current = false;
      setGroupSaving(false);
    }
  };

  const handleSave = async () => {
    if (
      !token ||
      !isOwner ||
      !photoDataUrl ||
      savingRef.current ||
      !groupId ||
      !isTimeline ||
      !groupExists
    )
      return;
    savingRef.current = true;
    setSaving(true);
    try {
      // Each file is uploaded to private R2 storage and tracked against this category.
      const photoBlob = await (await fetch(photoDataUrl)).blob();
      const photoAsset = await uploadToStorage(groupId!, photoBlob, token);
      let audioAssetId: string | null = null;
      if (noteMode === 'audio' && recordedAudio) {
        audioAssetId = (await uploadToStorage(groupId!, recordedAudio.blob, token)).id;
      }

      await createMemory(token, {
        photoAssetId: photoAsset.id,
        caption: noteMode === 'caption' ? caption.trim() || null : null,
        audioAssetId,
        memoryDate: memoryDate.slice(0, 10),
        groupId: groupId!,
      });

      setToast('Memory added.');
      setSaving(false);
      closeComposer();
      await load();
    } catch (cause) {
      setToast(cause instanceof Error ? cause.message : 'Could not save the memory. Check your connection and try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const removeCategory = async () => {
    if (!token || !activeGroup || removing) return;
    setRemoving(true); setDeleteError(null);
    try {
      await deleteMemoryGroup(token, activeGroup.id);
      setConfirmDelete(false); setLightbox(null);
      setMemoryGroups(previous => previous.filter(group => group.id !== activeGroup.id));
      window.dispatchEvent(new CustomEvent('lo-audio-play', { detail: null }));
      history.replace('/memories');
    } catch { setDeleteError('Could not remove this category. Please try again.'); }
    finally { setRemoving(false); }
  };

  return (
    <IonPage>
      <BrandHeader
        icon={imagesOutline}
        title={isTimeline ? 'Memory Timeline' : 'Memories'}
        accent="plum"
        showBack
        backTo={isTimeline ? '/memories' : '/home'}
      />

      <AppScreen
        className="memories-screen"
        title={
          isTimeline ? activeGroup?.name || 'Memory category' : 'Our memories.'
        }
        eyebrow={isTimeline ? 'Memory timeline' : 'Collections'}
        subtitle={
          isTimeline
            ? activeGroup?.description ||
              'A slow walk through the moments we’ve kept.'
            : 'Little chapters of our story, each with a place of its own.'
        }
        action={isOwner ? (!isTimeline ? (
          <AppButton onClick={() => setShowGroupComposer(true)} disabled={!groupsLoaded} icon={addOutline}>Create a category</AppButton>
        ) : activeGroup ? (
          <AppButton variant="quiet" icon={trashOutline} onClick={() => { setDeleteError(null); setConfirmDelete(true); }}>Delete category</AppButton>
        ) : null) : null}
      >
        {!isTimeline && <p className="memory-retention-note"><IonIcon icon={timeOutline} aria-hidden="true" />A little chapter, here for 3 days. Its photos and voice notes are deleted with it.</p>}
        {activeGroup && <p className="memory-retention-note"><IonIcon icon={timeOutline} aria-hidden="true" /><span>{remainingTime(activeGroup.expiresAt, now)} · Until {moroccoFormat(new Date(activeGroup.expiresAt), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. Photos and voice notes expire with this category.</span></p>}
        {loading && !loaded && (
          <FeedbackState kind="loading" heading="Finding your memories…" />
        )}
        {error && (
          <FeedbackState
            kind="failure"
            heading={error}
            detail={
              loaded ? 'Your previous memories are still here.' : undefined
            }
            onRetry={load}
          />
        )}
        {groupsError && (
          <FeedbackState
            kind="failure"
            heading={groupsError}
            detail="Please try again to find your active categories."
            onRetry={load}
          />
        )}
        {!isTimeline && loaded && (
          <div className="memory-collections">
            {activeGroups.map((group) => (
              <MemoryGroupCard
                key={group.id}
                name={group.name}
                description={group.description}
                expiresAt={group.expiresAt}
                now={now}
                memories={memories.filter(
                  (memory) => memory.groupId === group.id,
                )}
                onOpen={() => history.push(`/memories/groups/${group.id}`)}
              />
            ))}
          </div>
        )}
        {loaded &&
          ((!isTimeline &&
            activeGroups.length === 0) ||
            (isTimeline && groupExists && visibleMemories.length === 0)) && (
            <FeedbackState
              kind="empty"
              illustration="memories"
              heading={
                isTimeline
                  ? 'A new chapter starts here.'
                  : 'Our story is just beginning.'
              }
              detail={
                isOwner
                  ? isTimeline
                    ? 'Add the first photo, with a caption or a voice note.'
                    : 'Create a category—Birthdays, Trips, or Everyday moments—then fill it with memories.'
                  : 'The moments we keep will appear here.'
              }
            />
          )}
        {isTimeline && groupsLoaded && !groupExists && (
          <FeedbackState
            kind="empty"
            heading="This category has expired or was removed."
            detail="Temporary categories disappear after 3 days, along with their photos and voice notes."
          />
        )}
        {loaded && isTimeline && groupExists && visibleMemories.length > 0 && (
          <div className="memory-snake">
            {timelineGroups.map((group) => (
              <div key={group.label}>
                <p className="month-label">{group.label}</p>
                <div className="memory-snake__group">
                  {group.entries.map((memory) => (
                    <MemoryCard
                      key={memory.id}
                      memory={memory}
                      index={order.get(memory.id) ?? 0}
                      onOpen={setLightbox}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {isOwner && isTimeline && groupExists && (
          <IonFab vertical="bottom" horizontal="end" slot="fixed">
            <IonFabButton
              color="tertiary"
              onClick={() => {
                setMemoryDate(new Date().toISOString());
                setShowComposer(true);
              }}
              aria-label="Add a memory"
            >
              <IonIcon icon={addOutline} />
            </IonFabButton>
          </IonFab>
        )}
      </AppScreen>

      <IonModal
        isOpen={showGroupComposer}
        onDidDismiss={closeGroupComposer}
        canDismiss={!groupSaving}
      >
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton
                onClick={closeGroupComposer}
                disabled={groupSaving}
                aria-label="Close category creation"
              >
                <IonIcon icon={closeOutline} />
              </IonButton>
            </IonButtons>
            <IonTitle>Create a category</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <form className="memory-group-form" onSubmit={handleCreateGroup}>
            <p className="memory-group-form__intro">
              Give a chapter of our story a name. It will be available for 3 days.
            </p>
            <p className="memory-retention-note">Automatically deleted 72 hours after creation, including every photo and voice note. Adding more memories does not extend this time.</p>
            <label htmlFor="memory-group-name">Category name</label>
            <input
              id="memory-group-name"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="e.g. Birthday memories"
              required
              maxLength={100}
              disabled={groupSaving}
            />
            <label htmlFor="memory-group-description">
              Description (optional)
            </label>
            <textarea
              id="memory-group-description"
              value={groupDescription}
              onChange={(event) => setGroupDescription(event.target.value)}
              placeholder="What makes this chapter special?"
              maxLength={500}
              rows={4}
              disabled={groupSaving}
            />
            {groupSaveError && (
              <p className="memory-group-form__error" role="alert">
                {groupSaveError}
              </p>
            )}
            <AppButton
              type="submit"
              busy={groupSaving}
              disabled={!groupName.trim()}
            >
              Create category
            </AppButton>
          </form>
        </IonContent>
      </IonModal>

      <IonModal
        isOpen={showComposer}
        onDidDismiss={closeComposer}
        canDismiss={!saving}
      >
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton
                onClick={closeComposer}
                disabled={saving}
                aria-label="Back"
              >
                <IonIcon icon={chevronBackOutline} />
              </IonButton>
            </IonButtons>
            <IonTitle>Add a memory</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <p className="memory-composer-group">
            Adding to{' '}
            <strong>{activeGroup?.name}</strong>
          </p>
          {photoDataUrl ? (
            <div className="memory-preview">
              <IonImg src={photoDataUrl} className="memory-preview__img" />
              <IonButton fill="clear" onClick={() => setPhotoDataUrl(null)}>
                <IonIcon slot="start" icon={closeOutline} /> Remove
              </IonButton>
            </div>
          ) : (
            <div className="composer-photo-actions">
              <IonButton
                expand="block"
                color="tertiary"
                onClick={() => pickPhoto(CameraSource.Camera)}
              >
                <IonIcon slot="start" icon={cameraOutline} />
                Take a photo
              </IonButton>
              <IonButton
                expand="block"
                fill="outline"
                color="tertiary"
                onClick={() => pickPhoto(CameraSource.Photos)}
              >
                <IonIcon slot="start" icon={imagesOutline} />
                Choose from gallery
              </IonButton>
            </div>
          )}

          <IonSegment
            value={noteMode}
            onIonChange={(e) =>
              setNoteMode((e.detail.value as 'caption' | 'audio') ?? 'caption')
            }
            className="composer-segment"
          >
            <IonSegmentButton value="caption">
              <IonLabel>Caption</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="audio">
              <IonLabel>Voice note</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          {noteMode === 'caption' ? (
            <IonTextarea
              value={caption}
              onIonInput={(e) => setCaption(String(e.detail.value ?? ''))}
              label="Caption (optional)"
              labelPlacement="stacked"
              placeholder="Add a caption…"
              maxlength={4000}
              autoGrow
              rows={3}
            />
          ) : (
            <AudioRecorder value={recordedAudio} onChange={setRecordedAudio} />
          )}

          <p className="composer-label">When was this?</p>
          <div className="composer-datetime">
            <IonDatetime
              value={memoryDate}
              onIonChange={(e) =>
                setMemoryDate(
                  String(e.detail.value ?? new Date().toISOString()),
                )
              }
              presentation="date"
            />
          </div>

          <div className="composer-actions">
            <IonButton
              expand="block"
              color="tertiary"
              onClick={handleSave}
              disabled={saving || !photoDataUrl}
            >
              {saving ? 'Uploading…' : 'Save memory'}
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      <IonModal
        className="lightbox-modal"
        isOpen={!!lightbox}
        onDidDismiss={() => setLightbox(null)}
      >
        <IonContent>
          {lightbox && (
            <PhotoLightbox
              memory={lightbox}
              onClose={() => setLightbox(null)}
            />
          )}
        </IonContent>
      </IonModal>

      <ConfirmSheet open={confirmDelete} title="Delete this category?"
        detail={deleteError ?? 'This removes the category now and permanently deletes all its photos and voice notes. This cannot be undone.'}
        confirmLabel="Delete category" busy={removing} onConfirm={() => { void removeCategory(); }}
        onClose={() => setConfirmDelete(false)} />
      <IonToast
        isOpen={!!toast}
        message={toast ?? ''}
        duration={2500}
        onDidDismiss={() => setToast(null)}
      />
    </IonPage>
  );
}

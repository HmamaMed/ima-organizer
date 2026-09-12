import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
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
  IonSpinner,
  IonText,
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
  micOutline,
  playOutline,
  pauseOutline,
  stopOutline,
  trashOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../../shared/auth/AuthContext';
import BrandHeader from '../../shared/ui/BrandHeader';
import { uploadToStorage } from '../../shared/storage/mediaStorage';
import { useInView } from '../../shared/utils/useInView';
import { createMemory, fetchMemories, type Memory } from './memoriesApi';

function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Groups memories by calendar month, newest month first, entries within a month newest first. */
function groupByMonth(memories: Memory[]): { label: string; entries: Memory[] }[] {
  const sorted = [...memories].sort((a, b) => new Date(b.memoryDate).getTime() - new Date(a.memoryDate).getTime());
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

/** Position of an entry within the whole (flattened) timeline, driving the alternating walk-in side and stagger. */
function indexTimeline(groups: { label: string; entries: Memory[] }[]): Map<string, number> {
  const map = new Map<string, number>();
  let i = 0;
  for (const group of groups) {
    for (const memory of group.entries) {
      map.set(memory.id, i++);
    }
  }
  return map;
}

function AudioPill({ src }: { src: string }) {
  const [audio] = useState(() => new Audio(src));
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const onEnded = () => setPlaying(false);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.pause();
    };
  }, [audio]);

  const toggle = () => {
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
    setPlaying(!playing);
  };

  return (
    <button type="button" className={`audio-pill ${playing ? 'audio-pill--playing' : ''}`} onClick={toggle}>
      <IonIcon icon={playing ? pauseOutline : playOutline} />
      Voice note
    </button>
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
function AudioRecorder({ value, onChange }: { value: RecordedAudio | null; onChange: (audio: RecordedAudio | null) => void }) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
  }, []);

  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value.blob) : null), [value]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

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
      timerRef.current = window.setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250);
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
        blob: base64ToBlob(result.value.recordDataBase64, result.value.mimeType),
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
          <span className="audio-recorder__duration">{formatDuration(value.durationMs)}</span>
          <button type="button" className="audio-recorder__discard" onClick={() => onChange(null)}>
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
          <button type="button" className="audio-recorder__stop" onClick={stopRecording} aria-label="Stop recording">
            <IonIcon icon={stopOutline} />
          </button>
          <span className="audio-recorder__timer">{formatDuration(elapsedMs)}</span>
          <span className="audio-recorder__pulse" />
        </div>
      ) : (
        <button type="button" className="audio-recorder__start" onClick={startRecording}>
          <IonIcon icon={micOutline} />
          Tap to record a voice note
        </button>
      )}
    </div>
  );
}

function MemoryCard({ memory, index, onOpen }: { memory: Memory; index: number; onOpen: (memory: Memory) => void }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const side = index % 2 === 0 ? 'left' : 'right';

  return (
    <div
      ref={ref}
      className={`memory-card memory-card--${side} ${inView ? 'is-visible' : ''}`}
      style={{ '--reveal-delay': `${Math.min(index, 5) * 70}ms` } as CSSProperties}
    >
      <button type="button" className="memory-card__photo-btn" onClick={() => onOpen(memory)} aria-label="View photo full-screen">
        <IonImg src={memory.photoUrl} alt={memory.caption ?? 'Memory'} className="memory-card__photo" />
      </button>
      <div className="memory-card__body">
        {memory.caption && <p className="memory-card__caption font-display-italic">{memory.caption}</p>}
        <span className="memory-card__date">{formatDate(memory.memoryDate)}</span>
        {memory.audioUrl && <AudioPill src={memory.audioUrl} />}
      </div>
    </div>
  );
}

function PhotoLightbox({ memory, onClose }: { memory: Memory; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="lightbox" onClick={onClose}>
      <button type="button" className="lightbox__close" onClick={onClose} aria-label="Close">
        <IonIcon icon={closeOutline} />
      </button>
      <img src={memory.photoUrl} alt={memory.caption ?? 'Memory'} className="lightbox__img" onClick={(e) => e.stopPropagation()} />
      {(memory.caption || memory.audioUrl) && (
        <div className="lightbox__meta" onClick={(e) => e.stopPropagation()}>
          {memory.caption && <p className="lightbox__caption font-display-italic">{memory.caption}</p>}
          <span className="lightbox__date">{formatDate(memory.memoryDate)}</span>
          {memory.audioUrl && <AudioPill src={memory.audioUrl} />}
        </div>
      )}
    </div>
  );
}

export default function MemoriesPage() {
  const { token, user } = useAuth();
  const history = useHistory();
  const isOwner = user?.role === 'OWNER';

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Composer state
  const [showComposer, setShowComposer] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [noteMode, setNoteMode] = useState<'caption' | 'audio'>('caption');
  const [caption, setCaption] = useState('');
  const [recordedAudio, setRecordedAudio] = useState<RecordedAudio | null>(null);
  const [memoryDate, setMemoryDate] = useState<string>(new Date().toISOString());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<Memory | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setMemories(await fetchMemories(token));
      setError(null);
    } catch {
      setError('Could not load memories.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

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

  const handleSave = async () => {
    if (!token || !photoDataUrl) return;
    setSaving(true);
    try {
      // Upload the photo (and voice note, if recorded) to Supabase Storage, then persist the metadata.
      const photoBlob = await (await fetch(photoDataUrl)).blob();
      const photoUrl = await uploadToStorage(
        `memories/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
        photoBlob,
      );

      let audioUrl: string | null = null;
      if (noteMode === 'audio' && recordedAudio) {
        const extension = recordedAudio.mimeType.includes('mp4') ? 'm4a'
          : recordedAudio.mimeType.includes('aac') ? 'aac'
          : recordedAudio.mimeType.includes('ogg') ? 'ogg'
          : 'webm';
        audioUrl = await uploadToStorage(
          `memories/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`,
          recordedAudio.blob,
        );
      }

      await createMemory(token, {
        photoUrl,
        caption: noteMode === 'caption' ? (caption.trim() || null) : null,
        audioUrl,
        memoryDate: memoryDate.slice(0, 10),
      });

      setToast('Memory added.');
      closeComposer();
      await load();
    } catch {
      setToast('Could not save the memory. Check Firebase config.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <BrandHeader icon={imagesOutline} title="Memory Timeline" accent="plum" showBack />

      <IonContent className="ion-padding">
        {loading ? (
          <div className="centered"><IonSpinner /></div>
        ) : error ? (
          <IonText color="danger"><p>{error}</p></IonText>
        ) : memories.length === 0 ? (
          <IonText className="empty-state">
            <p>{isOwner ? 'No memories yet. Add the first one.' : 'No memories yet.'}</p>
          </IonText>
        ) : (
          <div className="memory-snake">
            {(() => {
              const groups = groupByMonth(memories);
              const order = indexTimeline(groups);
              return groups.map((group) => (
                <div key={group.label}>
                  <p className="month-label">{group.label}</p>
                  <div className="memory-snake__group">
                    {group.entries.map((memory) => (
                      <MemoryCard key={memory.id} memory={memory} index={order.get(memory.id) ?? 0} onOpen={setLightbox} />
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {isOwner && (
          <IonFab vertical="bottom" horizontal="end" slot="fixed">
            <IonFabButton color="tertiary" onClick={() => setShowComposer(true)} aria-label="Add a memory">
              <IonIcon icon={addOutline} />
            </IonFabButton>
          </IonFab>
        )}

        {/* Temporary: lets you compare the locked countdown screen against the real timeline before wiring the gate. */}
        <button type="button" className="lock-preview-link" onClick={() => history.push('/memories/lock-preview')}>
          Preview: locked countdown screen →
        </button>
      </IonContent>

      <IonModal isOpen={showComposer} onDidDismiss={closeComposer}>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={closeComposer} aria-label="Back">
                <IonIcon icon={chevronBackOutline} />
              </IonButton>
            </IonButtons>
            <IonTitle>Add a memory</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          {photoDataUrl ? (
            <div className="memory-preview">
              <IonImg src={photoDataUrl} className="memory-preview__img" />
              <IonButton fill="clear" onClick={() => setPhotoDataUrl(null)}>
                <IonIcon slot="start" icon={closeOutline} /> Remove
              </IonButton>
            </div>
          ) : (
            <div className="composer-photo-actions">
              <IonButton expand="block" color="tertiary" onClick={() => pickPhoto(CameraSource.Camera)}>
                <IonIcon slot="start" icon={cameraOutline} />
                Take a photo
              </IonButton>
              <IonButton expand="block" fill="outline" color="tertiary" onClick={() => pickPhoto(CameraSource.Photos)}>
                <IonIcon slot="start" icon={imagesOutline} />
                Choose from gallery
              </IonButton>
            </div>
          )}

          <IonSegment
            value={noteMode}
            onIonChange={(e) => setNoteMode((e.detail.value as 'caption' | 'audio') ?? 'caption')}
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
              placeholder="Add a caption…"
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
              onIonChange={(e) => setMemoryDate(String(e.detail.value ?? new Date().toISOString()))}
              presentation="date"
            />
          </div>

          <div className="composer-actions">
            <IonButton expand="block" color="tertiary" onClick={handleSave} disabled={saving || !photoDataUrl}>
              {saving ? 'Uploading…' : 'Save memory'}
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      {lightbox && createPortal(<PhotoLightbox memory={lightbox} onClose={() => setLightbox(null)} />, document.body)}

      <IonToast
        isOpen={!!toast}
        message={toast ?? ''}
        duration={2500}
        onDidDismiss={() => setToast(null)}
      />
    </IonPage>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import {
  IonButton,
  IonContent,
  IonDatetime,
  IonHeader,
  IonIcon,
  IonImg,
  IonItem,
  IonLabel,
  IonModal,
  IonPage,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { cameraOutline, closeOutline } from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import { uploadToStorage } from '../../shared/firebase/storage';
import { createMemory, fetchMemories, type Memory } from './memoriesApi';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function MemoryCard({ memory }: { memory: Memory }) {
  return (
    <div className="memory-card">
      <IonImg src={memory.photoUrl} alt={memory.caption ?? 'Memory'} className="memory-card__photo" />
      <div className="memory-card__body">
        <span className="memory-card__date">{formatDate(memory.memoryDate)}</span>
        {memory.caption && <p className="memory-card__caption">{memory.caption}</p>}
        {memory.audioUrl && (
          <audio controls src={memory.audioUrl} className="memory-card__audio" />
        )}
      </div>
    </div>
  );
}

export default function MemoriesPage() {
  const { token, user } = useAuth();
  const isOwner = user?.role === 'OWNER';

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Composer state
  const [showComposer, setShowComposer] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [memoryDate, setMemoryDate] = useState<string>(new Date().toISOString());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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

  const takePhoto = async () => {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        quality: 85,
      });
      setPhotoDataUrl(photo.dataUrl ?? null);
    } catch {
      // user cancelled
    }
  };

  const handleSave = async () => {
    if (!token || !photoDataUrl) return;
    setSaving(true);
    try {
      // Upload the photo directly to Firebase Storage, then persist metadata.
      const blob = await (await fetch(photoDataUrl)).blob();
      const photoUrl = await uploadToStorage(
        `memories/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
        blob,
      );

      await createMemory(token, {
        photoUrl,
        caption: caption.trim() || null,
        memoryDate: memoryDate.slice(0, 10),
      });

      setToast('Memory added.');
      setShowComposer(false);
      setPhotoDataUrl(null);
      setCaption('');
      await load();
    } catch {
      setToast('Could not save the memory. Check Firebase config.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Memories</IonTitle>
        </IonToolbar>
      </IonHeader>

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
          <div className="memory-feed">
            {memories.map((memory) => (
              <MemoryCard key={memory.id} memory={memory} />
            ))}
          </div>
        )}

        {isOwner && (
          <div className="composer-fab">
            <IonButton expand="block" onClick={() => setShowComposer(true)}>
              <IonIcon slot="start" icon={cameraOutline} />
              Add a memory
            </IonButton>
          </div>
        )}
      </IonContent>

      <IonModal isOpen={showComposer} onDidDismiss={() => setShowComposer(false)}>
        <IonHeader>
          <IonToolbar>
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
            <IonButton expand="block" onClick={takePhoto}>
              <IonIcon slot="start" icon={cameraOutline} />
              Take a photo
            </IonButton>
          )}

          <IonTextarea
            value={caption}
            onIonInput={(e) => setCaption(String(e.detail.value ?? ''))}
            placeholder="Add a caption…"
            autoGrow
            rows={3}
          />

          <IonItem lines="none">
            <IonLabel>When was this?</IonLabel>
          </IonItem>
          <IonDatetime
            value={memoryDate}
            onIonChange={(e) => setMemoryDate(String(e.detail.value ?? new Date().toISOString()))}
            presentation="date"
          />

          <div className="composer-actions">
            <IonButton onClick={handleSave} disabled={saving || !photoDataUrl}>
              {saving ? 'Uploading…' : 'Save memory'}
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

import { useCallback, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonIcon,
  IonInput,
  IonModal,
  IonPage,
  IonToast,
  useIonViewWillEnter,
} from '@ionic/react';
import { Redirect, useHistory } from 'react-router-dom';
import {
  addOutline,
  checkmarkCircle,
  chevronForwardOutline,
  closeOutline,
  listOutline,
  trashOutline,
} from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import BrandHeader from '../../shared/ui/BrandHeader';
import AppScreen from '../../shared/ui/AppScreen';
import ConfirmSheet from '../../shared/ui/ConfirmSheet';
import FeedbackState from '../../shared/ui/FeedbackState';
import {
  createProgramme,
  deleteProgramme,
  fetchProgrammes,
  updateProgramme,
  type Programme,
} from './gymApi';
import './gym.css';

/** Owner-only: every programme ever built, and which one she's currently on. */
export default function ProgrammesPage() {
  const { token, user } = useAuth();
  const history = useHistory();

  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Programme | null>(null);
  const [mutating, setMutating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token || user?.role !== 'OWNER') return;
    setLoading(true);
    try {
      setProgrammes(await fetchProgrammes(token));
      setLoaded(true);
      setError(null);
    } catch {
      setError('Could not load your programmes.');
    } finally {
      setLoading(false);
    }
  }, [token, user?.role]);

  useIonViewWillEnter(() => {
    void load();
  });

  const create = async () => {
    if (!token || saving || name.trim() === '') return;
    setSaving(true);
    try {
      const created = await createProgramme(token, {
        name: name.trim(),
        description: description.trim() || null,
      });
      setCreating(false);
      setName('');
      setDescription('');
      history.push(`/gym/programmes/${created.id}`);
    } catch {
      setToast('Could not create that programme.');
    } finally {
      setSaving(false);
    }
  };

  const activate = async (programme: Programme) => {
    if (!token || mutating) return;
    setMutating(true);
    try {
      await updateProgramme(token, programme.id, {
        name: programme.name,
        description: programme.description,
        active: true,
      });
      setToast(`“${programme.name}” is now the shared plan.`);
      await load();
    } catch {
      setToast('Could not switch the active programme.');
    } finally {
      setMutating(false);
    }
  };

  const remove = async (programme: Programme) => {
    if (!token || mutating) return;
    setMutating(true);
    try {
      await deleteProgramme(token, programme.id);
      setMutating(false);
      setDeleteTarget(null);
      setToast(`Deleted “${programme.name}”.`);
      await load();
    } catch {
      setToast('Could not delete that programme.');
    } finally {
      setMutating(false);
    }
  };

  if (user?.role !== 'OWNER') return <Redirect to="/gym" />;

  return (
    <IonPage>
      <BrandHeader icon={listOutline} title="Programmes" accent="gold" showBack backTo="/gym" />

      <AppScreen
        title="Your programmes."
        eyebrow="Gym Coach"
        subtitle="Build a routine that feels right."
      >
        {loading && !loaded && <FeedbackState kind="loading" heading="Finding your programmes…" />}
        {error && <FeedbackState kind="failure" heading={error} onRetry={load} />}
        {loaded && (
          <div className="programmes">
            <button type="button" className="primary-cta" onClick={() => setCreating(true)}>
              <IonIcon icon={addOutline} /> New programme
            </button>

            {programmes.length === 0 ? (
              <p className="empty-state">
                No programmes yet. Create one, then fill its days from your exercise library.
              </p>
            ) : (
              <div className="programme-list">
                {programmes.map((programme) => (
                  <div
                    key={programme.id}
                    className={`prog-card ${programme.active ? 'prog-card--active' : ''}`}
                  >
                    <button
                      type="button"
                      className="prog-card__main"
                      onClick={() => history.push(`/gym/programmes/${programme.id}`)}
                    >
                      <span className="prog-card__name font-display">{programme.name}</span>
                      <span className="prog-card__meta">
                        {programme.days.length} session{programme.days.length === 1 ? '' : 's'}
                        {programme.active && ' · active programme'}
                      </span>
                      <IonIcon icon={chevronForwardOutline} className="prog-card__chevron" />
                    </button>

                    <div className="prog-card__actions">
                      {programme.active ? (
                        <span className="prog-card__badge">
                          <IonIcon icon={checkmarkCircle} /> Active
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="prog-card__activate"
                          disabled={mutating}
                          onClick={() => activate(programme)}
                        >
                          Make active
                        </button>
                      )}
                      <button
                        type="button"
                        className="prog-card__delete"
                        aria-label={`Delete ${programme.name}`}
                        disabled={mutating}
                        onClick={() => setDeleteTarget(programme)}
                      >
                        <IonIcon icon={trashOutline} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </AppScreen>

      <IonModal isOpen={creating} onDidDismiss={() => setCreating(false)} canDismiss={!saving}>
        <div className="ex-form">
          <IonHeader className="ion-no-border">
            <IonToolbar>
              <div className="picker__head">
                <button
                  type="button"
                  className="picker__close"
                  onClick={() => setCreating(false)}
                  disabled={saving}
                  aria-label="Cancel"
                >
                  <IonIcon icon={closeOutline} />
                </button>
                <span className="picker__title font-display">New programme</span>
                <button
                  type="button"
                  className="picker__done"
                  disabled={name.trim() === '' || saving}
                  onClick={create}
                >
                  {saving ? 'Creating…' : 'Create'}
                </button>
              </div>
            </IonToolbar>
          </IonHeader>

          <IonContent>
            <div className="ex-form__body">
              <label className="field">
                <span className="field__label">Name</span>
                <IonInput
                  className="field__input"
                  aria-label="Programme name"
                  value={name}
                  placeholder="October — Glow up"
                  onIonInput={(e) => setName(String(e.detail.value ?? ''))}
                />
              </label>
              <label className="field">
                <span className="field__label">Description (optional)</span>
                <IonInput
                  className="field__input"
                  aria-label="Description (optional)"
                  value={description}
                  placeholder="Three easy sessions a week"
                  onIonInput={(e) => setDescription(String(e.detail.value ?? ''))}
                />
              </label>
            </div>
          </IonContent>
        </div>
      </IonModal>

      <ConfirmSheet
        open={!!deleteTarget}
        title="Delete this programme?"
        detail="Deleting the active programme promotes the newest remaining programme, if one exists. Its sessions will also be removed."
        confirmLabel="Delete programme"
        busy={mutating}
        onConfirm={() => {
          if (deleteTarget) void remove(deleteTarget);
        }}
        onClose={() => setDeleteTarget(null)}
      />
      <IonToast
        isOpen={!!toast}
        message={toast ?? ''}
        duration={2600}
        onDidDismiss={() => setToast(null)}
      />
    </IonPage>
  );
}

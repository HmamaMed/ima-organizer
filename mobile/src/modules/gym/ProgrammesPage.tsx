import { useCallback, useEffect, useState } from 'react';
import { IonContent, IonIcon, IonInput, IonModal, IonPage, IonSpinner, IonText, IonToast } from '@ionic/react';
import { useHistory } from 'react-router-dom';
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
  const { token } = useAuth();
  const history = useHistory();

  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setProgrammes(await fetchProgrammes(token));
      setError(null);
    } catch {
      setError('Could not load your programmes.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!token || name.trim() === '') return;
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
    if (!token) return;
    try {
      await updateProgramme(token, programme.id, {
        name: programme.name,
        description: programme.description,
        active: true,
      });
      setToast(`“${programme.name}” is now her plan.`);
      await load();
    } catch {
      setToast('Could not switch the active programme.');
    }
  };

  const remove = async (programme: Programme) => {
    if (!token) return;
    try {
      await deleteProgramme(token, programme.id);
      setToast(`Deleted “${programme.name}”.`);
      await load();
    } catch {
      setToast('Could not delete that programme.');
    }
  };

  return (
    <IonPage>
      <BrandHeader icon={listOutline} title="Programmes" accent="gold" showBack backTo="/gym" />

      <IonContent className="ion-padding">
        {loading ? (
          <div className="centered"><IonSpinner /></div>
        ) : error ? (
          <IonText color="danger"><p>{error}</p></IonText>
        ) : (
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
                  <div key={programme.id} className={`prog-card ${programme.active ? 'prog-card--active' : ''}`}>
                    <button
                      type="button"
                      className="prog-card__main"
                      onClick={() => history.push(`/gym/programmes/${programme.id}`)}
                    >
                      <span className="prog-card__name font-display">{programme.name}</span>
                      <span className="prog-card__meta">
                        {programme.days.length} session{programme.days.length === 1 ? '' : 's'}
                        {programme.active && ' · her plan right now'}
                      </span>
                      <IonIcon icon={chevronForwardOutline} className="prog-card__chevron" />
                    </button>

                    <div className="prog-card__actions">
                      {programme.active ? (
                        <span className="prog-card__badge">
                          <IonIcon icon={checkmarkCircle} /> Active
                        </span>
                      ) : (
                        <button type="button" className="prog-card__activate" onClick={() => activate(programme)}>
                          Make active
                        </button>
                      )}
                      <button
                        type="button"
                        className="prog-card__delete"
                        aria-label={`Delete ${programme.name}`}
                        onClick={() => remove(programme)}
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
      </IonContent>

      <IonModal isOpen={creating} onDidDismiss={() => setCreating(false)} initialBreakpoint={0.6} breakpoints={[0, 0.6, 1]}>
        <div className="ex-form">
          <div className="picker__head">
            <button type="button" className="picker__close" onClick={() => setCreating(false)} aria-label="Cancel">
              <IonIcon icon={closeOutline} />
            </button>
            <span className="picker__title font-display">New programme</span>
            <button type="button" className="picker__done" disabled={name.trim() === '' || saving} onClick={create}>
              {saving ? 'Creating…' : 'Create'}
            </button>
          </div>

          <div className="ex-form__body">
            <label className="field">
              <span className="field__label">Name</span>
              <IonInput
                className="field__input"
                value={name}
                placeholder="October — Glow up"
                onIonInput={(e) => setName(String(e.detail.value ?? ''))}
              />
            </label>
            <label className="field">
              <span className="field__label">Description (optional)</span>
              <IonInput
                className="field__input"
                value={description}
                placeholder="Three easy sessions a week"
                onIonInput={(e) => setDescription(String(e.detail.value ?? ''))}
              />
            </label>
          </div>
        </div>
      </IonModal>

      <IonToast isOpen={!!toast} message={toast ?? ''} duration={2600} onDidDismiss={() => setToast(null)} />
    </IonPage>
  );
}

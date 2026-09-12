import { useMemo, useState } from 'react';
import { IonButton, IonContent, IonIcon, IonPage, IonText, IonTextarea, IonToast } from '@ionic/react';
import { Redirect, useHistory } from 'react-router-dom';
import { closeOutline, paperPlaneOutline, calendarClearOutline } from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import { ApiError } from '../../shared/api/client';
import { createNote } from './notesApi';

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayIsoDate(): string {
  return toIsoDate(new Date());
}

function formatHour(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:00 ${period}`;
}

interface DateChip {
  iso: string;
  top: string;
  day: number;
}

/** The next few weeks as day chips — no month-grid calendar needed for near-term scheduling. */
function buildDateChips(count: number): DateChip[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const top = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString(undefined, { weekday: 'short' });
    return { iso: toIsoDate(d), top, day: d.getDate() };
  });
}

/** Combines a local date + hour into the UTC instant the backend stores. */
function buildScheduledInstant(dateStr: string, hour: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString();
}

export default function ComposeNotePage() {
  const { token, user } = useAuth();
  const history = useHistory();

  const [content, setContent] = useState('');
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [scheduleDate, setScheduleDate] = useState(todayIsoDate());
  const [scheduleHour, setScheduleHour] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const now = new Date();
  const dateChips = useMemo(() => buildDateChips(21), []);
  const hourOptions = useMemo(() => {
    const isToday = scheduleDate === todayIsoDate();
    const options = Array.from({ length: 24 }, (_, h) => h);
    return isToday ? options.filter((h) => h > now.getHours()) : options;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleDate]);

  if (user && user.role !== 'OWNER') {
    return <Redirect to="/notes" />;
  }

  const canSubmit = content.trim().length > 0 && (sendMode === 'now' || scheduleHour !== null);

  const handleSubmit = async () => {
    if (!token || !canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const scheduledFor = sendMode === 'schedule' ? buildScheduledInstant(scheduleDate, scheduleHour!) : null;
      await createNote(token, { content: content.trim(), scheduledFor });
      setToast(sendMode === 'now' ? 'Note sent.' : 'Note scheduled.');
      history.push('/notes');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Could not reach the server. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <div className="compose-header">
        <button className="icon-btn" onClick={() => history.push('/notes')} aria-label="Cancel">
          <IonIcon icon={closeOutline} />
        </button>
        <span className="compose-header__label">Write a note</span>
        <button
          className="compose-header__send"
          onClick={handleSubmit}
          disabled={saving || !canSubmit}
        >
          {saving ? 'Saving…' : 'Send'}
        </button>
      </div>

      <IonContent className="ion-padding">
        <div className="compose-body">
          <IonTextarea
            value={content}
            onIonInput={(e) => setContent(String(e.detail.value ?? ''))}
            placeholder="What do you want to say?"
            autoGrow
            rows={5}
            className="compose-body__textarea"
          />

          <div className="mode-toggle" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={sendMode === 'now'}
              className={`mode-toggle__btn ${sendMode === 'now' ? 'mode-toggle__btn--active' : ''}`}
              onClick={() => setSendMode('now')}
            >
              Send now
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={sendMode === 'schedule'}
              className={`mode-toggle__btn ${sendMode === 'schedule' ? 'mode-toggle__btn--active' : ''}`}
              onClick={() => setSendMode('schedule')}
            >
              Schedule
            </button>
          </div>

          {sendMode === 'schedule' && (
            <div className="schedule-picker">
              <div className="schedule-field">
                <span className="schedule-field__label">Date</span>
                <div className="chip-row">
                  {dateChips.map((c) => (
                    <button
                      key={c.iso}
                      type="button"
                      className={`chip ${scheduleDate === c.iso ? 'chip--active' : ''}`}
                      onClick={() => {
                        setScheduleDate(c.iso);
                        setScheduleHour(null);
                      }}
                    >
                      <span className="chip__top">{c.top}</span>
                      <span className="chip__day">{c.day}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="schedule-field">
                <span className="schedule-field__label">Time</span>
                <div className="chip-row">
                  {hourOptions.map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={`chip chip--hour ${scheduleHour === h ? 'chip--active' : ''}`}
                      onClick={() => setScheduleHour(h)}
                    >
                      {formatHour(h)}
                    </button>
                  ))}
                  {hourOptions.length === 0 && (
                    <span className="chip-row__empty">No hours left today</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <IonText color="danger" className="composer-error"><p>{error}</p></IonText>
          )}

          <IonButton
            expand="block"
            shape="round"
            className="composer-submit"
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
          >
            <IonIcon slot="start" icon={sendMode === 'now' ? paperPlaneOutline : calendarClearOutline} />
            {saving ? 'Saving…' : sendMode === 'now' ? 'Send' : 'Schedule note'}
          </IonButton>
        </div>
      </IonContent>

      <IonToast isOpen={!!toast} message={toast ?? ''} duration={2500} onDidDismiss={() => setToast(null)} />
    </IonPage>
  );
}

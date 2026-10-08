import { useCallback, useEffect, useState } from 'react';
import {
  IonFooter,
  IonPage,
  IonTextarea,
  useIonViewDidLeave,
  useIonViewWillEnter,
} from '@ionic/react';
import { Redirect, useHistory, useLocation } from 'react-router-dom';
import { chatbubbleEllipsesOutline, paperPlaneOutline, calendarClearOutline } from 'ionicons/icons';
import { useAuth } from '../../shared/auth/AuthContext';
import { ApiError } from '../../shared/api/client';
import BrandHeader from '../../shared/ui/BrandHeader';
import AppScreen from '../../shared/ui/AppScreen';
import AppButton from '../../shared/ui/AppButton';
import FeedbackState from '../../shared/ui/FeedbackState';
import useUnsavedChanges from '../../shared/navigation/useUnsavedChanges';
import { localDateKey } from '../../shared/utils/date';
import { createNote, fetchNotes } from './notesApi';

const NOTE_LIMIT = 4000;

function scheduledInstant(dateStr: string, hour: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString();
}

export default function ComposeNotePage() {
  const { token, user } = useAuth();
  const history = useHistory();
  const location = useLocation();
  const [content, setContent] = useState('');
  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now');
  const [scheduleDate, setScheduleDate] = useState(localDateKey());
  const [scheduleHour, setScheduleHour] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [occupied, setOccupied] = useState<Set<string>>(new Set());
  const [slotsError, setSlotsError] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const { allowNavigation, confirmation } = useUnsavedChanges(
    content.length > 0,
    saving,
    '/notes/compose',
  );

  const loadSlots = useCallback(async () => {
    if (!token) return;
    try {
      const notes = await fetchNotes(token);
      setOccupied(
        new Set(
          notes
            .filter((n) => n.status === 'SCHEDULED' && n.scheduledFor)
            .map((n) => new Date(n.scheduledFor!).toISOString()),
        ),
      );
      setSlotsError(false);
    } catch {
      setSlotsError(true);
    }
  }, [token]);
  useIonViewWillEnter(() => {
    setNow(new Date());
    void loadSlots();
  });
  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);
  useEffect(() => {
    if (location.pathname !== '/notes/compose') return;
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, [location.pathname]);

  useIonViewDidLeave(() => {
    setContent('');
    setSendMode('now');
    setScheduleHour(null);
    setError(null);
  });

  const dates = Array.from({ length: 21 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    return { date, iso: localDateKey(date) };
  });
  const hours = Array.from({ length: 24 }, (_, h) => h).filter(
    (hour) => Date.parse(scheduledInstant(scheduleDate, hour)) > now.getTime(),
  );
  const selectedInstant =
    scheduleHour === null ? null : scheduledInstant(scheduleDate, scheduleHour);
  const validSlot =
    !!selectedInstant &&
    dates.some((d) => d.iso === scheduleDate) &&
    Date.parse(selectedInstant) > now.getTime() &&
    !occupied.has(selectedInstant);
  const canSubmit =
    !!content.trim() && content.length <= NOTE_LIMIT && (sendMode === 'now' || validSlot);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (user?.role !== 'OWNER') return <Redirect to="/notes" />;

  const submit = async () => {
    if (!token || !canSubmit || saving) return;
    if (
      sendMode === 'schedule' &&
      (!selectedInstant || Date.parse(selectedInstant) <= Date.now())
    ) {
      setError('That hour has passed. Choose another moment.');
      setNow(new Date());
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createNote(token, {
        content: content.trim(),
        scheduledFor: sendMode === 'schedule' ? selectedInstant : null,
      });
      allowNavigation();
      setContent('');
      setScheduleHour(null);
      history.push('/notes', { feedback: sendMode === 'now' ? 'Note sent.' : 'Note scheduled.' });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not reach the server. Your note is still here.',
      );
      void loadSlots();
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonPage>
      <BrandHeader
        icon={chatbubbleEllipsesOutline}
        title="Notes"
        accent="rose"
        showBack
        backTo="/notes"
      />
      <AppScreen
        title="Write a little note."
        eyebrow="Notes"
        subtitle="A few words can make an ordinary day."
      >
        <div className="compose-body">
          <div>
            <span className="compose-field-label" id="note-label">
              Your note
            </span>
            <IonTextarea
              aria-labelledby="note-label"
              aria-describedby="note-count"
              value={content}
              onIonInput={(e) => setContent(String(e.detail.value ?? ''))}
              maxlength={NOTE_LIMIT}
              placeholder="What do you want to say?"
              autoGrow
              rows={7}
              className="compose-body__textarea"
              disabled={saving}
            />
            <p id="note-count" className="compose-count">
              {content.length.toLocaleString()} / 4,000
            </p>
          </div>
          <div className="mode-toggle" role="group" aria-label="When to send">
            <button
              type="button"
              className={`mode-toggle__btn ${sendMode === 'now' ? 'mode-toggle__btn--active' : ''}`}
              aria-pressed={sendMode === 'now'}
              disabled={saving}
              onClick={() => setSendMode('now')}
            >
              Send now
            </button>
            <button
              type="button"
              className={`mode-toggle__btn ${sendMode === 'schedule' ? 'mode-toggle__btn--active' : ''}`}
              aria-pressed={sendMode === 'schedule'}
              disabled={saving}
              onClick={() => setSendMode('schedule')}
            >
              Schedule
            </button>
          </div>
          {sendMode === 'schedule' ? (
            <div className="schedule-picker">
              <div className="schedule-field">
                <span className="schedule-field__label" id="schedule-date-label">
                  Choose a day · next 21 days
                </span>
                <div className="chip-row" role="group" aria-labelledby="schedule-date-label">
                  {dates.map(({ date, iso }, i) => (
                    <button
                      key={iso}
                      type="button"
                      className={`chip ${scheduleDate === iso ? 'chip--active' : ''}`}
                      aria-pressed={scheduleDate === iso}
                      aria-label={date.toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                      disabled={saving}
                      onClick={() => {
                        setScheduleDate(iso);
                        setScheduleHour(null);
                      }}
                    >
                      <span className="chip__top">
                        {i === 0
                          ? 'Today'
                          : date.toLocaleDateString(undefined, { weekday: 'short' })}
                      </span>
                      <span className="chip__day">{date.getDate()}</span>
                      <span className="chip__month">
                        {date.toLocaleDateString(undefined, { month: 'short' })}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="schedule-field">
                <span className="schedule-field__label" id="schedule-hour-label">
                  Choose an hour
                </span>
                <div className="schedule-hours" role="group" aria-labelledby="schedule-hour-label">
                  {hours.map((hour) => {
                    const taken = occupied.has(scheduledInstant(scheduleDate, hour));
                    const label = new Date(scheduledInstant(scheduleDate, hour)).toLocaleTimeString(
                      undefined,
                      {
                        hour: 'numeric',
                        minute: '2-digit',
                      },
                    );
                    return (
                      <button
                        key={hour}
                        type="button"
                        className={`chip ${scheduleHour === hour ? 'chip--active' : ''}`}
                        aria-pressed={scheduleHour === hour}
                        disabled={saving || taken}
                        title={taken ? 'Already scheduled at this hour' : undefined}
                        onClick={() => setScheduleHour(hour)}
                      >
                        {label}
                        {taken ? ' · Taken' : ''}
                      </button>
                    );
                  })}
                  {hours.length === 0 && (
                    <p className="compose-hint">No hours left today. Choose another day.</p>
                  )}
                </div>
              </div>
              {selectedInstant && (
                <p className="schedule-summary">
                  {new Date(selectedInstant).toLocaleString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  <br />
                  Local time · {timezone}
                </p>
              )}
              {slotsError && (
                <FeedbackState
                  kind="failure"
                  heading="Could not check occupied hours."
                  detail="Your choice will be checked when you save."
                  onRetry={loadSlots}
                />
              )}
              <p className="compose-hint">
                Delivery runs hourly. Scheduling saves your note for the chosen moment.
              </p>
            </div>
          ) : (
            <p className="compose-hint">Your note will appear in Notes as soon as it is saved.</p>
          )}
          {error && <FeedbackState kind="failure" heading={error} />}
        </div>
      </AppScreen>
      <IonFooter className="lo-action-footer">
        <AppButton
          busy={saving}
          disabled={!canSubmit}
          icon={sendMode === 'now' ? paperPlaneOutline : calendarClearOutline}
          onClick={submit}
        >
          {saving ? 'Saving…' : sendMode === 'now' ? 'Send note' : 'Schedule note'}
        </AppButton>
      </IonFooter>
      {confirmation}
    </IonPage>
  );
}

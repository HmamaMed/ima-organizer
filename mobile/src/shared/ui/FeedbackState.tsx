import { IonIcon, IonSpinner } from '@ionic/react';
import { alertCircleOutline, heartOutline } from 'ionicons/icons';
import AppButton from './AppButton';
import notesEmpty from '../../assets/empty-states/notes.svg';
import memoriesEmpty from '../../assets/empty-states/memories.svg';

const illustrations = { notes: notesEmpty, memories: memoriesEmpty };

export default function FeedbackState({
  kind,
  heading,
  detail,
  onRetry,
  retryLabel = 'Try again',
  illustration,
}: {
  kind: 'loading' | 'empty' | 'failure' | 'success';
  heading: string;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  illustration?: keyof typeof illustrations;
}) {
  return (
    <div className={`lo-feedback lo-feedback--${kind}`} role="status" aria-live="polite">
      {kind === 'empty' && illustration ? (
        <img className="lo-feedback__illustration" src={illustrations[illustration]} alt="" aria-hidden="true" />
      ) : kind === 'loading' ? (
        <IonSpinner aria-hidden="true" />
      ) : (
        <IonIcon icon={kind === 'failure' ? alertCircleOutline : heartOutline} aria-hidden="true" />
      )}
      <div>
        <p className="lo-feedback__heading">{heading}</p>
        {detail && <p>{detail}</p>}
      </div>
      {onRetry && (
        <AppButton variant="secondary" onClick={onRetry}>
          {retryLabel}
        </AppButton>
      )}
    </div>
  );
}

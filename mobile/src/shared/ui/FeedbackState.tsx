import { IonIcon, IonSpinner } from '@ionic/react';
import { alertCircleOutline, heartOutline } from 'ionicons/icons';
import AppButton from './AppButton';

export default function FeedbackState({
  kind,
  heading,
  detail,
  onRetry,
}: {
  kind: 'loading' | 'empty' | 'failure' | 'success';
  heading: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <div className={`lo-feedback lo-feedback--${kind}`} role="status" aria-live="polite">
      {kind === 'loading' ? (
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
          Try again
        </AppButton>
      )}
    </div>
  );
}

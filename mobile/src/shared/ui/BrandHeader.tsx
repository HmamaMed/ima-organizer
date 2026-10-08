import { IonHeader, IonIcon, IonToolbar } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { chevronBackOutline } from 'ionicons/icons';

export type Accent = 'rose' | 'gold' | 'plum' | 'muted';

interface BrandHeaderProps {
  icon: string;
  title: string;
  accent: Accent;
  /** Shows a back button — every module screen but Home itself. */
  showBack?: boolean;
  /** Where the back button goes; defaults to Home. Sub-pages point at their parent screen. */
  backTo?: string;
  onBack?: () => void;
}

/** Quiet chapter chrome; the screen owns its full wrapping heading. */
export default function BrandHeader({
  icon,
  title,
  accent,
  showBack,
  backTo = '/home',
  onBack,
}: BrandHeaderProps) {
  const history = useHistory();

  return (
    <IonHeader className="brand-header ion-no-border">
      <IonToolbar>
        <div className={`brand-header__inner brand-header__inner--${accent}`}>
          {showBack && (
            <button
              type="button"
              className="brand-header__back"
              onClick={onBack ?? (() => history.push(backTo, { direction: 'back' }))}
              aria-label="Back"
            >
              <IonIcon icon={chevronBackOutline} />
            </button>
          )}
          <IonIcon icon={icon} className="brand-header__icon" aria-hidden="true" />
          <span className="brand-header__title">{title}</span>
        </div>
      </IonToolbar>
    </IonHeader>
  );
}

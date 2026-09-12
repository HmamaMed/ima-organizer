import { IonHeader, IonIcon, IonToolbar } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { chevronBackOutline } from 'ionicons/icons';

export type Accent = 'rose' | 'gold' | 'plum' | 'muted';

interface BrandHeaderProps {
  icon: string;
  title: string;
  accent: Accent;
  /** Shows a back button that returns to Home — every module screen but Home itself. */
  showBack?: boolean;
}

/** Shared module header: an accent-colored icon + Fraunces title, per DESIGN.md. */
export default function BrandHeader({ icon, title, accent, showBack }: BrandHeaderProps) {
  const history = useHistory();

  return (
    <IonHeader className="brand-header">
      <IonToolbar>
        <div className={`brand-header__inner brand-header__inner--${accent}`}>
          {showBack && (
            <button
              type="button"
              className="brand-header__back"
              onClick={() => history.push('/home')}
              aria-label="Back to Home"
            >
              <IonIcon icon={chevronBackOutline} />
            </button>
          )}
          <IonIcon icon={icon} className="brand-header__icon" />
          <h1 className="brand-header__title font-display">{title}</h1>
        </div>
      </IonToolbar>
    </IonHeader>
  );
}

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
}

/** Shared module header: an accent-colored icon + Fraunces title, per DESIGN.md. */
export default function BrandHeader({ icon, title, accent, showBack, backTo = '/home' }: BrandHeaderProps) {
  const history = useHistory();

  return (
    <IonHeader className="brand-header">
      <IonToolbar>
        <div className={`brand-header__inner brand-header__inner--${accent}`}>
          {showBack && (
            <button
              type="button"
              className="brand-header__back"
              onClick={() => history.push(backTo)}
              aria-label="Back"
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

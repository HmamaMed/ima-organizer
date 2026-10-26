import { t, useI18n } from "../i18n";
import { IonHeader, IonIcon, IonToolbar } from '@ionic/react';
import { chevronBackOutline } from 'ionicons/icons';
import useAppBack from '../navigation/useAppBack';

export type Accent = 'rose' | 'gold' | 'plum' | 'muted';

interface BrandHeaderProps {
  icon: string;
  title: string;
  accent: Accent;
  /** Shows a back button — every module screen but Home itself. */
  showBack?: boolean;
  /** Where the back button goes; defaults to Home. Sub-pages point at their parent screen. */
  backTo?: string;
  backLabel?: string;
  onBack?: () => void;
}

/** Quiet chapter chrome; the screen owns its full wrapping heading. */
export default function BrandHeader({
  icon,
  title,
  accent,
  showBack,
  backTo,
  backLabel = t("Back"),
  onBack,
}: BrandHeaderProps) {
  useI18n();
  const goBack = useAppBack(backTo);

  return (
    <IonHeader className="brand-header ion-no-border">
      <IonToolbar>
        <div className={`brand-header__inner brand-header__inner--${accent}`}>
          {showBack && (
            <button
              type="button"
              className="brand-header__back"
              onClick={onBack ?? goBack}
              aria-label={backLabel}
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

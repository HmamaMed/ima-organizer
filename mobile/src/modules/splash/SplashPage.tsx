import BrandLogo from '../../shared/ui/BrandLogo';
import { useI18n } from '../../shared/i18n';
import './SplashPage.css';

export default function SplashPage() {
  const { t } = useI18n();
  return (
    <div className="splash-screen">
      <BrandLogo variant="white" className="splash-screen__logo" />
      <p className="splash-screen__tag">{t('Nos mots, nos moments, notre quotidien.')}</p>
    </div>
  );
}

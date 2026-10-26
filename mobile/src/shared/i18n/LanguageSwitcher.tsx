import { useI18n } from './index';
import { IonIcon } from '@ionic/react';
import { chevronDownOutline, globeOutline } from 'ionicons/icons';
import './language.css';

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useI18n();
  if (compact) return <label className="language-select">
    <IonIcon icon={globeOutline} aria-hidden="true" />
    <select aria-label={t('Langue de l’application')} value={language} onChange={event => setLanguage(event.target.value === 'en' ? 'en' : 'fr')}>
      <option lang="fr" value="fr">Français</option><option lang="en" value="en">English</option>
    </select>
    <IonIcon icon={chevronDownOutline} aria-hidden="true" />
  </label>;
  return <div className="language-switcher" role="group" aria-label={t('Langue de l’application')}>
    <button type="button" lang="fr" aria-pressed={language === 'fr'} onClick={() => setLanguage('fr')}><span aria-hidden="true">🇫🇷</span>Français</button>
    <button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}><span aria-hidden="true">🇬🇧</span>English</button>
  </div>;
}

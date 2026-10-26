import { useI18n } from './index';
import './language.css';

export default function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();
  return <div className="language-switcher" role="group" aria-label={t('Langue de l’application')}>
    <button type="button" lang="fr" aria-label="Français" title="Français" aria-pressed={language === 'fr'} onClick={() => setLanguage('fr')}><span aria-hidden="true">🇫🇷</span></button>
    <button type="button" lang="en" aria-label="English" title="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}><span aria-hidden="true">🇬🇧</span></button>
  </div>;
}

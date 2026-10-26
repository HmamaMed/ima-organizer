import { t, useI18n, getLanguage } from "../shared/i18n";
import { useState } from 'react';
import { IonApp, IonIcon, IonLabel, IonPage, IonRefresher, IonRefresherContent, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Link, Redirect, Route, useHistory, useLocation } from 'react-router-dom';
import { chevronForwardOutline, filmOutline, homeOutline, imagesOutline, mailOutline, notificationsOutline, personOutline, restaurantOutline, giftOutline, calendarOutline } from 'ionicons/icons';
import AppScreen from '../shared/ui/AppScreen';
import BrandLogo from '../shared/ui/BrandLogo';
import AppButton from '../shared/ui/AppButton';
import FeedbackState from '../shared/ui/FeedbackState';
import WatchlistPage from '../modules/watchlist/WatchlistPage';
import RecipesPage from '../modules/recipes/RecipesPage';
import BirthdaysPage from '../modules/birthdays/BirthdaysPage';
import NotificationsPage from '../modules/notifications/NotificationsPage';
import CouplesPushRegistration from './CouplesPushRegistration';
import WishesPage from '../modules/wishes/WishesPage';
import BackButtonHandler from '../shared/navigation/BackButtonHandler';
import { CouplesSession } from './CouplesSession';
import { useCouplesSession } from './sessionContext';
import CouplesAccessPage from './CouplesAccessPage';
import CouplesPrivacyPage from './CouplesPrivacyPage';
import CouplePairing from './CouplePairing';
import { rememberInvitation } from './invitation';
import CoupleNotesPage from './CoupleNotesPage';
import CoupleMemoriesPage from './CoupleMemoriesPage';
import CoupleAccountPage from './CoupleAccountPage';
import CoupleInboxPage from './CoupleInboxPage';
import './couples.css';

function Home() {
  useI18n();
  const { user, space, refreshState, error } = useCouplesSession();
  const shared = [
    { path: '/notes', title: t('Nos petits mots'), detail: t('Une pensée, une conversation.'), icon: mailOutline, accent: 'rose' },
    { path: '/memories', title: t('Nos moments'), detail: t('Les instants qu’on partage.'), icon: imagesOutline, accent: 'gold' },
    { path: '/watchlist', title: t('On regarde quoi ?'), detail: t('Notre prochaine soirée canapé.'), icon: filmOutline, accent: 'plum' },
    { path: '/recipes', title: t('Nos recettes'), detail: t('À cuisiner et à savourer.'), icon: restaurantOutline, accent: 'gold' },
    { path: '/wishes', title: t('Nos envies'), detail: t('Des idées pour se faire plaisir.'), icon: giftOutline, accent: 'rose' },
    { path: '/inbox', title: t('Pour vous'), detail: t('Ses dernières attentions.'), icon: notificationsOutline, accent: 'plum' },
  ];
  return <IonPage lang={getLanguage()}><AppScreen className="content-safe-top couple-home" fixedContent={<IonRefresher slot="fixed" onIonRefresh={event => { void refreshState().finally(() => event.detail.complete()); }}><IonRefresherContent /></IonRefresher>}>
    <div className="home-brand"><BrandLogo /></div>
    <header className="lo-screen__intro"><p className="lo-eyebrow">{space?.members.map(member => member.name).join(t(' et '))}</p><h1 className="lo-screen__title">{t("Bonjour") + " "}{user?.name ?? ''}.</h1><p className="lo-screen__subtitle">{t("Un espace privé pour vos petits mots, vos moments et vos projets.")}</p></header>
    <CouplePairing />
    {error && <FeedbackState kind="failure" heading={t(error)} onRetry={() => { void refreshState(); }} />}
    {space?.coupleId && <section aria-labelledby="home-shared"><h2 className="home-section-title" id="home-shared">{t('À partager')}</h2><div className="home-cards">{shared.map(item => <Link className={`home-card home-card--${item.accent}`} to={item.path} key={item.path}><span className="home-card__icon"><IonIcon icon={item.icon} aria-hidden="true" /></span><span><strong>{item.title}</strong><span className="home-card__detail">{item.detail}</span></span><IonIcon className="home-card__arrow" icon={chevronForwardOutline} aria-hidden="true" /></Link>)}</div></section>}
    <section className="home-personal" aria-labelledby="home-personal"><h2 className="home-section-title" id="home-personal">{t('Pour moi')}</h2><div className="home-personal__links"><Link to="/birthdays"><IonIcon icon={calendarOutline} aria-hidden="true" /><span>{t('Mes rappels d’anniversaire')}</span><IonIcon icon={chevronForwardOutline} aria-hidden="true" /></Link><Link to="/notifications"><IonIcon icon={notificationsOutline} aria-hidden="true" /><span>{t('Mes rappels personnels')}</span><IonIcon icon={chevronForwardOutline} aria-hidden="true" /></Link></div></section>
  </AppScreen></IonPage>;
}
function Routes() {
  useI18n();
  const history = useHistory();
  const { pathname } = useLocation();
  const { user, space, loading, error, refreshState } = useCouplesSession();
  const [link, setLink] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const invitation = params.get('invitation'); if (invitation) rememberInvitation(invitation);
    const action = window.location.pathname === '/verify' ? 'verify' : window.location.pathname === '/reset' ? 'reset' : null;
    const actionToken = params.get('token') ?? '';
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
    return { action, actionToken } as { action: 'verify' | 'reset' | null; actionToken: string };
  });
  const accountReady = !!user && (user.emailVerified || user.emailVerificationRequired === false);
  if (pathname === '/privacy' && (!accountReady || !space || link.action)) return <CouplesPrivacyPage />;
  if (!accountReady || link.action) return <CouplesAccessPage action={link.action} actionToken={link.actionToken} onActionDone={() => { setLink({ action: null, actionToken: '' }); history.replace('/home'); }} />;
  if (!space) return <IonPage><AppScreen><FeedbackState kind={error ? 'failure' : 'loading'} heading={error || t("On retrouve votre espace…")} onRetry={error ? () => { void refreshState(); } : undefined} />{!loading && !error && <AppButton onClick={() => { void refreshState(); }}>{t("Retrouver mon espace")}</AppButton>}</AppScreen></IonPage>;
  return <IonTabs key={space.coupleId ?? 'unpaired'}>
    <IonRouterOutlet>
    <Route exact path="/home"><Home /></Route>
    <Route exact path="/birthdays"><BirthdaysPage /></Route>
    <Route exact path="/notifications"><NotificationsPage /></Route>
    <Route exact path="/profile"><CoupleAccountPage /></Route>
    <Route exact path="/delete-account"><CoupleAccountPage /></Route>
    <Route exact path="/privacy"><CouplesPrivacyPage /></Route>
    <Route exact path="/notes">{space.coupleId ? <CoupleNotesPage /> : <Redirect to="/home" />}</Route>
    <Route exact path="/memories">{space.coupleId ? <CoupleMemoriesPage /> : <Redirect to="/home" />}</Route>
    <Route exact path="/watchlist">{space.coupleId ? <WatchlistPage /> : <Redirect to="/home" />}</Route>
    <Route exact path="/recipes">{space.coupleId ? <RecipesPage /> : <Redirect to="/home" />}</Route>
    <Route exact path="/wishes">{space.coupleId ? <WishesPage /> : <Redirect to="/home" />}</Route>
    <Route exact path="/inbox">{space.coupleId ? <CoupleInboxPage /> : <Redirect to="/home" />}</Route>
    <Route><Redirect to="/home" /></Route>
    </IonRouterOutlet>
    <IonTabBar slot="bottom" className="couple-tab-bar" aria-label={t("Navigation principale")}>
      <IonTabButton tab="home" href="/home"><IonIcon icon={homeOutline} aria-hidden="true" /><IonLabel>{t("Home")}</IonLabel></IonTabButton>
      <IonTabButton tab="profile" href="/profile"><IonIcon icon={personOutline} aria-hidden="true" /><IonLabel>{t("Profile")}</IonLabel></IonTabButton>
    </IonTabBar>
  </IonTabs>;
}
export default function CouplesRoot() {
  useI18n();
  return <IonApp><IonReactRouter><CouplesSession><BackButtonHandler /><CouplesPushRegistration /><Routes /></CouplesSession></IonReactRouter></IonApp>;
}

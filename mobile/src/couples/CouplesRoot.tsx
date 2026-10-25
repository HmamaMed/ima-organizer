import { useState } from 'react';
import { IonApp, IonIcon, IonLabel, IonPage, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Link, Redirect, Route, useLocation } from 'react-router-dom';
import { filmOutline, homeOutline, imagesOutline, mailOutline, notificationsOutline, personOutline, restaurantOutline, giftOutline, calendarOutline } from 'ionicons/icons';
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
  const { user, space, refreshState, loading, error } = useCouplesSession();
  return <IonPage lang="fr"><AppScreen className="content-safe-top">
    <div className="home-brand"><BrandLogo /></div>
    <header className="lo-screen__intro"><p className="lo-eyebrow">{space?.members.map(member => member.name).join(' et ')}</p><h1 className="lo-screen__title">Bonjour {user?.name ?? ''}.</h1><p className="lo-screen__subtitle">Un espace privé pour vos petits mots, vos moments et vos projets.</p></header>
    <CouplePairing />
    {space?.coupleId && <div className="couple-grid">{[{ path: '/notes', title: 'Nos petits mots', icon: mailOutline }, { path: '/memories', title: 'Nos moments', icon: imagesOutline }, { path: '/watchlist', title: 'On regarde quoi ?', icon: filmOutline }, { path: '/recipes', title: 'Nos recettes', icon: restaurantOutline }, { path: '/wishes', title: 'Nos envies', icon: giftOutline }, { path: '/inbox', title: 'Pour vous', icon: notificationsOutline }].map(item => <Link className="couple-link" to={item.path} key={item.path}><IonIcon icon={item.icon} aria-hidden="true" />{item.title}</Link>)}</div>}
    <div className="couple-grid"><Link className="couple-link" to="/birthdays"><IonIcon icon={calendarOutline} aria-hidden="true" />Mes rappels d’anniversaire</Link><Link className="couple-link" to="/notifications"><IonIcon icon={notificationsOutline} aria-hidden="true" />Mes rappels personnels</Link></div>
    {error && <p className="couple-error" role="alert">{error}</p>}<AppButton variant="quiet" busy={loading} onClick={() => { void refreshState(); }}>Actualiser notre espace</AppButton>
  </AppScreen></IonPage>;
}
function Routes() {
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
  if (!accountReady || link.action) return <CouplesAccessPage action={link.action} actionToken={link.actionToken} onActionDone={() => { setLink({ action: null, actionToken: '' }); window.history.replaceState(null, '', '/home'); }} />;
  if (!space) return <IonPage><AppScreen><FeedbackState kind={error ? 'failure' : 'loading'} heading={error || 'On retrouve votre espace…'} onRetry={error ? () => { void refreshState(); } : undefined} />{!loading && !error && <AppButton onClick={() => { void refreshState(); }}>Retrouver mon espace</AppButton>}</AppScreen></IonPage>;
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
    <IonTabBar slot="bottom" className="couple-tab-bar" aria-label="Navigation principale">
      <IonTabButton tab="home" href="/home"><IonIcon icon={homeOutline} aria-hidden="true" /><IonLabel>Home</IonLabel></IonTabButton>
      <IonTabButton tab="profile" href="/profile"><IonIcon icon={personOutline} aria-hidden="true" /><IonLabel>Profile</IonLabel></IonTabButton>
    </IonTabBar>
  </IonTabs>;
}
export default function CouplesRoot() {
  return <IonApp><IonReactRouter><CouplesSession><BackButtonHandler /><CouplesPushRegistration /><Routes /></CouplesSession></IonReactRouter></IonApp>;
}

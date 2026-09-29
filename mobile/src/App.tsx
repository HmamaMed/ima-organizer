import { useEffect, useState } from 'react';
import { IonApp, IonIcon, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import { homeOutline, personOutline } from 'ionicons/icons';
import { AuthProvider, useAuth } from './shared/auth/AuthContext';
import LoginPage from './shared/auth/LoginPage';
import SplashPage from './modules/splash/SplashPage';
import HomePage from './modules/home/HomePage';
import NotesPage from './modules/notes/NotesPage';
import ComposeNotePage from './modules/notes/ComposeNotePage';
import MemoriesPage from './modules/memories/MemoriesPage';
import BirthdayCountdownPage from './modules/memories/BirthdayCountdownPage';
import GymPage from './modules/gym/GymPage';
import SessionPage from './modules/gym/SessionPage';
import ExerciseLibraryPage from './modules/gym/ExerciseLibraryPage';
import ProgrammesPage from './modules/gym/ProgrammesPage';
import ProgrammeEditorPage from './modules/gym/ProgrammeEditorPage';
import ProgressPage from './modules/gym/ProgressPage';
import ProfilePage from './modules/profile/ProfilePage';
import ComingSoonPage from './modules/coming-soon/ComingSoonPage';
import BackButtonHandler from './shared/navigation/BackButtonHandler';
import './App.css';

const SPLASH_DURATION_MS = 900;

/** Home and Profile are the only permanent tabs; everything else is pushed on top. */
function AuthenticatedTabs() {
  return (
    <IonTabs>
      <BackButtonHandler />
      <IonRouterOutlet>
        <Route exact path="/home">
          <HomePage />
        </Route>
        <Route exact path="/notes">
          <NotesPage />
        </Route>
        <Route exact path="/notes/compose">
          <ComposeNotePage />
        </Route>
        <Route exact path="/memories">
          <MemoriesPage />
        </Route>
        {/* Temporary preview route — not wired as a real gate yet, see BirthdayCountdownPage.tsx */}
        <Route exact path="/memories/lock-preview">
          <BirthdayCountdownPage />
        </Route>
        <Route exact path="/gym">
          <GymPage />
        </Route>
        {/* Authoring routes are owner-only server-side; the UI just doesn't link them for her. */}
        <Route exact path="/gym/exercises">
          <ExerciseLibraryPage />
        </Route>
        <Route exact path="/gym/programmes">
          <ProgrammesPage />
        </Route>
        <Route exact path="/gym/programmes/:programmeId">
          <ProgrammeEditorPage />
        </Route>
        <Route exact path="/gym/progress">
          <ProgressPage />
        </Route>
        <Route exact path="/gym/day/:dayId">
          <SessionPage />
        </Route>
        <Route exact path="/profile">
          <ProfilePage />
        </Route>
        <Route exact path="/more">
          <ComingSoonPage />
        </Route>
        <Route exact path="/">
          <Redirect to="/home" />
        </Route>
        <Route>
          <Redirect to="/home" />
        </Route>
      </IonRouterOutlet>
      <IonTabBar slot="bottom">
        <IonTabButton tab="home" href="/home">
          <IonIcon icon={homeOutline} />
          Home
        </IonTabButton>
        <IonTabButton tab="profile" href="/profile">
          <IonIcon icon={personOutline} />
          Profile
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <IonRouterOutlet>
        <Route exact path="/login">
          <LoginPage />
        </Route>
        <Route exact path="/">
          <Redirect to="/login" />
        </Route>
        <Route>
          <Redirect to="/login" />
        </Route>
      </IonRouterOutlet>
    );
  }

  return <AuthenticatedTabs />;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <IonApp>
      {showSplash ? (
        <SplashPage />
      ) : (
        <AuthProvider>
          <IonReactRouter>
            <AppRoutes />
          </IonReactRouter>
        </AuthProvider>
      )}
    </IonApp>
  );
}

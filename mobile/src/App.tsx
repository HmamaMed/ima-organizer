import { IonApp, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, IonIcon, IonLabel } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import { chatbubbleEllipsesOutline, imagesOutline, barbellOutline, addCircleOutline } from 'ionicons/icons';
import { AuthProvider, useAuth } from './shared/auth/AuthContext';
import LoginPage from './shared/auth/LoginPage';
import NotesPage from './modules/notes/NotesPage';
import MemoriesPage from './modules/memories/MemoriesPage';
import GymPage from './modules/gym/GymPage';
import ComingSoonPage from './modules/coming-soon/ComingSoonPage';
import './App.css';

function AppTabs() {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/notes">
          <NotesPage />
        </Route>
        <Route exact path="/memories">
          <MemoriesPage />
        </Route>
        <Route exact path="/gym">
          <GymPage />
        </Route>
        <Route exact path="/more">
          <ComingSoonPage />
        </Route>
        <Route exact path="/">
          <Redirect to="/notes" />
        </Route>
      </IonRouterOutlet>

      <IonTabBar slot="bottom">
        <IonTabButton tab="notes" href="/notes">
          <IonIcon icon={chatbubbleEllipsesOutline} />
          <IonLabel>Notes</IonLabel>
        </IonTabButton>
        <IonTabButton tab="memories" href="/memories">
          <IonIcon icon={imagesOutline} />
          <IonLabel>Memories</IonLabel>
        </IonTabButton>
        <IonTabButton tab="gym" href="/gym">
          <IonIcon icon={barbellOutline} />
          <IonLabel>Gym</IonLabel>
        </IonTabButton>
        <IonTabButton tab="more" href="/more">
          <IonIcon icon={addCircleOutline} />
          <IonLabel>More</IonLabel>
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
      </IonRouterOutlet>
    );
  }

  return <AppTabs />;
}

export default function App() {
  return (
    <IonApp>
      <AuthProvider>
        <IonReactRouter>
          <AppRoutes />
        </IonReactRouter>
      </AuthProvider>
    </IonApp>
  );
}

# Kept — Implementation Guide (React + Ionic + Capacitor)

Companion doc to `app-design.html`. That file is the visual spec — colors, type, spacing, copy tone. This file is how to build it as a real, installable app on her phone.

## 1. Why this stack

- **Ionic React** gives you production-ready mobile UI primitives (tabs, modals, date pickers, gestures) without hand-rolling navigation transitions.
- **Capacitor** (Ionic's native runtime) wraps the web app into a real iOS/Android binary and exposes native device APIs — push notifications, camera, file storage, local scheduled notifications — as JS plugins.
- Since this is a single-recipient private app, you don't need App Store distribution: Capacitor apps can be sideloaded (Xcode → her phone, or Android APK) or shared via TestFlight/internal testing track

## 4. Navigation structure

Two-tier nav, matching the design file:

- **Tab bar** (`IonTabBar`, persists at the bottom): Home, Profile. These are the only permanent destinations — this is what makes it scale, since new modules don't need new tabs.
- **Stack push** (`IonRouterOutlet` inside Home's tab): tapping Memory Timeline or Gym Coach *pushes* a screen with a back-chevron header, rather than adding a tab. This is exactly what the mockup shows on those two screens.

```tsx
<IonTabs>
  <IonRouterOutlet>
    <Route exact path="/home" component={Home} />
    <Route exact path="/memory" component={MemoryTimeline} />   {/* pushed from Home */}
    <Route exact path="/gym" component={GymCoach} />            {/* pushed from Home */}
    <Route exact path="/notes" component={NotesFeed} />
    <Route exact path="/notes/compose" component={ComposeNote} />
    <Route exact path="/profile" component={Profile} />
  </IonRouterOutlet>
  <IonTabBar slot="bottom">
    <IonTabButton tab="home" href="/home">Home</IonTabButton>
    <IonTabButton tab="notes" href="/notes">Notes</IonTabButton>
    <IonTabButton tab="profile" href="/profile">Profile</IonTabButton>
  </IonTabBar>
</IonTabs>
```

Auth flow sits outside the tabs: `Splash → Login → Tabs`, guarded by a simple `isAuthenticated` check that redirects.

## 6. Design tokens → Ionic theme

Drop this into `src/theme/variables.css`, replacing Ionic's defaults:

```css
:root {
  --ion-color-primary: #4A1942;       /* Plum */
  --ion-color-secondary: #C65D7B;     /* Rose */
  --ion-color-tertiary: #B8935A;      /* Gold */
  --ion-background-color: #FBF4EE;    /* Paper */
  --ion-text-color: #2B1E24;          /* Ink */
  --mod-notes: #C65D7B;
  --mod-memory: #4A1942;
  --mod-gym: #B8935A;
  --mist: #F1E4E6;
  --font-serif: 'Fraunces', serif;    /* headlines, note text, greetings */
  --font-sans: 'Inter', sans-serif;   /* everything else */
}
```


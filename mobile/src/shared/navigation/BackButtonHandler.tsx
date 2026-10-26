import { t, useI18n } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IonToast } from '@ionic/react';
import { useLocation } from 'react-router-dom';
import { useCouplesSession } from '../../couples/sessionContext';
import useAppBack, { backDestination, type BackLocationState, type HardwareBackEvent } from './useAppBack';

const EXIT_PRESS_WINDOW_MS = 2000;
const NAVIGATION_DEBOUNCE_MS = 350;
function hasOverlay() {
  return Array.from(document.querySelectorAll<HTMLElement>('ion-modal, ion-alert, ion-action-sheet, ion-popover, ion-loading, ion-picker-legacy'))
    .some(overlay => !overlay.classList.contains('overlay-hidden') && overlay.getClientRects().length > 0);
}

/** Ionic owns overlay dismissal. One lower-priority handler owns screen parents and exit. */
export default function BackButtonHandler() {
  useI18n();
  const location = useLocation<BackLocationState>();
  const { user } = useCouplesSession();
  const accountReady = !!user && (user.emailVerified || user.emailVerificationRequired === false);
  const goBack = useAppBack(backDestination(location.pathname, location.state, accountReady));
  const current = useRef({ pathname: location.pathname, accountReady, goBack });
  current.current = { pathname: location.pathname, accountReady, goBack };
  const lastBackPress = useRef(0), lastNavigation = useRef(0);
  const [showExitToast, setShowExitToast] = useState(false);

  useEffect(() => { lastBackPress.current = 0; setShowExitToast(false); }, [location.key, accountReady]);
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    const resetExit = () => { lastBackPress.current = 0; setShowExitToast(false); };
    const handleBack = (event: Event) => {
      if (hasOverlay()) { lastBackPress.current = 0; setShowExitToast(false); }
      // Ionic overlays use priority 100 and menus 99; the router's generic handler uses 0.
      (event as HardwareBackEvent).detail.register(10, async () => {
        // Non-dismissible overlays must also prevent navigation underneath them.
        if (hasOverlay()) return;
        const now = Date.now();
        if (now - lastNavigation.current < NAVIGATION_DEBOUNCE_MS) return;
        const { pathname, accountReady, goBack } = current.current;
        const atAccessRoot = !accountReady && pathname !== '/privacy';
        if (pathname !== '/home' && !atAccessRoot) {
          lastNavigation.current = now; lastBackPress.current = 0; setShowExitToast(false);
          goBack();
          return;
        }
        if (lastBackPress.current && now - lastBackPress.current < EXIT_PRESS_WINDOW_MS) {
          lastBackPress.current = 0;
          await App.exitApp();
          return;
        }
        lastBackPress.current = now; setShowExitToast(true);
      });
    };
    document.addEventListener('ionBackButton', handleBack);
    document.addEventListener('pointerdown', resetExit, { passive: true });
    document.addEventListener('keydown', resetExit);
    // The Android plugin emits Ionic's document backbutton event only while a native listener exists.
    // Route exclusively through ionBackButton: processing this callback as well causes two back actions.
    const listener = App.addListener('backButton', () => {});
    return () => {
      document.removeEventListener('ionBackButton', handleBack);
      document.removeEventListener('pointerdown', resetExit);
      document.removeEventListener('keydown', resetExit);
      void listener.then(handle => handle.remove());
    };
  }, []);

  return <IonToast isOpen={showExitToast} message={t('Press back again to exit')} duration={EXIT_PRESS_WINDOW_MS} position="bottom" onDidDismiss={() => setShowExitToast(false)} />;
}

import { useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { IonToast } from '@ionic/react';
import { useHistory, useLocation } from 'react-router-dom';

const EXIT_PRESS_WINDOW_MS = 2000;

/** Tab roots — pressing back here doesn't navigate further, it arms the exit prompt. */
const ROOT_PATHS = new Set(['/home']);

/**
 * Wires the Android hardware back button to in-app navigation instead of the
 * OS default (which just closes the app from anywhere).
 * - Inside any section: goes back one step, or to Home if there's nothing
 *   left in history.
 * - On Home: first press shows a "press back again to exit" toast; a second
 *   press within the window actually exits the app.
 */
export default function BackButtonHandler() {
  const history = useHistory();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  const lastBackPressRef = useRef(0);
  const [showExitToast, setShowExitToast] = useState(false);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const listenerPromise = App.addListener('backButton', async ({ canGoBack }) => {
      // Close the top Ionic sheet/lightbox before navigating its underlying page.
      // dismiss respects canDismiss while a write is in progress.
      const modals = document.querySelectorAll<HTMLIonModalElement>('ion-modal.show-modal');
      const modal = modals[modals.length - 1];
      if (modal) {
        await modal.dismiss(undefined, 'backdrop');
        return;
      }
      const atRoot = ROOT_PATHS.has(pathnameRef.current);

      if (!atRoot) {
        if (canGoBack) {
          history.goBack();
        } else {
          history.replace('/home');
        }
        return;
      }

      const now = Date.now();
      if (now - lastBackPressRef.current < EXIT_PRESS_WINDOW_MS) {
        App.exitApp();
        return;
      }
      lastBackPressRef.current = now;
      setShowExitToast(true);
    });

    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [history]);

  return (
    <IonToast
      isOpen={showExitToast}
      message="Press back again to exit"
      duration={EXIT_PRESS_WINDOW_MS}
      position="bottom"
      onDidDismiss={() => setShowExitToast(false)}
    />
  );
}

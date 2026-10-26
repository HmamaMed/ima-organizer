import { useCallback, useRef } from 'react';
import { useIonRouter } from '@ionic/react';
import { useLocation } from 'react-router-dom';

export type HardwareBackEvent = CustomEvent<{ register: (priority: number, handler: () => void | Promise<void>) => void }>;
export interface BackLocationState { privacyReturnTo?: string; returnTo?: string }

/** Screen parents are explicit: tab switches and old login entries are not a back stack. */
export function backDestination(pathname: string, state?: BackLocationState, accountReady = true): string {
  if (pathname === '/privacy') {
    if (state?.privacyReturnTo === '/' || state?.privacyReturnTo === '/delete-account') return state.privacyReturnTo;
    return accountReady ? '/profile' : '/';
  }
  if (pathname === '/delete-account') return accountReady ? '/profile' : '/';
  if (pathname === '/birthdays' && state?.returnTo === '/notifications') return '/notifications';
  return '/home';
}

/** Pop the Ionic stack when its parent matches; replace with the parent for direct links. */
export default function useAppBack(destination?: string) {
  const router = useIonRouter();
  const location = useLocation<BackLocationState>();
  const target = destination ?? backDestination(location.pathname, location.state);
  const lastNavigation = useRef(0);
  return useCallback(() => {
    if (location.pathname === target) return;
    const now = Date.now();
    if (now - lastNavigation.current < 350) return;
    lastNavigation.current = now;
    if (router.canGoBack() && router.routeInfo.pushedByRoute === target) router.goBack();
    else router.push(target, 'back', 'pop');
  }, [router, location.pathname, target]);
}

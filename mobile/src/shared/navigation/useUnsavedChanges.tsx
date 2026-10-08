import { useEffect, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import type { Location } from 'history';
import ConfirmSheet from '../ui/ConfirmSheet';

/** Blocks route changes only while this editor is the active Ionic page. */
export default function useUnsavedChanges(dirty: boolean, busy: boolean, route: string) {
  const history = useHistory();
  const location = useLocation();
  const [destination, setDestination] = useState<Location | null>(null);
  const unblock = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (location.pathname !== route || (!dirty && !busy)) return;
    const release = history.block((next) => {
      if (next.pathname === route) return;
      if (!busy) setDestination(next);
      return false;
    });
    unblock.current = release;
    return () => {
      release();
      unblock.current = null;
    };
  }, [history, location.pathname, route, dirty, busy]);

  const allowNavigation = () => {
    unblock.current?.();
    unblock.current = null;
  };
  const confirmation = (
    <ConfirmSheet
      open={!!destination}
      title="Leave without saving?"
      detail="Your changes are still on this screen. Leaving will discard them."
      confirmLabel="Discard changes"
      onClose={() => setDestination(null)}
      onConfirm={() => {
        allowNavigation();
        if (destination) history.push(destination);
        setDestination(null);
      }}
    />
  );
  return { allowNavigation, confirmation };
}

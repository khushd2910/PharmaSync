import { useEffect, useRef } from 'react';
import { useToast } from '../context/ToastContext';

/**
 * Renders nothing — just listens for the browser's online/offline events
 * and surfaces a toast either way. Mounted once near the root (inside
 * ToastProvider) so every page benefits without wiring this up per-page.
 *
 * duration=0 tells ToastContext to skip its auto-dismiss timer, so the
 * "you're offline" toast stays up until connectivity actually returns
 * (or the person dismisses it) rather than disappearing on its own while
 * they're still offline.
 */
const NetworkStatusListener = () => {
  const { showToast } = useToast();
  const wasOffline = useRef(false);

  useEffect(() => {
    const handleOffline = () => {
      wasOffline.current = true;
      showToast("You're offline — some actions won't work until your connection is back.", 'error', 0);
    };
    const handleOnline = () => {
      if (wasOffline.current) {
        showToast('Back online', 'success');
        wasOffline.current = false;
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

export default NetworkStatusListener;

import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// React Router (a single-page app) never touches window scroll on its own —
// the browser just leaves it wherever it was on the old page. That's why
// clicking into a medicine you'd scrolled down to see landed you part-way
// down its details page, and going back to Home dropped you at the footer
// instead of the top: neither page's scroll position was ever reset.
//
// This component fixes both directions at once:
//  - A fresh navigation (clicking a link — "PUSH") starts the new page at
//    the top, like a normal multi-page site would.
//  - Back/forward navigation ("POP") restores the exact scroll offset the
//    page was at before you left it, so the Back button (and the browser's
//    own back button) really does return you to where you were.
const STORAGE_KEY = 'pharmacare-scroll-positions';

const readPositions = () => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
};

const writePositions = (positions) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // sessionStorage unavailable (private browsing, quota) — non-critical
  }
};

const ScrollManager = () => {
  const location = useLocation();
  const navigationType = useNavigationType(); // 'POP' | 'PUSH' | 'REPLACE'
  const positionsRef = useRef(readPositions());

  // Continuously record the scroll position under the CURRENT page's own
  // history key, so the position is already saved the instant the user
  // navigates away — no need to catch an "on before leave" event.
  useEffect(() => {
    const key = location.key;
    const handleScroll = () => {
      positionsRef.current[key] = window.scrollY;
      writePositions(positionsRef.current);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.key]);

  useEffect(() => {
    const key = location.key;

    if (navigationType !== 'POP') {
      window.scrollTo(0, 0);
      return;
    }

    const target = positionsRef.current[key];
    if (typeof target !== 'number') return;

    const restore = () => window.scrollTo(0, target);
    restore();

    // The page being returned to (Home, in particular) often fetches its
    // content AFTER this mounts — its medicine grid isn't there yet on the
    // first frame, so the page is still short and scrollTo clamps close to
    // the bottom of that short page instead of the saved offset. Once the
    // grid loads in and the page grows, the browser doesn't re-scroll for
    // us, so the user is left stranded near the bottom. Re-applying the
    // target scroll position every time the DOM changes (for a short
    // window after navigating back) lets it "catch up" once the async
    // content has actually rendered, without hard-coding which page fetches
    // what or how long it takes.
    const observer = new MutationObserver(restore);
    observer.observe(document.body, { childList: true, subtree: true });
    const stopTimer = setTimeout(() => observer.disconnect(), 1500);

    return () => {
      observer.disconnect();
      clearTimeout(stopTimer);
    };
  }, [location.key, navigationType]);

  return null;
};

export default ScrollManager;

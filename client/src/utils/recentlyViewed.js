// Recently viewed medicines — localStorage only (no backend record kept
// per view), capped at 10, most recent first, deduped by id.
//
// Scoped per user: every function takes a `scope` (the logged-in user's id,
// or 'guest' for anyone not logged in) and reads/writes a separate list per
// scope, so one person's browsing history never bleeds into another
// account's Home page on a shared device/browser.
const STORAGE_PREFIX = 'pharmacare-recently-viewed';
const MAX_ITEMS = 10;

const storageKey = (scope) => `${STORAGE_PREFIX}:${scope || 'guest'}`;

export const addRecentlyViewed = (medicine, scope) => {
  if (!medicine?._id) return;
  try {
    const existing = getRecentlyViewed(scope).filter((m) => m._id !== medicine._id);
    const updated = [medicine, ...existing].slice(0, MAX_ITEMS);
    localStorage.setItem(storageKey(scope), JSON.stringify(updated));
  } catch {
    // localStorage unavailable (private browsing, quota) — non-critical, skip silently
  }
};

export const getRecentlyViewed = (scope) => {
  try {
    const stored = localStorage.getItem(storageKey(scope));
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Replaces the whole list outright — used after validating the cached
// entries against the server (see Home.jsx), so anything that no longer
// exists gets dropped and the rest gets refreshed with current data
// (price/stock/etc.) in one go, instead of trusting the stale cache as-is.
export const setRecentlyViewed = (medicines, scope) => {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify((medicines || []).slice(0, MAX_ITEMS)));
  } catch {
    // non-critical, skip silently
  }
};

// Drops one entry from the cache — used when a "recently viewed" medicine
// turns out to no longer exist (deleted, or the catalog was reseeded with
// new ids), so the same dead link doesn't keep showing up and confusing
// the user every time they visit Home.
export const removeRecentlyViewed = (id, scope) => {
  if (!id) return;
  try {
    const updated = getRecentlyViewed(scope).filter((m) => m._id !== id);
    localStorage.setItem(storageKey(scope), JSON.stringify(updated));
  } catch {
    // non-critical, skip silently
  }
};

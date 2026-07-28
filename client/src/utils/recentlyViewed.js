// Recently viewed medicines — localStorage only (no backend change
// needed), capped at 10, most recent first, deduped by id.
const STORAGE_KEY = 'pharmacare-recently-viewed';
const MAX_ITEMS = 10;

export const addRecentlyViewed = (medicine) => {
  if (!medicine?._id) return;
  try {
    const existing = getRecentlyViewed().filter((m) => m._id !== medicine._id);
    const updated = [medicine, ...existing].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable (private browsing, quota) — non-critical, skip silently
  }
};

export const getRecentlyViewed = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Drops one entry from the cache — used when a "recently viewed" medicine
// turns out to no longer exist (deleted, or the catalog was reseeded with
// new ids), so the same dead link doesn't keep showing up and confusing
// the user every time they visit Home.
export const removeRecentlyViewed = (id) => {
  if (!id) return;
  try {
    const updated = getRecentlyViewed().filter((m) => m._id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // non-critical, skip silently
  }
};

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

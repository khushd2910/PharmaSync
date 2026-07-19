// Shared thresholds for stock/expiry "attention needed" logic — used by
// both the dashboard counters and the medicine list's alert filters/badges,
// so they can never silently drift apart.
module.exports = {
  LOW_STOCK_THRESHOLD: 10,
  EXPIRY_WINDOW_DAYS: 30,
};

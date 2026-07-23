// Shared thresholds for stock/expiry "attention needed" logic — used by
// both the dashboard counters and the medicine list's alert filters/badges,
// so they can never silently drift apart *within Node*.
//
// LOW_STOCK_THRESHOLD is also read independently by
// python-service/analytics/inventory_analysis.py (its own env var, since
// Python can't import this file) — if you change the value here, change
// LOW_STOCK_THRESHOLD in python-service/.env to match, or the Python-side
// "low stock" analysis will disagree with what this API and the frontend
// show. Reading from env here (rather than a bare literal) at least makes
// this one, explicit knob instead of a hardcoded number with no indication
// it needs to stay in sync with anything.
module.exports = {
  LOW_STOCK_THRESHOLD: Number.isFinite(Number(process.env.LOW_STOCK_THRESHOLD))
    ? Number(process.env.LOW_STOCK_THRESHOLD)
    : 10,
  EXPIRY_WINDOW_DAYS: Number.isFinite(Number(process.env.EXPIRY_WINDOW_DAYS))
    ? Number(process.env.EXPIRY_WINDOW_DAYS)
    : 30,
};

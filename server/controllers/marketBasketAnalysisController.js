/**
 * Market Basket Analysis (Apriori / association rules), served by Django +
 * pandas + mlxtend — same split as sales/inventory/expiry analysis and the
 * demand/revenue forecasts (see salesAnalysisController.js). Node's job
 * here is thin: keep the existing admin-only auth check in place (protect
 * + adminOnly in adminRoutes.js — this Django service has no auth/session
 * system of its own and was never meant to be reachable directly from a
 * browser) and forward the request over HTTP to the Django analytics app,
 * which does the actual MongoDB + pandas + mlxtend work. See
 * python-service/analytics/market_basket_analysis.py and
 * python-service/analytics/views.py for that side.
 */

const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || process.env.DJANGO_API_URL || 'http://localhost:8000';
// Mining association rules over a year of baskets can take a moment
// longer than a plain DB read — same reasoning as the sales-analysis
// "Run Analysis Now" timeout.
const FETCH_TIMEOUT_MS = 15000;

const forwardToDjango = (path, { method = 'GET' } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(`${ANALYTICS_API_URL.replace(/\/$/, '')}${path}`, { method, signal: controller.signal }).finally(() =>
    clearTimeout(timeout)
  );
};

// @desc    Latest market basket analysis snapshot — top association rules
//          (antecedent -> consequent, with support/confidence/lift) and
//          top item pairs by support. Computed and stored by the Django
//          analytics service; this just proxies the read.
// @route   GET /api/admin/market-basket-analysis
// @access  Private (admin)
const getMarketBasketAnalysis = catchAsync(async (req, res, next) => {
  let upstream;
  try {
    upstream = await forwardToDjango('/api/market-basket-analysis');
  } catch (err) {
    return next(new AppError('Market basket analysis service is temporarily unavailable', 502));
  }
  if (!upstream.ok) {
    return next(new AppError('Market basket analysis service is temporarily unavailable', 502));
  }

  const data = await upstream.json();
  return res.status(200).json(data);
});

// @desc    Run the market basket analysis job right now instead of waiting
//          for its nightly schedule.
// @route   POST /api/admin/market-basket-analysis/run
// @access  Private (admin)
const runMarketBasketAnalysis = catchAsync(async (req, res, next) => {
  let upstream;
  try {
    upstream = await forwardToDjango('/api/market-basket-analysis/run', { method: 'POST' });
  } catch (err) {
    return next(new AppError('Market basket analysis service is temporarily unavailable', 502));
  }
  if (!upstream.ok) {
    return next(new AppError('Could not run market basket analysis', 502));
  }

  const data = await upstream.json();
  return res.status(200).json(data);
});

module.exports = { getMarketBasketAnalysis, runMarketBasketAnalysis };

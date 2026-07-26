/**
 * Module 6 — Expiry Analysis, now served by Django + pandas instead of
 * Node spawning `python3 analytics/expiry_analysis.py` as a subprocess per
 * request.
 *
 * Node's job here is thin, the same split already used for Modules 4, 5,
 * 8, and 9 (see inventoryAnalysisController.js, salesAnalysisController.js,
 * utils/fetchDrugInfo.js, chatController.js): keep the existing admin-only
 * auth check in place (protect + restrictTo('admin') in adminRoutes.js —
 * this Django service has no auth/session system of its own and was never
 * meant to be reachable directly from a browser) and forward the request
 * over HTTP to the Django analytics app, which does the actual MongoDB +
 * pandas work. See python-service/analytics/views.py for that side.
 */

const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || process.env.DJANGO_API_URL || 'http://localhost:8000';
const FETCH_TIMEOUT_MS = 15000;

const forwardToDjango = (path, { method = 'GET' } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(`${ANALYTICS_API_URL.replace(/\/$/, '')}${path}`, { method, signal: controller.signal }).finally(() =>
    clearTimeout(timeout)
  );
};

// @desc    Latest expiry analysis snapshot — medicines already expired,
//          plus buckets expiring within 30/60/90 days, and the urgent
//          alertCount that drives the dashboard notification. Computed and
//          stored by the Django analytics service
//          (python-service/analytics); this just proxies the read.
// @route   GET /api/admin/expiry-analysis
// @access  Private (admin)
const getExpiryAnalysis = catchAsync(async (req, res, next) => {
  let upstream;
  try {
    upstream = await forwardToDjango('/api/expiry-analysis');
  } catch (err) {
    return next(new AppError('Expiry analysis service is temporarily unavailable', 502));
  }
  if (!upstream.ok) {
    return next(new AppError('Expiry analysis service is temporarily unavailable', 502));
  }

  const data = await upstream.json();
  return res.status(200).json(data);
});

// @desc    Run the expiry analysis job right now instead of waiting for its
//          nightly schedule.
// @route   POST /api/admin/expiry-analysis/run
// @access  Private (admin)
const runExpiryAnalysis = catchAsync(async (req, res, next) => {
  let upstream;
  try {
    upstream = await forwardToDjango('/api/expiry-analysis/run', { method: 'POST' });
  } catch (err) {
    return next(new AppError('Expiry analysis service is temporarily unavailable', 502));
  }
  if (!upstream.ok) {
    return next(new AppError('Could not run expiry analysis', 502));
  }

  const data = await upstream.json();
  return res.status(200).json(data);
});

module.exports = { getExpiryAnalysis, runExpiryAnalysis };

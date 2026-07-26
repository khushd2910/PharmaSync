/**
 * Module 4 — Inventory Analysis, now served by Django + pandas instead of
 * Node spawning `python3 analytics/inventory_analysis.py` as a subprocess
 * per request.
 *
 * Node's job here is thin, the same split already used for Modules 5, 8,
 * and 9 (see salesAnalysisController.js, utils/fetchDrugInfo.js,
 * chatController.js): keep the existing admin-only auth check in place
 * (protect + restrictTo('admin') in adminRoutes.js — this Django service
 * has no auth/session system of its own and was never meant to be
 * reachable directly from a browser) and forward the request over HTTP to
 * the Django analytics app, which does the actual MongoDB + pandas work.
 * See python-service/analytics/views.py for that side.
 */

const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || process.env.DJANGO_API_URL || 'http://localhost:8000';
const FETCH_TIMEOUT_MS = 15000; // pandas over the whole catalog + a lookback window can take a moment longer than a plain DB read

const forwardToDjango = (path, { method = 'GET' } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(`${ANALYTICS_API_URL.replace(/\/$/, '')}${path}`, { method, signal: controller.signal }).finally(() =>
    clearTimeout(timeout)
  );
};

// @desc    Latest inventory analysis snapshot — Total Stock, Low Stock,
//          Fast Selling, Slow Selling. Computed and stored by the Django
//          analytics service (python-service/analytics); this just proxies
//          the read.
// @route   GET /api/admin/inventory-analysis
// @access  Private (admin)
const getInventoryAnalysis = catchAsync(async (req, res, next) => {
  let upstream;
  try {
    upstream = await forwardToDjango('/api/inventory-analysis');
  } catch (err) {
    // Network error, timeout, or the Django service isn't running —
    // report it plainly rather than letting the dashboard hang.
    return next(new AppError('Inventory analysis service is temporarily unavailable', 502));
  }
  if (!upstream.ok) {
    return next(new AppError('Inventory analysis service is temporarily unavailable', 502));
  }

  const data = await upstream.json();
  return res.status(200).json(data);
});

// @desc    Run the inventory analysis job right now instead of waiting for
//          its nightly schedule — useful for demos and for seeing the
//          effect of a stock change immediately.
// @route   POST /api/admin/inventory-analysis/run
// @access  Private (admin)
const runInventoryAnalysis = catchAsync(async (req, res, next) => {
  let upstream;
  try {
    upstream = await forwardToDjango('/api/inventory-analysis/run', { method: 'POST' });
  } catch (err) {
    return next(new AppError('Inventory analysis service is temporarily unavailable', 502));
  }
  if (!upstream.ok) {
    return next(new AppError('Could not run inventory analysis', 502));
  }

  const data = await upstream.json();
  return res.status(200).json(data);
});

module.exports = { getInventoryAnalysis, runInventoryAnalysis };

/**
 * Module 4 — Inventory Analysis. Computing a fresh snapshot ("Run
 * Analysis Now") genuinely needs pandas, so that still goes through
 * Django + python-service/analytics. Reading the *latest already-computed*
 * snapshot doesn't — it's the same plain "find the newest doc in this
 * collection" query Django was doing, against a database Node already has
 * a live connection to (see utils/readLatestAnalysis.js) — so that read no
 * longer depends on python-service being up. Every write into that
 * collection still comes from the Python side (the nightly cron job and
 * the /run endpoint below); Node only ever reads it here.
 */

const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const readLatestAnalysis = require('../utils/readLatestAnalysis');
const djangoAuthHeaders = require('../utils/djangoAuthHeaders');

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || process.env.DJANGO_API_URL || 'http://localhost:8000';
const FETCH_TIMEOUT_MS = 30000; // pandas over the whole catalog + a lookback window (and, for the deep analysis, training KMeans/Isolation Forest) can take a moment longer than a plain DB read

const forwardToDjango = (path, { method = 'GET' } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(`${ANALYTICS_API_URL.replace(/\/$/, '')}${path}`, {
    method,
    signal: controller.signal,
    headers: djangoAuthHeaders(),
  }).finally(() => clearTimeout(timeout));
};

// @desc    Latest inventory analysis snapshot — Total Stock, Low Stock,
//          Fast Selling, Slow Selling. Computed by the Django analytics
//          service; read here straight from MongoDB.
// @route   GET /api/admin/inventory-analysis
// @access  Private (admin)
const getInventoryAnalysis = catchAsync(async (req, res) => {
  const analysis = await readLatestAnalysis('inventory_analysis');
  return res.status(200).json({ analysis });
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

// @desc    Latest deep inventory analysis snapshot — ABC/Pareto
//          classification, reorder point/safety stock/EOQ, KMeans
//          behavioural segments, Isolation Forest anomalies. Computed by
//          the Django analytics service; read here straight from MongoDB.
//          See python-service/analytics/inventory_deep_analysis.py.
// @route   GET /api/admin/inventory-analysis/deep
// @access  Private (admin)
const getDeepInventoryAnalysis = catchAsync(async (req, res) => {
  const analysis = await readLatestAnalysis('inventory_deep_analysis');
  return res.status(200).json({ analysis });
});

// @desc    Train fresh KMeans/Isolation Forest models and compute a new
//          deep inventory analysis snapshot right now.
// @route   POST /api/admin/inventory-analysis/deep/run
// @access  Private (admin)
const runDeepInventoryAnalysis = catchAsync(async (req, res, next) => {
  let upstream;
  try {
    upstream = await forwardToDjango('/api/inventory-analysis/deep/run', { method: 'POST' });
  } catch (err) {
    return next(new AppError('Inventory analysis service is temporarily unavailable', 502));
  }
  if (!upstream.ok) {
    return next(new AppError('Could not run deep inventory analysis', 502));
  }

  const data = await upstream.json();
  return res.status(200).json(data);
});

module.exports = {
  getInventoryAnalysis,
  runInventoryAnalysis,
  getDeepInventoryAnalysis,
  runDeepInventoryAnalysis,
};

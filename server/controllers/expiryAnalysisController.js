/**
 * Module 6 — Expiry Analysis. Computing a fresh snapshot ("Run Analysis
 * Now") genuinely needs pandas, so that still goes through Django +
 * python-service/analytics. Reading the *latest already-computed* snapshot
 * doesn't — it's the same plain "find the newest doc in this collection"
 * query Django was doing, against a database Node already has a live
 * connection to (see utils/readLatestAnalysis.js) — so that read no
 * longer depends on python-service being up. Every write into that
 * collection still comes from the Python side (the nightly cron job and
 * the /run endpoint below); Node only ever reads it here.
 */

const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const readLatestAnalysis = require('../utils/readLatestAnalysis');
const djangoAuthHeaders = require('../utils/djangoAuthHeaders');

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || process.env.DJANGO_API_URL || 'http://localhost:8000';
const FETCH_TIMEOUT_MS = 15000;

const forwardToDjango = (path, { method = 'GET' } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(`${ANALYTICS_API_URL.replace(/\/$/, '')}${path}`, {
    method,
    signal: controller.signal,
    headers: djangoAuthHeaders(),
  }).finally(() => clearTimeout(timeout));
};

// @desc    Latest expiry analysis snapshot — medicines already expired,
//          plus buckets expiring within 30/60/90 days, and the urgent
//          alertCount that drives the dashboard notification. Computed by
//          the Django analytics service; read here straight from MongoDB.
// @route   GET /api/admin/expiry-analysis
// @access  Private (admin)
const getExpiryAnalysis = catchAsync(async (req, res) => {
  const analysis = await readLatestAnalysis('expiry_analysis');
  return res.status(200).json({ analysis });
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

/**
 * Module 5 — Sales Analysis, now served by Django + pandas instead of Node
 * spawning `python3 analytics/sales_analysis.py` as a subprocess per
 * request.
 *
 * Node's job here is thin, the same split already used for Module 8
 * (medicine_api, see utils/fetchDrugInfo.js) and Module 9 (chatbot, see
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
// Running a year of orders/POS sales through pandas on "Run Analysis Now"
// can take a moment longer than a plain DB read — same reasoning as
// chatController's Gemini timeout, just for a different slow step.
const FETCH_TIMEOUT_MS = 15000;

const forwardToDjango = (path, { method = 'GET' } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(`${ANALYTICS_API_URL.replace(/\/$/, '')}${path}`, { method, signal: controller.signal }).finally(() =>
    clearTimeout(timeout)
  );
};

// @desc    Latest sales analysis snapshot — Daily/Weekly/Monthly Sales,
//          Revenue, Best/Worst Sellers. Computed and stored by the Django
//          analytics service (python-service/analytics); this just proxies
//          the read.
// @route   GET /api/admin/sales-analysis
// @access  Private (admin)
const getSalesAnalysis = catchAsync(async (req, res, next) => {
  let upstream;
  try {
    upstream = await forwardToDjango('/api/sales-analysis');
  } catch (err) {
    // Network error, timeout, or the Django service isn't running —
    // report it plainly rather than letting the dashboard hang.
    return next(new AppError('Sales analysis service is temporarily unavailable', 502));
  }
  if (!upstream.ok) {
    return next(new AppError('Sales analysis service is temporarily unavailable', 502));
  }

  const data = await upstream.json();
  return res.status(200).json(data);
});

// @desc    Run the sales analysis job right now instead of waiting for its
//          nightly schedule.
// @route   POST /api/admin/sales-analysis/run
// @access  Private (admin)
const runSalesAnalysis = catchAsync(async (req, res, next) => {
  let upstream;
  try {
    upstream = await forwardToDjango('/api/sales-analysis/run', { method: 'POST' });
  } catch (err) {
    return next(new AppError('Sales analysis service is temporarily unavailable', 502));
  }
  if (!upstream.ok) {
    return next(new AppError('Could not run sales analysis', 502));
  }

  const data = await upstream.json();
  return res.status(200).json(data);
});

// @desc    Latest demand forecast snapshot.
// @route   GET /api/admin/demand-forecast
// @access  Private (admin)
const getDemandForecast = catchAsync(async (req, res, next) => {
  let upstream;
  try {
    upstream = await forwardToDjango('/api/demand-forecast');
  } catch (err) {
    return next(new AppError('Demand forecasting service is temporarily unavailable', 502));
  }
  if (!upstream.ok) {
    return next(new AppError('Demand forecasting service is temporarily unavailable', 502));
  }

  const data = await upstream.json();
  return res.status(200).json(data);
});

// @desc    Run the demand forecast job right now.
// @route   POST /api/admin/demand-forecast/run
// @access  Private (admin)
const runDemandForecast = catchAsync(async (req, res, next) => {
  let upstream;
  try {
    upstream = await forwardToDjango('/api/demand-forecast/run', { method: 'POST' });
  } catch (err) {
    return next(new AppError('Demand forecasting service is temporarily unavailable', 502));
  }
  if (!upstream.ok) {
    return next(new AppError('Could not generate demand forecast', 502));
  }

  const data = await upstream.json();
  return res.status(200).json(data);
});

// @desc    Latest revenue forecast snapshot.
// @route   GET /api/admin/revenue-forecast
// @access  Private (admin)
const getRevenueForecast = catchAsync(async (req, res, next) => {
  let upstream;
  try {
    upstream = await forwardToDjango('/api/revenue-forecast');
  } catch (err) {
    return next(new AppError('Revenue forecasting service is temporarily unavailable', 502));
  }
  if (!upstream.ok) {
    return next(new AppError('Revenue forecasting service is temporarily unavailable', 502));
  }

  const data = await upstream.json();
  return res.status(200).json(data);
});

// @desc    Run the revenue forecast job right now.
// @route   POST /api/admin/revenue-forecast/run
// @access  Private (admin)
const runRevenueForecast = catchAsync(async (req, res, next) => {
  let upstream;
  try {
    upstream = await forwardToDjango('/api/revenue-forecast/run', { method: 'POST' });
  } catch (err) {
    return next(new AppError('Revenue forecasting service is temporarily unavailable', 502));
  }
  if (!upstream.ok) {
    return next(new AppError('Could not generate revenue forecast', 502));
  }

  const data = await upstream.json();
  return res.status(200).json(data);
});

module.exports = { 
  getSalesAnalysis, 
  runSalesAnalysis, 
  getDemandForecast, 
  runDemandForecast,
  getRevenueForecast,
  runRevenueForecast
};



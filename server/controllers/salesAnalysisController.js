/**
 * Module 5 — Sales Analysis / Demand Forecast / Revenue Forecast.
 * Computing a fresh snapshot ("Run Analysis Now") genuinely needs pandas
 * (and, for the forecasts, a trained model), so that still goes through
 * Django + python-service/analytics. Reading the *latest already-computed*
 * snapshot doesn't — it's the same plain "find the newest doc in this
 * collection" query Django was doing, against a database Node already has
 * a live connection to (see utils/readLatestAnalysis.js) — so those reads
 * no longer depend on python-service being up. Every write into these
 * collections still comes from the Python side (the nightly cron jobs and
 * the /run endpoints below); Node only ever reads them here.
 */

const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const readLatestAnalysis = require('../utils/readLatestAnalysis');
const djangoAuthHeaders = require('../utils/djangoAuthHeaders');

const ANALYTICS_API_URL = process.env.ANALYTICS_API_URL || process.env.DJANGO_API_URL || 'http://localhost:8000';
// Running a year of orders/POS sales through pandas on "Run Analysis Now"
// can take a moment longer than a plain DB read — same reasoning as
// chatController's Gemini timeout, just for a different slow step.
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

// @desc    Latest sales analysis snapshot — Daily/Weekly/Monthly Sales,
//          Revenue, Best/Worst Sellers. Computed by the Django analytics
//          service; read here straight from MongoDB.
// @route   GET /api/admin/sales-analysis
// @access  Private (admin)
const getSalesAnalysis = catchAsync(async (req, res) => {
  const analysis = await readLatestAnalysis('sales_analysis');
  return res.status(200).json({ analysis });
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

// @desc    Latest demand forecast snapshot. Computed by the Django
//          analytics service; read here straight from MongoDB.
// @route   GET /api/admin/demand-forecast
// @access  Private (admin)
const getDemandForecast = catchAsync(async (req, res) => {
  const analysis = await readLatestAnalysis('demand_forecasts');
  return res.status(200).json({ analysis });
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

// @desc    Latest revenue forecast snapshot. Computed by the Django
//          analytics service; read here straight from MongoDB.
// @route   GET /api/admin/revenue-forecast
// @access  Private (admin)
const getRevenueForecast = catchAsync(async (req, res) => {
  const analysis = await readLatestAnalysis('revenue_forecasts');
  return res.status(200).json({ analysis });
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



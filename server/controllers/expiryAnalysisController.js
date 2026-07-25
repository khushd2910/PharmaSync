const path = require('path');
const ExpiryAnalysis = require('../models/ExpiryAnalysis');
const catchAsync = require('../utils/catchAsync');
const runPythonScript = require('../utils/runPythonScript');

const SCRIPT_PATH = path.join(__dirname, '..', '..', 'python-service', 'analytics', 'expiry_analysis.py');

// @desc    Latest nightly (or manually-triggered) expiry analysis snapshot —
//          medicines already expired, plus buckets expiring within 30/60/90
//          days, and the urgent alertCount that drives the dashboard
//          notification. Written by python-service/analytics/expiry_analysis.py;
//          this endpoint only reads whatever it last produced.
// @route   GET /api/admin/expiry-analysis
// @access  Private (admin)
const getExpiryAnalysis = catchAsync(async (req, res) => {
  const latest = await ExpiryAnalysis.findOne().sort({ generatedAt: -1 });
  return res.status(200).json({ analysis: latest || null });
});

// @desc    Run the Python expiry analysis job right now instead of waiting
//          for its nightly schedule.
// @route   POST /api/admin/expiry-analysis/run
// @access  Private (admin)
const runExpiryAnalysis = catchAsync(async (req, res) => {
  await runPythonScript(SCRIPT_PATH);
  const latest = await ExpiryAnalysis.findOne().sort({ generatedAt: -1 });
  return res.status(200).json({ message: 'Analysis complete', analysis: latest });
});

module.exports = { getExpiryAnalysis, runExpiryAnalysis };

const path = require('path');
const SalesAnalysis = require('../models/SalesAnalysis');
const catchAsync = require('../utils/catchAsync');
const runPythonScript = require('../utils/runPythonScript');

const SCRIPT_PATH = path.join(__dirname, '..', '..', 'python-service', 'analytics', 'sales_analysis.py');

// @desc    Latest nightly (or manually-triggered) sales analysis snapshot —
//          Daily/Weekly/Monthly Sales, Revenue, Best/Worst Sellers. Written
//          by python-service/analytics/sales_analysis.py; this endpoint
//          only reads whatever it last produced.
// @route   GET /api/admin/sales-analysis
// @access  Private (admin)
const getSalesAnalysis = catchAsync(async (req, res) => {
  const latest = await SalesAnalysis.findOne().sort({ generatedAt: -1 });
  return res.status(200).json({ analysis: latest || null });
});

// @desc    Run the Python sales analysis job right now instead of waiting
//          for its nightly schedule.
// @route   POST /api/admin/sales-analysis/run
// @access  Private (admin)
const runSalesAnalysis = catchAsync(async (req, res) => {
  await runPythonScript(SCRIPT_PATH);
  const latest = await SalesAnalysis.findOne().sort({ generatedAt: -1 });
  return res.status(200).json({ message: 'Analysis complete', analysis: latest });
});

module.exports = { getSalesAnalysis, runSalesAnalysis };

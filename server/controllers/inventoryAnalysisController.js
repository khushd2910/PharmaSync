const path = require('path');
const InventoryAnalysis = require('../models/InventoryAnalysis');
const catchAsync = require('../utils/catchAsync');
const runPythonScript = require('../utils/runPythonScript');

const SCRIPT_PATH = path.join(__dirname, '..', '..', 'python-service', 'analytics', 'inventory_analysis.py');

// @desc    Latest nightly (or manually-triggered) inventory analysis
//          snapshot — Total Stock, Low Stock, Fast Selling, Slow Selling.
//          Written by python-service/analytics/inventory_analysis.py; this
//          endpoint only reads whatever it last produced.
// @route   GET /api/admin/inventory-analysis
// @access  Private (admin)
const getInventoryAnalysis = catchAsync(async (req, res) => {
  const latest = await InventoryAnalysis.findOne().sort({ generatedAt: -1 });
  return res.status(200).json({ analysis: latest || null });
});

// @desc    Run the Python analysis job right now instead of waiting for its
//          nightly schedule — useful for demos and for seeing the effect of
//          a stock change immediately. Spawns the same script a cron job
//          would run, waits for it to finish, then returns the fresh result.
// @route   POST /api/admin/inventory-analysis/run
// @access  Private (admin)
const runInventoryAnalysis = catchAsync(async (req, res) => {
  await runPythonScript(SCRIPT_PATH);
  const latest = await InventoryAnalysis.findOne().sort({ generatedAt: -1 });
  return res.status(200).json({ message: 'Analysis complete', analysis: latest });
});

module.exports = { getInventoryAnalysis, runInventoryAnalysis };

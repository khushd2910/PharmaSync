const path = require('path');
const { spawn } = require('child_process');
const InventoryAnalysis = require('../models/InventoryAnalysis');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const SCRIPT_PATH = path.join(__dirname, '..', '..', 'python-service', 'analytics', 'inventory_analysis.py');
const RUN_TIMEOUT_MS = 60_000;

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
const runInventoryAnalysis = catchAsync(async (req, res, next) => {
  await new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [SCRIPT_PATH], { timeout: RUN_TIMEOUT_MS });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      // Most common case: PYTHON_BIN isn't on PATH / not installed
      reject(new AppError(`Could not start the analysis script (${err.message}). Is Python installed and on PATH?`, 500));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new AppError(`Analysis script exited with an error: ${stderr.trim() || `code ${code}`}`, 500));
      }
    });
  });

  const latest = await InventoryAnalysis.findOne().sort({ generatedAt: -1 });
  return res.status(200).json({ message: 'Analysis complete', analysis: latest });
});

module.exports = { getInventoryAnalysis, runInventoryAnalysis };

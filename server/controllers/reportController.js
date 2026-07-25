const fs = require('fs');
const path = require('path');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const runPythonScript = require('../utils/runPythonScript');

const SCRIPT_PATH = path.join(__dirname, '..', '..', 'python-service', 'reports', 'generate_reports.py');
const EXPORTS_DIR = path.join(__dirname, '..', '..', 'reports', 'exports');

// Fixed whitelist, both of what generate_reports.py is expected to produce
// and of what /download/:filename will ever serve — the filename comes
// straight from the URL, so accepting anything other than an exact match
// against this list would open a path-traversal hole.
const REPORT_FILES = ['Sales.csv', 'Inventory.csv', 'Expiry.csv', 'Orders.csv'];

// Shape the on-disk state of the four exports into what the dashboard
// needs to render: whether each one exists yet, and if so, its size and
// when it was last (re)generated. Missing files just come back as null
// rather than erroring — that's the normal "nobody has generated a report
// yet" state, not a failure.
const listExports = () =>
  REPORT_FILES.map((filename) => {
    const filePath = path.join(EXPORTS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return { filename, generatedAt: null, sizeBytes: null };
    }
    const stats = fs.statSync(filePath);
    return { filename, generatedAt: stats.mtime, sizeBytes: stats.size };
  });

// @desc    Current state of the four CSV exports (name, size, last
//          generated) without triggering a new run — for the reports page
//          to render on load.
// @route   GET /api/admin/reports
// @access  Private (admin)
const listReports = catchAsync(async (req, res) => {
  return res.status(200).json({ reports: listExports() });
});

// @desc    Run the Module 7 report-generation script now. Spawns
//          generate_reports.py, which overwrites Sales.csv, Inventory.csv,
//          Expiry.csv, and Orders.csv under reports/exports with a fresh
//          snapshot, then returns the refreshed file listing.
// @route   POST /api/admin/reports/generate
// @access  Private (admin)
const generateReports = catchAsync(async (req, res) => {
  await runPythonScript(SCRIPT_PATH);
  return res.status(200).json({ message: 'Reports generated', reports: listExports() });
});

// @desc    Download one of the four generated CSVs.
// @route   GET /api/admin/reports/download/:filename
// @access  Private (admin)
const downloadReport = catchAsync(async (req, res, next) => {
  const { filename } = req.params;
  if (!REPORT_FILES.includes(filename)) {
    return next(new AppError('Unknown report file', 404));
  }

  const filePath = path.join(EXPORTS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return next(new AppError('This report has not been generated yet — click "Generate Report" first.', 404));
  }

  return res.download(filePath, filename);
});

module.exports = { listReports, generateReports, downloadReport };

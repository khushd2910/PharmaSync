const { spawn } = require('child_process');
const AppError = require('./AppError');

const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const DEFAULT_TIMEOUT_MS = 60_000;

// Runs one of the python-service/analytics/*.py scripts to completion and
// resolves once it exits 0. Shared by every "Run Analysis Now" endpoint
// (inventory, sales, ...) so there's exactly one place that knows how to
// invoke Python from Node, rather than each analysis controller
// reimplementing spawn/timeout/stderr-capture slightly differently.
const runPythonScript = (scriptPath, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [scriptPath], { timeout: timeoutMs });

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

module.exports = runPythonScript;

/**
 * Module 8 — Medicine Information API integration.
 *
 * Flow:
 *   User opens medicine
 *     -> Node calls the Django Python service (python-service/medicine_api)
 *         -> That service calls the external Medicine API (openFDA)
 *             -> Returns Uses, Side Effects, Warnings, Storage, Dosage
 *     -> Node forwards the result straight back to the medicine page
 *
 * Node no longer talks to openFDA itself — that lookup now lives entirely
 * in python-service/medicine_api/views.py. This file just calls that service
 * over HTTP. Only called for medicines with a known `fdaAlias` (the US
 * generic name), since Indian and US generic names sometimes differ (e.g.
 * Salbutamol vs Albuterol). Always best-effort — returns null on any
 * failure (service down, network error, timeout, "not found") so a
 * problem with the Python service never breaks the medicine detail page.
 */

const djangoAuthHeaders = require('./djangoAuthHeaders');

const MEDICINE_API_URL = process.env.MEDICINE_API_URL || process.env.DJANGO_API_URL || 'http://localhost:8000';
const FETCH_TIMEOUT_MS = 4000;

// Small in-memory cache on the Node side too, on top of the Python
// service's own cache — avoids an HTTP round trip entirely for repeat
// views within the same server process. Resets on server restart.
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const fetchDrugInfo = async (fdaAlias) => {
  if (!fdaAlias) return null;

  const key = fdaAlias.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `${MEDICINE_API_URL.replace(/\/$/, '')}/api/medicine-info?generic_name=${encodeURIComponent(key)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, { signal: controller.signal, headers: djangoAuthHeaders() });
    clearTimeout(timeout);

    if (!res.ok) {
      cache.set(key, { data: null, fetchedAt: Date.now() });
      return null;
    }

    const json = await res.json();
    if (!json.found) {
      cache.set(key, { data: null, fetchedAt: Date.now() });
      return null;
    }

    const data = {
      source: json.source,
      uses: json.uses,
      sideEffects: json.sideEffects,
      warnings: json.warnings,
      storage: json.storage,
      dosage: json.dosage,
    };

    cache.set(key, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    // Network error, timeout, Python service not running, or unexpected
    // shape — fail silently, same contract as before.
    return null;
  }
};

module.exports = fetchDrugInfo;

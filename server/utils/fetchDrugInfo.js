/**
 * Fetches supplementary drug label info from openFDA — the live
 * "Medicine Information API fetches additional details" step in the
 * Medicine Details flow. Free, no API key required for moderate use.
 *
 * Only called for medicines with a known `fdaAlias` (the US generic name),
 * since Indian and US generic names sometimes differ (e.g. Salbutamol vs
 * Albuterol). Always best-effort — returns null on any failure so a slow
 * or unreachable API never breaks the medicine detail page.
 */

// Simple in-memory cache so repeated views of the same medicine (or the
// same generic across different brands) don't re-hit the API every time.
// Resets on server restart — fine for this use case.
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const FETCH_TIMEOUT_MS = 4000;

const fetchDrugInfo = async (fdaAlias) => {
  if (!fdaAlias) return null;

  const key = fdaAlias.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(key)}"&limit=1`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      cache.set(key, { data: null, fetchedAt: Date.now() });
      return null;
    }

    const json = await res.json();
    const result = json?.results?.[0];
    if (!result) {
      cache.set(key, { data: null, fetchedAt: Date.now() });
      return null;
    }

    const data = {
      source: 'openFDA',
      purpose: result.purpose?.[0],
      warnings: result.warnings?.[0] || result.warnings_and_cautions?.[0],
      dosageAndAdministration: result.dosage_and_administration?.[0],
      indicationsAndUsage: result.indications_and_usage?.[0],
    };

    cache.set(key, { data, fetchedAt: Date.now() });
    return data;
  } catch (err) {
    // Network error, timeout, or unexpected shape — fail silently
    return null;
  }
};

module.exports = fetchDrugInfo;

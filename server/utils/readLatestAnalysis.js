/**
 * Reads the most recent snapshot document from one of the analysis
 * collections (inventory_analysis, inventory_deep_analysis, sales_analysis,
 * expiry_analysis, demand_forecasts, revenue_forecasts) directly from
 * MongoDB, bypassing the Django analytics service.
 *
 * Why this exists: every "get latest snapshot" admin endpoint used to
 * proxy to python-service (see python-service/analytics/views.py's
 * `_latest`), which just does the exact same
 * `find_one(sort=[('generatedAt', -1)])` against a collection Node
 * already has a live connection to. Routing a plain read through a
 * second HTTP hop meant every admin analysis page went down the moment
 * that service wasn't running — the same failure mode fixed for medicine
 * card ratings. Reading the snapshot here instead means viewing the
 * dashboard always works off whatever was last generated, independent of
 * whether Django is currently up.
 *
 * This does NOT replace Django for computing a fresh snapshot ("Run
 * Analysis Now") — that still requires pandas/scikit-learn and stays
 * proxied. This only covers the read.
 */

const mongoose = require('mongoose');

const readLatestAnalysis = async (collectionName) => {
  const [doc] = await mongoose.connection.db
    .collection(collectionName)
    .find({})
    .sort({ generatedAt: -1 })
    .limit(1)
    .toArray();

  if (!doc) return null;

  // Match the shape python-service's `_json_safe` always returned — it
  // drops the raw `_id`, since the frontend never used it (Date fields
  // serialize to ISO strings via JSON.stringify either way, same as
  // Django's isoformat()).
  const { _id, ...rest } = doc;
  return rest;
};

module.exports = readLatestAnalysis;

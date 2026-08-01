const mongoose = require('mongoose');

// This collection is written by
// python-service/analytics/market_basket_analysis.py, not by this Node
// app — Mongoose is used here purely to READ it: the admin "Market Basket
// Analysis" page, and (via getRelatedMedicines in medicineController.js)
// as a ranking signal for MedicineDetails' "People Also Bought" row.
// Collection name pinned explicitly, same reasoning as SalesAnalysis /
// InventoryAnalysis: it must never silently drift from what the Python
// side targets via auto-pluralization.
const itemRefSchema = new mongoose.Schema(
  { medicineId: { type: String, required: true }, name: { type: String, required: true } },
  { _id: false }
);

const pairSchema = new mongoose.Schema(
  {
    itemA: { type: itemRefSchema, required: true },
    itemB: { type: itemRefSchema, required: true },
    count: { type: Number, required: true },
    support: { type: Number, required: true },
  },
  { _id: false }
);

const ruleSchema = new mongoose.Schema(
  {
    antecedents: [itemRefSchema],
    consequents: [itemRefSchema],
    support: { type: Number, required: true },
    confidence: { type: Number, required: true },
    lift: { type: Number, required: true },
  },
  { _id: false }
);

const marketBasketAnalysisSchema = new mongoose.Schema(
  {
    generatedAt: { type: Date, required: true },
    lookbackDays: { type: Number, required: true },
    minSupport: { type: Number, required: true },
    minConfidence: { type: Number, required: true },
    totalBaskets: { type: Number, required: true },
    avgBasketSize: { type: Number, required: true },
    topPairs: [pairSchema],
    rules: [ruleSchema],
  },
  { collection: 'market_basket_analysis' }
);

marketBasketAnalysisSchema.index({ generatedAt: -1 });

module.exports = mongoose.model('MarketBasketAnalysis', marketBasketAnalysisSchema);

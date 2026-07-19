const mongoose = require('mongoose');

// This collection is written by python-service/analytics/inventory_analysis.py,
// not by this Node app — Mongoose is used here purely to READ it for the
// admin dashboard. The collection name is pinned explicitly (rather than
// left to Mongoose's auto-pluralization of the model name) so it can never
// silently drift from what the Python side targets.
const analysisItemSchema = new mongoose.Schema(
  {
    medicineId: { type: String, required: true },
    name: { type: String, required: true },
    stock: { type: Number, required: true },
    unitsSold: { type: Number, required: true },
  },
  { _id: false }
);

const inventoryAnalysisSchema = new mongoose.Schema(
  {
    generatedAt: { type: Date, required: true },
    lookbackDays: { type: Number, required: true },
    lowStockThreshold: { type: Number, required: true },
    totalMedicines: { type: Number, required: true },
    totalStockUnits: { type: Number, required: true },
    lowStock: [analysisItemSchema],
    fastSelling: [analysisItemSchema],
    slowSelling: [analysisItemSchema],
  },
  { collection: 'inventory_analysis' }
);

inventoryAnalysisSchema.index({ generatedAt: -1 });

module.exports = mongoose.model('InventoryAnalysis', inventoryAnalysisSchema);

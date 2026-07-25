const mongoose = require('mongoose');

// This collection is written by python-service/analytics/expiry_analysis.py,
// not by this Node app — Mongoose is used here purely to READ it for the
// admin dashboard. Collection name pinned explicitly, same reasoning as
// InventoryAnalysis/SalesAnalysis: it must never silently drift from what
// the Python side targets via auto-pluralization.
const expiryItemSchema = new mongoose.Schema(
  {
    medicineId: { type: String, required: true },
    name: { type: String, required: true },
    stock: { type: Number, required: true },
    expiryDate: { type: Date, required: true },
    daysUntilExpiry: { type: Number, required: true },
  },
  { _id: false }
);

const expiryAnalysisSchema = new mongoose.Schema(
  {
    generatedAt: { type: Date, required: true },
    expiryAlertDays: { type: Number, required: true },
    bucketDays: [Number],
    totalTracked: { type: Number, required: true },
    alertCount: { type: Number, required: true },
    expired: [expiryItemSchema],
    expiringIn30: [expiryItemSchema],
    expiringIn60: [expiryItemSchema],
    expiringIn90: [expiryItemSchema],
  },
  { collection: 'expiry_analysis' }
);

expiryAnalysisSchema.index({ generatedAt: -1 });

module.exports = mongoose.model('ExpiryAnalysis', expiryAnalysisSchema);

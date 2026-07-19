const mongoose = require('mongoose');

// This collection is written by python-service/analytics/sales_analysis.py,
// not by this Node app — Mongoose is used here purely to READ it for the
// admin dashboard. Collection name pinned explicitly, same reasoning as
// InventoryAnalysis: it must never silently drift from what the Python
// side targets via auto-pluralization.
const dailyPointSchema = new mongoose.Schema(
  { date: { type: String, required: true }, revenue: Number, orders: Number },
  { _id: false }
);
const weeklyPointSchema = new mongoose.Schema(
  { weekStart: { type: String, required: true }, revenue: Number, orders: Number },
  { _id: false }
);
const monthlyPointSchema = new mongoose.Schema(
  { month: { type: String, required: true }, revenue: Number, orders: Number },
  { _id: false }
);

const sellerSchema = new mongoose.Schema(
  {
    medicineId: { type: String, required: true },
    name: { type: String, required: true },
    revenue: { type: Number, required: true },
    unitsSold: { type: Number, required: true },
  },
  { _id: false }
);

const salesAnalysisSchema = new mongoose.Schema(
  {
    generatedAt: { type: Date, required: true },
    lookbackDays: { type: Number, required: true },
    totalRevenue: { type: Number, required: true },
    onlineRevenue: { type: Number, required: true },
    posRevenue: { type: Number, required: true },
    totalOrders: { type: Number, required: true },
    daily: [dailyPointSchema],
    weekly: [weeklyPointSchema],
    monthly: [monthlyPointSchema],
    bestSellers: [sellerSchema],
    worstSellers: [sellerSchema],
  },
  { collection: 'sales_analysis' }
);

salesAnalysisSchema.index({ generatedAt: -1 });

module.exports = mongoose.model('SalesAnalysis', salesAnalysisSchema);

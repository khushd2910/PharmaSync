const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Medicine name is required'],
      trim: true,
    },
    price: {
      type: Number,
      min: 0,
    },
    manufacturer: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      trim: true,
      default: 'allopathy',
    },
    packSizeLabel: {
      type: String,
      trim: true,
    },
    composition1: {
      type: String,
      trim: true,
    },
    composition2: {
      type: String,
      trim: true,
    },
    isDiscontinued: {
      type: Boolean,
      default: false,
    },
<<<<<<< HEAD
    // Not in the seed dataset — defaulted here so Module 2's stock/order
    // management and prescription-alert features have somewhere to live
    // without a schema migration later.
=======
>>>>>>> master
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    requiresPrescription: {
      type: Boolean,
      default: false,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
<<<<<<< HEAD
=======
    // Simplified single-batch expiry for the storefront demo — real
    // batch/lot-level expiry tracking belongs to the admin stock module.
    expiryDate: {
      type: Date,
    },

    // Curated at import time from server/data/commonMolecules.js
    category: {
      type: String,
      trim: true,
      index: true,
    },
    uses: {
      type: String,
      trim: true,
    },
    sideEffects: {
      type: String,
      trim: true,
    },
    dosage: {
      type: String,
      trim: true,
    },
    // US/openFDA generic name, used for the live "additional details" API
    // enrichment lookup — null when no reliable match exists
    fdaAlias: {
      type: String,
      trim: true,
    },

    // Drive the Home page's Offers/Popular/Recently Added sections
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 90,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
>>>>>>> master
  },
  { timestamps: true }
);

// Powers the guest-facing search box (name, manufacturer, composition)
medicineSchema.index({ name: 'text', manufacturer: 'text', composition1: 'text' });
medicineSchema.index({ price: 1 });

module.exports = mongoose.model('Medicine', medicineSchema);

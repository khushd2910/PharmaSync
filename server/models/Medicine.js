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
    // Not in the seed dataset — defaulted here so Module 2's stock/order
    // management and prescription-alert features have somewhere to live
    // without a schema migration later.
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
  },
  { timestamps: true }
);

// Powers the guest-facing search box (name, manufacturer, composition)
medicineSchema.index({ name: 'text', manufacturer: 'text', composition1: 'text' });
medicineSchema.index({ price: 1 });

module.exports = mongoose.model('Medicine', medicineSchema);

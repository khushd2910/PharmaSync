const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    addedPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    addedStock: {
      type: Number,
      min: 0,
      default: 0,
    },
    addedName: {
      type: String,
      trim: true,
    },
    addedManufacturer: {
      type: String,
      trim: true,
    },
    addedPackSizeLabel: {
      type: String,
      trim: true,
    },
    addedRequiresPrescription: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const savedItemSchema = new mongoose.Schema(
  {
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
    savedItems: [savedItemSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', cartSchema);

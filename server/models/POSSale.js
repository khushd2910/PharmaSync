const mongoose = require('mongoose');

// Deliberately a separate collection from `Order`, not a shared one with a
// "channel" flag — an online Order is fundamentally shaped around a
// registered user, a delivery address, and a multi-day fulfillment
// pipeline (Pending -> ... -> Delivered), none of which apply to a
// walk-in counter sale that's paid for and handed over in the same
// minute. Forcing both through one schema would mean a pile of
// nullable/conditionally-required fields on both sides.
const saleItemSchema = new mongoose.Schema(
  {
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    // Snapshot fields, same rationale as Order — so a sale's receipt never
    // changes even if the medicine's name/price is edited later.
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const posSaleSchema = new mongoose.Schema(
  {
    // The admin/staff account that rang up the sale — always present, since
    // only logged-in admins can reach the POS screen. Distinct from `user`
    // on Order, which is the customer.
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [saleItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    gstAmount: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ['Cash', 'UPI', 'Card'], required: true },
    // Walk-in customers don't have accounts — these are optional, freeform,
    // captured only when the customer wants their name on the receipt or
    // for a future return/lookup.
    customerName: { type: String, trim: true },
    customerPhone: { type: String, trim: true },
    invoiceNumber: { type: String, required: true, unique: true },
    // Self-declared by the cashier at checkout — see posController.checkout.
    // Only meaningful (and only ever true) when the sale actually contains
    // a requiresPrescription medicine.
    prescriptionConfirmed: { type: Boolean, default: false },
    // Counter sales are settled and complete the instant they're rung up —
    // there's no fulfillment pipeline, only a possible later reversal.
    status: { type: String, enum: ['Completed', 'Refunded'], default: 'Completed' },
  },
  { timestamps: true }
);

posSaleSchema.index({ createdAt: -1 });

module.exports = mongoose.model('POSSale', posSaleSchema);

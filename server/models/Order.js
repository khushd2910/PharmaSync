const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    // Snapshot fields — so the order's history stays accurate even if the
    // medicine's price or name changes later
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    // Captured via the map picker — used for delivery routing later
    lat: { type: Number },
    lng: { type: Number },
  },
  { _id: false }
);

const ORDER_STATUSES = ['Pending', 'Confirmed', 'Packed', 'Out for Delivery', 'Delivered', 'Cancelled'];

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],
    totalAmount: { type: Number, required: true, min: 0 },
    address: { type: addressSchema, required: true },
    paymentMethod: { type: String, enum: ['COD', 'UPI'], required: true },
    paymentStatus: { type: String, default: 'Pending' },
    // Real status, settable by admin in a later module — defaults to
    // Pending; the frontend also computes a simulated in-progress status
    // for demo purposes until admin order management exists.
    orderStatus: { type: String, enum: ORDER_STATUSES, default: 'Pending' },
    // true while no admin has manually set a status — the frontend/backend
    // both fall back to a time-based demo progression in that case. Once
    // an admin updates the status (or a user cancels), this flips false
    // and orderStatus is trusted as-is everywhere.
    demoMode: { type: Boolean, default: true },
    invoiceNumber: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;

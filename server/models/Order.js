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
    paymentMethod: { type: String, enum: ['COD', 'UPI', 'Card', 'Wallet'], required: true },
    // Short display string for the payment step's chosen instrument — e.g.
    // "UPI · name@bank", "Card ending 4242", "PhonePe Wallet". Never store
    // full card/wallet credentials; this is a masked label only, and the
    // storefront demo doesn't process real payments.
    paymentDetails: { type: String, trim: true },
    couponCode: { type: String, trim: true, uppercase: true, default: null },
    couponDiscount: { type: Number, default: 0, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    platformFee: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, default: 'Pending' },
    // Quick-commerce style ETA in minutes (Blinkit-like), randomized 15-25
    // at checkout so it's stable across refreshes/revisits. Shown on the
    // post-payment confirmation step and then again on the order
    // history/details pages until the order is delivered. An admin can
    // correct this value from Order Management as the order actually
    // progresses — see orderController.adminUpdateOrderStatus. Once the
    // order reaches 'Delivered' it's locked and no longer editable.
    estimatedDeliveryMinutes: { type: Number, min: 1 },
    // Module 10 — Prescription Medicine Alert. Set at checkout time if the
    // cart contained any requiresPrescription medicine; `prescription`
    // points at the actual uploaded file (server/models/Prescription.js)
    // the user submitted for this order. `prescriptionStatus` starts at
    // 'Pending Review' and is flipped by an admin's approve/reject
    // decision (see prescriptionController.adminReviewPrescription) — a
    // rejection auto-cancels the order and restocks it, same as any other
    // cancellation.
    prescriptionRequired: { type: Boolean, default: false },
    prescriptionStatus: {
      type: String,
      enum: ['Not Required', 'Pending Review', 'Approved', 'Rejected'],
      default: 'Not Required',
    },
    prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', default: null },
    // Defaults to Pending at checkout; only an admin (via order management)
    // or the user (cancellation) ever changes it from here on.
    orderStatus: { type: String, enum: ORDER_STATUSES, default: 'Pending' },
    invoiceNumber: { type: String, required: true, unique: true },
    // Customer's post-delivery rating for this order (1-5 stars). Set once
    // via PATCH /orders/:id/rating after the order reaches "Delivered" —
    // previously this only lived in the browser's localStorage, which meant
    // it never showed up for admins and didn't survive a device switch.
    rating: { type: Number, min: 1, max: 5, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;

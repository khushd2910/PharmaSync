const mongoose = require('mongoose');

// Module 10 — Prescription Medicine Alert. One document per uploaded
// prescription file. A prescription starts life unattached (just
// uploaded), then gets linked to the one order it was used for once
// checkout succeeds — see orderController.createOrder. That link is what
// lets an admin's approve/reject decision cascade onto the right order.
const PRESCRIPTION_STATUSES = ['Pending', 'Approved', 'Rejected'];

const prescriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // Where the actual file lives, under uploads/prescriptions/ — see
    // server/middleware/uploadPrescription.js for how it gets there.
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },

    status: { type: String, enum: PRESCRIPTION_STATUSES, default: 'Pending' },

    // Set once this prescription is used at checkout — a prescription can
    // only ever back one order, so a rejected/consumed upload can't
    // silently be reused for a different cart later; the user uploads a
    // fresh one each time.
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },

    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewNote: { type: String, trim: true },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Prescription', prescriptionSchema);
module.exports.PRESCRIPTION_STATUSES = PRESCRIPTION_STATUSES;

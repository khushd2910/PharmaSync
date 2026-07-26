const path = require('path');
const fs = require('fs');
const Prescription = require('../models/Prescription');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { restockItems } = require('./orderController');
const { UPLOAD_DIR } = require('../middleware/uploadPrescription');

// @desc    Upload a prescription file. Doesn't attach it to an order by
//          itself — checkout (orderController.createOrder) links it to
//          whichever order actually needed it. Multiple uploads can sit
//          unused; only the one referenced by prescriptionId at checkout
//          gets consumed.
// @route   POST /api/prescriptions
// @access  Private (user)
const uploadPrescription = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('A prescription file is required', 400));
  }

  const prescription = await Prescription.create({
    user: req.user._id,
    fileName: req.file.filename,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
  });

  return res.status(201).json({ message: 'Prescription uploaded — awaiting pharmacist review', prescription });
});

// @desc    List the logged-in user's own prescription uploads, newest first
// @route   GET /api/prescriptions
// @access  Private (user)
const getMyPrescriptions = catchAsync(async (req, res) => {
  const prescriptions = await Prescription.find({ user: req.user._id }).sort({ createdAt: -1 });
  return res.status(200).json({ prescriptions });
});

// @desc    Stream a prescription file back — the uploader themself, or any
//          admin (to review it), can view it. Anyone else gets a 403,
//          since these are personal medical documents.
// @route   GET /api/prescriptions/:id/file
// @access  Private (owner or admin)
const getPrescriptionFile = catchAsync(async (req, res, next) => {
  const prescription = await Prescription.findById(req.params.id);
  if (!prescription) {
    return next(new AppError('Prescription not found', 404));
  }
  if (req.user.role !== 'admin' && !prescription.user.equals(req.user._id)) {
    return next(new AppError('Access denied', 403));
  }

  const filePath = path.join(UPLOAD_DIR, prescription.fileName);
  if (!fs.existsSync(filePath)) {
    return next(new AppError('Prescription file is missing from storage', 404));
  }

  res.setHeader('Content-Type', prescription.mimeType);
  return res.sendFile(filePath);
});

// @desc    List prescriptions for admin review, optionally filtered by
//          status (defaults to every status if omitted)
// @route   GET /api/admin/prescriptions?status=Pending
// @access  Private (admin)
const adminListPrescriptions = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    filter.status = req.query.status;
  }

  const prescriptions = await Prescription.find(filter)
    .populate('user', 'name email')
    .populate('order', 'invoiceNumber totalAmount')
    .sort({ createdAt: -1 });

  return res.status(200).json({ prescriptions });
});

// @desc    Approve or reject an uploaded prescription. If it's linked to
//          an order: approving unblocks that order (it starts progressing
//          normally — see server/utils/orderStatus.js's gate), rejecting
//          cancels and restocks it, same as any other cancellation, since
//          the sale can't legally complete without a valid prescription.
// @route   PATCH /api/admin/prescriptions/:id/review
// @access  Private (admin)
const adminReviewPrescription = catchAsync(async (req, res, next) => {
  const { status, reviewNote } = req.body;
  if (!['Approved', 'Rejected'].includes(status)) {
    return next(new AppError('status must be Approved or Rejected', 400));
  }

  const prescription = await Prescription.findById(req.params.id);
  if (!prescription) {
    return next(new AppError('Prescription not found', 404));
  }

  prescription.status = status;
  prescription.reviewNote = reviewNote || undefined;
  prescription.reviewedBy = req.user._id;
  prescription.reviewedAt = new Date();
  await prescription.save();

  if (prescription.order) {
    const order = await Order.findById(prescription.order);
    if (order) {
      order.prescriptionStatus = status === 'Approved' ? 'Approved' : 'Rejected';
      if (status === 'Rejected' && order.orderStatus !== 'Cancelled') {
        await restockItems(order.items);
        order.orderStatus = 'Cancelled';
        order.demoMode = false;
        if (order.paymentStatus === 'Paid') {
          order.paymentStatus = 'Refunded';
        }
      }
      await order.save();
    }
  }

  return res.status(200).json({ message: `Prescription ${status.toLowerCase()}`, prescription });
});

module.exports = {
  uploadPrescription,
  getMyPrescriptions,
  getPrescriptionFile,
  adminListPrescriptions,
  adminReviewPrescription,
};

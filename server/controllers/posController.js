const crypto = require('crypto');
const Medicine = require('../models/Medicine');
const POSSale = require('../models/POSSale');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { generatePOSReceiptPdf } = require('../utils/generateInvoicePdf');
const { getEffectivePrice } = require('./cartController');

const generateInvoiceNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `POS-${datePart}-${randomPart}`;
};

// Same atomic-decrement-with-rollback pattern as the online checkout
// (orderController.decrementStockOrRollback) — a counter sale is just as
// vulnerable to overselling if two staff members ring up the last few
// units of the same medicine at the same moment.
const decrementStockOrRollback = async (items) => {
  const decremented = [];

  for (const item of items) {
    const updated = await Medicine.findOneAndUpdate(
      { _id: item.medicine._id, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
      { new: true }
    );

    if (!updated) {
      for (const done of decremented) {
        await Medicine.updateOne({ _id: done.medicine }, { $inc: { stock: done.quantity } });
      }
      return { success: false, failedItem: item };
    }
    decremented.push({ medicine: item.medicine._id, quantity: item.quantity });
  }

  return { success: true };
};

const restockItems = async (items) => {
  for (const item of items) {
    await Medicine.updateOne({ _id: item.medicine }, { $inc: { stock: item.quantity } });
  }
};

// @desc    Look up medicines at the POS counter — by exact barcode (scanner
//          input) or by a name/manufacturer/composition substring (manual
//          search fallback when there's no barcode on file). Only
//          in-stock, non-discontinued items are returned — nothing sellable
//          at the counter should be out of stock or pulled from the catalog.
// @route   GET /api/admin/pos/search?barcode=&query=
// @access  Private (admin)
const searchCatalog = catchAsync(async (req, res, next) => {
  const { barcode, query } = req.query;

  if (barcode) {
    const medicine = await Medicine.findOne({
      barcode: barcode.trim(),
      isDiscontinued: { $ne: true },
    });
    if (!medicine) {
      return next(new AppError(`No medicine found for barcode "${barcode}"`, 404));
    }
    return res.status(200).json({ medicines: [medicine] });
  }

  const search = (query || '').trim();
  if (!search) {
    return res.status(200).json({ medicines: [] });
  }

  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tokens = search.split(/\s+/).filter(Boolean);
  const filter = {
    isDiscontinued: { $ne: true },
    $and: tokens.map((token) => {
      const regex = new RegExp(escapeRegex(token), 'i');
      return {
        $or: [
          { name: regex },
          { manufacturer: regex },
          { composition1: regex },
          { composition2: regex },
          { barcode: regex },
        ],
      };
    }),
  };

  const medicines = await Medicine.find(filter).limit(20).sort({ name: 1 });
  return res.status(200).json({ medicines });
});

// @desc    Ring up a counter sale: validates stock, decrements it
//          atomically, applies the same discount logic as the online
//          storefront, computes the GST breakup, and records the sale.
//          Instant and final — there's no cart persisted server-side; the
//          POS screen holds the in-progress sale client-side until checkout.
// @route   POST /api/admin/pos/sales
// @access  Private (admin)
const checkout = catchAsync(async (req, res, next) => {
  const { items, paymentMethod, customerName, customerPhone, prescriptionConfirmed } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return next(new AppError('At least one item is required', 400));
  }
  if (!['Cash', 'UPI', 'Card'].includes(paymentMethod)) {
    return next(new AppError('paymentMethod must be Cash, UPI, or Card', 400));
  }

  // Re-fetch every medicine server-side rather than trusting client-sent
  // prices/names — the POS screen is just a UI, the source of truth for
  // price/stock/discontinued status is always the current catalog record.
  const resolvedItems = [];
  for (const line of items) {
    const qty = Math.max(parseInt(line.quantity, 10) || 0, 0);
    if (!line.medicineId || qty < 1) {
      return next(new AppError('Each item needs a medicineId and a quantity of at least 1', 400));
    }
    const medicine = await Medicine.findById(line.medicineId);
    if (!medicine || medicine.isDiscontinued) {
      return next(new AppError('One of the scanned items is no longer available', 404));
    }
    resolvedItems.push({ medicine, quantity: qty });
  }

  // Same enforcement as the online storefront: a sale containing an Rx
  // medicine requires an explicit confirmation. At the counter that means
  // the cashier has physically seen the customer's prescription — this is
  // a recorded acknowledgment, not a scanned/verified prescription (no
  // upload workflow exists yet).
  const rxItems = resolvedItems.filter((item) => item.medicine.requiresPrescription);
  if (rxItems.length > 0 && prescriptionConfirmed !== true) {
    return next(
      new AppError(
        `This sale includes prescription-only medicine(s): ${rxItems.map((i) => i.medicine.name).join(', ')}. Confirm the prescription has been seen before completing the sale.`,
        400
      )
    );
  }

  const stockResult = await decrementStockOrRollback(resolvedItems);
  if (!stockResult.success) {
    return next(
      new AppError(
        `"${stockResult.failedItem.medicine.name}" only has ${stockResult.failedItem.medicine.stock} left in stock.`,
        409
      )
    );
  }

  const saleItems = resolvedItems.map((item) => ({
    medicine: item.medicine._id,
    name: item.medicine.name,
    price: getEffectivePrice(item.medicine),
    quantity: item.quantity,
  }));

  const totalAmount = Math.round(saleItems.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100) / 100;
  // Same GST-inclusive back-calculation used on the invoice PDF, kept here
  // too so the stored record and the printed receipt always agree.
  const DEMO_GST_RATE = 0.12;
  const subtotal = Math.round((totalAmount / (1 + DEMO_GST_RATE)) * 100) / 100;
  const gstAmount = Math.round((totalAmount - subtotal) * 100) / 100;

  const sale = await POSSale.create({
    cashier: req.user._id,
    items: saleItems,
    subtotal,
    gstAmount,
    totalAmount,
    paymentMethod,
    customerName: customerName || undefined,
    customerPhone: customerPhone || undefined,
    invoiceNumber: generateInvoiceNumber(),
    prescriptionConfirmed: rxItems.length > 0 ? prescriptionConfirmed === true : false,
  });

  return res.status(201).json({ message: 'Sale completed', sale });
});

// @desc    Sales history for the POS register — recent-first, optional
//          date-range filter for end-of-day/reconciliation review.
// @route   GET /api/admin/pos/sales?from=&to=&page=&limit=
// @access  Private (admin)
const listSales = catchAsync(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const filter = {};
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
  }

  const [sales, total, todayAgg] = await Promise.all([
    POSSale.find(filter)
      .populate('cashier', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    POSSale.countDocuments(filter),
    // Quick "today's till" summary for the POS screen's sidebar, independent
    // of whatever date filter/pagination is currently applied.
    POSSale.aggregate([
      {
        $match: {
          status: 'Completed',
          createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),
  ]);

  return res.status(200).json({
    sales,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    today: {
      revenue: Math.round((todayAgg[0]?.total || 0) * 100) / 100,
      count: todayAgg[0]?.count || 0,
    },
  });
});

// @desc    Get a single counter sale
// @route   GET /api/admin/pos/sales/:id
// @access  Private (admin)
const getSaleById = catchAsync(async (req, res, next) => {
  const sale = await POSSale.findById(req.params.id).populate('cashier', 'name');
  if (!sale) {
    return next(new AppError('Sale not found', 404));
  }
  return res.status(200).json({ sale });
});

// @desc    Reverse a counter sale — restocks the items and marks it
//          Refunded. Same-day corrections only in spirit (nothing enforces
//          a time window here, matching how easy it is to walk back to the
//          register); a Refunded sale is excluded from revenue totals.
// @route   PATCH /api/admin/pos/sales/:id/refund
// @access  Private (admin)
const refundSale = catchAsync(async (req, res, next) => {
  const sale = await POSSale.findById(req.params.id);
  if (!sale) {
    return next(new AppError('Sale not found', 404));
  }
  if (sale.status === 'Refunded') {
    return next(new AppError('This sale has already been refunded', 400));
  }

  await restockItems(sale.items);
  sale.status = 'Refunded';
  await sale.save();

  return res.status(200).json({ message: 'Sale refunded and stock restored', sale });
});

// @desc    Print/download the receipt PDF for a counter sale
// @route   GET /api/admin/pos/sales/:id/receipt
// @access  Private (admin)
const downloadReceipt = catchAsync(async (req, res, next) => {
  const sale = await POSSale.findById(req.params.id);
  if (!sale) {
    return next(new AppError('Sale not found', 404));
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${sale.invoiceNumber}.pdf"`);
  generatePOSReceiptPdf(sale, res);
});

module.exports = {
  searchCatalog,
  checkout,
  listSales,
  getSaleById,
  refundSale,
  downloadReceipt,
};

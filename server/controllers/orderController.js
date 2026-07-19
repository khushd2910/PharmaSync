const crypto = require('crypto');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Medicine = require('../models/Medicine');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { buildCartResponse, getEffectivePrice } = require('./cartController');
const { computeEffectiveStatus } = require('../utils/orderStatus');
const generateInvoicePdf = require('../utils/generateInvoicePdf');

const generateInvoiceNumber = () => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `INV-${datePart}-${randomPart}`;
};

// Atomically decrements stock for every cart item — each decrement only
// succeeds if enough stock is still available at that instant, which
// prevents overselling under concurrent checkouts. If any item fails
// (someone else bought the last units first), every earlier decrement in
// this order is rolled back and the whole checkout is rejected.
const decrementStockOrRollback = async (items) => {
  const decremented = [];

  for (const item of items) {
    const updated = await Medicine.findOneAndUpdate(
      { _id: item.medicine._id, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
      { new: true }
    );

    if (!updated) {
      // Roll back everything already decremented in this attempt
      for (const done of decremented) {
        await Medicine.updateOne({ _id: done.medicine }, { $inc: { stock: done.quantity } });
      }
      return { success: false, failedItem: item };
    }
    decremented.push({ medicine: item.medicine._id, quantity: item.quantity });
  }

  return { success: true };
};

// Reverses decrementStockOrRollback for a cancelled order — used both for
// user-initiated cancellation and admin-initiated cancellation.
const restockItems = async (items) => {
  for (const item of items) {
    await Medicine.updateOne({ _id: item.medicine }, { $inc: { stock: item.quantity } });
  }
};

// @desc    Place an order from the current cart
// @route   POST /api/orders
// @access  Private
const createOrder = catchAsync(async (req, res, next) => {
  const { address, paymentMethod } = req.body;

  if (!address || !address.line1 || !address.city) {
    return next(new AppError('A delivery address (line1, city) is required', 400));
  }
  if (!['COD', 'UPI'].includes(paymentMethod)) {
    return next(new AppError('paymentMethod must be COD or UPI', 400));
  }

  const cart = await Cart.findOne({ user: req.user._id }).populate('items.medicine');
  if (!cart || cart.items.length === 0) {
    return next(new AppError('Your cart is empty', 400));
  }

  const validItems = cart.items.filter((item) => item.medicine && !item.medicine.isDiscontinued);
  if (validItems.length === 0) {
    return next(new AppError('No valid items in cart to order', 400));
  }

  const stockResult = await decrementStockOrRollback(validItems);
  if (!stockResult.success) {
    return next(
      new AppError(`"${stockResult.failedItem.medicine.name}" no longer has enough stock. Please update your cart.`, 409)
    );
  }

  const orderItems = validItems.map((item) => ({
    medicine: item.medicine._id,
    name: item.medicine.name,
    price: getEffectivePrice(item.medicine),
    quantity: item.quantity,
  }));
  const totalAmount = Math.round(orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100) / 100;

  const order = await Order.create({
    user: req.user._id,
    items: orderItems,
    totalAmount,
    address: {
      line1: address.line1,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      lat: address.lat,
      lng: address.lng,
    },
    paymentMethod,
    // UPI (Demo) "succeeds" instantly for demo purposes; COD is settled on delivery
    paymentStatus: paymentMethod === 'UPI' ? 'Paid' : 'Pending',
    orderStatus: 'Pending',
    invoiceNumber: generateInvoiceNumber(),
  });

  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });

  return res.status(201).json({ message: 'Order placed successfully', order });
});

// @desc    List the logged-in user's past orders
// @route   GET /api/orders
// @access  Private
const getMyOrders = catchAsync(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  return res.status(200).json({ orders });
});

// @desc    Get a single order (must belong to the requesting user)
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = catchAsync(async (req, res, next) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) {
    return next(new AppError('Order not found', 404));
  }
  return res.status(200).json({ order });
});

// @desc    Cancel one of the logged-in user's own orders — only while it's
//          still early (Pending/Confirmed); once it's Packed or further,
//          it's too late to cancel from the storefront.
// @route   PATCH /api/orders/:id/cancel
// @access  Private
const cancelOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  const effectiveStatus = computeEffectiveStatus(order);
  if (effectiveStatus === 'Cancelled') {
    return next(new AppError('This order is already cancelled', 400));
  }
  if (!['Pending', 'Confirmed'].includes(effectiveStatus)) {
    return next(new AppError('This order is already being prepared and can no longer be cancelled', 400));
  }

  await restockItems(order.items);
  order.orderStatus = 'Cancelled';
  order.demoMode = false;
  await order.save();

  return res.status(200).json({ message: 'Order cancelled and refund/restock processed', order });
});

// @desc    Download a GST-style PDF invoice for an order (owner or admin)
// @route   GET /api/orders/:id/invoice
// @access  Private
const downloadInvoice = catchAsync(async (req, res, next) => {
  const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, user: req.user._id };
  const order = await Order.findOne(filter).populate('user', 'name email phone address');

  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${order.invoiceNumber}.pdf"`);
  generateInvoicePdf(order, res);
});

// @desc    List every order in the system, optionally filtered by status
// @route   GET /api/admin/orders?status=
// @access  Private (admin)
const adminListOrders = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.status) {
    filter.orderStatus = req.query.status;
  }
  const orders = await Order.find(filter).populate('user', 'name email').sort({ createdAt: -1 });
  return res.status(200).json({ orders });
});

// @desc    Manually set an order's status — takes it out of demo-timer mode
//          permanently. Cancelling here also restocks the items.
// @route   PATCH /api/admin/orders/:id/status
// @access  Private (admin)
const adminUpdateOrderStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  if (!Order.ORDER_STATUSES.includes(status)) {
    return next(new AppError(`status must be one of: ${Order.ORDER_STATUSES.join(', ')}`, 400));
  }

  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError('Order not found', 404));
  }

  if (status === 'Cancelled' && order.orderStatus !== 'Cancelled') {
    await restockItems(order.items);
  }

  order.orderStatus = status;
  order.demoMode = false;
  await order.save();

  return res.status(200).json({ message: 'Order status updated', order });
});

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  downloadInvoice,
  adminListOrders,
  adminUpdateOrderStatus,
};

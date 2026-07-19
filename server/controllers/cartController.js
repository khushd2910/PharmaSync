const Cart = require('../models/Cart');
const Medicine = require('../models/Medicine');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// Populates the medicine details for each cart item and computes totals —
// shared by every endpoint below so the client always gets a ready-to-render
// cart object instead of raw ids/quantities.
const buildCartResponse = async (userId) => {
  let cart = await Cart.findOne({ user: userId }).populate('items.medicine');

  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }

  // Drop any items whose medicine was deleted/discontinued since being added
  const validItems = cart.items.filter((item) => item.medicine);

  const items = validItems.map((item) => ({
    medicine: item.medicine,
    quantity: item.quantity,
    lineTotal: Math.round(getEffectivePrice(item.medicine) * item.quantity * 100) / 100,
  }));

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;

  return { items, totalItems, totalAmount };
};

const getEffectivePrice = (medicine) => {
  const price = medicine.price || 0;
  if (medicine.discountPercent > 0) {
    return Math.round(price * (1 - medicine.discountPercent / 100) * 100) / 100;
  }
  return price;
};

// @desc    Get the logged-in user's cart
// @route   GET /api/cart
// @access  Private
const getCart = catchAsync(async (req, res) => {
  const cart = await buildCartResponse(req.user._id);
  return res.status(200).json({ cart });
});

// @desc    Add a medicine to the cart (or increase quantity if already present)
// @route   POST /api/cart/items
// @access  Private
const addItem = catchAsync(async (req, res, next) => {
  const { medicineId, quantity = 1 } = req.body;

  if (!medicineId) {
    return next(new AppError('medicineId is required', 400));
  }
  const qty = Math.max(parseInt(quantity, 10) || 1, 1);

  const medicine = await Medicine.findById(medicineId);
  if (!medicine || medicine.isDiscontinued) {
    return next(new AppError('Medicine not found or unavailable', 404));
  }
  if (medicine.stock <= 0) {
    return next(new AppError('This medicine is currently out of stock', 400));
  }

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  const existing = cart.items.find((i) => i.medicine.toString() === medicineId);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + qty, medicine.stock);
  } else {
    cart.items.push({ medicine: medicineId, quantity: Math.min(qty, medicine.stock) });
  }
  await cart.save();

  const cartResponse = await buildCartResponse(req.user._id);
  return res.status(200).json({ message: 'Added to cart', cart: cartResponse });
});

// @desc    Set an item's quantity directly (used by +/- controls)
// @route   PATCH /api/cart/items/:medicineId
// @access  Private
const updateItemQuantity = catchAsync(async (req, res, next) => {
  const { medicineId } = req.params;
  const { quantity } = req.body;
  const qty = parseInt(quantity, 10);

  if (!Number.isFinite(qty) || qty < 1) {
    return next(new AppError('quantity must be at least 1', 400));
  }

  const medicine = await Medicine.findById(medicineId);
  if (!medicine) {
    return next(new AppError('Medicine not found', 404));
  }

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  const item = cart.items.find((i) => i.medicine.toString() === medicineId);
  if (!item) {
    return next(new AppError('Item not in cart', 404));
  }

  item.quantity = Math.min(qty, medicine.stock || qty);
  await cart.save();

  const cartResponse = await buildCartResponse(req.user._id);
  return res.status(200).json({ cart: cartResponse });
});

// @desc    Remove a single item from the cart
// @route   DELETE /api/cart/items/:medicineId
// @access  Private
const removeItem = catchAsync(async (req, res) => {
  const { medicineId } = req.params;

  await Cart.updateOne({ user: req.user._id }, { $pull: { items: { medicine: medicineId } } });

  const cartResponse = await buildCartResponse(req.user._id);
  return res.status(200).json({ cart: cartResponse });
});

// @desc    Empty the cart (used after a successful checkout)
// @route   DELETE /api/cart
// @access  Private
const clearCart = catchAsync(async (req, res) => {
  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
  return res.status(200).json({ cart: { items: [], totalItems: 0, totalAmount: 0 } });
});

module.exports = { getCart, addItem, updateItemQuantity, removeItem, clearCart, buildCartResponse, getEffectivePrice };

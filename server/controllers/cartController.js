const Cart = require('../models/Cart');
const Medicine = require('../models/Medicine');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// Populates the medicine details for each cart item and computes totals —
// shared by every endpoint below so the client always gets a ready-to-render
// cart object instead of raw ids/quantities.
const buildCartResponse = async (userId) => {
  let cart = await Cart.findOne({ user: userId }).populate('items.medicine savedItems.medicine');

  if (!cart) {
    cart = await Cart.create({ user: userId, items: [], savedItems: [] });
  }

  // A cart item's medicine reference can go stale if that medicine was
  // later removed from the catalog outside the normal cascading-delete
  // path (a reseed/bulk import that swaps ids, for example) — populate()
  // then silently returns null for that item instead of throwing. This
  // used to only be filtered out of savedItems (see validSaved below),
  // never out of items itself, so a stale item shipped to the client as
  // `{ medicine: null, ... }` and crashed every component that assumes
  // item.medicine exists (MedicineCard's cart lookup, Cart, Checkout).
  // Drop it here too, and persist the cleanup so it only has to happen
  // once per cart rather than re-triggering on every request.
  const hasStaleItems = cart.items.some((item) => !item.medicine);
  if (hasStaleItems) {
    cart.items = cart.items.filter((item) => item.medicine);
    await cart.save();
  }

  const items = cart.items.map((item) => {
    const medicine = item.medicine;
    const currentPrice = medicine ? getEffectivePrice(medicine) : 0;
    const addedPrice = Number.isFinite(item.addedPrice) ? item.addedPrice : currentPrice;
    const addedStock = Number.isFinite(item.addedStock) ? item.addedStock : (medicine?.stock ?? 0);
    const priceChanged = medicine && currentPrice !== addedPrice;
    const outOfStock = medicine && medicine.stock === 0;
    const onlyLeft = medicine && medicine.stock > 0 && medicine.stock < item.quantity;
    const lineTotal = Math.round(currentPrice * item.quantity * 100) / 100;

    return {
      medicine,
      quantity: item.quantity,
      lineTotal,
      currentPrice,
      addedPrice,
      addedStock,
      priceChanged,
      priceDelta: Math.round((currentPrice - addedPrice) * 100) / 100,
      outOfStock,
      onlyLeft,
      stockLevel: medicine?.stock ?? 0,
    };
  });

  const validSaved = cart.savedItems.filter((item) => item.medicine);
  const savedItems = validSaved.map((item) => ({
    medicine: item.medicine,
    quantity: item.quantity,
    addedAt: item.addedAt,
  }));

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = Math.round(items.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;

  return { items, savedItems, totalItems, totalAmount };
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
    cart = await Cart.create({ user: req.user._id, items: [], savedItems: [] });
  }

  const existing = cart.items.find((i) => i.medicine.toString() === medicineId);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + qty, medicine.stock);
  } else {
    cart.items.push({
      medicine: medicineId,
      quantity: Math.min(qty, medicine.stock),
      addedPrice: getEffectivePrice(medicine),
      addedStock: medicine.stock,
      addedName: medicine.name,
      addedManufacturer: medicine.manufacturer,
      addedPackSizeLabel: medicine.packSizeLabel,
      addedRequiresPrescription: medicine.requiresPrescription,
    });
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

  const availableStock = Number.isFinite(medicine.stock) ? medicine.stock : qty;
  if (availableStock <= 0) {
    return next(new AppError('This medicine is currently out of stock', 400));
  }

  item.quantity = Math.min(qty, availableStock);
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

// @desc    Save a cart item for later/wishlist
// @route   POST /api/cart/items/:medicineId/save
// @access  Private
const saveItemForLater = catchAsync(async (req, res, next) => {
  const { medicineId } = req.params;
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  const itemIndex = cart.items.findIndex((i) => i.medicine.toString() === medicineId);
  if (itemIndex === -1) {
    return next(new AppError('Item not in cart', 404));
  }

  const [item] = cart.items.splice(itemIndex, 1);
  const savedItem = cart.savedItems.find((s) => s.medicine.toString() === medicineId);
  if (savedItem) {
    savedItem.quantity = Math.max(savedItem.quantity, item.quantity);
  } else {
    cart.savedItems.push({ medicine: item.medicine, quantity: item.quantity });
  }

  await cart.save();
  const cartResponse = await buildCartResponse(req.user._id);
  return res.status(200).json({ message: 'Saved for later', cart: cartResponse });
});

// @desc    Move a saved item back to the cart
// @route   POST /api/cart/saved/:medicineId/move-back
// @access  Private
const moveSavedItemToCart = catchAsync(async (req, res, next) => {
  const { medicineId } = req.params;
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return next(new AppError('Cart not found', 404));
  }

  const savedItemIndex = cart.savedItems.findIndex((s) => s.medicine.toString() === medicineId);
  if (savedItemIndex === -1) {
    return next(new AppError('Saved item not found', 404));
  }

  const savedItem = cart.savedItems[savedItemIndex];
  const medicine = await Medicine.findById(medicineId);
  if (!medicine || medicine.isDiscontinued) {
    return next(new AppError('Medicine not available to move back to cart', 400));
  }
  if (medicine.stock <= 0) {
    return next(new AppError('Medicine is out of stock', 400));
  }

  const quantityToAdd = Math.min(savedItem.quantity, medicine.stock);
  const existing = cart.items.find((i) => i.medicine.toString() === medicineId);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantityToAdd, medicine.stock);
  } else {
    cart.items.push({
      medicine: medicineId,
      quantity: quantityToAdd,
      addedPrice: getEffectivePrice(medicine),
      addedStock: medicine.stock,
      addedName: medicine.name,
      addedManufacturer: medicine.manufacturer,
      addedPackSizeLabel: medicine.packSizeLabel,
      addedRequiresPrescription: medicine.requiresPrescription,
    });
  }
  cart.savedItems.splice(savedItemIndex, 1);
  await cart.save();

  const cartResponse = await buildCartResponse(req.user._id);
  return res.status(200).json({ message: 'Moved back to cart', cart: cartResponse });
});

// @desc    Remove a saved item from the wishlist
// @route   DELETE /api/cart/saved/:medicineId
// @access  Private
const removeSavedItem = catchAsync(async (req, res) => {
  const { medicineId } = req.params;
  await Cart.updateOne({ user: req.user._id }, { $pull: { savedItems: { medicine: medicineId } } });
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

module.exports = {
  getCart,
  addItem,
  updateItemQuantity,
  removeItem,
  saveItemForLater,
  moveSavedItemToCart,
  removeSavedItem,
  clearCart,
  buildCartResponse,
  getEffectivePrice,
};

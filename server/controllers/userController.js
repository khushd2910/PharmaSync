const User = require('../models/User');
const Medicine = require('../models/Medicine');
const Order = require('../models/Order');
const Prescription = require('../models/Prescription');
const Cart = require('../models/Cart');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// Shape returned to the client after any profile/address/wishlist mutation —
// mirrors authController's publicUser so the account object in AuthContext
// never has a different shape depending on which endpoint touched it.
const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  addresses: user.addresses,
  wishlist: user.wishlist,
  role: user.role,
  isVerified: user.isVerified,
  lastLoginAt: user.lastLoginAt,
  previousLoginAt: user.previousLoginAt,
});

// @desc    Update the logged-in user's own profile (name, phone only —
//          addresses are managed through their own endpoints below)
// @route   PATCH /api/user/profile
// @access  Private
const updateProfile = catchAsync(async (req, res) => {
  const { name, phone } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  return res.status(200).json({ message: 'Profile updated', user: publicUser(user) });
});

// @desc    Add a new saved address. The first address a user ever saves
//          becomes the default automatically; after that, isDefault must
//          be requested explicitly (or set later via setDefaultAddress).
// @route   POST /api/user/addresses
// @access  Private
const addAddress = catchAsync(async (req, res, next) => {
  const { label, line1, city, state, pincode, isDefault } = req.body;

  if (!line1 || !line1.trim() || !city || !city.trim()) {
    return next(new AppError('Please enter at least an address line and city', 400));
  }

  const user = await User.findById(req.user._id);
  const shouldBeDefault = isDefault || user.addresses.length === 0;

  if (shouldBeDefault) {
    user.addresses.forEach((a) => {
      a.isDefault = false;
    });
  }

  user.addresses.push({ label: label || 'Home', line1, city, state, pincode, isDefault: shouldBeDefault });
  await user.save();

  return res.status(201).json({ message: 'Address added', user: publicUser(user) });
});

// @desc    Update one of the logged-in user's saved addresses
// @route   PATCH /api/user/addresses/:addressId
// @access  Private
const updateAddress = catchAsync(async (req, res, next) => {
  const { label, line1, city, state, pincode } = req.body;

  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) {
    return next(new AppError('Address not found', 404));
  }

  if (label !== undefined) address.label = label;
  if (line1 !== undefined) address.line1 = line1;
  if (city !== undefined) address.city = city;
  if (state !== undefined) address.state = state;
  if (pincode !== undefined) address.pincode = pincode;

  await user.save();

  return res.status(200).json({ message: 'Address updated', user: publicUser(user) });
});

// @desc    Delete one of the logged-in user's saved addresses. If the
//          deleted one was the default, the next remaining address (if
//          any) is promoted so there's never a saved list with no default.
// @route   DELETE /api/user/addresses/:addressId
// @access  Private
const deleteAddress = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) {
    return next(new AppError('Address not found', 404));
  }

  const wasDefault = address.isDefault;
  address.deleteOne();

  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  await user.save();

  return res.status(200).json({ message: 'Address removed', user: publicUser(user) });
});

// @desc    Mark one saved address as the default (used to pre-fill
//          Checkout); clears the flag on every other saved address.
// @route   PATCH /api/user/addresses/:addressId/default
// @access  Private
const setDefaultAddress = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  const target = user.addresses.id(req.params.addressId);
  if (!target) {
    return next(new AppError('Address not found', 404));
  }

  user.addresses.forEach((a) => {
    a.isDefault = a._id.equals(target._id);
  });
  await user.save();

  return res.status(200).json({ message: 'Default address updated', user: publicUser(user) });
});

// @desc    List the logged-in user's wishlisted medicines with current
//          data (price/stock can move, so this always reads fresh rather
//          than trusting whatever was true when it was bookmarked).
//          Discontinued medicines are silently dropped, same as the rest
//          of the storefront.
// @route   GET /api/user/wishlist
// @access  Private
const getWishlist = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  const medicines = await Medicine.find({
    _id: { $in: user.wishlist },
    isDiscontinued: { $ne: true },
  });
  return res.status(200).json({ medicines });
});

// @desc    Toggle a medicine in/out of the logged-in user's wishlist.
// @route   POST /api/user/wishlist/:medicineId/toggle
// @access  Private
const toggleWishlist = catchAsync(async (req, res, next) => {
  const { medicineId } = req.params;

  const medicine = await Medicine.findById(medicineId);
  if (!medicine) {
    return next(new AppError('Medicine not found', 404));
  }

  const user = await User.findById(req.user._id);
  const isWishlisted = user.wishlist.some((id) => id.equals(medicine._id));

  if (isWishlisted) {
    user.wishlist = user.wishlist.filter((id) => !id.equals(medicine._id));
  } else {
    user.wishlist.push(medicine._id);
  }
  await user.save();

  return res.status(200).json({
    message: isWishlisted ? 'Removed from wishlist' : 'Added to wishlist',
    wishlisted: !isWishlisted,
    wishlist: user.wishlist,
  });
});

// @desc    Change the logged-in user's password (requires current password)
// @route   PATCH /api/user/change-password
// @access  Private
const changePassword = catchAsync(async (req, res, next) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmPassword) {
    return next(new AppError('Please fill in all password fields', 400));
  }
  if (newPassword !== confirmPassword) {
    return next(new AppError('New password and confirm password do not match', 400));
  }
  if (newPassword.length < 8) {
    return next(new AppError('New password must be at least 8 characters', 400));
  }
  if (newPassword === oldPassword) {
    return next(new AppError('New password must be different from the old password', 400));
  }

  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.matchPassword(oldPassword))) {
    return next(new AppError('Current password is incorrect', 401));
  }

  user.password = newPassword; // hashed by the pre-save hook
  await user.save();

  return res.status(200).json({ message: 'Password changed successfully' });
});

// @desc    Export all of the logged-in user's personal data as a downloadable
//          JSON file — profile, saved addresses, wishlist, order history and
//          prescription uploads. Kept as one flat file (rather than a zip of
//          per-resource files) since the volume per user is small and a
//          single JSON is easiest for a person to actually read or archive.
// @route   GET /api/user/export
// @access  Private
const exportUserData = catchAsync(async (req, res) => {
  const [orders, prescriptions] = await Promise.all([
    Order.find({ user: req.user._id }).lean(),
    Prescription.find({ user: req.user._id }).select('-reviewedBy').lean(),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    profile: {
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
      isVerified: req.user.isVerified,
      createdAt: req.user.createdAt,
    },
    addresses: req.user.addresses,
    wishlist: req.user.wishlist,
    orders,
    prescriptions,
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="pharmasync-data-${req.user._id}.json"`);
  return res.status(200).send(JSON.stringify(exportData, null, 2));
});

// @desc    Permanently delete the logged-in user's own account. Requires the
//          current password as a confirmation step (same trust bar as
//          changePassword) since this is irreversible. Saved cart and any
//          not-yet-used prescription uploads are removed with the account;
//          past orders are kept as-is for billing/records the way most
//          storefronts retain transaction history after account closure.
// @route   DELETE /api/user/account
// @access  Private
const deleteAccount = catchAsync(async (req, res, next) => {
  const { password } = req.body;

  if (!password) {
    return next(new AppError('Please enter your password to confirm account deletion', 400));
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.matchPassword(password))) {
    return next(new AppError('Incorrect password', 401));
  }

  await Promise.all([
    Cart.deleteOne({ user: user._id }),
    Prescription.deleteMany({ user: user._id, order: null }),
  ]);
  await user.deleteOne();

  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });

  return res.status(200).json({ message: 'Account deleted successfully' });
});

// @desc    Lightweight profile stats for the summary card — lifetime order
//          count/spend and prescription counts. Cancelled orders are
//          excluded from the spend total since nothing was actually kept.
// @route   GET /api/user/stats
// @access  Private
const getProfileStats = catchAsync(async (req, res) => {
  const [orderAgg, prescriptionAgg] = await Promise.all([
    Order.aggregate([
      { $match: { user: req.user._id, orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: null, orderCount: { $sum: 1 }, totalSpent: { $sum: '$totalAmount' } } },
    ]),
    Prescription.aggregate([
      { $match: { user: req.user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const { orderCount = 0, totalSpent = 0 } = orderAgg[0] || {};

  let prescriptionCount = 0;
  let pendingPrescriptionCount = 0;
  prescriptionAgg.forEach((row) => {
    prescriptionCount += row.count;
    if (row._id === 'Pending') pendingPrescriptionCount = row.count;
  });

  return res.status(200).json({ orderCount, totalSpent, prescriptionCount, pendingPrescriptionCount });
});

// @desc    Invalidate the logged-in user's stored refresh token — since only
//          one is tracked at a time, this is the same effect as "sign out
//          everywhere": any browser/device relying on it will be asked to
//          log in again the next time its access token expires.
// @route   POST /api/user/logout-all-devices
// @access  Private
const logoutAllDevices = catchAsync(async (req, res) => {
  req.user.refreshTokenHash = undefined;
  await req.user.save({ validateBeforeSave: false });

  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });

  return res.status(200).json({ message: 'Logged out of all devices' });
});

module.exports = {
  updateProfile,
  changePassword,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getWishlist,
  toggleWishlist,
  exportUserData,
  deleteAccount,
  getProfileStats,
  logoutAllDevices,
};

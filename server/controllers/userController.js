const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// @desc    Update the logged-in user's own profile
// @route   PATCH /api/user/profile
// @access  Private
const updateProfile = catchAsync(async (req, res) => {
  const { name, phone, address } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (address !== undefined) {
    // Accept either the structured {line1, city, state, pincode} object the
    // profile form now sends, or a plain string (older clients) so we don't
    // break on partial rollouts.
    updates.address = typeof address === 'string' ? { line1: address } : address;
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  return res.status(200).json({
    message: 'Profile updated',
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      role: user.role,
      isVerified: user.isVerified,
    },
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

module.exports = { updateProfile, changePassword };

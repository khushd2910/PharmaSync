const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');

// @desc    Update the logged-in user's own profile
// @route   PATCH /api/user/profile
// @access  Private
const updateProfile = catchAsync(async (req, res) => {
  const { name, phone, address } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (address !== undefined) updates.address = address;

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

module.exports = { updateProfile };

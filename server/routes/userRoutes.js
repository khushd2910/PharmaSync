const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  updateProfile,
  changePassword,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getWishlist,
  toggleWishlist,
} = require('../controllers/userController');

// @desc  Update the logged-in user's own profile (name, phone)
// @route PATCH /api/user/profile
// @access Private
router.patch('/profile', protect, updateProfile);

// @desc  Change the logged-in user's password (requires current password)
// @route PATCH /api/user/change-password
// @access Private
router.patch('/change-password', protect, changePassword);

// Saved addresses — a user can keep several (Home / Work / etc.) and pick
// which one is the default that Checkout pre-fills.
router.post('/addresses', protect, addAddress);
router.patch('/addresses/:addressId', protect, updateAddress);
router.delete('/addresses/:addressId', protect, deleteAddress);
router.patch('/addresses/:addressId/default', protect, setDefaultAddress);

// Wishlist — bookmark medicines from the storefront to come back to later.
router.get('/wishlist', protect, getWishlist);
router.post('/wishlist/:medicineId/toggle', protect, toggleWishlist);

module.exports = router;

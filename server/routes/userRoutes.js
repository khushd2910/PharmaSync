const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { updateProfile, changePassword } = require('../controllers/userController');

// @desc  Update the logged-in user's own profile (name, phone, address)
// @route PATCH /api/user/profile
// @access Private
router.patch('/profile', protect, updateProfile);

// @desc  Change the logged-in user's password (requires current password)
// @route PATCH /api/user/change-password
// @access Private
router.patch('/change-password', protect, changePassword);

module.exports = router;

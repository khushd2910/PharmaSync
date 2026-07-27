const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { updateProfile } = require('../controllers/userController');

// @desc  Update the logged-in user's own profile (name, phone, address)
// @route PATCH /api/user/profile
// @access Private
router.patch('/profile', protect, updateProfile);

module.exports = router;

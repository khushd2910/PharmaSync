const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// @desc  User dashboard (placeholder - later modules will add real data:
//        cart, orders, medicine listing, etc.)
// @route GET /api/user/dashboard
// @access Private (logged-in users)
router.get('/dashboard', protect, (req, res) => {
  res.status(200).json({
    message: `Welcome ${req.user.name}`,
    info: 'You can shop medicines from here (coming in Module 2).',
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

module.exports = router;

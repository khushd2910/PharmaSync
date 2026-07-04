const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');

// @desc  Admin dashboard (placeholder - later modules add medicine CRUD,
//        stock management, order management, POS billing, invoices, etc.)
// @route GET /api/admin/dashboard
// @access Private (admin only)
router.get('/dashboard', protect, adminOnly, (req, res) => {
  res.status(200).json({
    message: `Welcome Admin ${req.user.name}`,
    info: 'Manage complete pharmacy from here (coming in later modules).',
    admin: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

module.exports = router;

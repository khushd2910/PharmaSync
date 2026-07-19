const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { adminListOrders, adminUpdateOrderStatus } = require('../controllers/orderController');
const { getDashboardStats } = require('../controllers/adminController');
const { createMedicine } = require('../controllers/medicineController');
const { validate, addMedicineRules } = require('../middleware/validators');

router.use(protect, adminOnly); // every admin route requires an admin login

// @desc  Admin dashboard (placeholder - later modules add medicine CRUD,
//        stock management, POS billing, etc.)
// @route GET /api/admin/dashboard
router.get('/dashboard', (req, res) => {
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

// @desc  Overview counters for the dashboard (medicines, orders, revenue,
//        low stock, expiring soon)
// @route GET /api/admin/dashboard/stats
router.get('/dashboard/stats', getDashboardStats);

// @desc  List all orders, optionally filtered by status
// @route GET /api/admin/orders?status=
router.get('/orders', adminListOrders);

// @desc  Manually advance/cancel an order's status
// @route PATCH /api/admin/orders/:id/status
router.patch('/orders/:id/status', adminUpdateOrderStatus);

// @desc  Add a new medicine to the catalog
// @route POST /api/admin/medicines
router.post('/medicines', addMedicineRules, validate, createMedicine);

module.exports = router;

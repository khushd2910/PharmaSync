const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { adminListOrders, adminUpdateOrderStatus } = require('../controllers/orderController');
const { getDashboardStats } = require('../controllers/adminController');
const { createMedicine, adminListMedicines, updateMedicine } = require('../controllers/medicineController');
const { validate, addMedicineRules, updateMedicineRules } = require('../middleware/validators');

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

// @desc  List medicines for the admin management table (includes discontinued)
// @route GET /api/admin/medicines?search=&page=&limit=
router.get('/medicines', adminListMedicines);

// @desc  Add a new medicine to the catalog
// @route POST /api/admin/medicines
router.post('/medicines', addMedicineRules, validate, createMedicine);

// @desc  Edit an existing medicine — takes effect on the storefront (and
//        future POS) immediately, since both read the same catalog.
// @route PATCH /api/admin/medicines/:id
router.patch('/medicines/:id', updateMedicineRules, validate, updateMedicine);

module.exports = router;

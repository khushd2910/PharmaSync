const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { adminListOrders, adminUpdateOrderStatus } = require('../controllers/orderController');
const { getDashboardStats } = require('../controllers/adminController');
const { getInventoryAnalysis, runInventoryAnalysis } = require('../controllers/inventoryAnalysisController');
const { getSalesAnalysis, runSalesAnalysis, getDemandForecast, runDemandForecast, getRevenueForecast, runRevenueForecast } = require('../controllers/salesAnalysisController');
const { getExpiryAnalysis, runExpiryAnalysis } = require('../controllers/expiryAnalysisController');
const { listReports, generateReports, downloadReport } = require('../controllers/reportController');
const {
  createMedicine,
  adminListMedicines,
  updateMedicine,
  deleteMedicine,
  restockMedicine,
  bulkImportMedicines,
} = require('../controllers/medicineController');
const { validate, addMedicineRules, updateMedicineRules } = require('../middleware/validators');
const { adminListPrescriptions, adminReviewPrescription } = require('../controllers/prescriptionController');

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

// @desc  Latest nightly inventory analysis snapshot (Total Stock, Low
//        Stock, Fast Selling, Slow Selling) — written by the Python service
// @route GET /api/admin/inventory-analysis
router.get('/inventory-analysis', getInventoryAnalysis);

// @desc  Run the Python analysis job on demand instead of waiting for its
//        nightly schedule
// @route POST /api/admin/inventory-analysis/run
router.post('/inventory-analysis/run', runInventoryAnalysis);

// @desc  Latest nightly sales analysis snapshot (Daily/Weekly/Monthly
//        Sales, Revenue, Best/Worst Sellers) — written by the Python service
// @route GET /api/admin/sales-analysis
router.get('/sales-analysis', getSalesAnalysis);

// @desc  Run the Python sales analysis job on demand
// @route POST /api/admin/sales-analysis/run
router.post('/sales-analysis/run', runSalesAnalysis);

// @desc  Latest ML-based demand forecast snapshot
// @route GET /api/admin/demand-forecast
router.get('/demand-forecast', getDemandForecast);

// @desc  Run the ML-based demand forecast job on demand
// @route POST /api/admin/demand-forecast/run
router.post('/demand-forecast/run', runDemandForecast);

// @desc  Latest ML-based revenue forecast snapshot
// @route GET /api/admin/revenue-forecast
router.get('/revenue-forecast', getRevenueForecast);

// @desc  Run the ML-based revenue forecast job on demand
// @route POST /api/admin/revenue-forecast/run
router.post('/revenue-forecast/run', runRevenueForecast);


// @desc  Latest nightly expiry analysis snapshot (Expired, Expiring in
//        30/60/90 Days, and the alert count) — written by the Python service
// @route GET /api/admin/expiry-analysis
router.get('/expiry-analysis', getExpiryAnalysis);

// @desc  Run the Python expiry analysis job on demand
// @route POST /api/admin/expiry-analysis/run
router.post('/expiry-analysis/run', runExpiryAnalysis);

// @desc  Current state of the four CSV exports (Sales, Inventory, Expiry,
//        Orders) — name, size, and when each was last generated
// @route GET /api/admin/reports
router.get('/reports', listReports);

// @desc  Run the Module 7 report-generation script on demand, overwriting
//        the four CSVs under reports/exports with a fresh snapshot
// @route POST /api/admin/reports/generate
router.post('/reports/generate', generateReports);

// @desc  Download one of the generated CSVs by exact filename
// @route GET /api/admin/reports/download/:filename
router.get('/reports/download/:filename', downloadReport);

// @desc  List all orders, optionally filtered by status
// @route GET /api/admin/orders?status=&page=&limit=
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

// @desc  Bulk-add/update medicines from CSV text (parsed client-side,
//        sent as { csv: "..." } — no file-upload middleware needed)
// @route POST /api/admin/medicines/bulk-import
router.post('/medicines/bulk-import', bulkImportMedicines);

// @desc  Edit an existing medicine — takes effect on the storefront (and
//        future POS) immediately, since both read the same catalog.
// @route PATCH /api/admin/medicines/:id
router.patch('/medicines/:id', updateMedicineRules, validate, updateMedicine);

// @desc  Refill stock by a given amount — the quick action for a low-stock alert
// @route PATCH /api/admin/medicines/:id/restock
router.patch('/medicines/:id/restock', restockMedicine);

// @desc  Delete a medicine — removed from inventory entirely
// @route DELETE /api/admin/medicines/:id
router.delete('/medicines/:id', deleteMedicine);

// @desc  List uploaded prescriptions for review, optionally filtered by
//        status (Module 10 — Prescription Medicine Alert)
// @route GET /api/admin/prescriptions?status=Pending
router.get('/prescriptions', adminListPrescriptions);

// @desc  Approve or reject an uploaded prescription. Approving unblocks
//        its linked order; rejecting cancels and restocks it.
// @route PATCH /api/admin/prescriptions/:id/review
router.patch('/prescriptions/:id/review', adminReviewPrescription);

module.exports = router;

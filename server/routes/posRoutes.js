const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const {
  searchCatalog,
  checkout,
  listSales,
  getSaleById,
  refundSale,
  downloadReceipt,
} = require('../controllers/posController');

router.use(protect, adminOnly); // POS counter is an admin/staff-only screen

// @desc  Look up medicines at the counter by barcode (exact) or free-text search
// @route GET /api/admin/pos/search?barcode=&query=
router.get('/search', searchCatalog);

// @desc  Ring up a sale — decrements stock and records the transaction
// @route POST /api/admin/pos/sales
router.post('/sales', checkout);

// @desc  Sales history / till reconciliation
// @route GET /api/admin/pos/sales?from=&to=&page=&limit=
router.get('/sales', listSales);

// @desc  Single sale detail
// @route GET /api/admin/pos/sales/:id
router.get('/sales/:id', getSaleById);

// @desc  Reverse a sale, restocking the items
// @route PATCH /api/admin/pos/sales/:id/refund
router.patch('/sales/:id/refund', refundSale);

// @desc  Printable receipt PDF
// @route GET /api/admin/pos/sales/:id/receipt
router.get('/sales/:id/receipt', downloadReceipt);

module.exports = router;

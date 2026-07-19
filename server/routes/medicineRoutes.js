const express = require('express');
const router = express.Router();
const {
  listMedicines,
  getCategories,
  getBrands,
  getMedicineById,
} = require('../controllers/medicineController');

// All public — no `protect` middleware — so guests can browse without
// logging in. Cart/checkout requires login.
// Specific paths (categories, brands) must come before the /:id catch-all.
router.get('/categories', getCategories);
router.get('/brands', getBrands);
router.get('/', listMedicines);
router.get('/:id', getMedicineById);

module.exports = router;

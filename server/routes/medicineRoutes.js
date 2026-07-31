const express = require('express');
const router = express.Router();
const {
  listMedicines,
  getCategories,
  getBrands,
  getMedicinesByIds,
  getGenericAlternatives,
  getMedicineById,
  getRelatedMedicines,
} = require('../controllers/medicineController');

// All public — no `protect` middleware — so guests can browse without
// logging in. Cart/checkout requires login.
// Specific paths (categories, brands, by-ids) must come before the /:id catch-all.
router.get('/categories', getCategories);
router.get('/brands', getBrands);
router.get('/by-ids', getMedicinesByIds);
router.get('/generics', getGenericAlternatives);
router.get('/', listMedicines);
router.get('/:id/related', getRelatedMedicines);
router.get('/:id', getMedicineById);

module.exports = router;

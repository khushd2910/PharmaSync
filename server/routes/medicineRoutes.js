const express = require('express');
const router = express.Router();
<<<<<<< HEAD
const { listMedicines, getMedicineById } = require('../controllers/medicineController');

// Both public — no `protect` middleware — so guests can browse without
// logging in. Cart/checkout (Module 2 continuation) will require login.
=======
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
>>>>>>> master
router.get('/', listMedicines);
router.get('/:id', getMedicineById);

module.exports = router;

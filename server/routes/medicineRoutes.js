const express = require('express');
const router = express.Router();
const { listMedicines, getMedicineById } = require('../controllers/medicineController');

// Both public — no `protect` middleware — so guests can browse without
// logging in. Cart/checkout (Module 2 continuation) will require login.
router.get('/', listMedicines);
router.get('/:id', getMedicineById);

module.exports = router;

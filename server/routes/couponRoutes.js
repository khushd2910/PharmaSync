const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { listCoupons, validateCouponCode } = require('../controllers/couponController');

router.use(protect);
router.get('/', listCoupons);
router.post('/validate', validateCouponCode);

module.exports = router;

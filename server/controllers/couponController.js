const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const Coupon = require('../models/Coupon');
const { validateCoupon, normalizeCoupon } = require('../utils/couponUtils');

const listCoupons = catchAsync(async (req, res) => {
  const coupons = await Coupon.find({ active: true }).select(
    'code description type value maxDiscount minOrder firstOrderOnly maxUsesPerUser active'
  );
  return res.status(200).json({ coupons: coupons.map(normalizeCoupon) });
});

const validateCouponCode = catchAsync(async (req, res, next) => {
  const { code, cartAmount } = req.body;
  if (!code) {
    return next(new AppError('coupon code is required', 400));
  }
  if (!Number.isFinite(cartAmount)) {
    return next(new AppError('cartAmount is required', 400));
  }

  const validation = await validateCoupon({ code, userId: req.user._id, cartAmount });
  if (!validation.valid) {
    return next(new AppError(validation.message, 400));
  }

  return res.status(200).json({ coupon: validation.coupon, discount: validation.discount, message: `${validation.coupon.code} applied` });
});

module.exports = { listCoupons, validateCouponCode };

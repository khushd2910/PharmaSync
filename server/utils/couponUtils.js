const Coupon = require('../models/Coupon');
const Order = require('../models/Order');

const computeCouponDiscount = (coupon, amount) => {
  if (!coupon || amount <= 0) return 0;
  if (coupon.type === 'percent') {
    return Math.min(amount * (coupon.value / 100), coupon.maxDiscount || Infinity);
  }
  return Math.min(coupon.value, amount);
};

const normalizeCoupon = (coupon) => ({
  code: coupon.code,
  description: coupon.description,
  type: coupon.type,
  value: coupon.value,
  maxDiscount: coupon.maxDiscount,
  minOrder: coupon.minOrder,
  firstOrderOnly: coupon.firstOrderOnly,
  maxUsesPerUser: coupon.maxUsesPerUser,
  active: coupon.active,
});

const validateCoupon = async ({ code, userId, cartAmount }) => {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) {
    return { valid: false, message: 'Coupon code is required' };
  }

  const coupon = await Coupon.findOne({ code: normalizedCode, active: true });
  if (!coupon) {
    return { valid: false, message: 'Invalid coupon code' };
  }

  if (cartAmount < coupon.minOrder) {
    return {
      valid: false,
      message: `Add items worth ₹${(coupon.minOrder - cartAmount).toFixed(2)} more to unlock ${coupon.code}`,
    };
  }

  if (coupon.firstOrderOnly) {
    const previousOrders = await Order.countDocuments({ user: userId });
    if (previousOrders > 0) {
      return { valid: false, message: `${coupon.code} is valid only on your first order` };
    }
  }

  if (coupon.maxUsesPerUser > 0) {
    const usedCount = await Order.countDocuments({ user: userId, couponCode: coupon.code });
    if (usedCount >= coupon.maxUsesPerUser) {
      return { valid: false, message: `You have already used ${coupon.code}` };
    }
  }

  const discount = Math.min(computeCouponDiscount(coupon, cartAmount), cartAmount);
  if (discount <= 0) {
    return { valid: false, message: 'This coupon does not apply to your current cart total' };
  }

  return { valid: true, coupon: normalizeCoupon(coupon), discount };
};

module.exports = { computeCouponDiscount, normalizeCoupon, validateCoupon };

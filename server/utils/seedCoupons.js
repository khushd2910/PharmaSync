const Coupon = require('../models/Coupon');

const COUPON_FIXTURES = [
  {
    code: 'PYMED25',
    description: 'Get 20% instant discount, up to ₹150',
    type: 'percent',
    value: 20,
    maxDiscount: 150,
    minOrder: 150,
    firstOrderOnly: false,
    maxUsesPerUser: 1,
    active: true,
  },
  {
    code: 'WELCOME50',
    description: 'Flat ₹50 off, exclusively for your first order',
    type: 'flat',
    value: 50,
    minOrder: 0,
    firstOrderOnly: true,
    maxUsesPerUser: 1,
    active: true,
  },
];

const seedCoupons = async () => {
  try {
    const existing = await Coupon.find({ code: { $in: COUPON_FIXTURES.map((c) => c.code) } }).select('code');
    const existingCodes = new Set(existing.map((c) => c.code));
    const toInsert = COUPON_FIXTURES.filter((coupon) => !existingCodes.has(coupon.code));
    if (toInsert.length > 0) {
      await Coupon.insertMany(toInsert);
    }
  } catch (err) {
    // Seed failures should not crash the app in development, but they
    // should still be visible in the logs.
    console.error('Coupon seed error:', err.message);
  }
};

module.exports = seedCoupons;

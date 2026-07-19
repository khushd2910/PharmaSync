const Medicine = require('../models/Medicine');
const Order = require('../models/Order');
const catchAsync = require('../utils/catchAsync');
const { LOW_STOCK_THRESHOLD, EXPIRY_WINDOW_DAYS } = require('../utils/inventoryConstants');

// @desc    Aggregate counters for the admin dashboard overview
//          (Total Medicines, Total Orders, Revenue, Low Stock, Expiring Medicines)
// @route   GET /api/admin/dashboard/stats
// @access  Private (admin)
const getDashboardStats = catchAsync(async (req, res) => {
  const now = new Date();
  const expiryWindowEnd = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [totalMedicines, totalOrders, revenueAgg, lowStockCount, expiringCount] = await Promise.all([
    Medicine.countDocuments({}),
    Order.countDocuments({}),
    // Revenue = sum of totalAmount across every non-cancelled order. Cancelled
    // orders are excluded since their stock was restocked and no sale stands.
    Order.aggregate([
      { $match: { orderStatus: { $ne: 'Cancelled' } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    // Low stock: active medicines at/under the threshold (includes 0/out-of-stock).
    Medicine.countDocuments({ isDiscontinued: false, stock: { $lte: LOW_STOCK_THRESHOLD } }),
    // Expiring soon: active medicines with a known expiry date landing in the
    // next EXPIRY_WINDOW_DAYS (already-expired stock isn't counted here — that's
    // a separate, more urgent concern for a later "expired stock" view).
    Medicine.countDocuments({
      isDiscontinued: false,
      expiryDate: { $gte: now, $lte: expiryWindowEnd },
    }),
  ]);

  return res.status(200).json({
    stats: {
      totalMedicines,
      totalOrders,
      revenue: Math.round((revenueAgg[0]?.total || 0) * 100) / 100,
      lowStockCount,
      expiringCount,
    },
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    expiryWindowDays: EXPIRY_WINDOW_DAYS,
  });
});

module.exports = { getDashboardStats };

const Medicine = require('../models/Medicine');
const Order = require('../models/Order');
const POSSale = require('../models/POSSale');
const catchAsync = require('../utils/catchAsync');
const { LOW_STOCK_THRESHOLD, EXPIRY_WINDOW_DAYS } = require('../utils/inventoryConstants');

// @desc    Aggregate counters for the admin dashboard overview
//          (Total Medicines, Total Orders, Revenue, Low Stock, Expiring Medicines)
//          Revenue and order counts now combine both channels — the online
//          storefront and the in-store POS register — since the business
//          reads as one pharmacy regardless of which counter made the sale.
//          The two are also broken out separately for admins who want to
//          see channel mix at a glance.
// @route   GET /api/admin/dashboard/stats
// @access  Private (admin)
const getDashboardStats = catchAsync(async (req, res) => {
  const now = new Date();
  const expiryWindowEnd = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [totalMedicines, totalOnlineOrders, totalPosSales, onlineRevenueAgg, posRevenueAgg, lowStockCount, expiringCount] =
    await Promise.all([
      Medicine.countDocuments({}),
      Order.countDocuments({}),
      POSSale.countDocuments({}),
      // Revenue = sum of totalAmount across every non-cancelled order. Cancelled
      // orders are excluded since their stock was restocked and no sale stands.
      Order.aggregate([
        { $match: { orderStatus: { $ne: 'Cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      // Same idea for the counter — a Refunded sale doesn't count as revenue.
      POSSale.aggregate([
        { $match: { status: { $ne: 'Refunded' } } },
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

  const onlineRevenue = Math.round((onlineRevenueAgg[0]?.total || 0) * 100) / 100;
  const posRevenue = Math.round((posRevenueAgg[0]?.total || 0) * 100) / 100;

  return res.status(200).json({
    stats: {
      totalMedicines,
      totalOrders: totalOnlineOrders + totalPosSales,
      revenue: Math.round((onlineRevenue + posRevenue) * 100) / 100,
      lowStockCount,
      expiringCount,
      // Channel breakdown for admins who want to see online vs in-store mix.
      onlineOrders: totalOnlineOrders,
      onlineRevenue,
      posSales: totalPosSales,
      posRevenue,
    },
    lowStockThreshold: LOW_STOCK_THRESHOLD,
    expiryWindowDays: EXPIRY_WINDOW_DAYS,
  });
});

module.exports = { getDashboardStats };

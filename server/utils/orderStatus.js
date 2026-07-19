/**
 * Server-side mirror of client/src/utils/orderStatus.js — kept in sync
 * deliberately so "can this order still be cancelled?" is decided using
 * the same effective status the user actually sees on screen.
 */
const ORDER_STAGES = ['Pending', 'Confirmed', 'Packed', 'Out for Delivery', 'Delivered'];
const STAGE_DURATION_MS = 45 * 1000; // must match client/src/utils/orderStatus.js

const computeEffectiveStatus = (order) => {
  if (order.orderStatus === 'Cancelled') return 'Cancelled';
  if (order.demoMode === false) return order.orderStatus; // admin has taken manual control

  const elapsed = Date.now() - new Date(order.createdAt).getTime();
  const timeIndex = Math.min(Math.floor(elapsed / STAGE_DURATION_MS), ORDER_STAGES.length - 1);
  const storedIndex = ORDER_STAGES.indexOf(order.orderStatus);
  const finalIndex = Math.max(timeIndex, storedIndex === -1 ? 0 : storedIndex);
  return ORDER_STAGES[finalIndex];
};

module.exports = { ORDER_STAGES, computeEffectiveStatus };

/**
 * Server-side mirror of client/src/utils/orderStatus.js — kept in sync
 * deliberately so "can this order still be cancelled?" is decided using
 * the same effective status the user actually sees on screen.
 *
 * This whole file exists to simulate delivery progress on a timer, purely
 * for demo purposes — a real pharmacy's orders don't actually walk
 * themselves through Confirmed -> Packed -> Delivered on a clock. Before
 * running this for real, set ORDER_DEMO_ENABLED=false (server .env) and
 * VITE_ORDER_DEMO_ENABLED=false (client .env) so an order's status is
 * exactly whatever staff/admin actually set it to, with no auto-advance.
 */
const ORDER_STAGES = ['Pending', 'Confirmed', 'Packed', 'Out for Delivery', 'Delivered'];

const DEMO_ENABLED = process.env.ORDER_DEMO_ENABLED !== 'false'; // opt out, not opt in — matches today's default behavior
const STAGE_DURATION_MS = Number(process.env.ORDER_DEMO_STAGE_DURATION_MS) || 45 * 1000; // must match client/src/utils/orderStatus.js

const computeEffectiveStatus = (order) => {
  if (order.orderStatus === 'Cancelled') return 'Cancelled';
  if (!DEMO_ENABLED) return order.orderStatus; // simulation off — status is exactly what was last set
  if (order.demoMode === false) return order.orderStatus; // admin has taken manual control

  const elapsed = Date.now() - new Date(order.createdAt).getTime();
  const timeIndex = Math.min(Math.floor(elapsed / STAGE_DURATION_MS), ORDER_STAGES.length - 1);
  const storedIndex = ORDER_STAGES.indexOf(order.orderStatus);
  const finalIndex = Math.max(timeIndex, storedIndex === -1 ? 0 : storedIndex);
  return ORDER_STAGES[finalIndex];
};

module.exports = { ORDER_STAGES, computeEffectiveStatus };

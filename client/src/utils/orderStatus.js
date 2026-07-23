// Demo-mode delivery simulation: while demoMode is true (no admin has ever
// manually set a status), we compute a plausible "in progress" status
// purely from elapsed time since the order was placed. Once an admin
// updates it (or the user cancels), demoMode flips false server-side and
// the real orderStatus is trusted directly everywhere.
//
// Set VITE_ORDER_DEMO_ENABLED=false (and ORDER_DEMO_ENABLED=false in the
// server's .env, to match) before running this for real — a genuine order
// shouldn't visually walk itself to "Delivered" on a clock.
export const ORDER_STAGES = ['Pending', 'Confirmed', 'Packed', 'Out for Delivery', 'Delivered'];

const DEMO_ENABLED = import.meta.env.VITE_ORDER_DEMO_ENABLED !== 'false'; // opt out, not opt in
const STAGE_DURATION_MS = Number(import.meta.env.VITE_ORDER_DEMO_STAGE_DURATION_MS) || 45 * 1000; // 45s default — must match server/utils/orderStatus.js

export const computeDisplayStatus = (order) => {
  if (!order) return ORDER_STAGES[0];
  if (order.orderStatus === 'Cancelled') return 'Cancelled';
  if (!DEMO_ENABLED) return order.orderStatus; // simulation off — status is exactly what was last set
  if (order.demoMode === false) return order.orderStatus; // admin has taken manual control

  const elapsed = Date.now() - new Date(order.createdAt).getTime();
  const timeIndex = Math.min(Math.floor(elapsed / STAGE_DURATION_MS), ORDER_STAGES.length - 1);
  const storedIndex = ORDER_STAGES.indexOf(order.orderStatus);
  const finalIndex = Math.max(timeIndex, storedIndex === -1 ? 0 : storedIndex);
  return ORDER_STAGES[finalIndex];
};

export const isCancellable = (order) => ['Pending', 'Confirmed'].includes(computeDisplayStatus(order));

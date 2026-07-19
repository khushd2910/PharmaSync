// Demo-mode delivery simulation: while demoMode is true (no admin has ever
// manually set a status), we compute a plausible "in progress" status
// purely from elapsed time since the order was placed. Once an admin
// updates it (or the user cancels), demoMode flips false server-side and
// the real orderStatus is trusted directly everywhere.
export const ORDER_STAGES = ['Pending', 'Confirmed', 'Packed', 'Out for Delivery', 'Delivered'];

const STAGE_DURATION_MS = 45 * 1000; // 45s per stage — full demo cycle ≈ 3 minutes

export const computeDisplayStatus = (order) => {
  if (!order) return ORDER_STAGES[0];
  if (order.orderStatus === 'Cancelled') return 'Cancelled';
  if (order.demoMode === false) return order.orderStatus; // admin has taken manual control

  const elapsed = Date.now() - new Date(order.createdAt).getTime();
  const timeIndex = Math.min(Math.floor(elapsed / STAGE_DURATION_MS), ORDER_STAGES.length - 1);
  const storedIndex = ORDER_STAGES.indexOf(order.orderStatus);
  const finalIndex = Math.max(timeIndex, storedIndex === -1 ? 0 : storedIndex);
  return ORDER_STAGES[finalIndex];
};

export const isCancellable = (order) => ['Pending', 'Confirmed'].includes(computeDisplayStatus(order));

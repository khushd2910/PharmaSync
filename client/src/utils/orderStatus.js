// An order's status is exactly whatever it was last set to — either the
// default 'Pending' at checkout, or whatever an admin explicitly set from
// the admin order management screen. There is no automatic/time-based
// progression; only an admin (or the user, for cancellation) changes an
// order's status. Kept in sync with server/utils/orderStatus.js.
export const ORDER_STAGES = ['Pending', 'Confirmed', 'Packed', 'Out for Delivery', 'Delivered'];

export const computeDisplayStatus = (order) => {
  if (!order) return ORDER_STAGES[0];
  if (order.orderStatus === 'Cancelled') return 'Cancelled';
  // Module 10: held at Pending until an admin approves the linked
  // prescription upload — mirrors server/utils/orderStatus.js.
  if (order.prescriptionRequired && order.prescriptionStatus !== 'Approved') return 'Pending';
  return order.orderStatus;
};

export const isCancellable = (order) => ['Pending', 'Confirmed'].includes(computeDisplayStatus(order));

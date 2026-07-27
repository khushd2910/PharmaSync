/**
 * Server-side mirror of client/src/utils/orderStatus.js — kept in sync
 * deliberately so "can this order still be cancelled?" is decided using
 * the same effective status the user actually sees on screen.
 *
 * An order's status is exactly whatever it was last set to — either the
 * default 'Pending' at checkout, or whatever an admin explicitly set via
 * adminUpdateOrderStatus. There is no automatic/time-based progression;
 * only an admin (or the user, for cancellation) changes an order's status.
 */
const ORDER_STAGES = ['Pending', 'Confirmed', 'Packed', 'Out for Delivery', 'Delivered'];

const computeEffectiveStatus = (order) => {
  if (order.orderStatus === 'Cancelled') return 'Cancelled';
  // Module 10: an order needing a prescription doesn't move past Pending
  // until an admin approves the linked upload — a rejection cancels it
  // outright (prescriptionController.adminReviewPrescription), so the only
  // way out of this branch is 'Approved'.
  if (order.prescriptionRequired && order.prescriptionStatus !== 'Approved') return 'Pending';
  return order.orderStatus;
};

module.exports = { ORDER_STAGES, computeEffectiveStatus };

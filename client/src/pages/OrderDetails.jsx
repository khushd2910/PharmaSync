import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { FileText, MapPin, CreditCard, Download, XCircle, ShieldAlert, Eye, Check, X } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';
import OrderStatusStepper from '../components/OrderStatusStepper';
import { isCancellable, computeDisplayStatus, ORDER_STAGES } from '../utils/orderStatus';
import { formatCurrency, formatDateTime } from '../utils/format';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ALL_STATUSES = [...ORDER_STAGES, 'Cancelled'];

// Fallback labels for older orders that don't have a paymentDetails string
// on file (placed before this field existed).
const PAYMENT_METHOD_LABELS = {
  COD: 'Cash on Delivery',
  UPI: 'UPI',
  Card: 'Card',
  Wallet: 'Wallet',
};

const OrderDetails = () => {
  const { id } = useParams();
  const location = useLocation();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [reviewingPrescription, setReviewingPrescription] = useState(false);
  const [confirmRejectOpen, setConfirmRejectOpen] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith('/admin/');

  const loadOrder = (silent = false) => {
    if (!silent) setLoading(true);
    const endpoint = location.pathname.startsWith('/admin/') ? `/admin/orders/${id}` : `/orders/${id}`;
    api
      .get(endpoint)
      .then((res) => setOrder(res.data.order))
      .catch((err) => {
        if (!silent) showToast(err.response?.data?.message || 'Order not found', 'error');
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    loadOrder();

    // A user might leave this order's page open while an admin edits it
    // elsewhere (status, prescription review) — refetch whenever they
    // return to the tab.
    const handleFocus = () => loadOrder(true);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadOrder(true);
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleCancel = async () => {
    setConfirmCancelOpen(false);
    setCancelling(true);
    try {
      // The plain `/orders/:id/cancel` endpoint only looks up orders that
      // belong to the logged-in user, so it 404s when an admin (a
      // different user) tries to cancel someone else's order from the
      // admin order-detail page. Admins go through the admin status
      // endpoint instead, which isn't scoped to a particular user.
      const res = isAdmin
        ? await api.patch(`/admin/orders/${id}/status`, { status: 'Cancelled' })
        : await api.patch(`/orders/${id}/cancel`);
      setOrder(res.data.order);
      showToast('Order cancelled', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not cancel order', 'error');
    } finally {
      setCancelling(false);
    }
  };

  // Module 10 — Prescription Medicine Alert gate. Mirrors the server-side
  // check in orderController.adminUpdateOrderStatus and the same helper on
  // AdminOrders.jsx: an order that needs a prescription can't be moved out
  // of Pending until that prescription is Approved — only Cancelled stays
  // available while it's awaiting (or was refused) review.
  const isStatusLocked = order && order.prescriptionRequired && order.prescriptionStatus !== 'Approved';

  // Resolve the prescription's id whether the order's `prescription` field
  // came back populated (an object with _id, fileName, etc. — the normal
  // case) or, for any response that didn't run it through .populate(),
  // as a bare id string. Using this everywhere instead of
  // `order.prescription._id` directly means a stray unpopulated response
  // can never turn into a broken "/undefined/" request.
  const prescriptionId = order && order.prescription && (order.prescription._id || order.prescription);

  const handleAdminStatusChange = async (newStatus) => {
    if (!newStatus || newStatus === order.orderStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await api.patch(`/admin/orders/${id}/status`, { status: newStatus });
      setOrder(res.data.order);
      showToast('Order status updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update status', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handlePrescriptionReview = async (status) => {
    if (status === 'Rejected') {
      setConfirmRejectOpen(true);
      return;
    }
    setReviewingPrescription(true);
    try {
      await api.patch(`/admin/prescriptions/${prescriptionId}/review`, { status });
      showToast('Prescription approved', 'success');
      loadOrder(true);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update prescription', 'error');
    } finally {
      setReviewingPrescription(false);
    }
  };

  const handlePrescriptionReject = async () => {
    setConfirmRejectOpen(false);
    setReviewingPrescription(true);
    try {
      await api.patch(`/admin/prescriptions/${prescriptionId}/review`, { status: 'Rejected' });
      showToast('Prescription rejected — order cancelled', 'success');
      loadOrder(true);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update prescription', 'error');
    } finally {
      setReviewingPrescription(false);
    }
  };

  if (loading) return <p className="info-text center-text">Loading order…</p>;
  if (!order) return <p className="info-text center-text">Order not found.</p>;

  return (
    <div className="order-details-page">
      <div className="order-details-header">
        <div>
          <h1 className="page-title">Order {order.invoiceNumber}</h1>
          <p className="muted-text">
            Placed {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="order-actions">
          {computeDisplayStatus(order) === 'Delivered' && (
            <a
              className="btn-secondary"
              href={`${API_BASE_URL}/orders/${order._id}/invoice`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download size={14} strokeWidth={2} /> Invoice
            </a>
          )}
          {isCancellable(order) && (
            <button className="btn-secondary danger" onClick={() => setConfirmCancelOpen(true)} disabled={cancelling}>
              <XCircle size={14} strokeWidth={2} /> {cancelling ? 'Cancelling…' : 'Cancel order'}
            </button>
          )}
          {isAdmin && order.orderStatus !== 'Delivered' && (
            <select
              className="sort-select"
              value={order.orderStatus}
              disabled={updatingStatus}
              title={
                isStatusLocked
                  ? order.prescriptionStatus === 'Rejected'
                    ? 'Prescription was rejected — this order can only be cancelled'
                    : 'Waiting on prescription approval — only cancellation is allowed until then'
                  : undefined
              }
              onChange={(e) => handleAdminStatusChange(e.target.value)}
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s} disabled={isStatusLocked && s !== 'Cancelled' && s !== order.orderStatus}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <section className="checkout-section">
        <OrderStatusStepper order={order} />
      </section>

      <ConfirmModal
        open={confirmCancelOpen}
        title="Cancel this order?"
        message="Your order will be cancelled and stock will be released back to inventory."
        confirmLabel="Cancel order"
        danger={true}
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancelOpen(false)}
      />

      <div className="order-details-grid">
        <section className="checkout-section">
          <h2 className="checkout-section-title"><FileText size={16} strokeWidth={2} /> Items</h2>
          {order.items.map((item, i) => (
            <div className="order-item-row" key={i}>
              <div>
                <div className="order-item-title">{item.name}</div>
                <div className="muted-text">{item.quantity} unit{item.quantity > 1 ? 's' : ''} × {formatCurrency(item.price)} each</div>
              </div>
              <div className="order-item-total num">{formatCurrency(item.price * item.quantity)}</div>
            </div>
          ))}
          <div className="summary-line">
            <span>MRP Total</span>
            <span>{formatCurrency(order.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}</span>
          </div>
          {order.couponCode && order.couponDiscount > 0 && (
            <div className="summary-line discount">
              <span>Coupon ({order.couponCode})</span>
              <span>-{formatCurrency(order.couponDiscount)}</span>
            </div>
          )}
          <div className="summary-line total">
            <span>Total</span>
            <span>{formatCurrency(order.totalAmount)}</span>
          </div>

          {order.prescriptionRequired && (
            <div className="prescription-status-block">
              <h3 className="detail-subheading"><ShieldAlert size={14} strokeWidth={2} /> Prescription Status</h3>
              <span
                className={`badge ${
                  order.prescriptionStatus === 'Approved'
                    ? 'badge-success'
                    : order.prescriptionStatus === 'Rejected'
                    ? 'badge-rx'
                    : 'badge-status'
                }`}
              >
                {order.prescriptionStatus}
              </span>

              {prescriptionId && (
                <p style={{ marginTop: 8 }}>
                  <a
                    className="btn-secondary"
                    href={`${API_BASE_URL}/prescriptions/${prescriptionId}/file`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Eye size={14} strokeWidth={2} /> View prescription file
                  </a>
                </p>
              )}

              {!isAdmin && order.prescriptionStatus === 'Pending Review' && (
                <p className="muted-text">
                  Your uploaded prescription is awaiting pharmacist review. The order will start processing once it's approved.
                </p>
              )}
              {!isAdmin && order.prescriptionStatus === 'Rejected' && (
                <p className="muted-text">
                  Your prescription was rejected, so this order was cancelled and stock was released. Please place a new order with a valid prescription.
                </p>
              )}

              {isAdmin && order.prescriptionStatus === 'Pending Review' && prescriptionId && (
                <>
                  <p className="muted-text">
                    This order can't move past Pending until the prescription is reviewed — approve it to let the order progress, or reject it to cancel the order.
                  </p>
                  <div className="confirm-actions-row" style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={reviewingPrescription}
                      onClick={() => handlePrescriptionReview('Approved')}
                    >
                      <Check size={14} strokeWidth={2} /> Approve prescription
                    </button>
                    <button
                      type="button"
                      className="btn-secondary danger"
                      disabled={reviewingPrescription}
                      onClick={() => handlePrescriptionReview('Rejected')}
                    >
                      <X size={14} strokeWidth={2} /> Reject prescription
                    </button>
                  </div>
                </>
              )}
              {isAdmin && order.prescriptionStatus === 'Rejected' && (
                <p className="muted-text">
                  This prescription was rejected, so the order was cancelled and stock was released.
                </p>
              )}
            </div>
          )}
        </section>

        <div className="order-details-side">
          <section className="checkout-section">
            <h2 className="checkout-section-title"><MapPin size={16} strokeWidth={2} /> Delivery Address</h2>
            <p>{order.address.line1}</p>
            <p className="muted-text">{[order.address.city, order.address.state, order.address.pincode].filter(Boolean).join(', ')}</p>
          </section>

          <section className="checkout-section">
            <h2 className="checkout-section-title"><CreditCard size={16} strokeWidth={2} /> Payment</h2>
            <p>{order.paymentDetails || PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}</p>
            <span className={`badge ${
              order.paymentStatus === 'Paid' ? 'badge-success' : order.paymentStatus === 'Refunded' ? 'badge-rx' : 'badge-status'
            }`}>
              {order.paymentStatus}
            </span>
          </section>
        </div>
      </div>

      <ConfirmModal
        open={confirmCancelOpen}
        title="Cancel this order?"
        message="Your order will be cancelled and stock will be released back to inventory."
        confirmLabel="Cancel order"
        danger={true}
        onConfirm={handleCancel}
        onCancel={() => setConfirmCancelOpen(false)}
      />

      <ConfirmModal
        open={confirmRejectOpen}
        title="Reject this prescription?"
        message="The order linked to this prescription will be cancelled and its stock released."
        confirmLabel="Reject"
        danger={true}
        onConfirm={handlePrescriptionReject}
        onCancel={() => setConfirmRejectOpen(false)}
      />
    </div>
  );
};

export default OrderDetails;

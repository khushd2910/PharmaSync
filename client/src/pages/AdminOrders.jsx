import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, ChevronLeft, ChevronRight, Star, ShieldAlert } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { computeDisplayStatus, ORDER_STAGES } from '../utils/orderStatus';
import { formatCurrency, formatDate } from '../utils/format';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ALL_STATUSES = [...ORDER_STAGES, 'Cancelled'];

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const { showToast } = useToast();

  const pendingReviewCount = orders.filter((order) => order.prescriptionRequired && order.prescriptionStatus === 'Pending Review').length;

  const loadOrders = (pageValue) => {
    setLoading(true);
    const params = { limit: 20, page: pageValue };
    if (statusFilter) params.status = statusFilter;

    api
      .get('/admin/orders', { params })
      .then((res) => {
        setOrders(res.data.orders);
        setPagination(res.data.pagination);
      })
      .catch((err) => showToast(err.response?.data?.message || 'Could not load orders', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Changing the status filter invalidates whatever page we were on.
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    loadOrders(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page]);

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    try {
      const res = await api.patch(`/admin/orders/${orderId}/status`, { status: newStatus });
      setOrders((prev) => prev.map((o) => (o._id === orderId ? res.data.order : o)));
      showToast('Order status updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  // Lets an admin correct the quick-commerce ETA (in minutes) directly,
  // independent of a status change — e.g. traffic pushed the delivery back
  // but the order is still "Out for Delivery". Sends the order's current
  // status back unchanged so only the ETA moves. The input is uncontrolled
  // (see the `key` on it below) so this reads straight off the DOM value
  // on blur — no local draft state to fall out of sync.
  const handleDeliveryMinutesSave = async (order, rawValue) => {
    const trimmed = String(rawValue).trim();
    const currentValue = order.estimatedDeliveryMinutes == null ? '' : String(order.estimatedDeliveryMinutes);
    if (trimmed === currentValue) return; // unchanged, nothing to save

    if (trimmed !== '' && (!Number.isFinite(Number(trimmed)) || Number(trimmed) < 1)) {
      showToast('Delivery time must be a number of 1 or more minutes', 'error');
      return;
    }

    setUpdatingId(order._id);
    try {
      const res = await api.patch(`/admin/orders/${order._id}/status`, {
        status: order.orderStatus,
        estimatedDeliveryMinutes: trimmed === '' ? null : Number(trimmed),
      });
      setOrders((prev) => prev.map((o) => (o._id === order._id ? res.data.order : o)));
      showToast('Estimated delivery time updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update delivery time', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="admin-orders-page admin-theme">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Order Management</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {pendingReviewCount > 0 && (
            <span className="badge badge-status">
              <ShieldAlert size={12} strokeWidth={2} style={{ marginRight: 4 }} />
              {pendingReviewCount} prescription{pendingReviewCount === 1 ? '' : 's'} pending
            </span>
          )}
          <select className="sort-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="info-text center-text">Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className="info-text center-text">No orders found.</p>
      ) : (
        <div className="admin-orders-table">
          {orders.map((order) => (
            <div className="admin-order-row" key={order._id}>
              <div className="admin-order-main">
                <p className="order-invoice">{order.invoiceNumber}</p>
                <p className="muted-text">
                  {order.user?.name || 'Unknown'} · {order.user?.email}
                </p>
                <p className="muted-text">
                  {formatDate(order.createdAt)}
                  {' · '}{order.items.length} item{order.items.length > 1 ? 's' : ''}
                  {' · '}{formatCurrency(order.totalAmount)}
                </p>
                {order.rating && (
                  <p className="muted-text order-rating-admin" title={`Customer rated this order ${order.rating}/5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        size={12}
                        strokeWidth={2}
                        fill={order.rating >= n ? 'currentColor' : 'none'}
                      />
                    ))}
                  </p>
                )}
              </div>

              <span className="badge badge-status">{computeDisplayStatus(order)}</span>

              {order.prescriptionRequired && order.prescriptionStatus === 'Pending Review' && (
                <span className="badge badge-rx" title="Prescription needs admin review before fulfillment">
                  <ShieldAlert size={12} strokeWidth={2} style={{ marginRight: 4 }} />
                  Prescription pending
                </span>
              )}

              <Link className="btn-secondary admin" to={`/admin/orders/${order._id}`}>
                View details
              </Link>

              {order.orderStatus !== 'Delivered' && (
                <select
                  className="sort-select"
                  value={order.orderStatus}
                  disabled={updatingId === order._id}
                  onChange={(e) => handleStatusChange(order._id, e.target.value)}
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}

              {order.orderStatus !== 'Cancelled' && order.orderStatus !== 'Delivered' && (
                <label className="admin-eta-field">
                  <span className="muted-text" style={{ fontSize: 11 }}>Delivery in (mins)</span>
                  <input
                    type="number"
                    min={1}
                    className="sort-select"
                    // Keying on the saved value forces React to remount this
                    // input (fresh defaultValue) whenever the server-side
                    // value actually changes, so it can never get stuck
                    // showing a stale number after a save.
                    key={`${order._id}-${order.estimatedDeliveryMinutes ?? 'none'}`}
                    defaultValue={order.estimatedDeliveryMinutes ?? ''}
                    disabled={updatingId === order._id}
                    onBlur={(e) => handleDeliveryMinutesSave(order, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.target.blur();
                    }}
                  />
                </label>
              )}

              {computeDisplayStatus(order) === 'Delivered' && (
                <a
                  className="icon-btn-danger"
                  href={`${API_BASE_URL}/orders/${order._id}/invoice`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Download invoice"
                >
                  <Download size={16} strokeWidth={2} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && pagination.total > 0 && (
        <div className="pagination-bar">
          <span className="muted-text">
            {pagination.total} order{pagination.total === 1 ? '' : 's'} · page {pagination.page} of {pagination.pages}
          </span>
          <div className="pagination-controls">
            <button
              className="btn-secondary admin"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={14} strokeWidth={2} /> Prev
            </button>
            <button
              className="btn-secondary admin"
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page >= pagination.pages}
            >
              Next <ChevronRight size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;

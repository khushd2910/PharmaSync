import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { computeDisplayStatus, ORDER_STAGES } from '../utils/orderStatus';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const ALL_STATUSES = [...ORDER_STAGES, 'Cancelled'];

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const { showToast } = useToast();

  const loadOrders = () => {
    setLoading(true);
    api
      .get('/admin/orders', { params: statusFilter ? { status: statusFilter } : {} })
      .then((res) => setOrders(res.data.orders))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load orders', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

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

  return (
    <div className="admin-orders-page admin-theme">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Order Management</h2>
        </div>
        <select className="sort-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
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
                  {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {' · '}{order.items.length} item{order.items.length > 1 ? 's' : ''}
                  {' · '}₹{order.totalAmount.toFixed(2)}
                </p>
              </div>

              <span className="badge badge-status">{computeDisplayStatus(order)}</span>

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

              <a
                className="icon-btn-danger"
                href={`${API_BASE_URL}/orders/${order._id}/invoice`}
                target="_blank"
                rel="noopener noreferrer"
                title="Download invoice"
              >
                <Download size={16} strokeWidth={2} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminOrders;

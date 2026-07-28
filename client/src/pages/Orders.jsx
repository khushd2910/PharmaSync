import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Download } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { computeDisplayStatus } from '../utils/orderStatus';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Turns an item list into a compact readable string, e.g.
// "Paracetamol, Azithromycin +2 more" instead of dumping every name.
const summarizeItems = (items) => {
  if (!items || items.length === 0) return '—';
  const names = items.map((item) => item.name);
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    api
      .get('/orders')
      .then((res) => setOrders(res.data.orders))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load orders', 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p className="info-text center-text">Loading your orders…</p>;

  if (orders.length === 0) {
    return (
      <div className="orders-page">
        <div className="empty-state">
          <ClipboardList size={40} strokeWidth={1.5} />
          <h2>No orders yet</h2>
          <p className="muted-text">Your placed orders will show up here.</p>
          <Link to="/" className="btn-primary">Browse medicines</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <h1 className="page-title">Order History</h1>
      <div className="orders-list">
        {orders.map((order) => {
          const status = computeDisplayStatus(order);
          const isDelivered = status === 'Delivered';
          return (
            <div className="order-card" key={order._id}>
              <Link to={`/orders/${order._id}`} className="order-row">
                <div className="order-row-main">
                  <p className="order-invoice">{order.invoiceNumber}</p>
                  <p className="order-items-preview">{summarizeItems(order.items)}</p>
                  <p className="muted-text">
                    {order.items.length} item{order.items.length > 1 ? 's' : ''}
                    {' · '}
                    {isDelivered
                      ? `Delivered ${formatDate(order.updatedAt)}`
                      : `Placed ${formatDate(order.createdAt)}`}
                  </p>
                </div>
                <span className={`badge ${isDelivered ? 'badge-success' : status === 'Cancelled' ? 'badge-rx' : 'badge-status'}`}>
                  {status}
                </span>
                <span className="order-row-total num">{formatCurrency(order.totalAmount)}</span>
              </Link>
              {isDelivered && (
                <a
                  className="btn-secondary order-invoice-btn"
                  href={`${API_BASE_URL}/orders/${order._id}/invoice`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download size={14} strokeWidth={2} /> Invoice
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Orders;

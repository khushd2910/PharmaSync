import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { computeDisplayStatus } from '../utils/orderStatus';

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
        {orders.map((order) => (
          <Link to={`/orders/${order._id}`} className="order-row" key={order._id}>
            <div className="order-row-main">
              <p className="order-invoice">{order.invoiceNumber}</p>
              <p className="muted-text">
                {new Date(order.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                {' · '}{order.items.length} item{order.items.length > 1 ? 's' : ''}
              </p>
            </div>
            <span className="badge badge-status">{computeDisplayStatus(order)}</span>
            <span className="order-row-total num">₹{order.totalAmount.toFixed(2)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Orders;

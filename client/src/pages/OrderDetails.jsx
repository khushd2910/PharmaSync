import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FileText, MapPin, CreditCard, Download, XCircle } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import OrderStatusStepper from '../components/OrderStatusStepper';
import { isCancellable } from '../utils/orderStatus';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const OrderDetails = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const loadOrder = () => {
    setLoading(true);
    api
      .get(`/orders/${id}`)
      .then((res) => setOrder(res.data.order))
      .catch((err) => showToast(err.response?.data?.message || 'Order not found', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order? Stock will be released back.')) return;
    setCancelling(true);
    try {
      const res = await api.patch(`/orders/${id}/cancel`);
      setOrder(res.data.order);
      showToast('Order cancelled', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not cancel order', 'error');
    } finally {
      setCancelling(false);
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
            Placed {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        <div className="order-actions">
          <a
            className="btn-secondary"
            href={`${API_BASE_URL}/orders/${order._id}/invoice`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download size={14} strokeWidth={2} /> Invoice
          </a>
          {isCancellable(order) && (
            <button className="btn-secondary danger" onClick={handleCancel} disabled={cancelling}>
              <XCircle size={14} strokeWidth={2} /> {cancelling ? 'Cancelling…' : 'Cancel order'}
            </button>
          )}
        </div>
      </div>

      <section className="checkout-section">
        <OrderStatusStepper order={order} />
      </section>

      <div className="order-details-grid">
        <section className="checkout-section">
          <h2 className="checkout-section-title"><FileText size={16} strokeWidth={2} /> Items</h2>
          {order.items.map((item, i) => (
            <div className="summary-line" key={i}>
              <span>{item.name} × {item.quantity}</span>
              <span>₹{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="summary-line total">
            <span>Total</span>
            <span>₹{order.totalAmount.toFixed(2)}</span>
          </div>
        </section>

        <div className="order-details-side">
          <section className="checkout-section">
            <h2 className="checkout-section-title"><MapPin size={16} strokeWidth={2} /> Delivery Address</h2>
            <p>{order.address.line1}</p>
            <p className="muted-text">{[order.address.city, order.address.state, order.address.pincode].filter(Boolean).join(', ')}</p>
          </section>

          <section className="checkout-section">
            <h2 className="checkout-section-title"><CreditCard size={16} strokeWidth={2} /> Payment</h2>
            <p>{order.paymentMethod === 'UPI' ? 'UPI (Demo)' : 'Cash on Delivery'}</p>
            <span className={`badge ${order.paymentStatus === 'Paid' ? 'badge-success' : 'badge-status'}`}>
              {order.paymentStatus}
            </span>
          </section>
        </div>
      </div>

      <Link to="/orders" className="link-muted back-link">← Back to order history</Link>
    </div>
  );
};

export default OrderDetails;

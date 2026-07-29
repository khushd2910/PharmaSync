import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClipboardList, Download, Search, XCircle, RotateCcw,
  ChevronLeft, ChevronRight, ShieldAlert,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/format';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useCart } from '../context/CartContext';
import { computeDisplayStatus, isCancellable } from '../utils/orderStatus';
import IconInput from '../components/IconInput';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const PAGE_SIZE = 6;

// Turns an item list into a compact readable string, e.g.
// "Paracetamol, Azithromycin +2 more" instead of dumping every name.
const summarizeItems = (items) => {
  if (!items || items.length === 0) return '—';
  const names = items.map((item) => item.name);
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
};

const badgeClassFor = (status) => {
  if (status === 'Delivered') return 'badge-success';
  if (status === 'Cancelled') return 'badge-rx';
  return 'badge-status';
};

const rxBadgeClassFor = (prescriptionStatus) => {
  if (prescriptionStatus === 'Approved') return 'badge-success';
  if (prescriptionStatus === 'Rejected') return 'badge-rx';
  return 'badge-status';
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [cancellingId, setCancellingId] = useState(null);
  const [reorderingId, setReorderingId] = useState(null);
  const { showToast } = useToast();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get('/orders')
      .then((res) => setOrders(res.data.orders))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load orders', 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any change to search/sort invalidates whatever page we were on.
  useEffect(() => {
    setPage(1);
  }, [search, sortBy]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = query
      ? orders.filter((o) => o.invoiceNumber.toLowerCase().includes(query))
      : orders;

    return [...base].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'amount-high':
          return b.totalAmount - a.totalAmount;
        case 'amount-low':
          return a.totalAmount - b.totalAmount;
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });
  }, [orders, search, sortBy]);

  const totalPages = Math.max(Math.ceil(filteredOrders.length / PAGE_SIZE), 1);
  const pageOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCancel = async (orderId) => {
    if (!window.confirm('Cancel this order? Stock will be released back.')) return;
    setCancellingId(orderId);
    try {
      const res = await api.patch(`/orders/${orderId}/cancel`);
      setOrders((prev) => prev.map((o) => (o._id === orderId ? res.data.order : o)));
      showToast('Order cancelled', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not cancel order', 'error');
    } finally {
      setCancellingId(null);
    }
  };

  // Adds every item from a past order back into the cart. Items that are
  // now out of stock or discontinued are skipped (addToCart reports the
  // failure per-item) rather than blocking the whole reorder.
  const handleReorder = async (order) => {
    setReorderingId(order._id);
    let added = 0;
    let failed = 0;
    for (const item of order.items) {
      // eslint-disable-next-line no-await-in-loop
      const res = await addToCart(item.medicine, item.quantity);
      if (res.success) added += 1;
      else failed += 1;
    }
    setReorderingId(null);

    if (added === 0) {
      showToast('None of these items are available to reorder anymore', 'error');
      return;
    }
    showToast(
      failed > 0
        ? `Added ${added} item${added > 1 ? 's' : ''} to cart — ${failed} no longer available`
        : 'Items added to your cart',
      failed > 0 ? 'error' : 'success'
    );
    navigate('/cart');
  };

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
      <div className="dashboard-header">
        <h1 className="page-title">Order History</h1>
        <div className="orders-toolbar">
          <IconInput
            icon={Search}
            placeholder="Search by invoice number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="amount-high">Amount: High to Low</option>
            <option value="amount-low">Amount: Low to High</option>
          </select>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <p className="info-text center-text">No orders match “{search}”.</p>
      ) : (
        <>
          <div className="orders-list">
            {pageOrders.map((order) => {
              const status = computeDisplayStatus(order);
              const isDelivered = status === 'Delivered';
              const cancellable = isCancellable(order);
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
                    <span className={`badge ${badgeClassFor(status)}`}>{status}</span>
                    <span className="order-row-total num">{formatCurrency(order.totalAmount)}</span>
                  </Link>

                  <div className="order-card-footer">
                    <div className="order-card-tags">
                      {order.prescriptionRequired && (
                        <span className={`badge ${rxBadgeClassFor(order.prescriptionStatus)}`}>
                          <ShieldAlert size={11} strokeWidth={2} /> Rx {order.prescriptionStatus}
                        </span>
                      )}
                    </div>
                    <div className="order-card-actions">
                      {isDelivered && (
                        <a
                          className="btn-secondary"
                          href={`${API_BASE_URL}/orders/${order._id}/invoice`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download size={14} strokeWidth={2} /> Invoice
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handleReorder(order)}
                        disabled={reorderingId === order._id}
                      >
                        <RotateCcw size={14} strokeWidth={2} />
                        {reorderingId === order._id ? 'Adding…' : 'Reorder'}
                      </button>
                      {cancellable && (
                        <button
                          type="button"
                          className="btn-secondary danger"
                          onClick={() => handleCancel(order._id)}
                          disabled={cancellingId === order._id}
                        >
                          <XCircle size={14} strokeWidth={2} />
                          {cancellingId === order._id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pagination-bar">
            <span className="muted-text">
              {filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'} · page {page} of {totalPages}
            </span>
            <div className="pagination-controls">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft size={14} strokeWidth={2} /> Prev
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next <ChevronRight size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Orders;

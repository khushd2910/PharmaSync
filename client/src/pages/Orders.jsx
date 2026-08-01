import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ClipboardList, Download, Search, SearchX, XCircle, RotateCcw,
  ChevronLeft, ChevronRight, ShieldAlert, Copy, Clock, LifeBuoy, Star,
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { formatCurrency, formatDate } from '../utils/format';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useCart } from '../context/CartContext';
import { computeDisplayStatus, isCancellable, ORDER_STAGES } from '../utils/orderStatus';
import IconInput from '../components/IconInput';
import { getMedicineImage } from '../utils/medicineFormImage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const PAGE_SIZE = 6;
const MAX_THUMBS = 4;
const NEW_ORDER_WINDOW_MS = 48 * 60 * 60 * 1000; // orders placed within this window get a "New" tag

// Turns an item list into a compact readable string, e.g.
// "Paracetamol, Azithromycin +2 more" instead of dumping every name.
const summarizeItems = (items) => {
  if (!items || items.length === 0) return '—';
  const names = items.map((item) => item.name);
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
};

const renderOrderItems = (items) => (
  <div className="order-items-preview">
    {items.slice(0, 2).map((item, index) => (
      <span key={index} className="order-items-preview-item">
        <strong>{item.name}</strong>
        {item.quantity > 1 ? ` ×${item.quantity}` : ''}
      </span>
    ))}
    {items.length > 2 && (
      <span className="order-items-preview-more">+{items.length - 2} more</span>
    )}
  </div>
);

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

const monthLabelFor = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

const isRecentOrder = (order) => Date.now() - new Date(order.createdAt).getTime() < NEW_ORDER_WINDOW_MS;

// Loading placeholders shaped like the real card, so the layout doesn't
// jump once orders arrive — feels like a real product, not a spinner.
const OrderCardSkeleton = () => (
  <div className="order-card order-skeleton">
    <div className="skeleton-row">
      <div className="skeleton-block skeleton-title" />
      <div className="skeleton-block skeleton-badge" />
    </div>
    <div className="skeleton-thumbs">
      {[1, 2, 3, 4].map((n) => (
        <div key={n} className="skeleton-block skeleton-thumb" />
      ))}
    </div>
  </div>
);

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [cancellingId, setCancellingId] = useState(null);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [reorderingId, setReorderingId] = useState(null);
  const [ratingId, setRatingId] = useState(null);
  const { showToast } = useToast();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const loadOrders = (silent = false) => {
    api
      .get('/orders')
      .then((res) => setOrders(res.data.orders))
      .catch((err) => {
        if (!silent) showToast(err.response?.data?.message || 'Could not load orders', 'error');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();

    // A user might leave this tab open while an admin updates an order
    // (e.g. its ETA) elsewhere — refetch whenever they come back to it so
    // it doesn't keep showing what was current when the page first loaded.
    const handleFocus = () => loadOrders(true);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadOrders(true);
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
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

  // Month-grouping only makes sense when the list is in chronological
  // order — sorting by amount would otherwise interleave months oddly.
  const showMonthGroups = sortBy === 'newest' || sortBy === 'oldest';

  const totalPages = Math.max(Math.ceil(filteredOrders.length / PAGE_SIZE), 1);
  const pageOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCancel = async (orderId) => {
    if (!orderId) return;
    setCancellingId(orderId);
    try {
      const res = await api.patch(`/orders/${orderId}/cancel`);
      setOrders((prev) => prev.map((o) => (o._id === orderId ? res.data.order : o)));
      showToast('Order cancelled', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not cancel order', 'error');
    } finally {
      setCancellingId(null);
      setConfirmingCancelId(null);
    }
  };

  const handleCopyInvoice = (e, invoiceNumber) => {
    e.preventDefault();
    e.stopPropagation();
    if (!navigator.clipboard) {
      showToast('Copying is not supported in this browser', 'error');
      return;
    }
    navigator.clipboard
      .writeText(invoiceNumber)
      .then(() => showToast('Invoice number copied', 'success'))
      .catch(() => showToast('Could not copy invoice number', 'error'));
  };

  const handleRate = async (e, orderId, value) => {
    e.preventDefault();
    e.stopPropagation();
    setRatingId(orderId);
    try {
      const res = await api.patch(`/orders/${orderId}/rating`, { rating: value });
      setOrders((prev) => prev.map((o) => (o._id === orderId ? res.data.order : o)));
      showToast('Thanks for your feedback!', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not save your rating', 'error');
    } finally {
      setRatingId(null);
    }
  };

  // The medicine catalog is periodically wiped and re-imported (see
  // server/scripts/importMedicines.js), which mints a brand-new _id for
  // every medicine even when its name/details haven't changed. An old
  // order's item.medicine id can therefore go stale — the product is
  // still very much purchasable, just under a different _id now. If the
  // direct id lookup 404s, fall back to an exact (case-insensitive) name
  // match against the current catalog before giving up on that item.
  const findCurrentMedicineByName = async (name) => {
    try {
      const res = await api.get('/medicines', { params: { search: name, limit: 5 } });
      const candidates = res.data.medicines || [];
      return candidates.find((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase()) || null;
    } catch {
      return null;
    }
  };

  // Adds every item from a past order back into the cart, then takes the
  // user straight to checkout. Items that are now genuinely out of stock
  // or discontinued are skipped (reported to the user) rather than
  // blocking the whole reorder.
  const handleReorder = async (order) => {
    setReorderingId(order._id);
    let added = 0;
    let failed = 0;

    for (const item of order.items) {
      // eslint-disable-next-line no-await-in-loop
      let res = await addToCart(item.medicine, item.quantity);

      if (!res.success) {
        // eslint-disable-next-line no-await-in-loop
        const match = await findCurrentMedicineByName(item.name);
        if (match) {
          // eslint-disable-next-line no-await-in-loop
          res = await addToCart(match._id, item.quantity);
        }
      }

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
    navigate('/checkout');
  };

  if (loading) {
    return (
      <div className="orders-page">
        <div className="dashboard-header">
          <h1 className="page-title">Order History</h1>
        </div>
        <div className="orders-list">
          <OrderCardSkeleton />
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </div>
      </div>
    );
  }

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

  let lastMonthLabel = null;

  return (
    <div className="orders-page">
      <div className="dashboard-header">
        <h1 className="page-title">Order History</h1>
      </div>
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

      {filteredOrders.length === 0 ? (
        <div className="empty-state compact">
          <SearchX size={32} strokeWidth={1.5} />
          <p className="muted-text">No orders match “{search}”.</p>
        </div>
      ) : (
        <>
          <div className="orders-list">
            {pageOrders.map((order) => {
              const status = computeDisplayStatus(order);
              const isDelivered = status === 'Delivered';
              const isCancelled = status === 'Cancelled';
              const isActive = !isDelivered && !isCancelled;
              const cancellable = isCancellable(order);
              const stageIndex = ORDER_STAGES.indexOf(status);
              const monthLabel = monthLabelFor(order.createdAt);
              const showHeader = showMonthGroups && monthLabel !== lastMonthLabel;
              lastMonthLabel = monthLabel;
              const rating = order.rating || 0;

              return (
                <div key={order._id} className="order-list-item">
                  {showHeader && <div className="order-month-header">{monthLabel}</div>}
                  <div className={`order-card ${isCancelled ? 'order-card-cancelled' : ''}`}>
                    <Link to={`/orders/${order._id}`} className="order-row">
                      <div className="order-row-top">
                        <div className="order-row-main">
                          <div className="order-invoice-row">
                            <p className="order-invoice">{order.invoiceNumber}</p>
                            <button
                              type="button"
                              className="icon-copy-btn"
                              onClick={(e) => handleCopyInvoice(e, order.invoiceNumber)}
                              aria-label="Copy invoice number"
                              title="Copy invoice number"
                            >
                              <Copy size={12} strokeWidth={2} />
                            </button>
                            {isRecentOrder(order) && <span className="badge badge-discount">New</span>}
                          </div>
                          {renderOrderItems(order.items)}
                          <p className="muted-text">
                            {order.items.length} item{order.items.length > 1 ? 's' : ''}
                            {' · '}
                            {isDelivered
                              ? `Delivered ${formatDate(order.updatedAt)}`
                              : `Placed ${formatDate(order.createdAt)}`}
                            {isActive && order.estimatedDeliveryMinutes && (
                              <>
                                {' · '}
                                <Clock size={11} strokeWidth={2} className="inline-icon" />
                                {' '}Arriving in ~{order.estimatedDeliveryMinutes} mins
                              </>
                            )}
                          </p>
                        </div>
                        <span className={`badge ${badgeClassFor(status)}`}>{status}</span>
                        <span className="order-row-total num">{formatCurrency(order.totalAmount)}</span>
                      </div>

                      {!isCancelled && (
                        <div className="order-mini-stepper" title={`Status: ${status}`}>
                          {ORDER_STAGES.map((stage, i) => (
                            <div key={stage} className="order-mini-step">
                              <span className={`order-mini-dot ${i <= stageIndex ? 'filled' : ''} ${i === stageIndex ? 'current' : ''}`} />
                              {i < ORDER_STAGES.length - 1 && (
                                <span className={`order-mini-line ${i < stageIndex ? 'filled' : ''}`} />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="order-thumbs">
                        {order.items.slice(0, MAX_THUMBS).map((item, i) => (
                          <img
                            key={i}
                            src={item.imageUrl ? `http://localhost:5000${item.imageUrl}` : getMedicineImage({ name: item.name })}
                            alt={item.name}
                            className="order-thumb"
                            loading="lazy"
                          />
                        ))}
                        {order.items.length > MAX_THUMBS && (
                          <span className="order-thumb order-thumb-more">
                            +{order.items.length - MAX_THUMBS}
                          </span>
                        )}
                      </div>
                    </Link>

                    <div className="order-card-footer">
                      <div className="order-card-tags">
                        {order.prescriptionRequired && (
                          <span className={`badge ${rxBadgeClassFor(order.prescriptionStatus)}`}>
                            <ShieldAlert size={11} strokeWidth={2} /> Rx {order.prescriptionStatus}
                          </span>
                        )}
                        <Link
                          className="order-help-link"
                          to={`/support?order=${encodeURIComponent(order.invoiceNumber)}`}
                        >
                          <LifeBuoy size={12} strokeWidth={2} /> Need help?
                        </Link>
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
                                onClick={() => setOrderToCancel(order)}
                              >
                                <XCircle size={14} strokeWidth={2} /> Cancel
                              </button>
                            )}
                          </div>
                      {isDelivered && (
                        <div className="order-rating">
                          <span className="muted-text">
                            {rating ? 'Thanks for rating this order!' : 'Rate this order:'}
                          </span>
                          <div className="order-rating-stars">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                className="star-btn"
                                onClick={(e) => handleRate(e, order._id, n)}
                                disabled={ratingId === order._id}
                                aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                              >
                                <Star size={14} strokeWidth={2} fill={rating >= n ? 'currentColor' : 'none'} />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

      <ConfirmModal
        open={!!orderToCancel}
        title="Cancel this order?"
        message="Your order will be cancelled and stock will be released back to inventory."
        confirmLabel="Cancel order"
        danger={true}
        onConfirm={handleCancel}
        onCancel={() => setOrderToCancel(null)}
      />

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

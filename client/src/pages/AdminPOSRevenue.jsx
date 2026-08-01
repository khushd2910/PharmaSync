import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Receipt, RotateCcw, Search, SearchX, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import IconInput from '../components/IconInput';
import { formatCurrency, formatDateTime } from '../utils/format';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const PAGE_SIZE = 6;

const summarizeItems = (items) => {
  if (!items || items.length === 0) return '—';
  const names = items.map((item) => item.name);
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
};

const renderSaleItems = (items) => (
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

const POSRevenueCardSkeleton = () => (
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

const AdminPOSRevenue = () => {
  const { showToast } = useToast();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [processingRefundId, setProcessingRefundId] = useState(null);

  const loadSales = () => {
    setLoading(true);
    api
      .get('/admin/pos/sales', { params: { limit: 100 } })
      .then((res) => setSales(res.data.sales || []))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load POS sales', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy]);

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = query
      ? sales.filter((sale) => {
          const haystack = [
            sale.invoiceNumber,
            sale.customerName,
            sale.customerPhone,
            sale.paymentMethod,
            ...(sale.items || []).map((item) => item.name),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(query);
        })
      : sales;

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
  }, [sales, search, sortBy]);

  const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.status === 'Refunded' ? 0 : sale.totalAmount || 0), 0);
  const totalSales = filteredSales.filter((sale) => sale.status !== 'Refunded').length;
  const totalPages = Math.max(Math.ceil(filteredSales.length / PAGE_SIZE), 1);
  const pageSales = filteredSales.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleRefund = async (sale) => {
    if (!window.confirm(`Refund ${sale.invoiceNumber} for ₹${sale.totalAmount.toFixed(2)}? Stock will be restored.`)) return;
    setProcessingRefundId(sale._id);
    try {
      await api.patch(`/admin/pos/sales/${sale._id}/refund`);
      setSales((prev) => prev.map((item) => (item._id === sale._id ? { ...item, status: 'Refunded' } : item)));
      showToast('Sale refunded and stock restored', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not refund sale', 'error');
    } finally {
      setProcessingRefundId(null);
    }
  };

  if (loading) {
    return (
      <div className="orders-page">
        <div className="dashboard-header">
          <h1 className="page-title">POS Revenue</h1>
        </div>
        <div className="orders-list">
          <POSRevenueCardSkeleton />
          <POSRevenueCardSkeleton />
          <POSRevenueCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="orders-page admin-theme">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>POS Revenue</h2>
        </div>
        <div className="stat-card">
          <ClipboardList size={18} strokeWidth={2} className="stat-icon" />
          <div>
            <p className="stat-value">{formatCurrency(totalRevenue)}</p>
            <p className="stat-label">{totalSales} completed sale{totalSales === 1 ? '' : 's'}</p>
          </div>
        </div>
      </header>

      <div className="orders-toolbar">
        <IconInput
          icon={Search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoice, customer, payment or item"
        />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="amount-high">Highest amount</option>
          <option value="amount-low">Lowest amount</option>
        </select>
      </div>

      {filteredSales.length === 0 ? (
        <div className="empty-state compact">
          <SearchX size={38} strokeWidth={1.5} />
          <h3>No POS sales found</h3>
          <p className="muted-text">Try a different search term or complete a sale at the register.</p>
          <Link to="/admin/pos" className="btn-primary">Open POS Billing</Link>
        </div>
      ) : (
        <>
          <div className="orders-list">
            {pageSales.map((sale) => (
              <article key={sale._id} className={`order-card${sale.status === 'Refunded' ? ' order-card-cancelled' : ''}`}>
                <div className="order-row">
                  <div className="order-row-top">
                    <div>
                      <div className="order-invoice-row">
                        <p className="order-invoice">{sale.invoiceNumber}</p>
                        <span className={`badge ${sale.status === 'Refunded' ? 'badge-outofstock' : 'badge-success'}`}>
                          {sale.status}
                        </span>
                      </div>
                      <p className="muted-text" style={{ margin: '4px 0 0' }}>
                        {formatDateTime(sale.createdAt)}
                        {sale.customerName ? ` · ${sale.customerName}` : ''}
                        {sale.customerPhone ? ` · ${sale.customerPhone}` : ''}
                      </p>
                    </div>
                    <div className="order-row-total num">{formatCurrency(sale.totalAmount)}</div>
                    <div className="order-card-tags">
                      <span className="badge badge-status">{sale.paymentMethod}</span>
                      <span className="badge badge-status">{sale.items?.length || 0} item{(sale.items?.length || 0) === 1 ? '' : 's'}</span>
                    </div>
                  </div>

                  {renderSaleItems(sale.items || [])}

                  <div className="order-card-footer">
                    <p className="muted-text" style={{ margin: 0 }}>
                      {summarizeItems(sale.items || [])}
                    </p>
                    <div className="order-card-actions">
                      <a
                        className="btn-secondary"
                        href={`${API_BASE_URL}/admin/pos/sales/${sale._id}/receipt`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Receipt size={14} strokeWidth={2} /> Receipt
                      </a>
                      {sale.status !== 'Refunded' && (
                        <button className="btn-secondary danger" onClick={() => handleRefund(sale)} disabled={processingRefundId === sale._id}>
                          <RotateCcw size={14} strokeWidth={2} />
                          {processingRefundId === sale._id ? 'Refunding…' : 'Refund'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {filteredSales.length > PAGE_SIZE && (
            <div className="pagination-row">
              <button className="btn-secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={16} strokeWidth={2} /> Prev
              </button>
              <span className="muted-text">Page {page} of {totalPages}</span>
              <button className="btn-secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next <ChevronRight size={16} strokeWidth={2} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminPOSRevenue;

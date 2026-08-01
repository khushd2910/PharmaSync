import { useEffect, useRef, useState } from 'react';
import {
  ClipboardList, Pill, Package, Wallet, AlertTriangle, CalendarClock, ScanBarcode, BarChart3, RefreshCw, BellRing, Sparkles,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

import { formatCurrency, formatDate, formatDateTime } from '../utils/format';

const formatExpiry = formatDate;

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [expiryAnalysis, setExpiryAnalysis] = useState(null);
  const [expiryLoading, setExpiryLoading] = useState(true);
  const [runningExpiry, setRunningExpiry] = useState(false);
  const { showToast } = useToast();
  const expiryAlertShown = useRef(false);

  const loadExpiryAnalysis = ({ notify = false } = {}) => {
    setExpiryLoading(true);
    api
      .get('/admin/expiry-analysis')
      .then((res) => {
        const result = res.data.analysis;
        setExpiryAnalysis(result);
        // Dashboard Notification — surface a toast the first time we learn
        // there's an urgent (expired / expiring soon) batch, so admins don't
        // have to scroll down to notice. Doesn't re-fire on every re-render.
        if (notify && result?.alertCount > 0 && !expiryAlertShown.current) {
          expiryAlertShown.current = true;
          showToast(
            `${result.alertCount} medicine${result.alertCount === 1 ? '' : 's'} expired or expiring within ${result.expiryAlertDays} days`,
            'error',
            7000
          );
        }
      })
      .catch((err) => showToast(err.response?.data?.message || 'Could not load expiry analysis', 'error'))
      .finally(() => setExpiryLoading(false));
  };

  useEffect(() => {
    api.get('/admin/dashboard').then((res) => setData(res.data));
    api
      .get('/admin/dashboard/stats')
      .then((res) => setStats(res.data.stats))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load dashboard overview', 'error'))
      .finally(() => setStatsLoading(false));
    loadExpiryAnalysis({ notify: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenQuickInventory = () => {
    navigate('/admin/quick-inventory-analysis', { state: { autoRun: true } });
  };

  const handleOpenDiscountOptimization = () => {
    navigate('/admin/price-sensitivity-analysis', { state: { autoRun: true } });
  };

  const handleOpenDeepInventory = () => {
    navigate('/admin/deep-inventory-analysis', { state: { autoRun: true } });
  };

  const handleRunExpiryAnalysis = async () => {
    setRunningExpiry(true);
    try {
      const res = await api.post('/admin/expiry-analysis/run');
      setExpiryAnalysis(res.data.analysis);
      showToast('Expiry analysis complete', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not run expiry analysis', 'error');
    } finally {
      setRunningExpiry(false);
    }
  };

  return (
    <div className="dashboard-page admin-theme">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h2>Welcome, {user?.name?.split(' ')[0]}</h2>
        </div>
      </header>

      {data && <p className="info-text">{data.info}</p>}

      {statsLoading ? (
        <p className="info-text center-text">Loading overview…</p>
      ) : stats ? (
        <div className="stat-grid">
          <div className="stat-card">
            <Pill size={18} strokeWidth={2} className="stat-icon" />
            <div>
              <p className="stat-value">{stats.totalMedicines}</p>
              <p className="stat-label">Total Medicines</p>
            </div>
          </div>

          <div className="stat-card">
            <Package size={18} strokeWidth={2} className="stat-icon" />
            <div>
              <p className="stat-value">{stats.totalOrders}</p>
              <p className="stat-label">Total Orders</p>
            </div>
          </div>

          <div className="stat-card">
            <Wallet size={18} strokeWidth={2} className="stat-icon" />
            <div>
              <p className="stat-value">{formatCurrency(stats.revenue)}</p>
              <p className="stat-label">Revenue · {formatCurrency(stats.onlineRevenue)} online, {formatCurrency(stats.posRevenue)} in-store</p>
            </div>
          </div>

          <Link to="/admin/medicines?lowStock=true" className={`stat-card stat-card-link${stats.lowStockCount > 0 ? ' stat-card-warn' : ''}`}>
            <AlertTriangle size={18} strokeWidth={2} className="stat-icon" />
            <div>
              <p className="stat-value">{stats.lowStockCount}</p>
              <p className="stat-label">Low Stock</p>
            </div>
          </Link>

          <Link to="/admin/medicines?expiringSoon=true" className={`stat-card stat-card-link${stats.expiringCount > 0 ? ' stat-card-warn' : ''}`}>
            <CalendarClock size={18} strokeWidth={2} className="stat-icon" />
            <div>
              <p className="stat-value">{stats.expiringCount}</p>
              <p className="stat-label">Expiring Soon</p>
            </div>
          </Link>
        </div>
      ) : null}

      <section className="checkout-section analysis-section">
        <div className="analysis-header">
          <h2 className="checkout-section-title"><BarChart3 size={16} strokeWidth={2} /> Analysis Modules</h2>
        </div>

        <div className="analysis-grid">
          <button className="placeholder-card admin-action-card" onClick={handleOpenQuickInventory}>
            <BarChart3 size={20} strokeWidth={2} className="placeholder-icon" />
            <div>
              <strong>Quick Inventory Analysis</strong>
              <p className="muted-text">Low Stock, Fast Selling, and Slow Selling snapshots that auto-run on arrival.</p>
            </div>
          </button>

          <button className="placeholder-card admin-action-card" onClick={handleOpenDiscountOptimization}>
            <Wallet size={20} strokeWidth={2} className="placeholder-icon" />
            <div>
              <strong>Price Sensitivity / Discount Optimization</strong>
              <p className="muted-text">Dead-stock markdown recommendations based on category elasticity.</p>
            </div>
          </button>

          <button className="placeholder-card admin-action-card" onClick={handleOpenDeepInventory}>
            <Sparkles size={20} strokeWidth={2} className="placeholder-icon" />
            <div>
              <strong>Deep Inventory Analysis</strong>
              <p className="muted-text">ABC, reorder/EOQ, cluster segmentation, and anomaly detection.</p>
            </div>
          </button>
        </div>
      </section>

      <section className="checkout-section analysis-section">
        <div className="analysis-header">
          <h2 className="checkout-section-title">
            <CalendarClock size={16} strokeWidth={2} /> Expiry Analysis
            {expiryAnalysis?.alertCount > 0 && (
              <span className="badge badge-rx expiry-alert-badge">
                <BellRing size={12} strokeWidth={2.2} /> {expiryAnalysis.alertCount} urgent
              </span>
            )}
          </h2>
          <button className="btn-secondary admin" onClick={handleRunExpiryAnalysis} disabled={runningExpiry}>
            <RefreshCw size={14} strokeWidth={2} className={runningExpiry ? 'spin' : ''} />
            {runningExpiry ? 'Running…' : 'Run Analysis Now'}
          </button>
        </div>

        {expiryLoading ? (
          <p className="info-text center-text">Loading…</p>
        ) : !expiryAnalysis ? (
          <p className="info-text center-text">
            No expiry analysis has run yet. It runs automatically every night — or click "Run Analysis Now" above.
          </p>
        ) : (
          <>
            <p className="muted-text analysis-meta">
              Last run {formatDateTime(expiryAnalysis.generatedAt)} · {expiryAnalysis.totalTracked}{' '}
              medicines with a known expiry date · {expiryAnalysis.expired.length} already expired
            </p>

            <div className="analysis-grid">
              <div className="analysis-col">
                <h3>Expiring in 30 Days</h3>
                <ul className="analysis-list">
                  {expiryAnalysis.expiringIn30.length === 0 && <li className="analysis-empty">Nothing expiring this soon</li>}
                  {expiryAnalysis.expiringIn30.map((item) => (
                    <li key={item.medicineId}>
                      <span>{item.name}</span>
                      <span className="num">{formatExpiry(item.expiryDate)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="analysis-col">
                <h3>Expiring in 60 Days</h3>
                <ul className="analysis-list">
                  {expiryAnalysis.expiringIn60.length === 0 && <li className="analysis-empty">Nothing in this window</li>}
                  {expiryAnalysis.expiringIn60.map((item) => (
                    <li key={item.medicineId}>
                      <span>{item.name}</span>
                      <span className="num">{formatExpiry(item.expiryDate)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="analysis-col">
                <h3>Expiring in 90 Days</h3>
                <ul className="analysis-list">
                  {expiryAnalysis.expiringIn90.length === 0 && <li className="analysis-empty">Nothing in this window</li>}
                  {expiryAnalysis.expiringIn90.map((item) => (
                    <li key={item.medicineId}>
                      <span>{item.name}</span>
                      <span className="num">{formatExpiry(item.expiryDate)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {expiryAnalysis.expired.length > 0 && (
              <div className="analysis-col expiry-expired-col">
                <h3>Already Expired</h3>
                <ul className="analysis-list">
                  {expiryAnalysis.expired.map((item) => (
                    <li key={item.medicineId}>
                      <span>{item.name}</span>
                      <span className="num">{formatExpiry(item.expiryDate)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      <Link to="/admin/pos" className="placeholder-card admin-action-card">
        <ScanBarcode size={20} strokeWidth={2} className="placeholder-icon" />
        <div>
          <strong>POS Billing</strong>
          <p className="muted-text">Ring up walk-in customers — scan or search, bill, and print a GST receipt.</p>
        </div>
      </Link>

      <Link to="/admin/sales-analysis" className="placeholder-card admin-action-card">
        <BarChart3 size={20} strokeWidth={2} className="placeholder-icon" />
        <div>
          <strong>Sales Analysis</strong>
          <p className="muted-text">Daily, weekly, and monthly trends, revenue, and best/worst sellers.</p>
        </div>
      </Link>

      <Link to="/admin/inventory-analysis" className="placeholder-card admin-action-card">
        <BarChart3 size={20} strokeWidth={2} className="placeholder-icon" />
        <div>
          <strong>Deep Inventory Analysis</strong>
          <p className="muted-text">ABC classification, reorder/EOQ recommendations, AI stock segmentation, and anomaly detection.</p>
        </div>
      </Link>

      <Link to="/admin/orders" className="placeholder-card admin-action-card">
        <ClipboardList size={20} strokeWidth={2} className="placeholder-icon" />
        <div>
          <strong>Order Management</strong>
          <p className="muted-text">View every order, update delivery status, or cancel — and download invoices.</p>
        </div>
      </Link>

      <Link to="/admin/medicines" className="placeholder-card admin-action-card">
        <Pill size={20} strokeWidth={2} className="placeholder-icon" />
        <div>
          <strong>Manage Medicines</strong>
          <p className="muted-text">Add new medicines, edit price/stock/details — changes are live on the storefront immediately.</p>
        </div>
      </Link>
    </div>
  );
};

export default AdminDashboard;

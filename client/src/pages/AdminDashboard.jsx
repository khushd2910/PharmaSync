import { useEffect, useState } from 'react';
import {
  ClipboardList, Pill, Package, Wallet, AlertTriangle, CalendarClock, ScanBarcode, BarChart3, RefreshCw,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const loadAnalysis = () => {
    setAnalysisLoading(true);
    api
      .get('/admin/inventory-analysis')
      .then((res) => setAnalysis(res.data.analysis))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load inventory analysis', 'error'))
      .finally(() => setAnalysisLoading(false));
  };

  useEffect(() => {
    api.get('/admin/dashboard').then((res) => setData(res.data));
    api
      .get('/admin/dashboard/stats')
      .then((res) => setStats(res.data.stats))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load dashboard overview', 'error'))
      .finally(() => setStatsLoading(false));
    loadAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunAnalysis = async () => {
    setRunningAnalysis(true);
    try {
      const res = await api.post('/admin/inventory-analysis/run');
      setAnalysis(res.data.analysis);
      showToast('Analysis complete', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not run analysis', 'error');
    } finally {
      setRunningAnalysis(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="dashboard-page admin-theme">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h2>Welcome, {user?.name?.split(' ')[0]}</h2>
        </div>
        <button className="btn-secondary admin" onClick={handleLogout}>Logout</button>
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
              <p className="stat-value">₹{stats.revenue.toFixed(2)}</p>
              <p className="stat-label">Revenue · ₹{stats.onlineRevenue.toFixed(2)} online, ₹{stats.posRevenue.toFixed(2)} in-store</p>
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
          <h2 className="checkout-section-title"><BarChart3 size={16} strokeWidth={2} /> Inventory Analysis</h2>
          <button className="btn-secondary admin" onClick={handleRunAnalysis} disabled={runningAnalysis}>
            <RefreshCw size={14} strokeWidth={2} className={runningAnalysis ? 'spin' : ''} />
            {runningAnalysis ? 'Running…' : 'Run Analysis Now'}
          </button>
        </div>

        {analysisLoading ? (
          <p className="info-text center-text">Loading…</p>
        ) : !analysis ? (
          <p className="info-text center-text">
            No analysis has run yet. It runs automatically every night — or click "Run Analysis Now" above.
          </p>
        ) : (
          <>
            <p className="muted-text analysis-meta">
              Last run {new Date(analysis.generatedAt).toLocaleString('en-IN')} · sales window: last{' '}
              {analysis.lookbackDays} days · {analysis.totalStockUnits} total units across {analysis.totalMedicines}{' '}
              medicines
            </p>

            <div className="analysis-grid">
              <div className="analysis-col">
                <h3>Low Stock <span className="muted-text">(≤ {analysis.lowStockThreshold})</span></h3>
                <ul className="analysis-list">
                  {analysis.lowStock.length === 0 && <li className="analysis-empty">Nothing low on stock</li>}
                  {analysis.lowStock.map((item) => (
                    <li key={item.medicineId}>
                      <span>{item.name}</span>
                      <span className="num">{item.stock} left</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="analysis-col">
                <h3>Fast Selling</h3>
                <ul className="analysis-list">
                  {analysis.fastSelling.length === 0 && <li className="analysis-empty">No sales in this window yet</li>}
                  {analysis.fastSelling.map((item) => (
                    <li key={item.medicineId}>
                      <span>{item.name}</span>
                      <span className="num">{item.unitsSold} sold</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="analysis-col">
                <h3>Slow Selling</h3>
                <ul className="analysis-list">
                  {analysis.slowSelling.length === 0 && <li className="analysis-empty">Nothing sitting unsold</li>}
                  {analysis.slowSelling.map((item) => (
                    <li key={item.medicineId}>
                      <span>{item.name}</span>
                      <span className="num">{item.stock} in stock, {item.unitsSold} sold</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
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

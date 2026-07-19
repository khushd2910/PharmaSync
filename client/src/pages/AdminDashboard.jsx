import { useEffect, useState } from 'react';
import { ClipboardList, Pill, Package, Wallet, AlertTriangle, CalendarClock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    api.get('/admin/dashboard').then((res) => setData(res.data));
    api
      .get('/admin/dashboard/stats')
      .then((res) => setStats(res.data.stats))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load dashboard overview', 'error'))
      .finally(() => setStatsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              <p className="stat-label">Revenue</p>
            </div>
          </div>

          <div className={`stat-card${stats.lowStockCount > 0 ? ' stat-card-warn' : ''}`}>
            <AlertTriangle size={18} strokeWidth={2} className="stat-icon" />
            <div>
              <p className="stat-value">{stats.lowStockCount}</p>
              <p className="stat-label">Low Stock</p>
            </div>
          </div>

          <div className={`stat-card${stats.expiringCount > 0 ? ' stat-card-warn' : ''}`}>
            <CalendarClock size={18} strokeWidth={2} className="stat-icon" />
            <div>
              <p className="stat-value">{stats.expiringCount}</p>
              <p className="stat-label">Expiring Soon</p>
            </div>
          </div>
        </div>
      ) : null}

      <Link to="/admin/orders" className="placeholder-card admin-action-card">
        <ClipboardList size={20} strokeWidth={2} className="placeholder-icon" />
        <div>
          <strong>Order Management</strong>
          <p className="muted-text">View every order, update delivery status, or cancel — and download invoices.</p>
        </div>
      </Link>

      <Link to="/admin/medicines/new" className="placeholder-card admin-action-card">
        <Pill size={20} strokeWidth={2} className="placeholder-icon" />
        <div>
          <strong>Add Medicine</strong>
          <p className="muted-text">Add a new medicine to the catalog. Full edit/delete and stock management are coming in a later module.</p>
        </div>
      </Link>
    </div>
  );
};

export default AdminDashboard;

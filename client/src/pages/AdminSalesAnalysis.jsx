import { useEffect, useState } from 'react';
import { BarChart3, RefreshCw, Wallet, ShoppingBag, TrendingUp, TrendingDown } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

// Small dependency-free bar chart — the project has no charting library
// installed, and this sandbox has no network access to add one, so this
// renders bars as plain divs sized by percentage of the series max. Good
// enough for a trend at a glance; hover a bar for the exact figure.
const TrendChart = ({ points, labelKey, formatLabel }) => {
  const max = Math.max(1, ...points.map((p) => p.revenue));
  return (
    <div className="trend-chart">
      <div className="trend-chart-bars">
        {points.map((p) => (
          <div className="trend-chart-col" key={p[labelKey]} title={`${formatLabel(p[labelKey])}: ₹${p.revenue.toFixed(2)} · ${p.orders} order${p.orders === 1 ? '' : 's'}`}>
            <div className="trend-chart-bar" style={{ height: `${Math.max(2, (p.revenue / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="trend-chart-labels">
        {points.map((p, i) => (
          <span key={p[labelKey]} className={i % Math.ceil(points.length / 8) === 0 ? '' : 'trend-chart-label-hidden'}>
            {formatLabel(p[labelKey])}
          </span>
        ))}
      </div>
    </div>
  );
};

const formatDailyLabel = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const formatWeeklyLabel = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const formatMonthlyLabel = (ym) => {
  const [year, month] = ym.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
};

const AdminSalesAnalysis = () => {
  const { showToast } = useToast();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get('/admin/sales-analysis')
      .then((res) => setAnalysis(res.data.analysis))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load sales analysis', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await api.post('/admin/sales-analysis/run');
      setAnalysis(res.data.analysis);
      showToast('Analysis complete', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not run analysis', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="dashboard-page admin-theme">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Sales Analysis</h2>
        </div>
        <button className="btn-secondary admin" onClick={handleRun} disabled={running}>
          <RefreshCw size={14} strokeWidth={2} className={running ? 'spin' : ''} />
          {running ? 'Running…' : 'Run Analysis Now'}
        </button>
      </header>

      {loading ? (
        <p className="info-text center-text">Loading…</p>
      ) : !analysis ? (
        <p className="info-text center-text">
          No analysis has run yet. It runs automatically every night — or click "Run Analysis Now" above.
        </p>
      ) : (
        <>
          <p className="muted-text analysis-meta">
            Last run {new Date(analysis.generatedAt).toLocaleString('en-IN')} · built from the last {analysis.lookbackDays} days
          </p>

          <div className="stat-grid">
            <div className="stat-card">
              <Wallet size={18} strokeWidth={2} className="stat-icon" />
              <div>
                <p className="stat-value">₹{analysis.totalRevenue.toFixed(2)}</p>
                <p className="stat-label">Total Revenue · ₹{analysis.onlineRevenue.toFixed(2)} online, ₹{analysis.posRevenue.toFixed(2)} in-store</p>
              </div>
            </div>
            <div className="stat-card">
              <ShoppingBag size={18} strokeWidth={2} className="stat-icon" />
              <div>
                <p className="stat-value">{analysis.totalOrders}</p>
                <p className="stat-label">Orders + Sales</p>
              </div>
            </div>
          </div>

          <section className="checkout-section">
            <h2 className="checkout-section-title"><BarChart3 size={16} strokeWidth={2} /> Daily Sales <span className="muted-text">(last 30 days)</span></h2>
            <TrendChart points={analysis.daily} labelKey="date" formatLabel={formatDailyLabel} />
          </section>

          <section className="checkout-section">
            <h2 className="checkout-section-title"><BarChart3 size={16} strokeWidth={2} /> Weekly Sales <span className="muted-text">(last 12 weeks)</span></h2>
            <TrendChart points={analysis.weekly} labelKey="weekStart" formatLabel={formatWeeklyLabel} />
          </section>

          <section className="checkout-section">
            <h2 className="checkout-section-title"><BarChart3 size={16} strokeWidth={2} /> Monthly Sales <span className="muted-text">(last 12 months)</span></h2>
            <TrendChart points={analysis.monthly} labelKey="month" formatLabel={formatMonthlyLabel} />
          </section>

          <div className="analysis-grid two-col">
            <section className="checkout-section">
              <h2 className="checkout-section-title"><TrendingUp size={16} strokeWidth={2} /> Best Sellers</h2>
              <ul className="analysis-list">
                {analysis.bestSellers.length === 0 && <li className="analysis-empty">No sales in this window yet</li>}
                {analysis.bestSellers.map((item) => (
                  <li key={item.medicineId}>
                    <span>{item.name}</span>
                    <span className="num">₹{item.revenue.toFixed(2)} · {item.unitsSold} sold</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="checkout-section">
              <h2 className="checkout-section-title"><TrendingDown size={16} strokeWidth={2} /> Worst Sellers</h2>
              <ul className="analysis-list">
                {analysis.worstSellers.length === 0 && <li className="analysis-empty">No sales in this window yet</li>}
                {analysis.worstSellers.map((item) => (
                  <li key={item.medicineId}>
                    <span>{item.name}</span>
                    <span className="num">₹{item.revenue.toFixed(2)} · {item.unitsSold} sold</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminSalesAnalysis;

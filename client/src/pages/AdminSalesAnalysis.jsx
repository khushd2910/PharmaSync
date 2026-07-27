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
  const [forecast, setForecast] = useState(null);
  const [revenueForecast, setRevenueForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningForecast, setRunningForecast] = useState(false);
  const [runningRevenue, setRunningRevenue] = useState(false);
  const [forecastPage, setForecastPage] = useState(1);
  const FORECAST_PAGE_SIZE = 20;

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/sales-analysis'),
      api.get('/admin/demand-forecast'),
      api.get('/admin/revenue-forecast')
    ])
      .then(([salesRes, forecastRes, revenueRes]) => {
        setAnalysis(salesRes.data.analysis);
        setForecast(forecastRes.data.analysis);
        setRevenueForecast(revenueRes.data.analysis);
        setForecastPage(1);
      })
      .catch((err) => showToast(err.response?.data?.message || 'Could not load analysis data', 'error'))
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

  const handleRunForecast = async () => {
    setRunningForecast(true);
    try {
      const res = await api.post('/admin/demand-forecast/run');
      setForecast(res.data.analysis);
      setForecastPage(1);
      showToast('AI Demand Forecast generated successfully', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not run demand forecast', 'error');
    } finally {
      setRunningForecast(false);
    }
  };

  const handleRunRevenue = async () => {
    setRunningRevenue(true);
    try {
      const res = await api.post('/admin/revenue-forecast/run');
      setRevenueForecast(res.data.analysis);
      showToast('AI Revenue Forecast generated successfully', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not run revenue forecast', 'error');
    } finally {
      setRunningRevenue(false);
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

          <section className="checkout-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
              <h2 className="checkout-section-title" style={{ margin: 0 }}><BarChart3 size={16} strokeWidth={2} /> AI-Powered Daily Revenue Forecast <span className="muted-text">(next 30 days)</span></h2>
              <button className="btn-secondary admin" onClick={handleRunRevenue} disabled={runningRevenue}>
                <RefreshCw size={14} strokeWidth={2} className={runningRevenue ? 'spin' : ''} />
                {runningRevenue ? 'Running Predictor…' : 'Run Revenue Predictor Now'}
              </button>
            </div>
            
            {!revenueForecast ? (
              <p className="info-text center-text">
                No revenue forecast has run yet. Click "Run Revenue Predictor Now" to forecast macro daily revenues.
              </p>
            ) : (
              <>
                <p className="muted-text analysis-meta" style={{ marginBottom: '1.5rem' }}>
                  Generated {new Date(revenueForecast.generatedAt).toLocaleString('en-IN')} using {revenueForecast.modelType} modeling.
                </p>
                
                <div className="stat-grid" style={{ marginBottom: '2rem' }}>
                  <div className="stat-card" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '15px' }}>
                    <TrendingUp size={18} strokeWidth={2} className="stat-icon" style={{ color: '#10b981' }} />
                    <div>
                      <p className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>₹{revenueForecast.totalForecastedRevenue.toFixed(2)}</p>
                      <p className="stat-label" style={{ fontSize: '0.85rem', color: '#6b7280', margin: '4px 0 0 0' }}>Projected 30-Day Gross Revenue</p>
                    </div>
                  </div>
                  <div className="stat-card" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '15px' }}>
                    <BarChart3 size={18} strokeWidth={2} className="stat-icon" style={{ color: '#4f46e5' }} />
                    <div>
                      <p className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                        {revenueForecast.growthRate >= 0 ? '+' : ''}{(revenueForecast.growthRate * 100).toFixed(2)}%
                      </p>
                      <p className="stat-label" style={{ fontSize: '0.85rem', color: '#6b7280', margin: '4px 0 0 0' }}>Projected vs. Last 30 Days Actuals</p>
                    </div>
                  </div>
                </div>

                <TrendChart 
                  points={revenueForecast.predictions.map(p => ({ date: p.date, revenue: p.predictedRevenue, orders: 0 }))} 
                  labelKey="date" 
                  formatLabel={formatDailyLabel} 
                />
              </>
            )}
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

          <section className="checkout-section" style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
              <h2 className="checkout-section-title" style={{ margin: 0 }}><BarChart3 size={16} strokeWidth={2} /> AI-Powered Weekly Demand Forecast & Restock suggestions</h2>
              <button className="btn-secondary admin" onClick={handleRunForecast} disabled={runningForecast}>
                <RefreshCw size={14} strokeWidth={2} className={runningForecast ? 'spin' : ''} />
                {runningForecast ? 'Running AI Predictor…' : 'Run AI Predictor Now'}
              </button>
            </div>
            
            {!forecast ? (
              <p className="info-text center-text">
                No demand forecast has run yet. Click "Run AI Predictor Now" to forecast weekly demand.
              </p>
            ) : (
              <>
                <p className="muted-text analysis-meta" style={{ marginBottom: '1.5rem' }}>
                  Forecast generated {new Date(forecast.generatedAt).toLocaleString('en-IN')} using Random Forest Regressor models based on historical sales patterns.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {forecast.predictions.length === 0 && (
                    <p className="info-text center-text">No active medicines found to forecast.</p>
                  )}
                  {forecast.predictions
                    .slice((forecastPage - 1) * FORECAST_PAGE_SIZE, forecastPage * FORECAST_PAGE_SIZE)
                    .map((p) => (
                    <div className="admin-order-row" key={p.medicineId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff' }}>
                      <div className="admin-order-main">
                        <p className="order-invoice" style={{ fontWeight: '600', fontSize: '1.05rem', margin: '0 0 4px 0', color: '#1f2937' }}>{p.name}</p>
                        <p className="muted-text" style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                          Current Stock: <span style={{ fontWeight: '500', color: '#1f2937' }}>{p.currentStock} units</span> · AI-Predicted 7-Day Demand: <span style={{ fontWeight: '500', color: '#1f2937' }}>{p.predictedWeeklyDemand} units</span>
                        </p>
                        {p.restockSuggested && (
                          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#ef4444', fontWeight: '500' }}>
                            Suggested restock quantity: +{p.suggestedRestockQty} units
                          </p>
                        )}
                      </div>
                      <span
                        className={`badge ${
                          p.restockSuggested ? 'badge-outofstock' : 'badge-success'
                        }`}
                        style={{
                          fontSize: '0.8rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          fontWeight: '600'
                        }}
                      >
                        {p.restockSuggested ? 'Restock Needed' : 'Stock Adequate'}
                      </span>
                    </div>
                  ))}
                </div>
                {forecast.predictions.length > FORECAST_PAGE_SIZE && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '12px',
                      marginTop: '1.25rem',
                    }}
                  >
                    <button
                      className="btn-secondary admin"
                      onClick={() => setForecastPage((p) => Math.max(1, p - 1))}
                      disabled={forecastPage === 1}
                    >
                      Previous
                    </button>
                    <span className="muted-text" style={{ fontSize: '0.875rem' }}>
                      Page {forecastPage} of {Math.ceil(forecast.predictions.length / FORECAST_PAGE_SIZE)}
                      {' · '}
                      {forecast.predictions.length} medicines
                    </span>
                    <button
                      className="btn-secondary admin"
                      onClick={() =>
                        setForecastPage((p) =>
                          Math.min(Math.ceil(forecast.predictions.length / FORECAST_PAGE_SIZE), p + 1)
                        )
                      }
                      disabled={forecastPage >= Math.ceil(forecast.predictions.length / FORECAST_PAGE_SIZE)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default AdminSalesAnalysis;

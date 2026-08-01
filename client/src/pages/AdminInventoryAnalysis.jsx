import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  BarChart3, RefreshCw, Wallet, Repeat, AlertTriangle, PackageX, Sparkles, Layers, Info,
} from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

// Same "no charting library, no network access to add one" constraint as
// AdminSalesAnalysis.jsx's TrendChart — plain divs sized by percentage.
const ABC_COLORS = { A: '#10b981', B: '#f59e0b', C: '#6b7280', N: '#9ca3af' };
const SEGMENT_COLORS = {
  'Star Performers': '#10b981',
  'Steady Movers': '#3b82f6',
  'Slow Movers': '#f59e0b',
  'Dead / At-Risk Stock': '#ef4444',
};

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '15px' };
const sectionHeaderRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '10px' };

const AdminInventoryAnalysis = () => {
  const { showToast } = useToast();
  const location = useLocation();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const autoRunTriggered = useRef(false);

  const load = () => {
    setLoading(true);
    api
      .get('/admin/inventory-analysis/deep')
      .then((res) => setAnalysis(res.data.analysis))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load inventory analysis', 'error'))
      .finally(() => setLoading(false));
  };

  const handleRun = async ({ silent = false } = {}) => {
    setRunning(true);
    try {
      const res = await api.post('/admin/inventory-analysis/deep/run');
      setAnalysis(res.data.analysis);
      if (!silent) showToast('Deep inventory analysis complete', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not run deep inventory analysis', 'error');
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    load();
    // Arriving here via the Dashboard's "Run Analysis Now" button passes
    // autoRun in nav state, so the fresh run kicks off immediately instead
    // of making the admin click a second button on the page they just landed on.
    if (location.state?.autoRun && !autoRunTriggered.current) {
      autoRunTriggered.current = true;
      handleRun({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="dashboard-page admin-theme">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Inventory Analysis</h2>
        </div>
        <button className="btn-secondary admin" onClick={() => handleRun()} disabled={running}>
          <RefreshCw size={14} strokeWidth={2} className={running ? 'spin' : ''} />
          {running ? 'Running…' : 'Run Deep Analysis Now'}
        </button>
      </header>

      {loading ? (
        <p className="info-text center-text">Loading…</p>
      ) : !analysis ? (
        <p className="info-text center-text">
          No deep analysis has run yet. Click "Run Deep Analysis Now" above — it trains fresh ML models over your
          current catalog and sales history, so this takes a few seconds longer than the quick dashboard summary.
        </p>
      ) : (
        <>
          <p className="muted-text analysis-meta">
            Generated {new Date(analysis.generatedAt).toLocaleString('en-IN')} · built from the last{' '}
            {analysis.lookbackDays} days of sales across {analysis.summary.totalMedicines} medicines
          </p>

          <div className="stat-grid">
            <div className="stat-card">
              <Wallet size={18} strokeWidth={2} className="stat-icon" />
              <div>
                <p className="stat-value">₹{analysis.summary.totalInventoryValue.toFixed(2)}</p>
                <p className="stat-label">Total Inventory Value</p>
              </div>
            </div>
            <div className="stat-card">
              <Repeat size={18} strokeWidth={2} className="stat-icon" />
              <div>
                <p className="stat-value">{analysis.summary.avgTurnoverRatio.toFixed(2)}×</p>
                <p className="stat-label">Avg Turnover Ratio</p>
              </div>
            </div>
            <div className="stat-card stat-card-warn">
              <AlertTriangle size={18} strokeWidth={2} className="stat-icon" />
              <div>
                <p className="stat-value">{analysis.summary.reorderAlertCount}</p>
                <p className="stat-label">Reorder Alerts</p>
              </div>
            </div>
            <div className="stat-card">
              <PackageX size={18} strokeWidth={2} className="stat-icon" />
              <div>
                <p className="stat-value">{analysis.summary.deadStockCount}</p>
                <p className="stat-label">Dead Stock Items</p>
              </div>
            </div>
            <div className="stat-card">
              <Sparkles size={18} strokeWidth={2} className="stat-icon" />
              <div>
                <p className="stat-value">{analysis.summary.anomalyCount}</p>
                <p className="stat-label">AI-Flagged Anomalies</p>
              </div>
            </div>
          </div>

          {/* ABC / Pareto classification */}
          <section className="checkout-section" style={{ marginTop: '1.5rem' }}>
            <h2 className="checkout-section-title"><BarChart3 size={16} strokeWidth={2} /> ABC Classification <span className="muted-text">(revenue Pareto analysis)</span></h2>
            <p className="muted-text" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              A = top medicines driving 80% of revenue · B = next 15% · C = long tail · N = no sales in this window
            </p>
            <div className="analysis-grid" style={{ gridTemplateColumns: `repeat(${analysis.abcBreakdown.length}, 1fr)` }}>
              {analysis.abcBreakdown.map((cls) => (
                <div className="analysis-col" key={cls.abcClass} style={card}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                        background: ABC_COLORS[cls.abcClass] || '#9ca3af',
                      }}
                    />
                    Class {cls.abcClass}
                    <span className="muted-text" style={{ fontWeight: 400, fontSize: '0.8rem' }}>
                      ({cls.count} · {cls.revenueShare}% of revenue)
                    </span>
                  </h3>
                  <ul className="analysis-list">
                    {cls.medicines.slice(0, 6).map((m) => (
                      <li key={m.medicineId}>
                        <span>{m.name}</span>
                        <span className="num">₹{m.revenue.toFixed(0)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* KMeans behavioural segments */}
          <section className="checkout-section" style={{ marginTop: '1.5rem' }}>
            <div style={sectionHeaderRow}>
              <h2 className="checkout-section-title" style={{ margin: 0 }}>
                <Layers size={16} strokeWidth={2} /> AI Stock Segmentation
              </h2>
              <span className="muted-text" style={{ fontSize: '0.8rem' }}>
                {analysis.summary.clusteringModelUsed
                  ? 'Grouped by scikit-learn KMeans clustering on demand level, volatility & turnover'
                  : 'Catalog too small for clustering — grouped by rule-based fallback'}
              </span>
            </div>
            <div className="analysis-grid two-col">
              {analysis.segments.map((seg) => (
                <div className="analysis-col" key={seg.segment} style={card}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
                        background: SEGMENT_COLORS[seg.segment] || '#9ca3af',
                      }}
                    />
                    {seg.segment} <span className="muted-text" style={{ fontWeight: 400, fontSize: '0.8rem' }}>({seg.count})</span>
                  </h3>
                  <ul className="analysis-list">
                    {seg.medicines.length === 0 && <li className="analysis-empty">None in this segment</li>}
                    {seg.medicines.slice(0, 6).map((m) => (
                      <li key={m.medicineId}>
                        <span>{m.name}</span>
                        <span className="num">{m.avgDailyDemand}/day</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Reorder point / safety stock / EOQ */}
          <section className="checkout-section" style={{ marginTop: '1.5rem' }}>
            <h2 className="checkout-section-title"><AlertTriangle size={16} strokeWidth={2} /> Reorder Recommendations</h2>
            <p className="muted-text" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              Reorder point and safety stock are computed per medicine from its own demand average and variability
              (assuming a {analysis.assumptions.leadTimeDays}-day supplier lead time at a {analysis.assumptions.serviceLevelZ}-sigma
              service level, ≈95% for the default 1.65). Order quantity uses the Economic Order Quantity (EOQ) formula.
            </p>
            {analysis.reorderAlerts.length === 0 ? (
              <p className="info-text center-text">Nothing needs reordering right now.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {analysis.reorderAlerts.map((r) => (
                  <div
                    key={r.medicineId}
                    style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}
                  >
                    <div>
                      <p style={{ fontWeight: 600, margin: '0 0 4px 0' }}>{r.name}</p>
                      <p className="muted-text" style={{ fontSize: '0.85rem', margin: 0 }}>
                        Stock: <strong>{r.stock}</strong> · Reorder point: <strong>{r.reorderPoint}</strong> ·
                        {' '}Safety stock: <strong>{r.safetyStock}</strong>
                      </p>
                    </div>
                    <span className="badge badge-outofstock" style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: 600 }}>
                      Order {r.economicOrderQty} units (EOQ)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Dead stock */}
          <section className="checkout-section" style={{ marginTop: '1.5rem' }}>
            <h2 className="checkout-section-title"><PackageX size={16} strokeWidth={2} /> Dead Stock <span className="muted-text">(in stock, zero sales in {analysis.lookbackDays} days)</span></h2>
            {analysis.deadStock.length === 0 ? (
              <p className="info-text center-text">No dead stock detected.</p>
            ) : (
              <ul className="analysis-list">
                {analysis.deadStock.map((d) => (
                  <li key={d.medicineId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                      <span>{d.name}</span>
                      <span className="num">{d.stock} units · ₹{d.inventoryValue.toFixed(0)} tied up</span>
                    </div>
                    {d.discountRecommendationReason && (
                      <p className="muted-text" style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
                        {d.discountRecommendationPct > 0 ? (
                          <><strong>Suggested markdown:</strong> {d.discountRecommendationPct}% off · {d.discountRecommendationReason}</>
                        ) : (
                          <><strong>Recommendation:</strong> {d.discountRecommendationReason}</>
                        )}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Isolation Forest anomalies */}
          <section className="checkout-section" style={{ marginTop: '1.5rem' }}>
            <h2 className="checkout-section-title"><Sparkles size={16} strokeWidth={2} /> AI-Flagged Anomalies</h2>
            <p className="muted-text" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              {analysis.summary.anomalyModelUsed
                ? 'Detected with an Isolation Forest model trained on this run\u2019s demand, volatility, days-of-supply, and inventory value — flags the ~5% most statistically unusual items, not just the biggest or smallest.'
                : 'Catalog too small this run for anomaly detection to be meaningful.'}
            </p>
            {analysis.anomalies.length === 0 ? (
              <p className="info-text center-text">No anomalies flagged this run.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {analysis.anomalies.map((a) => (
                  <div key={a.medicineId} style={card}>
                    <p style={{ fontWeight: 600, margin: '0 0 4px 0' }}>{a.name}</p>
                    <p className="muted-text" style={{ fontSize: '0.85rem', margin: 0, textTransform: 'capitalize' }}>{a.anomalyReason}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="muted-text" style={{ fontSize: '0.78rem', marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Info size={13} strokeWidth={2} />
            Assumptions: {analysis.assumptions.leadTimeDays}-day lead time · ₹{analysis.assumptions.orderingCost} ordering cost/order ·{' '}
            {(analysis.assumptions.holdingCostRate * 100).toFixed(0)}% annual holding cost — override via environment variables if your actuals differ.
          </p>
        </>
      )}
    </div>
  );
};

export default AdminInventoryAnalysis;

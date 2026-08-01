import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw, Wallet, PackageX } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const AdminPriceSensitivityAnalysis = () => {
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
      .catch((err) => showToast(err.response?.data?.message || 'Could not load price sensitivity analysis', 'error'))
      .finally(() => setLoading(false));
  };

  const handleRun = async ({ silent = false } = {}) => {
    setRunning(true);
    try {
      const res = await api.post('/admin/inventory-analysis/deep/run');
      setAnalysis(res.data.analysis);
      if (!silent) showToast('Price sensitivity analysis complete', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not run price sensitivity analysis', 'error');
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    load();
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
          <h2>Price Sensitivity / Discount Optimization</h2>
        </div>
        <button className="btn-secondary admin" onClick={() => handleRun()} disabled={running}>
          <RefreshCw size={14} strokeWidth={2} className={running ? 'spin' : ''} />
          {running ? 'Running…' : 'Run Analysis Now'}
        </button>
      </header>

      {loading ? (
        <p className="info-text center-text">Loading…</p>
      ) : !analysis ? (
        <p className="info-text center-text">
          No discount optimization snapshot is available yet. Click “Run Analysis Now” above to create one.
        </p>
      ) : (
        <>
          <p className="muted-text analysis-meta">
            Generated {new Date(analysis.generatedAt).toLocaleString('en-IN')} · built from the last {analysis.lookbackDays} days
          </p>

          {analysis.deadStock.length === 0 ? (
            <p className="info-text center-text">No dead-stock recommendations were generated for this run.</p>
          ) : (
            <div className="analysis-grid">
              {analysis.deadStock.slice(0, 12).map((item) => (
                <div className="analysis-col" key={item.medicineId}>
                  <h3>{item.name}</h3>
                  <ul className="analysis-list">
                    <li>
                      <span>Stock</span>
                      <span className="num">{item.stock} units</span>
                    </li>
                    <li>
                      <span>Inventory Value</span>
                      <span className="num">₹{item.inventoryValue.toFixed(0)}</span>
                    </li>
                    <li>
                      <span>Category</span>
                      <span className="num">{item.category}</span>
                    </li>
                    <li>
                      <span>Suggested markdown</span>
                      <span className="num">{item.discountRecommendationPct > 0 ? `${item.discountRecommendationPct}%` : 'None'}</span>
                    </li>
                  </ul>
                  {item.discountRecommendationReason && (
                    <p className="muted-text" style={{ marginTop: '0.65rem', fontSize: '0.84rem' }}>
                      {item.discountRecommendationReason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="analysis-grid" style={{ marginTop: '1rem' }}>
            <div className="analysis-col">
              <h3><Wallet size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Elasticity Signal</h3>
              <ul className="analysis-list">
                <li>
                  <span>Dead-stock items</span>
                  <span className="num">{analysis.summary.deadStockCount}</span>
                </li>
                <li>
                  <span>Price signal model</span>
                  <span className="num">Category regression</span>
                </li>
              </ul>
            </div>
            <div className="analysis-col">
              <h3><PackageX size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Targeted Action</h3>
              <ul className="analysis-list">
                <li>
                  <span>Recommendation</span>
                  <span className="num">Markdown if slope is negative</span>
                </li>
                <li>
                  <span>Fallback</span>
                  <span className="num">No markdown expected</span>
                </li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminPriceSensitivityAnalysis;

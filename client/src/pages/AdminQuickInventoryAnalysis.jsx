import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BarChart3, RefreshCw, AlertTriangle, PackageX } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { formatDateTime } from '../utils/format';

const AdminQuickInventoryAnalysis = () => {
  const { showToast } = useToast();
  const location = useLocation();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const autoRunTriggered = useRef(false);

  const load = () => {
    setLoading(true);
    api
      .get('/admin/inventory-analysis')
      .then((res) => setAnalysis(res.data.analysis))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load quick inventory analysis', 'error'))
      .finally(() => setLoading(false));
  };

  const handleRun = async ({ silent = false } = {}) => {
    setRunning(true);
    try {
      const res = await api.post('/admin/inventory-analysis/run');
      setAnalysis(res.data.analysis);
      if (!silent) showToast('Quick inventory analysis complete', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not run quick inventory analysis', 'error');
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
          <h2>Quick Inventory Analysis</h2>
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
          No quick inventory analysis has run yet. Click “Run Analysis Now” above to generate a fresh snapshot.
        </p>
      ) : (
        <>
          <p className="muted-text analysis-meta">
            Last run {formatDateTime(analysis.generatedAt)} · sales window: last {analysis.lookbackDays} days ·{' '}
            {analysis.totalStockUnits} total units across {analysis.totalMedicines} medicines
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

          <div className="analysis-grid" style={{ marginTop: '1rem' }}>
            <div className="analysis-col">
              <h3><AlertTriangle size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Quick Health</h3>
              <ul className="analysis-list">
                <li>
                  <span>Total stock units</span>
                  <span className="num">{analysis.totalStockUnits}</span>
                </li>
                <li>
                  <span>Medicines tracked</span>
                  <span className="num">{analysis.totalMedicines}</span>
                </li>
              </ul>
            </div>
            <div className="analysis-col">
              <h3><PackageX size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Stock Watch</h3>
              <ul className="analysis-list">
                <li>
                  <span>Low stock threshold</span>
                  <span className="num">≤ {analysis.lowStockThreshold}</span>
                </li>
                <li>
                  <span>Sales lookback</span>
                  <span className="num">{analysis.lookbackDays} days</span>
                </li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminQuickInventoryAnalysis;

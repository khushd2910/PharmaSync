import { useEffect, useState } from 'react';
import { ShoppingBasket, RefreshCw, Boxes, Layers, ArrowRight, TrendingUp } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const RULES_PAGE_SIZE = 10;

const AdminMarketBasketAnalysis = () => {
  const { showToast } = useToast();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [rulesPage, setRulesPage] = useState(1);

  const load = () => {
    setLoading(true);
    api
      .get('/admin/market-basket-analysis')
      .then((res) => {
        setAnalysis(res.data.analysis);
        setRulesPage(1);
      })
      .catch((err) => showToast(err.response?.data?.message || 'Could not load market basket analysis', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await api.post('/admin/market-basket-analysis/run');
      setAnalysis(res.data.analysis);
      setRulesPage(1);
      showToast('Market basket analysis complete', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not run market basket analysis', 'error');
    } finally {
      setRunning(false);
    }
  };

  const totalRulesPages = analysis ? Math.max(1, Math.ceil(analysis.rules.length / RULES_PAGE_SIZE)) : 1;
  const pagedRules = analysis
    ? analysis.rules.slice((rulesPage - 1) * RULES_PAGE_SIZE, rulesPage * RULES_PAGE_SIZE)
    : [];

  return (
    <div className="dashboard-page admin-theme">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Market Basket Analysis</h2>
        </div>
        <button className="btn-secondary admin" onClick={handleRun} disabled={running}>
          <RefreshCw size={14} strokeWidth={2} className={running ? 'spin' : ''} />
          {running ? 'Mining rules…' : 'Run Analysis Now'}
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
            Last run {new Date(analysis.generatedAt).toLocaleString('en-IN')} · built from the last{' '}
            {analysis.lookbackDays} days · min support {(analysis.minSupport * 100).toFixed(1)}% · min confidence{' '}
            {(analysis.minConfidence * 100).toFixed(0)}%
          </p>

          <div className="stat-grid">
            <div className="stat-card">
              <ShoppingBasket size={18} strokeWidth={2} className="stat-icon" />
              <div>
                <p className="stat-value">{analysis.totalBaskets}</p>
                <p className="stat-label">Multi-item baskets analysed</p>
              </div>
            </div>
            <div className="stat-card">
              <Boxes size={18} strokeWidth={2} className="stat-icon" />
              <div>
                <p className="stat-value">{analysis.avgBasketSize}</p>
                <p className="stat-label">Average basket size</p>
              </div>
            </div>
            <div className="stat-card">
              <Layers size={18} strokeWidth={2} className="stat-icon" />
              <div>
                <p className="stat-value">{analysis.rules.length}</p>
                <p className="stat-label">Association rules found</p>
              </div>
            </div>
          </div>

          <section className="checkout-section">
            <h2 className="checkout-section-title">
              <TrendingUp size={16} strokeWidth={2} /> Top Pairs <span className="muted-text">(by support)</span>
            </h2>
            <p className="muted-text" style={{ marginTop: '-6px', marginBottom: '12px' }}>
              How often each pair shows up together, out of every basket analysed.
            </p>
            <ul className="analysis-list">
              {analysis.topPairs.length === 0 && <li className="analysis-empty">Not enough basket history yet</li>}
              {analysis.topPairs.map((pair, i) => (
                <li key={`${pair.itemA.medicineId}-${pair.itemB.medicineId}-${i}`}>
                  <span>
                    {pair.itemA.name} <ArrowRight size={12} strokeWidth={2} style={{ verticalAlign: 'middle', margin: '0 4px' }} />{' '}
                    {pair.itemB.name}
                  </span>
                  <span className="num">
                    {(pair.support * 100).toFixed(1)}% · {pair.count} baskets
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="checkout-section" style={{ marginTop: '2rem' }}>
            <h2 className="checkout-section-title">
              <ShoppingBasket size={16} strokeWidth={2} /> Association Rules{' '}
              <span className="muted-text">(customers who buy X also buy Y)</span>
            </h2>
            <p className="muted-text" style={{ marginTop: '-6px', marginBottom: '12px' }}>
              Ranked by lift — how much more likely the pairing is than chance (lift &gt; 1 means a genuine
              relationship, not just two popular items).
            </p>

            {analysis.rules.length === 0 ? (
              <p className="info-text center-text">Not enough basket history yet to mine reliable rules.</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {pagedRules.map((rule, i) => (
                    <div
                      key={`${rule.antecedents[0].medicineId}-${rule.consequents[0].medicineId}-${i}`}
                      className="admin-order-row"
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        background: '#fff',
                        flexWrap: 'wrap',
                        gap: '10px',
                      }}
                    >
                      <div className="admin-order-main">
                        <p style={{ fontWeight: 600, fontSize: '1.02rem', margin: '0 0 4px 0', color: '#1f2937' }}>
                          {rule.antecedents[0].name}
                          <ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: 'middle', margin: '0 6px' }} />
                          {rule.consequents[0].name}
                        </p>
                        <p className="muted-text" style={{ fontSize: '0.85rem', margin: 0 }}>
                          Support: <span style={{ fontWeight: 500, color: '#1f2937' }}>{(rule.support * 100).toFixed(1)}%</span>
                          {' · '}
                          Confidence: <span style={{ fontWeight: 500, color: '#1f2937' }}>{(rule.confidence * 100).toFixed(1)}%</span>
                        </p>
                      </div>
                      <span
                        className="badge badge-success"
                        style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem', borderRadius: '6px', fontWeight: 600 }}
                      >
                        Lift {rule.lift.toFixed(2)}×
                      </span>
                    </div>
                  ))}
                </div>

                {analysis.rules.length > RULES_PAGE_SIZE && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '1.25rem' }}>
                    <button
                      className="btn-secondary admin"
                      onClick={() => setRulesPage((p) => Math.max(1, p - 1))}
                      disabled={rulesPage === 1}
                    >
                      Previous
                    </button>
                    <span className="muted-text" style={{ fontSize: '0.875rem' }}>
                      Page {rulesPage} of {totalRulesPages} · {analysis.rules.length} rules
                    </span>
                    <button
                      className="btn-secondary admin"
                      onClick={() => setRulesPage((p) => Math.min(totalRulesPages, p + 1))}
                      disabled={rulesPage >= totalRulesPages}
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

export default AdminMarketBasketAnalysis;

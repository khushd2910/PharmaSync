import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, RefreshCw, ChevronLeft, ChevronRight, Wallet, PackageX, ArrowDown, ArrowUp } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import IconInput from '../components/IconInput';

const AdminPriceSensitivityAnalysis = () => {
  const { showToast } = useToast();
  const location = useLocation();
  const [analysis, setAnalysis] = useState(null);
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [draftDiscounts, setDraftDiscounts] = useState({});
  const [sortBy, setSortBy] = useState('markdown');
  const autoRunTriggered = useRef(false);

  const loadMedicines = (searchValue, pageValue) => {
    setLoading(true);
    api
      .get('/admin/medicines', { params: { search: searchValue || undefined, page: pageValue, limit: 10 } })
      .then((res) => {
        setMedicines(res.data.medicines);
        setPagination(res.data.pagination);
        setDraftDiscounts((prev) => {
          const next = { ...prev };
          res.data.medicines.forEach((medicine) => {
            next[medicine._id] = medicine.discountPercent || 0;
          });
          return next;
        });
      })
      .catch((err) => showToast(err.response?.data?.message || 'Could not load medicines for pricing table', 'error'))
      .finally(() => setLoading(false));
  };

  const load = () => {
    api
      .get('/admin/inventory-analysis/deep')
      .then((res) => setAnalysis(res.data.analysis))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load price sensitivity analysis', 'error'));
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

  useEffect(() => {
    const timer = setTimeout(() => loadMedicines(search, page), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  const recommendationMap = useMemo(() => {
    return new Map((analysis?.priceSensitivityRecommendations || []).map((item) => [item.medicineId, item]));
  }, [analysis]);

  const categorySummary = useMemo(() => {
    const buckets = new Map();
    (analysis?.priceSensitivityRecommendations || []).forEach((item) => {
      const category = item.category || 'Uncategorized';
      const existing = buckets.get(category) || { category, count: 0, avgSuggestedMarkdown: 0, recommendedCount: 0 };
      existing.count += 1;
      existing.avgSuggestedMarkdown += item.discountRecommendationPct || 0;
      if ((item.discountRecommendationPct || 0) > 0) existing.recommendedCount += 1;
      buckets.set(category, existing);
    });

    return Array.from(buckets.values())
      .map((item) => ({
        ...item,
        avgSuggestedMarkdown: Number(((item.avgSuggestedMarkdown / Math.max(item.count, 1)) || 0).toFixed(1)),
      }))
      .sort((a, b) => {
        if (sortBy === 'category') return a.category.localeCompare(b.category);
        return b.avgSuggestedMarkdown - a.avgSuggestedMarkdown;
      });
  }, [analysis, sortBy]);

  const handleApplyDiscount = async (medicine) => {
    const nextDiscount = Number(draftDiscounts[medicine._id]);
    if (!Number.isFinite(nextDiscount) || nextDiscount < 0 || nextDiscount > 100) {
      showToast('Discount must be between 0 and 100', 'error');
      return;
    }

    try {
      const res = await api.patch(`/admin/medicines/${medicine._id}`, { discountPercent: nextDiscount });
      setMedicines((prev) => prev.map((m) => (m._id === medicine._id ? res.data.medicine : m)));
      setDraftDiscounts((prev) => ({ ...prev, [medicine._id]: res.data.medicine.discountPercent || 0 }));
      showToast(`Discount updated for ${medicine.name}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update discount', 'error');
    }
  };

  const handleResetDiscount = async (medicine) => {
    try {
      const res = await api.patch(`/admin/medicines/${medicine._id}`, { discountPercent: 0 });
      setMedicines((prev) => prev.map((m) => (m._id === medicine._id ? res.data.medicine : m)));
      setDraftDiscounts((prev) => ({ ...prev, [medicine._id]: 0 }));
      showToast(`Discount reset for ${medicine.name}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not reset discount', 'error');
    }
  };

  const handleApplySuggested = async (medicine) => {
    const recommendation = recommendationMap.get(medicine._id?.toString?.() || medicine._id);
    const nextDiscount = Number(recommendation?.discountRecommendationPct || 0);
    try {
      const res = await api.patch(`/admin/medicines/${medicine._id}`, { discountPercent: nextDiscount });
      setMedicines((prev) => prev.map((m) => (m._id === medicine._id ? res.data.medicine : m)));
      setDraftDiscounts((prev) => ({ ...prev, [medicine._id]: nextDiscount }));
      showToast(`AI recommended markdown applied to ${medicine.name}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not apply AI markdown', 'error');
    }
  };

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

      <p className="muted-text analysis-meta">
        AI-powered category elasticity view for all medicines. Search by name or category, review the current discount, and update markdowns dynamically for whichever products deserve a price test.
      </p>

      <div style={{ marginBottom: 18 }}>
        <IconInput
          icon={Search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search medicines by name, brand, category, or manufacturer"
        />
      </div>

      {analysis && (
        <div className="analysis-grid" style={{ marginBottom: '1rem' }}>
          <div className="analysis-col">
            <h3><Wallet size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Category Markdown Response</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <button className="btn-secondary admin" onClick={() => setSortBy('markdown')}>
                <ArrowDown size={14} strokeWidth={2} /> Highest markdown response
              </button>
              <button className="btn-secondary admin" onClick={() => setSortBy('category')}>
                <ArrowUp size={14} strokeWidth={2} /> Category sort
              </button>
            </div>
            <ul className="analysis-list">
              {categorySummary.slice(0, 8).map((item) => (
                <li key={item.category}>
                  <span>{item.category}</span>
                  <span className="num">{item.avgSuggestedMarkdown}% avg · {item.recommendedCount} suggest</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="analysis-col">
            <h3><PackageX size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Admin Action Model</h3>
            <ul className="analysis-list">
              <li>
                <span>Current use</span>
                <span className="num">Human review + AI suggestion</span>
              </li>
              <li>
                <span>Suggested meaning</span>
                <span className="num">Markdown if elasticity is negative</span>
              </li>
              <li>
                <span>Expected price</span>
                <span className="num">Price × (1 − discount%)</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {loading ? (
        <p className="info-text center-text">Loading pricing guidance…</p>
      ) : medicines.length === 0 ? (
        <p className="info-text center-text">No medicines matched your search.</p>
      ) : (
        <>
          <div className="admin-orders-table">
            {medicines.map((medicine) => {
              const recommendation = recommendationMap.get(medicine._id?.toString?.() || medicine._id);
              const suggestedMarkdown = recommendation?.discountRecommendationPct > 0 ? recommendation.discountRecommendationPct : 0;
              const currentDiscount = Number(medicine.discountPercent || 0);
              const expectedPrice = Number(medicine.price || 0) * (1 - (currentDiscount / 100));
              const aiExpectedPrice = Number(medicine.price || 0) * (1 - (suggestedMarkdown / 100));
              const suggestionText = recommendation?.discountRecommendationReason || 'No category-level elasticity signal was strong enough to justify a markdown. Keep current price and test bundles or assortment changes instead.';
              const draftDiscount = Number(draftDiscounts[medicine._id] ?? currentDiscount);

              return (
                <div className="admin-order-row" key={medicine._id}>
                  <div className="admin-order-main">
                    <p className="order-invoice">{medicine.name}</p>
                    <p className="muted-text">
                      {medicine.brand || medicine.manufacturer || 'No brand'} · {medicine.category || 'Uncategorized'}
                    </p>
                    <p className="muted-text">
                      Base price ₹{Number(medicine.price || 0).toFixed(2)} · current discount {currentDiscount}% · expected price ₹{expectedPrice.toFixed(2)}
                    </p>
                  </div>

                  <div className="admin-medicine-actions" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <span className={`badge ${suggestedMarkdown > 0 ? 'badge-rx' : 'badge-success'}`}>
                      AI markdown: {suggestedMarkdown > 0 ? `${suggestedMarkdown}%` : 'None'}
                    </span>
                    <span className="muted-text" style={{ maxWidth: 360, textAlign: 'right', fontSize: '0.82rem' }}>
                      {suggestionText}
                    </span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Discount %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={draftDiscount}
                        onChange={(e) => setDraftDiscounts((prev) => ({ ...prev, [medicine._id]: Number(e.target.value) }))}
                        style={{ width: 72, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}
                      />
                      <button className="btn-secondary admin" onClick={() => handleApplyDiscount(medicine)}>
                        Apply discount
                      </button>
                      <button className="btn-secondary admin" onClick={() => handleResetDiscount(medicine)}>
                        Reset discount
                      </button>
                      <button className="btn-secondary admin" onClick={() => handleApplySuggested(medicine)}>
                        Use AI suggestion
                      </button>
                    </div>
                    <div className="muted-text" style={{ fontSize: '0.8rem', textAlign: 'right' }}>
                      AI expected price at suggested markdown: ₹{aiExpectedPrice.toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pagination-bar">
            <span className="muted-text">
              {pagination.total} medicine{pagination.total === 1 ? '' : 's'} · page {pagination.page} of {pagination.pages}
            </span>
            <div className="pagination-controls">
              <button
                className="btn-secondary admin"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft size={14} strokeWidth={2} /> Prev
              </button>
              <button
                className="btn-secondary admin"
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page >= pagination.pages}
              >
                Next <ChevronRight size={14} strokeWidth={2} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminPriceSensitivityAnalysis;

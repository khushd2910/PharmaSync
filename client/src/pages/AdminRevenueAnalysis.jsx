import { useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw, Search, Wallet, ShoppingBag } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const AdminRevenueAnalysis = () => {
  const { showToast } = useToast();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('totalRevenue');
  const [sortDir, setSortDir] = useState('desc');
  const PAGE_SIZE = 20;

  const loadRevenueAnalysis = () => {
    setLoading(true);
    api
      .get('/admin/sales-analysis')
      .then((res) => setAnalysis(res.data.analysis))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load revenue analysis', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRevenueAnalysis();
  }, []);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await api.post('/admin/sales-analysis/run');
      setAnalysis(res.data.analysis);
      showToast('Revenue analysis refreshed successfully', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not run revenue analysis', 'error');
    } finally {
      setRunning(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!analysis?.medicineRevenueBreakdown) return [];
    const q = search.trim().toLowerCase();
    const filtered = q
      ? analysis.medicineRevenueBreakdown.filter((item) => item.name.toLowerCase().includes(q))
      : analysis.medicineRevenueBreakdown;

    const sorted = [...filtered].sort((a, b) => {
      const multiplier = sortDir === 'asc' ? 1 : -1;
      const raw = a[sortBy] - b[sortBy];
      return raw * multiplier;
    });

    return sorted;
  }, [analysis, search, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPageItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir(column === 'name' ? 'asc' : 'desc');
    }
  };

  const renderSortIndicator = (column) => {
    if (sortBy !== column) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div className="dashboard-page admin-theme">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Revenue Analysis</h2>
        </div>
        <button className="btn-secondary admin" onClick={handleRun} disabled={running}>
          <RefreshCw size={14} strokeWidth={2} className={running ? 'spin' : ''} />
          {running ? 'Running…' : 'Run Analysis Now'}
        </button>
      </header>

      {loading ? (
        <p className="info-text center-text">Loading revenue analysis…</p>
      ) : !analysis ? (
        <p className="info-text center-text">No revenue analysis has run yet.</p>
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
                <p className="stat-label">Combined Revenue · ₹{analysis.onlineRevenue.toFixed(2)} online, ₹{analysis.posRevenue.toFixed(2)} offline</p>
              </div>
            </div>
            <div className="stat-card">
              <ShoppingBag size={18} strokeWidth={2} className="stat-icon" />
              <div>
                <p className="stat-value">{analysis.totalOrders}</p>
                <p className="stat-label">Orders + POS Sales</p>
              </div>
            </div>
          </div>

          <section className="checkout-section">
            <div className="analysis-header revenue-analysis-header">
              <h2 className="checkout-section-title" style={{ margin: 0 }}>
                <BarChart3 size={16} strokeWidth={2} /> Medicine Revenue Breakdown
              </h2>
              <div className="search-wrapper revenue-search-wrapper">
                <Search size={14} strokeWidth={2} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search medicine"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <p className="info-text center-text">No medicines match this search.</p>
            ) : (
              <>
                <div className="admin-revenue-table-wrap">
                  <table className="admin-revenue-table">
                    <thead>
                      <tr>
                        <th><button type="button" className="revenue-sort-button" onClick={() => handleSort('name')}>Medicine{renderSortIndicator('name')}</button></th>
                        <th>Total Units</th>
                        <th>Online Units</th>
                        <th>Offline Units</th>
                        <th><button type="button" className="revenue-sort-button" onClick={() => handleSort('totalRevenue')}>Total Revenue{renderSortIndicator('totalRevenue')}</button></th>
                        <th><button type="button" className="revenue-sort-button" onClick={() => handleSort('onlineRevenue')}>Online Revenue{renderSortIndicator('onlineRevenue')}</button></th>
                        <th><button type="button" className="revenue-sort-button" onClick={() => handleSort('posRevenue')}>Offline Revenue{renderSortIndicator('posRevenue')}</button></th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPageItems.map((item) => (
                        <tr key={item.medicineId}>
                          <td>{item.name}</td>
                          <td>{item.unitsSold}</td>
                          <td>{item.onlineUnits}</td>
                          <td>{item.posUnits}</td>
                          <td>₹{item.totalRevenue.toFixed(2)}</td>
                          <td>₹{item.onlineRevenue.toFixed(2)}</td>
                          <td>₹{item.posRevenue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pagination-row revenue-pagination-row">
                  <button
                    className="btn-secondary admin"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </button>
                  <span className="muted-text">
                    Page {page} of {totalPages} · {filteredItems.length} medicines
                  </span>
                  <button
                    className="btn-secondary admin"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default AdminRevenueAnalysis;

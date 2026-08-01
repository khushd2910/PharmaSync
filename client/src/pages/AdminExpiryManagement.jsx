import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const formatExpiry = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const daysUntil = (value) => {
  if (!value) return null;
  const diffMs = new Date(value).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const statusLabel = (days) => {
  if (days === null || days === undefined) return 'No expiry on file';
  if (days < 0) return 'Expired';
  if (days <= 30) return 'Expiring in 30 days';
  if (days <= 60) return 'Expiring in 60 days';
  if (days <= 90) return 'Expiring in 90 days';
  return 'Tracked';
};

const AdminExpiryManagement = () => {
  const { showToast } = useToast();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMedicines, setLoadingMedicines] = useState(true);
  const [running, setRunning] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [medicines, setMedicines] = useState([]);
  const [sortBy, setSortBy] = useState('expiryDate');
  const [sortDir, setSortDir] = useState('asc');
  const PAGE_SIZE = 20;

  const loadSummary = () => {
    api
      .get('/admin/expiry-analysis')
      .then((res) => setAnalysis(res.data.analysis))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load expiry analysis', 'error'));
  };

  const loadMedicines = (searchValue, pageValue) => {
    setLoadingMedicines(true);
    api
      .get('/admin/medicines', {
        params: {
          search: searchValue || undefined,
          page: pageValue,
          limit: PAGE_SIZE,
        },
      })
      .then((res) => {
        setMedicines(res.data.medicines);
        setPagination(res.data.pagination);
      })
      .catch((err) => showToast(err.response?.data?.message || 'Could not load medicines for expiry view', 'error'))
      .finally(() => setLoadingMedicines(false));
  };

  useEffect(() => {
    loadSummary();
    loadMedicines(search, page);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => loadMedicines(search, page), 250);
    return () => clearTimeout(timer);
  }, [search, page]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const res = await api.post('/admin/expiry-analysis/run');
      setAnalysis(res.data.analysis);
      showToast('Expiry analysis refreshed successfully', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not run expiry analysis', 'error');
    } finally {
      setRunning(false);
    }
  };

  const expiryRows = useMemo(() => {
    return medicines
      .map((medicine) => {
        const expiryDays = daysUntil(medicine.expiryDate);
        return {
          medicineId: medicine._id,
          name: medicine.name,
          expiryDate: medicine.expiryDate,
          daysUntilExpiry: expiryDays,
          status: statusLabel(expiryDays),
          brand: medicine.brand || medicine.manufacturer || '—',
        };
      })
      .filter((item) => item.expiryDate)
      .sort((a, b) => {
        const multiplier = sortDir === 'asc' ? 1 : -1;
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name) * multiplier;
        }
        if (sortBy === 'status') {
          return a.status.localeCompare(b.status) * multiplier;
        }
        return (new Date(a.expiryDate) - new Date(b.expiryDate)) * multiplier;
      });
  }, [medicines, sortBy, sortDir]);

  useEffect(() => {
    setLoading(false);
  }, [analysis, medicines]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
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
          <h2>Expiry Management</h2>
        </div>
        <button className="btn-secondary admin" onClick={handleRun} disabled={running}>
          <RefreshCw size={14} strokeWidth={2} className={running ? 'spin' : ''} />
          {running ? 'Running…' : 'Run Analysis Now'}
        </button>
      </header>

      {loading ? (
        <p className="info-text center-text">Loading expiry view…</p>
      ) : !analysis ? (
        <p className="info-text center-text">No expiry analysis has run yet.</p>
      ) : (
        <>
          <p className="muted-text analysis-meta">
            Last run {new Date(analysis.generatedAt).toLocaleString('en-IN')} · {analysis.totalTracked} medicines with a known expiry date · {analysis.alertCount} urgent alerts
          </p>

          <div className="stat-grid">
            <div className="stat-card">
              <AlertTriangle size={18} strokeWidth={2} className="stat-icon" />
              <div>
                <p className="stat-value">{analysis.alertCount}</p>
                <p className="stat-label">Urgent alerts within {analysis.expiryAlertDays} days</p>
              </div>
            </div>
            <div className="stat-card">
              <ShieldAlert size={18} strokeWidth={2} className="stat-icon" />
              <div>
                <p className="stat-value">{analysis.expired.length}</p>
                <p className="stat-label">Already expired</p>
              </div>
            </div>
            <div className="stat-card">
              <CalendarClock size={18} strokeWidth={2} className="stat-icon" />
              <div>
                <p className="stat-value">{analysis.totalTracked}</p>
                <p className="stat-label">Tracked with expiry dates</p>
              </div>
            </div>
          </div>

          <section className="checkout-section">
            <div className="analysis-header revenue-analysis-header">
              <h2 className="checkout-section-title" style={{ margin: 0 }}>
                <CalendarClock size={16} strokeWidth={2} /> Latest Expiry Dates
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

            {loadingMedicines ? (
              <p className="info-text center-text">Loading medicines…</p>
            ) : expiryRows.length === 0 ? (
              <p className="info-text center-text">No medicines with expiry dates match this search.</p>
            ) : (
              <>
                <div className="admin-revenue-table-wrap">
                  <table className="admin-revenue-table">
                    <thead>
                      <tr>
                        <th>
                          <button type="button" className="revenue-sort-button" onClick={() => handleSort('name')}>
                            Medicine{renderSortIndicator('name')}
                          </button>
                        </th>
                        <th>Brand</th>
                        <th>
                          <button type="button" className="revenue-sort-button" onClick={() => handleSort('expiryDate')}>
                            Expiry Date{renderSortIndicator('expiryDate')}
                          </button>
                        </th>
                        <th>
                          <button type="button" className="revenue-sort-button" onClick={() => handleSort('status')}>
                            Status{renderSortIndicator('status')}
                          </button>
                        </th>
                        <th>Days Left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiryRows.map((item) => (
                        <tr key={`${item.medicineId}-${item.expiryDate}`}>
                          <td>{item.name}</td>
                          <td>{item.brand}</td>
                          <td>{formatExpiry(item.expiryDate)}</td>
                          <td>{item.status}</td>
                          <td>{item.daysUntilExpiry}</td>
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
                    Page {pagination.page} of {pagination.pages} · {pagination.total} medicines
                  </span>
                  <button
                    className="btn-secondary admin"
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    disabled={page >= pagination.pages}
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

export default AdminExpiryManagement;

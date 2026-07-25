import { useEffect, useState } from 'react';
import { FileSpreadsheet, RefreshCw, Download } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// One line per export, in the fixed order the diagram/backend produce them
// — kept separate from the whitelist on the server, but must match it.
const REPORT_LABELS = {
  'Sales.csv': 'Combined sales — online orders + in-store POS, one row per sale',
  'Inventory.csv': 'Full medicine catalog snapshot — stock, price, status',
  'Expiry.csv': 'Active medicines with a known expiry date, nearest first',
  'Orders.csv': 'Online orders only, with customer + delivery detail',
};

const formatSize = (bytes) => {
  if (bytes === null || bytes === undefined) return null;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const AdminReports = () => {
  const { showToast } = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get('/admin/reports')
      .then((res) => setReports(res.data.reports))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load reports', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/admin/reports/generate');
      setReports(res.data.reports);
      showToast('Reports generated', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not generate reports', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="dashboard-page admin-theme">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>CSV Reports</h2>
        </div>
        <button className="btn-secondary admin" onClick={handleGenerate} disabled={generating}>
          <RefreshCw size={14} strokeWidth={2} className={generating ? 'spin' : ''} />
          {generating ? 'Generating…' : 'Generate Report'}
        </button>
      </header>

      <p className="muted-text analysis-meta">
        Runs the Python export job against the live database and writes four fresh CSVs — download any of them below.
      </p>

      {loading ? (
        <p className="info-text center-text">Loading…</p>
      ) : (
        <div className="admin-orders-table">
          {reports.map((report) => (
            <div className="admin-order-row" key={report.filename}>
              <div className="admin-order-main">
                <p className="order-invoice">
                  <FileSpreadsheet size={14} strokeWidth={2} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
                  {report.filename}
                </p>
                <p className="muted-text">{REPORT_LABELS[report.filename]}</p>
                <p className="muted-text">
                  {report.generatedAt
                    ? `Generated ${new Date(report.generatedAt).toLocaleString('en-IN')} · ${formatSize(report.sizeBytes)}`
                    : 'Not generated yet'}
                </p>
              </div>

              {report.generatedAt ? (
                <a
                  className="icon-btn-danger"
                  href={`${API_BASE_URL}/admin/reports/download/${report.filename}`}
                  title={`Download ${report.filename}`}
                >
                  <Download size={16} strokeWidth={2} />
                </a>
              ) : (
                <Download size={16} strokeWidth={2} style={{ opacity: 0.3 }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminReports;

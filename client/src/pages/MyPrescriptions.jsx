import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Eye, Clock, AlertTriangle } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const STATUS_BADGE_CLASS = {
  Approved: 'badge badge-success',
  Rejected: 'badge badge-cancelled',
  Pending: 'badge badge-status',
};

const formatDate = (value) =>
  new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const MyPrescriptions = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    api
      .get('/prescriptions')
      .then((res) => setPrescriptions(res.data.prescriptions))
      .catch((err) => {
        setError(true);
        showToast(err.response?.data?.message || 'Could not load your prescriptions', 'error');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="saved-page">
        <p className="info-text center-text">Loading your prescriptions…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="saved-page">
        <div className="empty-state">
          <AlertTriangle size={40} strokeWidth={1.5} />
          <h2>Couldn't load your prescriptions</h2>
          <p className="muted-text">Something went wrong while fetching your prescriptions. Please try again.</p>
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  if (prescriptions.length === 0) {
    return (
      <div className="saved-page">
        <div className="empty-state">
          <FileText size={40} strokeWidth={1.5} />
          <h2>No prescriptions uploaded yet</h2>
          <p className="muted-text">
            Prescriptions you upload at checkout for prescription-only medicines will show up here.
          </p>
          <Link to="/" className="btn-primary">Browse medicines</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-page">
      <h1 className="page-title">My Prescriptions</h1>
      <p className="muted-text" style={{ marginBottom: 20 }}>
        Every prescription you've uploaded, and whether our pharmacist has reviewed it yet.
      </p>

      <div className="address-list">
        {prescriptions.map((p) => (
          <div className="address-card" key={p._id}>
            <div className="address-card-header">
              <strong><FileText size={14} strokeWidth={2} style={{ verticalAlign: -2, marginRight: 6 }} />{p.originalName}</strong>
              <span className={STATUS_BADGE_CLASS[p.status] || 'badge badge-status'}>{p.status}</span>
            </div>
            <p className="muted-text" style={{ margin: '4px 0 10px' }}>
              <Clock size={12} strokeWidth={2} style={{ verticalAlign: -1, marginRight: 4 }} />
              Uploaded {formatDate(p.createdAt)}
              {p.order ? ' · linked to an order' : ' · not yet used on an order'}
            </p>
            {p.reviewNote && (
              <p className="muted-text" style={{ margin: '0 0 10px' }}>
                Pharmacist note: {p.reviewNote}
              </p>
            )}
            <div className="address-card-actions">
              <a
                href={`${API_BASE_URL}/prescriptions/${p._id}/file`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                <Eye size={13} strokeWidth={2} /> View file
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyPrescriptions;

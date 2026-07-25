import { useEffect, useState } from 'react';
import { FileText, Check, X, Eye } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const STATUSES = ['Pending', 'Approved', 'Rejected'];

const AdminPrescriptions = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const { showToast } = useToast();

  const loadPrescriptions = () => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;

    api
      .get('/admin/prescriptions', { params })
      .then((res) => setPrescriptions(res.data.prescriptions))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load prescriptions', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPrescriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleReview = async (id, status) => {
    if (status === 'Rejected' && !window.confirm('Reject this prescription? If it\'s linked to an order, that order will be cancelled and stock released.')) {
      return;
    }
    setReviewingId(id);
    try {
      const res = await api.patch(`/admin/prescriptions/${id}/review`, { status });
      setPrescriptions((prev) => prev.map((p) => (p._id === id ? res.data.prescription : p)));
      showToast(`Prescription ${status.toLowerCase()}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update prescription', 'error');
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="admin-orders-page admin-theme">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Prescription Verification</h2>
        </div>
        <select className="sort-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="info-text center-text">Loading prescriptions…</p>
      ) : prescriptions.length === 0 ? (
        <p className="info-text center-text">No prescriptions found.</p>
      ) : (
        <div className="admin-orders-table">
          {prescriptions.map((p) => (
            <div className="admin-order-row" key={p._id}>
              <div className="admin-order-main">
                <p className="order-invoice"><FileText size={14} strokeWidth={2} /> {p.originalName}</p>
                <p className="muted-text">
                  {p.user?.name || 'Unknown user'} · {p.user?.email}
                </p>
                <p className="muted-text">
                  {new Date(p.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {p.order && <> · Order {p.order.invoiceNumber} (₹{p.order.totalAmount?.toFixed(2)})</>}
                  {!p.order && ' · Not yet linked to an order'}
                </p>
              </div>

              <span
                className={`badge ${
                  p.status === 'Approved' ? 'badge-success' : p.status === 'Rejected' ? 'badge-rx' : 'badge-status'
                }`}
              >
                {p.status}
              </span>

              <a
                className="icon-btn-danger"
                href={`${API_BASE_URL}/prescriptions/${p._id}/file`}
                target="_blank"
                rel="noopener noreferrer"
                title="View file"
              >
                <Eye size={16} strokeWidth={2} />
              </a>

              {p.status === 'Pending' && (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={reviewingId === p._id}
                    onClick={() => handleReview(p._id, 'Approved')}
                  >
                    <Check size={14} strokeWidth={2} /> Approve
                  </button>
                  <button
                    type="button"
                    className="btn-secondary danger"
                    disabled={reviewingId === p._id}
                    onClick={() => handleReview(p._id, 'Rejected')}
                  >
                    <X size={14} strokeWidth={2} /> Reject
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPrescriptions;

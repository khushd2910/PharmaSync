import { useEffect, useState } from 'react';
import { FileText, Check, X, Eye } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDate } from '../utils/format';
import ConfirmModal from '../components/ConfirmModal';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const STATUSES = ['Pending', 'Approved', 'Rejected'];

const AdminPrescriptions = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [selected, setSelected] = useState([]);
  const [confirmState, setConfirmState] = useState(null); // { ids, status } | null
  const [bulkRunning, setBulkRunning] = useState(false);
  const { showToast } = useToast();

  const pendingCount = prescriptions.filter((p) => p.status === 'Pending').length;

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
    setSelected([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const reviewOne = async (id, status) => {
    const res = await api.patch(`/admin/prescriptions/${id}/review`, { status });
    setPrescriptions((prev) => prev.map((p) => (p._id === id ? res.data.prescription : p)));
  };

  const handleReview = async (id, status) => {
    if (status === 'Rejected') {
      setConfirmState({ ids: [id], status });
      return;
    }
    setReviewingId(id);
    try {
      await reviewOne(id, status);
      showToast(`Prescription ${status.toLowerCase()}`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update prescription', 'error');
    } finally {
      setReviewingId(null);
    }
  };

  const toggleSelected = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const pendingIds = prescriptions.filter((p) => p.status === 'Pending').map((p) => p._id);
  const allPendingSelected = pendingIds.length > 0 && pendingIds.every((id) => selected.includes(id));

  const toggleSelectAll = () => {
    setSelected(allPendingSelected ? [] : pendingIds);
  };

  const handleBulkAction = (status) => {
    if (selected.length === 0) return;
    if (status === 'Rejected') {
      setConfirmState({ ids: selected, status });
      return;
    }
    runBulk(selected, status);
  };

  const runBulk = async (ids, status) => {
    setBulkRunning(true);
    setConfirmState(null);
    let successCount = 0;
    for (const id of ids) {
      try {
        await reviewOne(id, status);
        successCount += 1;
      } catch {
        // Keep going — a single failure in a batch shouldn't stop the rest.
      }
    }
    setBulkRunning(false);
    setSelected([]);
    if (successCount > 0) {
      showToast(`${successCount} prescription${successCount === 1 ? '' : 's'} ${status.toLowerCase()}`, 'success');
    }
    if (successCount < ids.length) {
      showToast(`${ids.length - successCount} could not be updated`, 'error');
    }
  };

  return (
    <div className="admin-orders-page admin-theme">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Prescription Verification</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {pendingCount > 0 && (
            <span className="badge badge-status">
              {pendingCount} pending review
            </span>
          )}
          <select className="sort-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="bulk-action-bar">
          <span>{selected.length} selected</span>
          <div className="bulk-action-buttons">
            <button type="button" className="btn-secondary" disabled={bulkRunning} onClick={() => handleBulkAction('Approved')}>
              <Check size={14} strokeWidth={2} /> Approve selected
            </button>
            <button type="button" className="btn-secondary danger" disabled={bulkRunning} onClick={() => handleBulkAction('Rejected')}>
              <X size={14} strokeWidth={2} /> Reject selected
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="info-text center-text">Loading prescriptions…</p>
      ) : prescriptions.length === 0 ? (
        <p className="info-text center-text">No prescriptions found.</p>
      ) : (
        <div className="admin-orders-table">
          {pendingIds.length > 0 && (
            <label className="checkbox-filter">
              <input type="checkbox" checked={allPendingSelected} onChange={toggleSelectAll} />
              Select all pending
            </label>
          )}

          {prescriptions.map((p) => (
            <div className="admin-order-row" key={p._id}>
              {p.status === 'Pending' && (
                <input
                  type="checkbox"
                  className="row-select-checkbox"
                  checked={selected.includes(p._id)}
                  onChange={() => toggleSelected(p._id)}
                  aria-label={`Select prescription from ${p.user?.name || 'this user'}`}
                />
              )}

              <div className="admin-order-main">
                <p className="order-invoice"><FileText size={14} strokeWidth={2} /> {p.originalName}</p>
                <p className="muted-text">
                  {p.user?.name || 'Unknown user'} · {p.user?.email}
                </p>
                <p className="muted-text">
                  {formatDate(p.createdAt)}
                  {p.order && <> · Order {p.order.invoiceNumber} ({formatCurrency(p.order.totalAmount)})</>}
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

      <ConfirmModal
        open={!!confirmState}
        title={confirmState?.ids.length > 1 ? `Reject ${confirmState.ids.length} prescriptions?` : 'Reject this prescription?'}
        message="Any order already linked to a rejected prescription will be cancelled and its stock released."
        confirmLabel="Reject"
        onConfirm={() => runBulk(confirmState.ids, confirmState.status)}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
};

export default AdminPrescriptions;

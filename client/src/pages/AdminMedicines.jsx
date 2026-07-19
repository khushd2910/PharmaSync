import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Pencil, Plus, PackagePlus, Trash2, X } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import IconInput from '../components/IconInput';

const AdminMedicines = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const lowStock = searchParams.get('lowStock') === 'true';
  const expiringSoon = searchParams.get('expiringSoon') === 'true';

  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const { showToast } = useToast();

  const loadMedicines = (searchValue) => {
    setLoading(true);
    const params = { limit: 100 };
    if (searchValue) params.search = searchValue;
    if (lowStock) params.lowStock = 'true';
    if (expiringSoon) params.expiringSoon = 'true';

    api
      .get('/admin/medicines', { params })
      .then((res) => setMedicines(res.data.medicines))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load medicines', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Debounce search-as-you-type so every keystroke doesn't fire a request
    const timer = setTimeout(() => loadMedicines(search), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, lowStock, expiringSoon]);

  const stockLabel = (medicine) => {
    if (medicine.isDiscontinued) return { text: 'Discontinued', className: 'badge-outofstock' };
    if (medicine.stock <= 0) return { text: 'Out of stock', className: 'badge-outofstock' };
    if (medicine.stock <= 10) return { text: `Low · ${medicine.stock}`, className: 'badge-rx' };
    return { text: `${medicine.stock} in stock`, className: 'badge-success' };
  };

  const handleRestock = async (medicine) => {
    const input = window.prompt(`Add how many units to "${medicine.name}"? (current stock: ${medicine.stock})`, '20');
    if (input === null) return;
    const amount = Number(input);
    if (!Number.isInteger(amount) || amount <= 0) {
      showToast('Enter a whole number greater than 0', 'error');
      return;
    }

    setBusyId(medicine._id);
    try {
      const res = await api.patch(`/admin/medicines/${medicine._id}/restock`, { amount });
      setMedicines((prev) => prev.map((m) => (m._id === medicine._id ? res.data.medicine : m)));
      showToast(res.data.message, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not restock', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (medicine) => {
    if (!window.confirm(`Delete "${medicine.name}"? This removes it from inventory permanently.`)) return;

    setBusyId(medicine._id);
    try {
      await api.delete(`/admin/medicines/${medicine._id}`);
      setMedicines((prev) => prev.filter((m) => m._id !== medicine._id));
      showToast('Medicine removed from inventory', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not delete medicine', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const clearFilter = () => setSearchParams({});

  return (
    <div className="admin-orders-page admin-theme">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Medicines</h2>
        </div>
        <Link to="/admin/medicines/new" className="btn-primary">
          <Plus size={16} strokeWidth={2} /> Add Medicine
        </Link>
      </div>

      {(lowStock || expiringSoon) && (
        <div className="notice-banner admin-filter-banner">
          Showing only {lowStock ? 'low-stock' : 'expiring-soon'} medicines.
          <button className="icon-btn-danger" onClick={clearFilter} title="Clear filter">
            <X size={14} strokeWidth={2} /> Clear
          </button>
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <IconInput
          icon={Search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, manufacturer, or composition"
        />
      </div>

      {loading ? (
        <p className="info-text center-text">Loading medicines…</p>
      ) : medicines.length === 0 ? (
        <p className="info-text center-text">No medicines found.</p>
      ) : (
        <div className="admin-orders-table">
          {medicines.map((medicine) => {
            const stock = stockLabel(medicine);
            const busy = busyId === medicine._id;
            return (
              <div className="admin-order-row" key={medicine._id}>
                <div className="admin-order-main">
                  <p className="order-invoice">{medicine.name}</p>
                  <p className="muted-text">
                    {medicine.brand || medicine.manufacturer || 'No brand'}
                    {medicine.category ? ` · ${medicine.category}` : ''}
                  </p>
                  <p className="muted-text">₹{Number(medicine.price || 0).toFixed(2)}</p>
                </div>

                <span className={`badge ${stock.className}`}>{stock.text}</span>

                <div className="admin-medicine-actions">
                  <button
                    className="icon-btn-danger"
                    onClick={() => handleRestock(medicine)}
                    disabled={busy}
                    title="Refill stock"
                  >
                    <PackagePlus size={16} strokeWidth={2} />
                  </button>

                  <Link className="icon-btn-danger" to={`/admin/medicines/${medicine._id}/edit`} title="Edit medicine">
                    <Pencil size={16} strokeWidth={2} />
                  </Link>

                  <button
                    className="icon-btn-danger"
                    onClick={() => handleDelete(medicine)}
                    disabled={busy}
                    title="Delete medicine"
                  >
                    <Trash2 size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminMedicines;


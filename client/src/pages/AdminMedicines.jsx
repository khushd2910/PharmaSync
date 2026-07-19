import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Pencil, Plus } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import IconInput from '../components/IconInput';

const AdminMedicines = () => {
  const [medicines, setMedicines] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const loadMedicines = (searchValue) => {
    setLoading(true);
    api
      .get('/admin/medicines', { params: searchValue ? { search: searchValue, limit: 50 } : { limit: 50 } })
      .then((res) => setMedicines(res.data.medicines))
      .catch((err) => showToast(err.response?.data?.message || 'Could not load medicines', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Debounce search-as-you-type so every keystroke doesn't fire a request
    const timer = setTimeout(() => loadMedicines(search), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const stockLabel = (medicine) => {
    if (medicine.isDiscontinued) return { text: 'Discontinued', className: 'badge-outofstock' };
    if (medicine.stock <= 0) return { text: 'Out of stock', className: 'badge-outofstock' };
    if (medicine.stock <= 10) return { text: `Low · ${medicine.stock}`, className: 'badge-rx' };
    return { text: `${medicine.stock} in stock`, className: 'badge-success' };
  };

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

                <Link
                  className="icon-btn-danger"
                  to={`/admin/medicines/${medicine._id}/edit`}
                  title="Edit medicine"
                >
                  <Pencil size={16} strokeWidth={2} />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminMedicines;

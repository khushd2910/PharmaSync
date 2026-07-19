import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Pencil, ArrowLeft } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const EMPTY_FORM = {
  name: '',
  brand: '',
  category: '',
  price: '',
  stock: '',
  expiryDate: '',
  manufacturer: '',
  description: '',
  requiresPrescription: false,
  barcode: '',
};

const AdminEditMedicine = () => {
  const { id } = useParams();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get(`/medicines/${id}`)
      .then((res) => {
        const m = res.data.medicine;
        setForm({
          name: m.name || '',
          brand: m.brand || '',
          category: m.category || '',
          price: m.price ?? '',
          stock: m.stock ?? '',
          // Trim the ISO timestamp down to yyyy-mm-dd for the date input
          expiryDate: m.expiryDate ? m.expiryDate.slice(0, 10) : '',
          manufacturer: m.manufacturer || '',
          description: m.description || '',
          requiresPrescription: !!m.requiresPrescription,
          barcode: m.barcode || '',
        });
      })
      .catch((err) => {
        showToast(err.response?.data?.message || 'Could not load medicine', 'error');
        navigate('/admin/medicines');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/admin/medicines/${id}`, {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock),
      });
      showToast('Medicine updated — live on the storefront now', 'success');
      navigate('/admin/medicines');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update medicine', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-page admin-theme">
        <p className="info-text center-text">Loading medicine…</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page admin-theme">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Update Medicine</h2>
        </div>
        <Link to="/admin/medicines" className="btn-secondary admin">
          <ArrowLeft size={15} strokeWidth={2} /> Back to list
        </Link>
      </header>

      <section className="checkout-section">
        <h2 className="checkout-section-title">
          <Pencil size={16} strokeWidth={2} /> Admin edits
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div>
              <label className="field-label">Name</label>
              <input name="name" value={form.name} onChange={handleChange} required />
            </div>

            <div>
              <label className="field-label">Brand</label>
              <input name="brand" value={form.brand} onChange={handleChange} />
            </div>

            <div>
              <label className="field-label">Category</label>
              <input name="category" value={form.category} onChange={handleChange} />
            </div>

            <div>
              <label className="field-label">Price (₹)</label>
              <input type="number" name="price" value={form.price} onChange={handleChange} min="0" step="0.01" required />
            </div>

            <div>
              <label className="field-label">Quantity</label>
              <input type="number" name="stock" value={form.stock} onChange={handleChange} min="0" step="1" required />
            </div>

            <div>
              <label className="field-label">Expiry</label>
              <input type="date" name="expiryDate" value={form.expiryDate} onChange={handleChange} />
            </div>

            <div>
              <label className="field-label">Manufacturer</label>
              <input name="manufacturer" value={form.manufacturer} onChange={handleChange} />
            </div>

            <div>
              <label className="field-label">Barcode</label>
              <input name="barcode" value={form.barcode} onChange={handleChange} placeholder="Scan or type — used by POS lookup" />
            </div>
          </div>

          <label className="field-label">Description</label>
          <textarea name="description" value={form.description} onChange={handleChange} rows={4} />

          <label className="checkbox-filter form-checkbox">
            <input
              type="checkbox"
              name="requiresPrescription"
              checked={form.requiresPrescription}
              onChange={handleChange}
            />
            Prescription Required
          </label>

          <p className="info-text muted-text form-note">
            Automatically updates everywhere this medicine appears — Online Store and Offline Store both read the
            same catalog record, so there's nothing extra to sync.
          </p>

          <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: 18 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </section>
    </div>
  );
};

export default AdminEditMedicine;

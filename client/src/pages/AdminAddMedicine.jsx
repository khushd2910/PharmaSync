import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackagePlus } from 'lucide-react';
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
};

const AdminAddMedicine = () => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      Object.entries({ ...form, price: Number(form.price), stock: Number(form.stock) }).forEach(([key, value]) => {
        if (value !== null && value !== undefined) formData.append(key, value);
      });
      if (imageFile) formData.append('image', imageFile);
      await api.post('/admin/medicines', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast('Medicine added successfully', 'success');
      navigate('/admin/medicines');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not add medicine', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dashboard-page admin-theme">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Add Medicine</h2>
        </div>
      </header>

      <section className="checkout-section">
        <h2 className="checkout-section-title">
          <PackagePlus size={16} strokeWidth={2} /> Medicine details
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div>
              <label className="field-label">Name</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Paracetamol 500mg" required />
            </div>

            <div>
              <label className="field-label">Brand</label>
              <input name="brand" value={form.brand} onChange={handleChange} placeholder="e.g. Crocin" />
            </div>

            <div>
              <label className="field-label">Category</label>
              <input name="category" value={form.category} onChange={handleChange} placeholder="e.g. Pain Relief" />
            </div>

            <div>
              <label className="field-label">Price (₹)</label>
              <input type="number" name="price" value={form.price} onChange={handleChange} min="0" step="0.01" placeholder="0.00" required />
            </div>

            <div>
              <label className="field-label">Quantity</label>
              <input type="number" name="stock" value={form.stock} onChange={handleChange} min="0" step="1" placeholder="0" required />
            </div>

            <div>
              <label className="field-label">Expiry</label>
              <input type="date" name="expiryDate" value={form.expiryDate} onChange={handleChange} />
            </div>

            <div>
              <label className="field-label">Manufacturer</label>
              <input name="manufacturer" value={form.manufacturer} onChange={handleChange} placeholder="e.g. GSK" />
            </div>
          </div>

          <div>
            <label className="field-label">Primary image</label>
            <input type="file" accept="image/*" onChange={handleImageChange} />
            {imagePreview && <img src={imagePreview} alt="Preview" style={{ width: 140, height: 140, objectFit: 'cover', marginTop: 10, borderRadius: 8 }} />}
          </div>

          <label className="field-label">Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Short description shown on the medicine's detail page"
            rows={4}
          />

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
            Saved medicines are available across both the online storefront and (once POS billing ships) in-store —
            there's a single shared catalog.
          </p>

          <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: 18 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </section>
    </div>
  );
};

export default AdminAddMedicine;

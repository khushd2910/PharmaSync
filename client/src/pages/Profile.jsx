import { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Phone, MapPin, ClipboardList } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import IconInput from '../components/IconInput';

const Profile = () => {
  const { user, login } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.patch('/user/profile', form);
      login(res.data.user);
      showToast('Profile updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <h1 className="page-title">Your Profile</h1>

      <div className="profile-grid">
        <section className="checkout-section">
          <h2 className="checkout-section-title">Edit details</h2>
          <form onSubmit={handleSubmit}>
            <label className="field-label">Name</label>
            <IconInput icon={User} name="name" value={form.name} onChange={handleChange} required />

            <label className="field-label">Phone</label>
            <IconInput icon={Phone} name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />

            <label className="field-label">Address</label>
            <IconInput icon={MapPin} name="address" value={form.address} onChange={handleChange} placeholder="Your address" />

            <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: 18 }}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </section>

        <section className="checkout-section">
          <h2 className="checkout-section-title">Account</h2>
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Verified:</strong> {user?.isVerified ? 'Yes' : 'Not yet verified'}</p>
          <Link to="/orders" className="btn-secondary profile-orders-link">
            <ClipboardList size={15} strokeWidth={2} /> View order history
          </Link>
        </section>
      </div>
    </div>
  );
};

export default Profile;

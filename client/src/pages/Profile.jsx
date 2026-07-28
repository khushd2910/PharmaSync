import { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Phone, MapPin, ClipboardList, Lock, Sun, Moon } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import IconInput from '../components/IconInput';

const emptyAddress = { line1: '', city: '', state: '', pincode: '' };

const Profile = () => {
  const { user, login } = useAuth();
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: { ...emptyAddress, ...(user?.address || {}) },
  });
  const [saving, setSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPw, setChangingPw] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handleAddressChange = (e) =>
    setForm({ ...form, address: { ...form.address, [e.target.name]: e.target.value } });

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

  const handlePwChange = (e) => setPwForm({ ...pwForm, [e.target.name]: e.target.value });

  const handlePwSubmit = async (e) => {
    e.preventDefault();

    if (!pwForm.oldPassword || !pwForm.newPassword || !pwForm.confirmPassword) {
      showToast('Please fill in all password fields', 'error');
      return;
    }
    if (pwForm.newPassword.length < 8) {
      showToast('New password must be at least 8 characters', 'error');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      showToast('New password and confirm password do not match', 'error');
      return;
    }

    setChangingPw(true);
    try {
      await api.patch('/user/change-password', pwForm);
      showToast('Password changed successfully', 'success');
      setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not change password', 'error');
    } finally {
      setChangingPw(false);
    }
  };

  return (
    <div className="profile-page">
      <h1 className="page-title">Your Profile</h1>

      <div className="profile-grid">
        <div>
          <section className="checkout-section">
            <h2 className="checkout-section-title">Edit details</h2>
            <form onSubmit={handleSubmit}>
              <label className="field-label">Name</label>
              <IconInput icon={User} name="name" value={form.name} onChange={handleChange} required />

              <label className="field-label">Phone</label>
              <IconInput icon={Phone} name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />

              <label className="field-label"><MapPin size={13} strokeWidth={2} /> Address line</label>
              <input
                name="line1"
                value={form.address.line1}
                onChange={handleAddressChange}
                placeholder="House no, street, area"
              />
              <label className="field-label">City</label>
              <input name="city" value={form.address.city} onChange={handleAddressChange} placeholder="City" />
              <label className="field-label">State</label>
              <input name="state" value={form.address.state} onChange={handleAddressChange} placeholder="State" />
              <label className="field-label">Pincode</label>
              <input name="pincode" value={form.address.pincode} onChange={handleAddressChange} placeholder="Pincode" />
              <p className="muted-text" style={{ marginTop: 4 }}>
                Saved here will be used to auto-fill your delivery address at checkout.
              </p>

              <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: 18 }}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </section>

          <section className="checkout-section">
            <h2 className="checkout-section-title"><Lock size={16} strokeWidth={2} /> Change password</h2>
            <form onSubmit={handlePwSubmit}>
              <label className="field-label">Current password</label>
              <IconInput
                icon={Lock}
                type="password"
                name="oldPassword"
                value={pwForm.oldPassword}
                onChange={handlePwChange}
                autoComplete="current-password"
                required
              />

              <label className="field-label">New password</label>
              <IconInput
                icon={Lock}
                type="password"
                name="newPassword"
                value={pwForm.newPassword}
                onChange={handlePwChange}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                required
              />

              <label className="field-label">Confirm new password</label>
              <IconInput
                icon={Lock}
                type="password"
                name="confirmPassword"
                value={pwForm.confirmPassword}
                onChange={handlePwChange}
                autoComplete="new-password"
                required
              />

              <button type="submit" className="btn-primary" disabled={changingPw} style={{ marginTop: 18 }}>
                {changingPw ? 'Updating…' : 'Change password'}
              </button>
            </form>
          </section>
        </div>

        <div>
          <section className="checkout-section">
            <h2 className="checkout-section-title">Account</h2>
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Verified:</strong> {user?.isVerified ? 'Yes' : 'Not yet verified'}</p>
            <Link to="/orders" className="btn-secondary profile-orders-link">
              <ClipboardList size={15} strokeWidth={2} /> View order history
            </Link>
          </section>

          <section className="checkout-section">
            <h2 className="checkout-section-title">Appearance</h2>
            <p className="muted-text" style={{ marginTop: 0 }}>Choose how PharmaSync looks on this device.</p>
            <div className="appearance-toggle">
              <button
                type="button"
                className={`appearance-option ${theme === 'light' ? 'active' : ''}`}
                onClick={() => theme !== 'light' && toggleTheme()}
              >
                <Sun size={16} strokeWidth={2} /> Light
              </button>
              <button
                type="button"
                className={`appearance-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => theme !== 'dark' && toggleTheme()}
              >
                <Moon size={16} strokeWidth={2} /> Dark
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Profile;

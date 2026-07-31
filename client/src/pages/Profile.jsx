import { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Phone, MapPin, ClipboardList, Lock, Sun, Moon, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import IconInput from '../components/IconInput';

const emptyAddress = { label: 'Home', line1: '', city: '', state: '', pincode: '' };

const Profile = () => {
  const { user, login } = useAuth();
  const { cart } = useCart();
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });
  const [saving, setSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPw, setChangingPw] = useState(false);

  // ---------------- Saved addresses ----------------
  const addresses = user?.addresses || [];
  const [addingAddress, setAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState(emptyAddress);
  const [savingAddress, setSavingAddress] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editAddress, setEditAddress] = useState(emptyAddress);
  const [addressBusyId, setAddressBusyId] = useState(null);

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

  const handleAddAddress = async (e) => {
    e.preventDefault();
    if (!newAddress.line1.trim() || !newAddress.city.trim()) {
      showToast('Please enter at least an address line and city', 'error');
      return;
    }
    setSavingAddress(true);
    try {
      const res = await api.post('/user/addresses', newAddress);
      login(res.data.user);
      showToast('Address added', 'success');
      setNewAddress(emptyAddress);
      setAddingAddress(false);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not add address', 'error');
    } finally {
      setSavingAddress(false);
    }
  };

  const startEditingAddress = (address) => {
    setEditingId(address._id);
    setEditAddress({
      label: address.label || 'Home',
      line1: address.line1 || '',
      city: address.city || '',
      state: address.state || '',
      pincode: address.pincode || '',
    });
  };

  const handleSaveEditAddress = async (addressId) => {
    if (!editAddress.line1.trim() || !editAddress.city.trim()) {
      showToast('Please enter at least an address line and city', 'error');
      return;
    }
    setAddressBusyId(addressId);
    try {
      const res = await api.patch(`/user/addresses/${addressId}`, editAddress);
      login(res.data.user);
      showToast('Address updated', 'success');
      setEditingId(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update address', 'error');
    } finally {
      setAddressBusyId(null);
    }
  };

  const handleDeleteAddress = async (addressId) => {
    setAddressBusyId(addressId);
    try {
      const res = await api.delete(`/user/addresses/${addressId}`);
      login(res.data.user);
      showToast('Address removed', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not remove address', 'error');
    } finally {
      setAddressBusyId(null);
    }
  };

  const handleSetDefaultAddress = async (addressId) => {
    setAddressBusyId(addressId);
    try {
      const res = await api.patch(`/user/addresses/${addressId}/default`);
      login(res.data.user);
      showToast('Default address updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not update default address', 'error');
    } finally {
      setAddressBusyId(null);
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

      <section className="checkout-section profile-summary-card">
        <h2 className="checkout-section-title">Welcome back, {user?.name || 'PharmaSync user'}</h2>
        <p className="muted-text">Your personal care center for orders, prescriptions and pharmacy support.</p>
        <div className="profile-summary-grid">
          <div className="profile-summary-card-block">
            <strong>Quick actions</strong>
            <p>Update your address, review recent orders, or head to support with one tap.</p>
            <Link to="/orders" className="link-btn">View orders</Link>
          </div>
          <div className="profile-summary-card-block">
            <strong>Saved items</strong>
            <p>{cart.savedItems?.length || 0} item{(cart.savedItems?.length || 0) !== 1 ? 's' : ''} saved for later.</p>
            <Link to="/saved-items" className="link-btn">View saved items</Link>
          </div>
          <div className="profile-summary-card-block">
            <strong>Health reminders</strong>
            <p>Save your delivery preferences and keep a record of prescription notes for faster refills.</p>
          </div>
          <div className="profile-summary-card-block">
            <strong>Support hub</strong>
            <p>Need help with a delivery, refund or prescription? Our Help Center has guided support.</p>
            <Link to="/support" className="link-btn">Open help</Link>
          </div>
        </div>
      </section>

      <div className="profile-grid">
        <div>
          <section className="checkout-section">
            <h2 className="checkout-section-title">Edit details</h2>
            <form onSubmit={handleSubmit}>
              <label className="field-label">Name</label>
              <IconInput icon={User} name="name" value={form.name} onChange={handleChange} required />

              <label className="field-label">Phone</label>
              <IconInput icon={Phone} name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />

              <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: 18 }}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </section>

          <section className="checkout-section">
            <h2 className="checkout-section-title"><MapPin size={16} strokeWidth={2} /> Saved addresses</h2>
            <p className="muted-text" style={{ marginTop: 0 }}>
              Keep a few addresses (Home, Work…) handy — the one marked default auto-fills at checkout.
            </p>

            {addresses.length === 0 && !addingAddress && (
              <p className="info-text" style={{ margin: '10px 0' }}>You haven't saved an address yet.</p>
            )}

            <div className="address-list">
              {addresses.map((address) => (
                <div className="address-card" key={address._id}>
                  {editingId === address._id ? (
                    <div className="address-edit-form">
                      <input
                        value={editAddress.label}
                        onChange={(e) => setEditAddress({ ...editAddress, label: e.target.value })}
                        placeholder="Label (e.g. Home, Work)"
                      />
                      <input
                        value={editAddress.line1}
                        onChange={(e) => setEditAddress({ ...editAddress, line1: e.target.value })}
                        placeholder="House no, street, area"
                      />
                      <input
                        value={editAddress.city}
                        onChange={(e) => setEditAddress({ ...editAddress, city: e.target.value })}
                        placeholder="City"
                      />
                      <input
                        value={editAddress.state}
                        onChange={(e) => setEditAddress({ ...editAddress, state: e.target.value })}
                        placeholder="State"
                      />
                      <input
                        value={editAddress.pincode}
                        onChange={(e) => setEditAddress({ ...editAddress, pincode: e.target.value })}
                        placeholder="Pincode"
                      />
                      <div className="address-card-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={addressBusyId === address._id}
                          onClick={() => handleSaveEditAddress(address._id)}
                        >
                          <Check size={14} strokeWidth={2} /> Save
                        </button>
                        <button type="button" className="btn-secondary ghost" onClick={() => setEditingId(null)}>
                          <X size={14} strokeWidth={2} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="address-card-header">
                        <strong>{address.label || 'Address'}</strong>
                        {address.isDefault && <span className="badge badge-success">Default</span>}
                      </div>
                      <p className="muted-text" style={{ margin: '4px 0 10px' }}>
                        {address.line1}
                        {address.line1 ? <br /> : null}
                        {[address.city, address.state, address.pincode].filter(Boolean).join(', ')}
                      </p>
                      <div className="address-card-actions">
                        {!address.isDefault && (
                          <button
                            type="button"
                            className="link-btn"
                            disabled={addressBusyId === address._id}
                            onClick={() => handleSetDefaultAddress(address._id)}
                          >
                            Set as default
                          </button>
                        )}
                        <button type="button" className="btn-secondary" onClick={() => startEditingAddress(address)}>
                          <Pencil size={13} strokeWidth={2} /> Edit
                        </button>
                        <button
                          type="button"
                          className="btn-secondary danger"
                          disabled={addressBusyId === address._id}
                          onClick={() => handleDeleteAddress(address._id)}
                        >
                          <Trash2 size={13} strokeWidth={2} /> Remove
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {addingAddress ? (
              <form onSubmit={handleAddAddress} className="address-edit-form" style={{ marginTop: addresses.length > 0 ? 14 : 0 }}>
                <input
                  value={newAddress.label}
                  onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                  placeholder="Label (e.g. Home, Work)"
                />
                <input
                  value={newAddress.line1}
                  onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
                  placeholder="House no, street, area"
                />
                <input
                  value={newAddress.city}
                  onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                  placeholder="City"
                />
                <input
                  value={newAddress.state}
                  onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                  placeholder="State"
                />
                <input
                  value={newAddress.pincode}
                  onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                  placeholder="Pincode"
                />
                <div className="address-card-actions">
                  <button type="submit" className="btn-primary" disabled={savingAddress}>
                    {savingAddress ? 'Saving…' : 'Save address'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary ghost"
                    onClick={() => {
                      setAddingAddress(false);
                      setNewAddress(emptyAddress);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="btn-secondary"
                style={{ marginTop: addresses.length > 0 ? 14 : 10 }}
                onClick={() => setAddingAddress(true)}
              >
                <Plus size={14} strokeWidth={2} /> Add a new address
              </button>
            )}
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

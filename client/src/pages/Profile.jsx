import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User, Phone, MapPin, ClipboardList, Lock, Sun, Moon, Plus, Pencil, Trash2, Check, X,
  LocateFixed, Download, ShieldAlert, UserX, FileText, Receipt, LogOut, ShieldCheck,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import IconInput from '../components/IconInput';
import Avatar from '../components/Avatar';
import ConfirmModal from '../components/ConfirmModal';
import { SkeletonBlock } from '../components/Skeleton';

const emptyAddress = { label: 'Home', line1: '', city: '', state: '', pincode: '' };

// Indian PIN codes are 6 digits and never start with 0.
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

const formatDateTime = (value) => {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

// Small heuristic strength score (0-4) — length plus how many character
// classes are mixed in. Good enough to nudge people away from weak
// passwords without pulling in a whole zxcvbn-style dependency.
const PASSWORD_STRENGTH_LEVELS = [
  { label: 'Very weak', className: 'weak' },
  { label: 'Weak', className: 'weak' },
  { label: 'Fair', className: 'fair' },
  { label: 'Good', className: 'good' },
  { label: 'Strong', className: 'strong' },
];

const scorePasswordStrength = (password) => {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const level = Math.min(score, 4);
  return { score: level, ...PASSWORD_STRENGTH_LEVELS[level] };
};

const Profile = () => {
  const { user, login, logout } = useAuth();
  const { cart } = useCart();
  const { medicines: wishlistMedicines } = useWishlist() || {};
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

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
  // 'new' while locating for the add-address form, or an address _id while
  // locating for that address's edit form — only one lookup runs at a time.
  const [locatingFor, setLocatingFor] = useState(null);

  // ---------------- Danger zone: export / delete account ----------------
  const [exporting, setExporting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // ---------------- Summary stats (orders, spend, prescriptions) ----------------
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api
      .get('/user/stats')
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, []);

  // ---------------- Security: last login / log out of all devices ----------------
  const [confirmingLogoutAll, setConfirmingLogoutAll] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const passwordStrength = useMemo(() => scorePasswordStrength(pwForm.newPassword), [pwForm.newPassword]);

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
    if (newAddress.pincode.trim() && !PINCODE_REGEX.test(newAddress.pincode.trim())) {
      showToast('Enter a valid 6-digit pincode', 'error');
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
    if (editAddress.pincode.trim() && !PINCODE_REGEX.test(editAddress.pincode.trim())) {
      showToast('Enter a valid 6-digit pincode', 'error');
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

  // Reuses the OpenStreetMap (Nominatim) reverse-geocoding that already
  // backs the map embed on Checkout — here it autofills the address form
  // fields instead of just dropping a pin, so saving an address doesn't
  // require typing it all out by hand.
  const handleUseCurrentLocation = (formId, setter) => {
    if (!navigator.geolocation) {
      showToast('Location access is not supported in this browser', 'error');
      return;
    }
    setLocatingFor(formId);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=18`,
            { headers: { Accept: 'application/json' }, signal: controller.signal }
          );
          if (!res.ok) throw new Error('reverse geocode request failed');
          const data = await res.json();
          const addr = data.address || {};

          const houseNumber = addr.house_number ? `${addr.house_number}, ` : '';
          const street = addr.road || addr.pedestrian || addr.footway || addr.neighbourhood || addr.suburb || '';
          const line1 = `${houseNumber}${street}`.trim() || (data.display_name || '').split(',')[0] || '';
          const pincode = (addr.postcode || '').replace(/\D/g, '').slice(0, 6);

          setter((prev) => ({
            ...prev,
            line1: line1 || prev.line1,
            city: addr.city || addr.town || addr.village || addr.county || prev.city,
            state: addr.state || prev.state,
            pincode: pincode.length === 6 ? pincode : prev.pincode,
          }));
          showToast('Address auto-filled from your location', 'success');
        } catch (err) {
          const message = err.name === 'AbortError'
            ? 'Location lookup timed out — please enter the address manually'
            : 'Could not fetch address for your location';
          showToast(message, 'error');
        } finally {
          clearTimeout(timeoutId);
          setLocatingFor(null);
        }
      },
      () => {
        showToast('Could not access your location. Please allow location permission.', 'error');
        setLocatingFor(null);
      }
    );
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

  // ---------------- Danger zone: export / delete account ----------------
  const handleExportData = async () => {
    setExporting(true);
    try {
      const res = await api.get('/user/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `pharmasync-data-${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('Your data export has started downloading', 'success');
    } catch (err) {
      showToast('Could not export your data', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleRequestDeleteAccount = () => {
    if (!deletePassword) {
      showToast('Enter your password to confirm account deletion', 'error');
      return;
    }
    setConfirmingDelete(true);
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await api.delete('/user/account', { data: { password: deletePassword } });
      showToast('Your account has been deleted', 'success');
      await logout();
      navigate('/');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not delete account', 'error');
    } finally {
      setDeletingAccount(false);
      setConfirmingDelete(false);
      setDeletePassword('');
    }
  };

  const handleLogoutAllDevices = async () => {
    setLoggingOutAll(true);
    try {
      await api.post('/user/logout-all-devices');
      showToast('Logged out of all devices', 'success');
      await logout();
      navigate('/login');
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not log out of all devices', 'error');
    } finally {
      setLoggingOutAll(false);
      setConfirmingLogoutAll(false);
    }
  };

  return (
    <div className="profile-page">
      <h1 className="page-title">Your Profile</h1>

      <section className="checkout-section profile-summary-card">
        <div className="profile-summary-header">
          <Avatar name={user?.name} size={56} />
          <div>
            <h2 className="checkout-section-title">Welcome back, {user?.name || 'PharmaSync user'}</h2>
            <p className="muted-text">Your personal care center for orders, prescriptions and pharmacy support.</p>
          </div>
        </div>
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
            <strong>Wishlist</strong>
            <p>{wishlistMedicines?.length || 0} medicine{(wishlistMedicines?.length || 0) !== 1 ? 's' : ''} on your wishlist.</p>
            <Link to="/wishlist" className="link-btn">View wishlist</Link>
          </div>
          <div className="profile-summary-card-block">
            <strong><FileText size={14} strokeWidth={2} style={{ verticalAlign: -2, marginRight: 4 }} />My Prescriptions</strong>
            {stats ? (
              <p>
                {stats.prescriptionCount} uploaded
                {stats.pendingPrescriptionCount > 0 ? ` · ${stats.pendingPrescriptionCount} awaiting review` : ''}.
              </p>
            ) : (
              <SkeletonBlock height={14} width="80%" style={{ margin: '8px 0' }} />
            )}
            <Link to="/prescriptions" className="link-btn">View prescriptions</Link>
          </div>
          <div className="profile-summary-card-block">
            <strong><Receipt size={14} strokeWidth={2} style={{ verticalAlign: -2, marginRight: 4 }} />Lifetime stats</strong>
            {stats ? (
              <p>
                {stats.orderCount} order{stats.orderCount === 1 ? '' : 's'} placed · ₹{stats.totalSpent.toLocaleString('en-IN')} spent lifetime.
              </p>
            ) : (
              <SkeletonBlock height={14} width="80%" style={{ margin: '8px 0' }} />
            )}
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
                        onChange={(e) => setEditAddress({ ...editAddress, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        placeholder="Pincode (6 digits)"
                        maxLength={6}
                        inputMode="numeric"
                      />
                      <button
                        type="button"
                        className="btn-secondary ghost use-location-btn"
                        disabled={locatingFor === address._id}
                        onClick={() => handleUseCurrentLocation(address._id, setEditAddress)}
                      >
                        <LocateFixed size={14} strokeWidth={2} />
                        {locatingFor === address._id ? 'Locating…' : 'Use current location'}
                      </button>
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
                  onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  placeholder="Pincode (6 digits)"
                  maxLength={6}
                  inputMode="numeric"
                />
                <button
                  type="button"
                  className="btn-secondary ghost use-location-btn"
                  disabled={locatingFor === 'new'}
                  onClick={() => handleUseCurrentLocation('new', setNewAddress)}
                >
                  <LocateFixed size={14} strokeWidth={2} />
                  {locatingFor === 'new' ? 'Locating…' : 'Use current location'}
                </button>
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
              {passwordStrength && (
                <div className="password-strength">
                  <div className="password-strength-bar">
                    {[0, 1, 2, 3].map((i) => (
                      <span
                        key={i}
                        className={i <= passwordStrength.score - 1 ? `filled ${passwordStrength.className}` : ''}
                      />
                    ))}
                  </div>
                  <span className={`password-strength-label ${passwordStrength.className}`}>
                    {passwordStrength.label}
                  </span>
                </div>
              )}

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
            <h2 className="checkout-section-title"><ShieldCheck size={16} strokeWidth={2} /> Security</h2>
            <p className="muted-text" style={{ marginTop: 0 }}>
              {user?.previousLoginAt
                ? `Last login: ${formatDateTime(user.previousLoginAt)}`
                : 'This is your first recorded login.'}
            </p>
            <p className="muted-text" style={{ marginBottom: 14 }}>
              Two-factor authentication isn't available yet — in the meantime, you can end every other
              signed-in session below.
            </p>
            <button
              type="button"
              className="btn-secondary"
              disabled={loggingOutAll}
              onClick={() => setConfirmingLogoutAll(true)}
            >
              <LogOut size={14} strokeWidth={2} /> {loggingOutAll ? 'Logging out…' : 'Log out of all devices'}
            </button>
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

          <section className="checkout-section danger-zone">
            <h2 className="checkout-section-title"><ShieldAlert size={16} strokeWidth={2} /> Danger zone</h2>

            <div className="danger-zone-row">
              <div>
                <strong>Export your data</strong>
                <p className="muted-text" style={{ margin: '4px 0 0' }}>
                  Download a copy of your profile, addresses, orders and prescriptions as a JSON file.
                </p>
              </div>
              <button type="button" className="btn-secondary" disabled={exporting} onClick={handleExportData}>
                <Download size={14} strokeWidth={2} /> {exporting ? 'Preparing…' : 'Export data'}
              </button>
            </div>

            <div className="danger-zone-row danger-zone-row-delete">
              <div>
                <strong>Delete account</strong>
                <p className="muted-text" style={{ margin: '4px 0 8px' }}>
                  Permanently removes your profile, saved addresses and wishlist. Order history is kept for
                  billing records. This cannot be undone.
                </p>
                <IconInput
                  icon={Lock}
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your password to confirm"
                  autoComplete="current-password"
                />
              </div>
              <button type="button" className="btn-secondary danger" onClick={handleRequestDeleteAccount}>
                <UserX size={14} strokeWidth={2} /> Delete account
              </button>
            </div>
          </section>
        </div>
      </div>

      <ConfirmModal
        open={confirmingDelete}
        title="Delete your account?"
        message="This permanently deletes your profile, saved addresses and wishlist. Your order history is kept for billing records. This cannot be undone."
        confirmLabel={deletingAccount ? 'Deleting…' : 'Delete account'}
        danger
        onConfirm={handleDeleteAccount}
        onCancel={() => setConfirmingDelete(false)}
      />

      <ConfirmModal
        open={confirmingLogoutAll}
        title="Log out of all devices?"
        message="You'll be signed out here and on any other device using this account. You'll need to log in again."
        confirmLabel={loggingOutAll ? 'Logging out…' : 'Log out everywhere'}
        danger={false}
        onConfirm={handleLogoutAllDevices}
        onCancel={() => setConfirmingLogoutAll(false)}
      />
    </div>
  );
};

export default Profile;

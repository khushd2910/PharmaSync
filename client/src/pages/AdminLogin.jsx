import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AuthCard from '../components/AuthCard';
import PasswordInput from '../components/PasswordInput';

const AdminLogin = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/admin/login', form);
      login(res.data.user);
      showToast('Welcome back, admin', 'success');
      navigate('/admin/dashboard');
    } catch (err) {
      const message = err.response?.data?.message || 'Admin login failed';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard admin eyebrow="Pharmacy Staff" title="Admin login" subtitle="Manage inventory, orders, and billing.">
      <form onSubmit={handleSubmit} noValidate>
        {error && <p className="error-text">{error}</p>}
        <label className="field-label" htmlFor="email">Admin email</label>
        <input id="email" name="email" type="email" placeholder="admin@pharma.com" value={form.email} onChange={handleChange} required autoComplete="email" />

        <label className="field-label" htmlFor="password">Password</label>
        <PasswordInput
          name="password"
          placeholder="Your password"
          value={form.password}
          onChange={handleChange}
          required
          autoComplete="current-password"
        />

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Logging in…' : 'Login as admin'}
        </button>
        <p className="auth-footnote">
          <Link to="/login" className="link-muted">← Back to patient login</Link>
        </p>
      </form>
    </AuthCard>
  );
};

export default AdminLogin;

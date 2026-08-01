import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AuthCard from '../components/AuthCard';
import PasswordInput from '../components/PasswordInput';
import IconInput from '../components/IconInput';

const AdminLogin = () => {
  const [form, setForm] = useState({ email: '', password: '', mfaCode: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requiresMfa, setRequiresMfa] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const csrfRes = await api.get('/auth/admin/csrf-token');
      const res = await api.post('/auth/admin/login', {
        ...form,
        csrfToken: csrfRes.data?.csrfToken,
      });

      if (res.data?.requiresMfa) {
        setRequiresMfa(true);
        const recipient = res.data?.recipient || 'the configured admin inbox';
        showToast(`A one-time verification code was sent to ${recipient}. Enter it to continue.`, 'info');
        setLoading(false);
        return;
      }

      login(res.data.user);
      showToast('Welcome back, admin', 'success');
      navigate('/');
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
        <IconInput icon={Mail} id="email" name="email" type="email" placeholder="admin@pharma.com" value={form.email} onChange={handleChange} required autoComplete="email" />

        <label className="field-label" htmlFor="password">Password</label>
        <PasswordInput
          name="password"
          placeholder="Your password"
          value={form.password}
          onChange={handleChange}
          required
          autoComplete="current-password"
        />

        {requiresMfa && (
          <>
            <label className="field-label" htmlFor="mfaCode">Admin MFA code</label>
            <IconInput icon={Mail} id="mfaCode" name="mfaCode" type="text" placeholder="123456" value={form.mfaCode} onChange={handleChange} required autoComplete="one-time-code" />
          </>
        )}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Logging in…' : requiresMfa ? 'Verify MFA' : 'Login as admin'}
        </button>
        <p className="auth-footnote">
          <Link to="/login" className="link-muted">← Back to patient login</Link>
        </p>
      </form>
    </AuthCard>
  );
};

export default AdminLogin;

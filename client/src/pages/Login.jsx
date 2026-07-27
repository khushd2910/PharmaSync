import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AuthCard from '../components/AuthCard';
import PasswordInput from '../components/PasswordInput';
import IconInput from '../components/IconInput';

const Login = () => {
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
      const res = await api.post('/auth/login', form);
      login(res.data.user);
      showToast('Welcome back!', 'success');
      navigate('/dashboard');
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard eyebrow="Patient Login" title="Welcome back" subtitle="Sign in to manage your orders and prescriptions.">
      <form onSubmit={handleSubmit} noValidate>
        {error && <p className="error-text">{error}</p>}
        <label className="field-label" htmlFor="email">Email</label>
        <IconInput icon={Mail} id="email" name="email" type="email" placeholder="jane@example.com" value={form.email} onChange={handleChange} required autoComplete="email" />

        <label className="field-label" htmlFor="password">Password</label>
        <PasswordInput
          name="password"
          placeholder="Your password"
          value={form.password}
          onChange={handleChange}
          required
          autoComplete="current-password"
        />
        <div className="field-actions">
          <Link to="/forgot-password" className="link-muted">Forgot password?</Link>
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Logging in…' : 'Login'}
        </button>
        <p className="auth-footnote">
          New here? <Link to="/register">Create an account</Link>
        </p>
        <p className="auth-footnote muted">
          <Link to="/admin/login" className="link-muted">Admin login →</Link>
        </p>
      </form>
    </AuthCard>
  );
};

export default Login;

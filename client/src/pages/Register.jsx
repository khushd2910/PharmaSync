import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Phone } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import AuthCard from '../components/AuthCard';
import PasswordInput from '../components/PasswordInput';
import IconInput from '../components/IconInput';

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
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
      const res = await api.post('/auth/register', form);
      login(res.data.user);
      showToast(res.data.message || 'Account created', 'success');
      navigate('/dashboard');
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed';
      setError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard eyebrow="New Patient Intake" title="Create an account" subtitle="A few details and you're in.">
      <form onSubmit={handleSubmit} noValidate>
        {error && <p className="error-text">{error}</p>}
        <label className="field-label" htmlFor="name">Full name</label>
        <IconInput icon={User} id="name" name="name" placeholder="Jane Doe" value={form.name} onChange={handleChange} required />

        <label className="field-label" htmlFor="email">Email</label>
        <IconInput icon={Mail} id="email" name="email" type="email" placeholder="jane@example.com" value={form.email} onChange={handleChange} required autoComplete="email" />

        <label className="field-label" htmlFor="phone">Phone <span className="optional-tag">optional</span></label>
        <IconInput icon={Phone} id="phone" name="phone" placeholder="+91 98765 43210" value={form.phone} onChange={handleChange} />

        <label className="field-label" htmlFor="password">Password</label>
        <PasswordInput
          name="password"
          placeholder="At least 8 characters, with a letter and a number"
          value={form.password}
          onChange={handleChange}
          minLength={8}
          required
          autoComplete="new-password"
        />

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Creating account…' : 'Register'}
        </button>
        <p className="auth-footnote">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </AuthCard>
  );
};

export default Register;

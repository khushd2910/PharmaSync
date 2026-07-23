import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import AuthCard from '../components/AuthCard';
import PasswordInput from '../components/PasswordInput';

const ResetPassword = () => {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post(`/auth/reset-password/${token}`, { password });
      showToast(res.data.message || 'Password reset successful', 'success');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Reset link is invalid or has expired');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard eyebrow="Account Recovery" title="Set a new password" subtitle="Make it something you'll remember.">
      <form onSubmit={handleSubmit} noValidate>
        {error && <p className="error-text">{error}</p>}
        <label className="field-label" htmlFor="password">New password</label>
        <PasswordInput
          name="password"
          placeholder="At least 8 characters, with a letter and a number"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
          autoComplete="new-password"
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Resetting…' : 'Reset password'}
        </button>
        <p className="auth-footnote">
          <Link to="/login" className="link-muted">← Back to login</Link>
        </p>
      </form>
    </AuthCard>
  );
};

export default ResetPassword;

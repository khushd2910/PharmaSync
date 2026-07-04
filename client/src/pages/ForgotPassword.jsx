import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import AuthCard from '../components/AuthCard';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      showToast(err.response?.data?.message || 'Something went wrong', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard eyebrow="Account Recovery" title="Reset your password" subtitle="We'll email you a link to reset it.">
      {sent ? (
        <div className="notice-box">
          <p>If an account with that email exists, a reset link is on its way.</p>
          <p className="auth-footnote"><Link to="/login">← Back to login</Link></p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <label className="field-label" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="jane@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
          <p className="auth-footnote">
            <Link to="/login" className="link-muted">← Back to login</Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
};

export default ForgotPassword;

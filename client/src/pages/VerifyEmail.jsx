import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios';
import AuthCard from '../components/AuthCard';

const VerifyEmail = () => {
  const { token } = useParams();
  const [status, setStatus] = useState('checking'); // checking | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    api
      .get(`/auth/verify-email/${token}`)
      .then((res) => {
        setStatus('success');
        setMessage(res.data.message);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Verification link is invalid or has expired');
      });
  }, [token]);

  return (
    <AuthCard eyebrow="Account Verification" title="Verifying your email">
      <div className="notice-box">
        {status === 'checking' && <p>Checking your link…</p>}
        {status === 'success' && <p>✅ {message}</p>}
        {status === 'error' && <p className="error-text">{message}</p>}
        <p className="auth-footnote">
          <Link to="/login">Go to login</Link>
        </p>
      </div>
    </AuthCard>
  );
};

export default VerifyEmail;

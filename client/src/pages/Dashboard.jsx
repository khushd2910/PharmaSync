import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/user/dashboard').then((res) => setData(res.data));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">Patient Dashboard</p>
          <h2>Welcome, {user?.name?.split(' ')[0]}</h2>
        </div>
        <button className="btn-secondary" onClick={handleLogout}>Logout</button>
      </header>

      {user && !user.isVerified && (
        <div className="notice-banner">
          Your email isn't verified yet. Check your inbox for the verification link we sent when you registered.
        </div>
      )}

      {data && <p className="info-text">{data.info}</p>}
      <div className="placeholder-card">
        <span className="rx-mark small">Rx</span>
        Medicine shopping, cart, checkout & order history unlock in Module 2.
      </div>
    </div>
  );
};

export default Dashboard;

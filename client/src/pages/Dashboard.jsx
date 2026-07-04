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
        <h2>User Dashboard</h2>
        <button onClick={handleLogout}>Logout</button>
      </header>
      <p>Welcome, {user?.name} 👋</p>
      {data && <p className="info-text">{data.info}</p>}
      <div className="placeholder-card">
        Medicine shopping, cart, checkout & order history will be enabled in
        Module 2.
      </div>
    </div>
  );
};

export default Dashboard;

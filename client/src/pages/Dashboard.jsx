import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/user/dashboard').then((res) => setData(res.data));
  }, []);

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Patient Dashboard</p>
          <h2>Welcome, {user?.name?.split(' ')[0]}</h2>
        </div>
      </header>

      {user && !user.isVerified && (
        <div className="notice-banner">
          Your email isn't verified yet. Check your inbox for the verification link we sent when you registered.
        </div>
      )}

      {data && <p className="info-text">{data.info}</p>}
      <div className="placeholder-card">
        <ShoppingBag size={20} strokeWidth={2} className="placeholder-icon" />
        Medicine shopping, cart, checkout & order history unlock in Module 2.
      </div>
    </div>
  );
};

export default Dashboard;

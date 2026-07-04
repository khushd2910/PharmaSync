import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/admin/dashboard').then((res) => setData(res.data));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="dashboard-page admin-theme">
      <header className="dashboard-header">
        <h2>Admin Dashboard</h2>
        <button onClick={handleLogout}>Logout</button>
      </header>
      <p>Welcome, {user?.name} 👋</p>
      {data && <p className="info-text">{data.info}</p>}
      <div className="placeholder-card">
        Medicine CRUD, stock management, order management, POS billing &
        invoicing will be enabled in later modules.
      </div>
    </div>
  );
};

export default AdminDashboard;

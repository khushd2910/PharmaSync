import { useEffect, useState } from 'react';
<<<<<<< HEAD
import { LayoutDashboard } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
=======
import { LayoutDashboard, ClipboardList } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
>>>>>>> master

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
        <div>
<<<<<<< HEAD
          <p className="dashboard-eyebrow">Admin Dashboard</p>
=======
          <p className="eyebrow">Admin Dashboard</p>
>>>>>>> master
          <h2>Welcome, {user?.name?.split(' ')[0]}</h2>
        </div>
        <button className="btn-secondary admin" onClick={handleLogout}>Logout</button>
      </header>

      {data && <p className="info-text">{data.info}</p>}
<<<<<<< HEAD
      <div className="placeholder-card">
        <LayoutDashboard size={20} strokeWidth={2} className="placeholder-icon" />
        Medicine CRUD, stock management, order management, POS billing & invoicing unlock in later modules.
=======

      <Link to="/admin/orders" className="placeholder-card admin-action-card">
        <ClipboardList size={20} strokeWidth={2} className="placeholder-icon" />
        <div>
          <strong>Order Management</strong>
          <p className="muted-text">View every order, update delivery status, or cancel — and download invoices.</p>
        </div>
      </Link>

      <div className="placeholder-card">
        <LayoutDashboard size={20} strokeWidth={2} className="placeholder-icon" />
        Medicine CRUD, stock management & POS billing unlock in later modules.
>>>>>>> master
      </div>
    </div>
  );
};

export default AdminDashboard;

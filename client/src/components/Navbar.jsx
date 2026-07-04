import { Link, useNavigate } from 'react-router-dom';
import { Pill, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <Pill size={20} strokeWidth={2.2} />
        <span>PharmaCare</span>
      </Link>

      <div className="navbar-links">
        <Link to="/" className="navbar-link">Home</Link>

        {!user && (
          <>
            <Link to="/login" className="navbar-link">Login</Link>
            <Link to="/register" className="navbar-btn">Register</Link>
            <Link to="/admin/login" className="navbar-link muted">Admin</Link>
          </>
        )}

        {user && user.role === 'user' && (
          <>
            <Link to="/dashboard" className="navbar-link">Dashboard</Link>
            <button className="navbar-btn ghost" onClick={handleLogout}>
              <LogOut size={15} strokeWidth={2} /> Logout
            </button>
          </>
        )}

        {user && user.role === 'admin' && (
          <>
            <Link to="/admin/dashboard" className="navbar-link">Admin Dashboard</Link>
            <button className="navbar-btn ghost" onClick={handleLogout}>
              <LogOut size={15} strokeWidth={2} /> Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

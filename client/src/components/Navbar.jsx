import { Link, useNavigate } from 'react-router-dom';
import { Pill, LogOut, ShoppingCart, User as UserIcon, ClipboardList } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { cart } = useCart();
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
            <Link to="/orders" className="navbar-link icon-link">
              <ClipboardList size={16} strokeWidth={2} /> Orders
            </Link>
            <Link to="/profile" className="navbar-link icon-link">
              <UserIcon size={16} strokeWidth={2} /> Profile
            </Link>
            <Link to="/cart" className="navbar-link icon-link cart-link">
              <ShoppingCart size={16} strokeWidth={2} />
              Cart
              {cart.totalItems > 0 && <span className="cart-badge">{cart.totalItems}</span>}
            </Link>
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

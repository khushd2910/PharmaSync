import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Pill, LogOut, ShoppingCart, User as UserIcon, ClipboardList, LayoutDashboard, ScanBarcode,
  BarChart3, FileSpreadsheet, ShieldAlert, Sun, Moon, Menu, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand" onClick={closeMenu}>
        <Pill size={20} strokeWidth={2.2} />
        <span>PharmaCare</span>
      </Link>

      <button
        type="button"
        className="navbar-menu-toggle"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
      >
        {menuOpen ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
      </button>

      <div className={`navbar-links ${menuOpen ? 'navbar-links-open' : ''}`}>
        <Link to="/" className="navbar-link" onClick={closeMenu}>Home</Link>

        {!user && (
          <>
            <Link to="/login" className="navbar-link" onClick={closeMenu}>Login</Link>
            <Link to="/register" className="navbar-btn" onClick={closeMenu}>Register</Link>
            <Link to="/admin/login" className="navbar-link muted" onClick={closeMenu}>Admin</Link>
          </>
        )}

        {user && user.role === 'user' && (
          <>
            <Link to="/dashboard" className="navbar-link icon-link" onClick={closeMenu}>
              <LayoutDashboard size={16} strokeWidth={2} /> Dashboard
            </Link>
            <Link to="/orders" className="navbar-link icon-link" onClick={closeMenu}>
              <ClipboardList size={16} strokeWidth={2} /> Orders
            </Link>
            <Link to="/profile" className="navbar-link icon-link" onClick={closeMenu}>
              <UserIcon size={16} strokeWidth={2} /> Profile
            </Link>
            <Link to="/cart" className="navbar-link icon-link cart-link" onClick={closeMenu}>
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
            <Link to="/admin/dashboard" className="navbar-link icon-link" onClick={closeMenu}>
              <LayoutDashboard size={16} strokeWidth={2} /> Dashboard
            </Link>
            <Link to="/admin/medicines" className="navbar-link icon-link" onClick={closeMenu}>
              <Pill size={16} strokeWidth={2} /> Medicines
            </Link>
            <Link to="/admin/orders" className="navbar-link icon-link" onClick={closeMenu}>
              <ClipboardList size={16} strokeWidth={2} /> Orders
            </Link>
            <Link to="/admin/prescriptions" className="navbar-link icon-link" onClick={closeMenu}>
              <ShieldAlert size={16} strokeWidth={2} /> Prescriptions
            </Link>
            <Link to="/admin/pos" className="navbar-link icon-link" onClick={closeMenu}>
              <ScanBarcode size={16} strokeWidth={2} /> POS
            </Link>
            <Link to="/admin/sales-analysis" className="navbar-link icon-link" onClick={closeMenu}>
              <BarChart3 size={16} strokeWidth={2} /> Sales
            </Link>
            <Link to="/admin/reports" className="navbar-link icon-link" onClick={closeMenu}>
              <FileSpreadsheet size={16} strokeWidth={2} /> Reports
            </Link>
            <button className="navbar-btn ghost" onClick={handleLogout}>
              <LogOut size={15} strokeWidth={2} /> Logout
            </button>
          </>
        )}

        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={17} strokeWidth={2} /> : <Moon size={17} strokeWidth={2} />}
        </button>
      </div>
    </nav>
  );
};

export default Navbar;

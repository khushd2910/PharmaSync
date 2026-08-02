import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, ShoppingCart, User as UserIcon, ClipboardList, LayoutDashboard, ScanBarcode,
  BarChart3, FileSpreadsheet, ShieldAlert, Pill, Menu, X, Heart, Sun, Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import ConfirmModal from './ConfirmModal';
import BrandLogo from './BrandLogo';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef(null);

  // Scroll shadow: add .navbar-scrolled once user has scrolled 10px
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;

    const handleOutsideClick = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    setConfirmLogoutOpen(true);
  };

  const confirmLogout = async () => {
    setConfirmLogoutOpen(false);
    await logout();
    navigate('/login');
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav className={`navbar${scrolled ? ' navbar-scrolled' : ''}`} ref={navRef}>
      <Link to="/" className="navbar-brand" onClick={closeMenu}>
        <BrandLogo compact />
      </Link>

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
            <Link to="/orders" className="navbar-link icon-link" onClick={closeMenu}>
              <ClipboardList size={16} strokeWidth={2} /> Orders
            </Link>
            <Link to="/wishlist" className="navbar-link icon-link" onClick={closeMenu}>
              <Heart size={16} strokeWidth={2} /> Wishlist
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

        {/* Theme toggle — always visible inside the menu on mobile */}
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark'
            ? <Sun size={16} strokeWidth={2} />
            : <Moon size={16} strokeWidth={2} />
          }
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Theme toggle visible on desktop outside menu */}
        <button
          type="button"
          className="theme-toggle-btn navbar-desktop-theme"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          style={{ display: menuOpen ? 'none' : undefined }}
        >
          {theme === 'dark'
            ? <Sun size={16} strokeWidth={2} />
            : <Moon size={16} strokeWidth={2} />
          }
        </button>

        <button
          type="button"
          className="navbar-menu-toggle"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
        </button>
      </div>

      <ConfirmModal
        open={confirmLogoutOpen}
        title="Log out of PharmaSync?"
        message="You will need to sign in again to access your account."
        confirmLabel="Log out"
        danger={false}
        onConfirm={confirmLogout}
        onCancel={() => setConfirmLogoutOpen(false)}
      />
    </nav>
  );
};

export default Navbar;

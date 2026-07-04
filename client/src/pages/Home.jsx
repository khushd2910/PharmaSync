import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShieldCheck, Truck, FileText } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import IconInput from '../components/IconInput';
import MedicineCard from '../components/MedicineCard';

const highlights = [
  { icon: ShieldCheck, title: 'Verified accounts', text: 'Email verification keeps every account secure.' },
  { icon: Truck, title: 'Doorstep delivery', text: 'Live address selection with map-based delivery.' },
  { icon: FileText, title: 'GST invoices', text: 'Download clean, itemized invoices for every order.' },
];

const Home = () => {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [medicines, setMedicines] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const fetchMedicines = async (targetPage, append = false) => {
    setLoading(true);
    try {
      const res = await api.get('/medicines', {
        params: { search, sort, page: targetPage, limit: 12 },
      });
      setMedicines((prev) => (append ? [...prev, ...res.data.medicines] : res.data.medicines));
      setPages(res.data.pagination.pages);
      setTotal(res.data.pagination.total);
      setPage(targetPage);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not load medicines', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Debounce search input so we don't fire a request on every keystroke
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchMedicines(1, false);
    }, 350);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sort]);

  const handleAddToCart = (medicine) => {
    if (!user) {
      showToast('Please log in to add items to your cart', 'info');
      navigate('/login');
      return;
    }
    if (user.role === 'admin') {
      showToast('Admins manage stock, not carts', 'info');
      return;
    }
    showToast(`Cart is coming in Module 2 — "${medicine.name}" noted!`, 'info');
  };

  return (
    <div className="home-page">
      <section className="hero">
        <p className="auth-eyebrow center">Pharmacy Management, Simplified</p>
        <h1 className="hero-title">Your neighborhood pharmacy, online.</h1>
        <p className="hero-subtitle">
          Browse medicines below without an account — sign up when you're
          ready to order, track deliveries, or manage prescriptions.
        </p>
        {!user && (
          <div className="hero-actions">
            <Link to="/register" className="btn-primary hero-btn">Get started as a patient</Link>
            <Link to="/admin/login" className="btn-secondary hero-btn">I'm pharmacy staff</Link>
          </div>
        )}
      </section>

      <section className="browse-section">
        <div className="browse-header">
          <h2 className="browse-title">Browse medicines</h2>
          <span className="browse-count">{total.toLocaleString()} available</span>
        </div>

        <div className="browse-controls">
          <IconInput
            icon={Search}
            placeholder="Search by name, manufacturer, or composition…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Sort: Name (A–Z)</option>
            <option value="price-asc">Sort: Price (low to high)</option>
            <option value="price-desc">Sort: Price (high to low)</option>
          </select>
        </div>

        {loading && medicines.length === 0 ? (
          <p className="info-text center-text">Loading medicines…</p>
        ) : medicines.length === 0 ? (
          <p className="info-text center-text">No medicines found for "{search}".</p>
        ) : (
          <>
            <div className="medicine-grid">
              {medicines.map((m) => (
                <MedicineCard key={m._id} medicine={m} onAddToCart={handleAddToCart} />
              ))}
            </div>
            {page < pages && (
              <div className="load-more-wrap">
                <button
                  className="btn-secondary"
                  onClick={() => fetchMedicines(page + 1, true)}
                  disabled={loading}
                >
                  {loading ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="feature-grid">
        {highlights.map(({ icon: Icon, title, text }) => (
          <div className="feature-card" key={title}>
            <Icon size={22} strokeWidth={2} className="feature-icon" />
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
};

export default Home;

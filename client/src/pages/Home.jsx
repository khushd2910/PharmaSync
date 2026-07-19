import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShieldCheck, Truck, FileText, Tag } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import IconInput from '../components/IconInput';
import MedicineCard from '../components/MedicineCard';

const highlights = [
  { icon: ShieldCheck, title: 'Verified accounts', text: 'Email verification keeps every account secure.' },
  { icon: Truck, title: 'Doorstep delivery', text: 'Live address selection with delivery tracking.' },
  { icon: FileText, title: 'GST invoices', text: 'Download clean, itemized invoices for every order.' },
];

const Home = () => {
  // Discovery-mode data (shown as promo rows above the catalog when no
  // search/filter is active — purely additive, not a replacement view)
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [offers, setOffers] = useState([]);
  const [popular, setPopular] = useState([]);
  const [recent, setRecent] = useState([]);

  // Search/filter state
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [sort, setSort] = useState('name');
  const [prescriptionRequired, setPrescriptionRequired] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);

  const [medicines, setMedicines] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  const { user } = useAuth();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isBrowsing = !search.trim() && !category && !brand && !prescriptionRequired && !inStockOnly;

  // Load discovery sections + filter option lists once
  useEffect(() => {
    api.get('/medicines/categories').then((res) => setCategories(res.data.categories)).catch(() => {});
    api.get('/medicines/brands').then((res) => setBrands(res.data.brands)).catch(() => {});
    api.get('/medicines', { params: { onOffer: true, limit: 8 } }).then((res) => setOffers(res.data.medicines)).catch(() => {});
    api.get('/medicines', { params: { featured: true, limit: 8 } }).then((res) => setPopular(res.data.medicines)).catch(() => {});
    api.get('/medicines', { params: { sort: 'newest', limit: 8 } }).then((res) => setRecent(res.data.medicines)).catch(() => {});
  }, []);

  const fetchMedicines = async (targetPage, append = false) => {
    setLoading(true);
    try {
      const res = await api.get('/medicines', {
        params: {
          search: search.trim() || undefined,
          category: category || undefined,
          brand: brand || undefined,
          prescriptionRequired: prescriptionRequired || undefined,
          inStock: inStockOnly ? 'true' : undefined,
          sort,
          page: targetPage,
          limit: 12,
        },
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

  // The catalog grid is always live — filters/search/sort are available
  // from the start, not hidden behind an initial search action.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchMedicines(1, false), 350);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, brand, sort, prescriptionRequired, inStockOnly]);

  const handleAddToCart = async (medicine) => {
    if (!user) {
      showToast('Please log in to add items to your cart', 'info');
      navigate('/login');
      return;
    }
    if (user.role === 'admin') {
      showToast('Admins manage stock, not carts', 'info');
      return;
    }
    const result = await addToCart(medicine._id, 1);
    showToast(result.success ? `${medicine.name} added to cart` : result.message, result.success ? 'success' : 'error');
  };

  return (
    <div className="home-page">
      <section className="hero">
        <p className="eyebrow center">Pharmacy Management, Simplified</p>
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

      {/* Search bar — always visible */}
      <section className="search-bar-section">
        <IconInput
          icon={Search}
          placeholder="Search by name, manufacturer, or composition…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </section>

      {/* Medicine Categories — quick-filter pills */}
      {categories.length > 0 && (
        <section className="category-pills-section">
          <button
            className={`category-pill ${!category ? 'active' : ''}`}
            onClick={() => setCategory('')}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className={`category-pill ${category === c ? 'active' : ''}`}
              onClick={() => setCategory(category === c ? '' : c)}
            >
              {c}
            </button>
          ))}
        </section>
      )}

      {/* Promo rows — additive, shown above the catalog only while browsing */}
      {isBrowsing && offers.length > 0 && (
        <BrowseRow title="Offers" icon={Tag} medicines={offers} onAddToCart={handleAddToCart} />
      )}
      {isBrowsing && popular.length > 0 && (
        <BrowseRow title="Popular Medicines" medicines={popular} onAddToCart={handleAddToCart} />
      )}
      {isBrowsing && recent.length > 0 && (
        <BrowseRow title="Recently Added" medicines={recent} onAddToCart={handleAddToCart} />
      )}

      {/* Filters + catalog grid — always visible and always functional */}
      <section className="browse-section">
        <div className="browse-header">
          <h2 className="browse-title">{isBrowsing ? 'All Medicines' : 'Search results'}</h2>
          <span className="browse-count">{total.toLocaleString()} found</span>
        </div>

        <div className="browse-controls">
          <select className="sort-select" value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name">Sort: Name (A–Z)</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
          </select>
          <select
            className="sort-select"
            value={prescriptionRequired}
            onChange={(e) => setPrescriptionRequired(e.target.value)}
          >
            <option value="">Prescription: Any</option>
            <option value="true">Prescription required</option>
            <option value="false">No prescription needed</option>
          </select>
          <label className="checkbox-filter">
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
            In stock only
          </label>
        </div>

        {loading && medicines.length === 0 ? (
          <p className="info-text center-text">Loading medicines…</p>
        ) : medicines.length === 0 ? (
          <p className="info-text center-text">No medicines match your filters.</p>
        ) : (
          <>
            <div className="medicine-grid">
              {medicines.map((m) => (
                <MedicineCard key={m._id} medicine={m} onAddToCart={handleAddToCart} />
              ))}
            </div>
            {page < pages && (
              <div className="load-more-wrap">
                <button className="btn-secondary" onClick={() => fetchMedicines(page + 1, true)} disabled={loading}>
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

// Horizontal discovery row (Offers / Popular Medicines)
const BrowseRow = ({ title, icon: Icon, medicines, onAddToCart }) => (
  <section className="browse-row-section">
    <div className="browse-header">
      <h2 className="browse-title">
        {Icon && <Icon size={18} strokeWidth={2} className="browse-title-icon" />}
        {title}
      </h2>
    </div>
    <div className="browse-row-scroll">
      {medicines.map((m) => (
        <div className="browse-row-item" key={m._id}>
          <MedicineCard medicine={m} onAddToCart={onAddToCart} />
        </div>
      ))}
    </div>
  </section>
);

export default Home;

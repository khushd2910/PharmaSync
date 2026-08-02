import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, ShieldCheck, Truck, FileText, Heart, Sparkles } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useToast } from '../context/ToastContext';
import IconInput from '../components/IconInput';
import MedicineCard from '../components/MedicineCard';
import MedicineRow from '../components/MedicineRow';
import { SkeletonMedicineCard } from '../components/Skeleton';
import { getRecentlyViewed, setRecentlyViewed as persistRecentlyViewed } from '../utils/recentlyViewed';

// Trust highlights shown in the feature grid below the catalog
const highlights = [
  { icon: ShieldCheck, title: 'Verified accounts', text: 'Email verification keeps every account secure and trusted.' },
  { icon: Truck, title: 'Doorstep delivery', text: 'Live address selection with real-time delivery tracking.' },
  { icon: FileText, title: 'GST invoices', text: 'Download clean, itemized invoices instantly for every order.' },
];

// Category tiles with emojis for visual, non-tech-savvy navigation
const CATEGORY_TILES = [
  { emoji: '💊', name: 'Pain Relief' },
  { emoji: '🤧', name: 'Cold & Flu' },
  { emoji: '❤️', name: 'Heart Care' },
  { emoji: '🍬', name: 'Diabetes' },
  { emoji: '🧴', name: 'Skin Care' },
  { emoji: '🌿', name: 'Ayurvedic' },
  { emoji: '🧪', name: 'Vitamins' },
  { emoji: '😴', name: 'Sleep Aid' },
  { emoji: '🏋️', name: 'Nutrition' },
  { emoji: '👁️', name: 'Eye Care' },
];

const Home = () => {
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [offers, setOffers] = useState([]);
  const [popular, setPopular] = useState([]);
  const [recent, setRecent] = useState([]);

  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [heroSearch, setHeroSearch] = useState('');
  const [category, setCategory] = useState(() => searchParams.get('category') || '');
  const [brand, setBrand] = useState(() => searchParams.get('brand') || '');
  const [sort, setSort] = useState(() => searchParams.get('sort') || 'name');
  const [prescriptionRequired, setPrescriptionRequired] = useState(() => searchParams.get('rx') || '');
  const [inStockOnly, setInStockOnly] = useState(() => searchParams.get('inStock') === 'true');

  const [suggestOpen, setSuggestOpen] = useState(false);
  const suggestCloseRef = useRef(null);

  const [medicines, setMedicines] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  const catalogRef = useRef(null);

  const { user } = useAuth();
  const { addToCart } = useCart();
  const { medicines: wishlistMedicines } = useWishlist() || {};
  const { showToast } = useToast();
  const navigate = useNavigate();
  const recentScope = user?.id || 'guest';

  const isBrowsing = !search.trim() && !category && !brand && !prescriptionRequired && !inStockOnly;

  // Load discovery sections + filter lists
  useEffect(() => {
    api.get('/medicines/categories').then((res) => setCategories(res.data.categories)).catch(() => {});
    api.get('/medicines/brands').then((res) => setBrands(res.data.brands)).catch(() => {});
    api.get('/medicines', { params: { onOffer: true, limit: 8 } }).then((res) => setOffers(res.data.medicines)).catch(() => {});
    api.get('/medicines', { params: { featured: true, limit: 8 } }).then((res) => setPopular(res.data.medicines)).catch(() => {});
    api.get('/medicines', { params: { sort: 'newest', limit: 8 } }).then((res) => setRecent(res.data.medicines)).catch(() => {});
  }, []);

  const cachedRecentlyViewed = getRecentlyViewed(recentScope);
  const cachedRecentlyViewedIds = cachedRecentlyViewed.map((m) => m._id).join(',');

  const { data: validatedRecentlyViewed } = useQuery({
    queryKey: ['recently-viewed', recentScope, cachedRecentlyViewedIds],
    queryFn: async () => {
      const res = await api.get('/medicines/by-ids', { params: { ids: cachedRecentlyViewedIds } });
      const byId = new Map(res.data.medicines.map((m) => [m._id, m]));
      const stillValid = cachedRecentlyViewed.map((m) => byId.get(m._id)).filter(Boolean);
      persistRecentlyViewed(stillValid, recentScope);
      return stillValid;
    },
    enabled: cachedRecentlyViewedIds.length > 0,
    staleTime: 60 * 1000,
  });

  const recentlyViewed = validatedRecentlyViewed ?? cachedRecentlyViewed;

  const visibleMedicineIds = Array.from(
    new Set(
      [...offers, ...popular, ...recent, ...medicines, ...recentlyViewed, ...(wishlistMedicines || [])].map(
        (m) => m._id
      )
    )
  )
    .sort()
    .join(',');

  const { data: ratings = {} } = useQuery({
    queryKey: ['rating-summaries', visibleMedicineIds],
    queryFn: async () => {
      const res = await api.get('/medicines/reviews/summary', { params: { ids: visibleMedicineIds } });
      return res.data.summaries || {};
    },
    enabled: visibleMedicineIds.length > 0,
    staleTime: 60 * 1000,
  });

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

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchMedicines(1, false), 350);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, brand, sort, prescriptionRequired, inStockOnly]);

  useEffect(() => {
    const next = {};
    if (search.trim()) next.q = search.trim();
    if (category) next.category = category;
    if (brand) next.brand = brand;
    if (sort && sort !== 'name') next.sort = sort;
    if (prescriptionRequired) next.rx = prescriptionRequired;
    if (inStockOnly) next.inStock = 'true';
    setSearchParams(next, { replace: true });
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

  const handleSuggestionClick = (medicine) => {
    setSuggestOpen(false);
    navigate(`/medicines/${medicine._id}`);
  };

  const handleSearchBlur = () => {
    suggestCloseRef.current = setTimeout(() => setSuggestOpen(false), 150);
  };
  const cancelSuggestClose = () => clearTimeout(suggestCloseRef.current);

  const searchSuggestions = search.trim() ? medicines.slice(0, 6) : [];

  // Hero search: set the main search and scroll to catalog
  const handleHeroSearch = (e) => {
    e.preventDefault();
    if (!heroSearch.trim()) return;
    setSearch(heroSearch.trim());
    setTimeout(() => {
      catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Category tile click: set category filter and scroll to catalog
  const handleCategoryTileClick = (name) => {
    setCategory(category === name ? '' : name);
    setTimeout(() => {
      catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  return (
    <div className="home-page">

      {/* ── Hero Banner ── */}
      <section className="hero-banner">
        {/* Decorative floating orbs */}
        <div className="hero-orb hero-orb-1" aria-hidden="true" />
        <div className="hero-orb hero-orb-2" aria-hidden="true" />
        <div className="hero-orb hero-orb-3" aria-hidden="true" />
        <div className="hero-orb hero-orb-4" aria-hidden="true" />

        <div className="hero-inner">
          <div className="hero-eyebrow">
            <Sparkles size={12} strokeWidth={2.5} />
            India&apos;s Trusted Online Pharmacy
          </div>
          <h1 className="hero-title">
            Your health, delivered<br />
            <span className="gradient-text">to your door.</span>
          </h1>
          <p className="hero-subtitle">
            Browse 1,150+ genuine medicines. Order with confidence —<br />
            pharmacist-verified, GST-invoiced, and tracked door-to-door.
          </p>

          {/* Hero Search Bar */}
          <form className="hero-search-wrap" onSubmit={handleHeroSearch}>
            <Search size={18} style={{ color: '#9db4ac', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search medicines, vitamins, supplements…"
              value={heroSearch}
              onChange={(e) => setHeroSearch(e.target.value)}
              autoComplete="off"
            />
            <button type="submit" className="hero-search-btn">
              Search
            </button>
          </form>

          {/* Trust pills */}
          <div className="hero-trust-pills">
            <span className="hero-trust-pill">✓ 1,150+ Medicines</span>
            <span className="hero-trust-pill">✓ Verified Sellers</span>
            <span className="hero-trust-pill">✓ GST Invoices</span>
            <span className="hero-trust-pill">✓ Free Returns</span>
          </div>

          {/* CTA Buttons (for guests) */}
          {!user && (
            <div className="hero-actions">
              <Link to="/register" className="hero-btn-white">
                Get started as a patient
              </Link>
              <Link to="/admin/login" className="hero-btn-outline">
                I&apos;m pharmacy staff →
              </Link>
            </div>
          )}
        </div>

        {/* Animated scroll-down indicator */}
        <button
          type="button"
          className="hero-scroll-indicator"
          aria-label="Scroll to medicines"
          onClick={() => catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
          Scroll
        </button>
      </section>

      {/* ── Trust Ticker Strip ── */}
      <div className="ticker-strip" aria-hidden="true">
        <div className="ticker-inner">
          {[
            { icon: <ShieldCheck size={14} />, text: 'Licensed Pharmacy Partners' },
            { icon: <Truck size={14} />, text: 'Fast Tracked Delivery' },
            { icon: <FileText size={14} />, text: 'GST-Invoiced Orders' },
            { icon: <Heart size={14} />, text: 'Pharmacist Verified' },
            { icon: <ShieldCheck size={14} />, text: '1,150+ Genuine Medicines' },
            { icon: <Truck size={14} />, text: '7-Day Easy Returns' },
            { icon: <FileText size={14} />, text: 'Secure Encrypted Payments' },
            { icon: <Heart size={14} />, text: 'Rx Prescription Support' },
            // Duplicate for seamless loop
            { icon: <ShieldCheck size={14} />, text: 'Licensed Pharmacy Partners' },
            { icon: <Truck size={14} />, text: 'Fast Tracked Delivery' },
            { icon: <FileText size={14} />, text: 'GST-Invoiced Orders' },
            { icon: <Heart size={14} />, text: 'Pharmacist Verified' },
            { icon: <ShieldCheck size={14} />, text: '1,150+ Genuine Medicines' },
            { icon: <Truck size={14} />, text: '7-Day Easy Returns' },
            { icon: <FileText size={14} />, text: 'Secure Encrypted Payments' },
            { icon: <Heart size={14} />, text: 'Rx Prescription Support' },
          ].map((item, i) => (
            <span key={i} className="ticker-item">
              {item.icon}
              {item.text}
              <span className="ticker-dot" />
            </span>
          ))}
        </div>
      </div>

      {/* ── Category Tiles ── */}
      {categories.length > 0 && (
        <section className="category-tiles-section">
          <div className="category-tiles-header">
            <h2>Shop by Category</h2>
            <p>Find medicines quickly — just tap the area you need help with</p>
          </div>
          <div className="category-tiles-grid">
            {CATEGORY_TILES.map((tile) => {
              // Match tile name to real categories (case-insensitive contains check)
              const matched = categories.find((c) =>
                c.toLowerCase().includes(tile.name.toLowerCase().split(' ')[0])
              );
              const targetCategory = matched || tile.name;
              return (
                <button
                  key={tile.name}
                  className="category-tile"
                  onClick={() => handleCategoryTileClick(targetCategory)}
                  type="button"
                >
                  <span className="category-tile-emoji">{tile.emoji}</span>
                  <span className="category-tile-name">{tile.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Main Search Bar ── */}
      <section className="search-bar-section">
        <div className="search-suggest-wrap">
          <IconInput
            icon={Search}
            placeholder="Search by name, manufacturer, or composition…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => {
              cancelSuggestClose();
              setSuggestOpen(true);
            }}
            onBlur={handleSearchBlur}
          />
          {suggestOpen && searchSuggestions.length > 0 && (
            <div className="search-suggest-dropdown" onMouseDown={cancelSuggestClose}>
              {searchSuggestions.map((m) => (
                <button
                  type="button"
                  key={m._id}
                  className="search-suggest-item"
                  onClick={() => handleSuggestionClick(m)}
                >
                  <span className="search-suggest-name">{m.name}</span>
                  {m.manufacturer && <span className="search-suggest-sub">{m.manufacturer}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Category Pill Filters ── */}
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

      {/* ── Discovery Rows (browsing mode only) ── */}
      {isBrowsing && wishlistMedicines?.length > 0 && (
        <MedicineRow title="My Wishlist" icon={Heart} medicines={wishlistMedicines} onAddToCart={handleAddToCart} ratings={ratings} />
      )}
      {isBrowsing && recentlyViewed.length > 0 && (
        <MedicineRow title="Recently Viewed" medicines={recentlyViewed} onAddToCart={handleAddToCart} ratings={ratings} />
      )}
      {isBrowsing && offers.length > 0 && (
        <MedicineRow title="🔖 Today&apos;s Offers" medicines={offers} onAddToCart={handleAddToCart} ratings={ratings} />
      )}
      {isBrowsing && popular.length > 0 && (
        <MedicineRow title="⭐ Popular Medicines" medicines={popular} onAddToCart={handleAddToCart} ratings={ratings} />
      )}
      {isBrowsing && recent.length > 0 && (
        <MedicineRow title="🆕 Recently Added" medicines={recent} onAddToCart={handleAddToCart} ratings={ratings} />
      )}

      {/* ── Catalog Grid ── */}
      <section className="browse-section" ref={catalogRef}>
        <div className="browse-header">
          <h2 className="browse-title">
            {isBrowsing ? 'All Medicines' : `Results for "${search || category || brand}"`}
          </h2>
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
          <div className="medicine-grid">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonMedicineCard key={i} />
            ))}
          </div>
        ) : medicines.length === 0 ? (
          <p className="info-text center-text">No medicines match your filters.</p>
        ) : (
          <>
            <div className="medicine-grid">
              {medicines.map((m) => (
                <MedicineCard key={m._id} medicine={m} onAddToCart={handleAddToCart} rating={ratings[m._id]} />
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

      {/* ── Trust / Feature Grid ── */}
      <section className="feature-grid">
        {highlights.map(({ icon: Icon, title, text }) => (
          <div className="feature-card" key={title}>
            <div className="feature-icon-wrap">
              <Icon size={22} strokeWidth={2} />
            </div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
};

export default Home;

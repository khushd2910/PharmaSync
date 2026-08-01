import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, ShieldCheck, Truck, FileText, Tag, Heart } from 'lucide-react';
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

  // Search/filter state — initialized from the URL so a shared link,
  // bookmark, or browser back/forward restores the same filtered view
  // instead of always resetting to a blank Home page.
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') || '');
  const [category, setCategory] = useState(() => searchParams.get('category') || '');
  const [brand, setBrand] = useState(() => searchParams.get('brand') || '');
  const [sort, setSort] = useState(() => searchParams.get('sort') || 'name');
  const [prescriptionRequired, setPrescriptionRequired] = useState(() => searchParams.get('rx') || '');
  const [inStockOnly, setInStockOnly] = useState(() => searchParams.get('inStock') === 'true');

  // Search suggestions dropdown — shown under the search bar while typing,
  // built from whatever the main catalog fetch below already returned
  // (no extra network round-trip needed).
  const [suggestOpen, setSuggestOpen] = useState(false);
  const suggestCloseRef = useRef(null);

  const [medicines, setMedicines] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  const { user } = useAuth();
  const { addToCart } = useCart();
  const { medicines: wishlistMedicines } = useWishlist() || {};
  const { showToast } = useToast();
  const navigate = useNavigate();
  // Each account (and guest browsing) gets its own Recently Viewed list —
  // otherwise everyone sharing a browser would see each other's history.
  const recentScope = user?.id || 'guest';

  const isBrowsing = !search.trim() && !category && !brand && !prescriptionRequired && !inStockOnly;

  // Load discovery sections + filter option lists once
  useEffect(() => {
    api.get('/medicines/categories').then((res) => setCategories(res.data.categories)).catch(() => {});
    api.get('/medicines/brands').then((res) => setBrands(res.data.brands)).catch(() => {});
    api.get('/medicines', { params: { onOffer: true, limit: 8 } }).then((res) => setOffers(res.data.medicines)).catch(() => {});
    api.get('/medicines', { params: { featured: true, limit: 8 } }).then((res) => setPopular(res.data.medicines)).catch(() => {});
    api.get('/medicines', { params: { sort: 'newest', limit: 8 } }).then((res) => setRecent(res.data.medicines)).catch(() => {});
  }, []);

  // Recently Viewed is cached client-side, so it can go stale — a medicine
  // gets removed, or the catalog gets reseeded with new ids. Rather than
  // trusting the cache and only finding out it's wrong when the person
  // clicks through to a "not found" page, re-check every cached id against
  // the server on load and quietly drop anything that no longer comes back
  // (also refreshing price/stock for the ones that do).
  //
  // This used to be a hand-rolled effect with its own cancelled-flag
  // cleanup. React Query gets the same result for less code, plus caching
  // for free: navigating Home → a medicine → back to Home reuses the
  // cached result (same queryKey) instead of re-fetching every time.
  const cachedRecentlyViewed = getRecentlyViewed(recentScope);
  const cachedRecentlyViewedIds = cachedRecentlyViewed.map((m) => m._id).join(',');

  const { data: validatedRecentlyViewed } = useQuery({
    queryKey: ['recently-viewed', recentScope, cachedRecentlyViewedIds],
    queryFn: async () => {
      const res = await api.get('/medicines/by-ids', { params: { ids: cachedRecentlyViewedIds } });
      const byId = new Map(res.data.medicines.map((m) => [m._id, m]));
      // Keep the cache's most-recent-first order, just filtered down to
      // (and refreshed with) whatever the server confirms still exists.
      const stillValid = cachedRecentlyViewed.map((m) => byId.get(m._id)).filter(Boolean);
      persistRecentlyViewed(stillValid, recentScope);
      return stillValid;
    },
    enabled: cachedRecentlyViewedIds.length > 0,
    staleTime: 60 * 1000,
  });

  // While the validation query is loading (or if it fails — offline, server
  // hiccup), fall back to showing the cache as-is rather than hiding the
  // row entirely; worst case a stale click still goes through the existing
  // 404 handling on the details page.
  const recentlyViewed = validatedRecentlyViewed ?? cachedRecentlyViewed;

  // Star ratings for every medicine currently on screen (discovery rows +
  // catalog grid + recently viewed + wishlist) — one bulk request rather
  // than one per card. Medicines with no reviews just aren't in the
  // response, so their cards render without a rating rather than 0 stars.
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

  // The catalog grid is always live — filters/search/sort are available
  // from the start, not hidden behind an initial search action.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchMedicines(1, false), 350);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, brand, sort, prescriptionRequired, inStockOnly]);

  // Mirror the active filters into the URL (replacing, not pushing, so
  // typing in the search box doesn't fill up browser history) — lets
  // people bookmark/share a filtered view and makes back/forward and
  // refresh restore it instead of dropping back to a blank Home page.
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

  // A plain onBlur would close the dropdown before a click on one of its
  // items has a chance to register, since blur fires first — delaying the
  // close by a tick lets that click go through, and gets cancelled by
  // onFocus/onMouseDown if the person is just clicking back into the input.
  const handleSearchBlur = () => {
    suggestCloseRef.current = setTimeout(() => setSuggestOpen(false), 150);
  };
  const cancelSuggestClose = () => clearTimeout(suggestCloseRef.current);

  const searchSuggestions = search.trim() ? medicines.slice(0, 6) : [];

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
      {isBrowsing && wishlistMedicines?.length > 0 && (
        <MedicineRow title="My Wishlist" icon={Heart} medicines={wishlistMedicines} onAddToCart={handleAddToCart} ratings={ratings} />
      )}
      {isBrowsing && recentlyViewed.length > 0 && (
        <MedicineRow title="Recently Viewed" medicines={recentlyViewed} onAddToCart={handleAddToCart} ratings={ratings} />
      )}
      {isBrowsing && offers.length > 0 && (
        <MedicineRow title="Offers" icon={Tag} medicines={offers} onAddToCart={handleAddToCart} ratings={ratings} />
      )}
      {isBrowsing && popular.length > 0 && (
        <MedicineRow title="Popular Medicines" medicines={popular} onAddToCart={handleAddToCart} ratings={ratings} />
      )}
      {isBrowsing && recent.length > 0 && (
        <MedicineRow title="Recently Added" medicines={recent} onAddToCart={handleAddToCart} ratings={ratings} />
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

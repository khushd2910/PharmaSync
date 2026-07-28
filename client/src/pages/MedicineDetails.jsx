import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pill, ShoppingCart, Minus, Plus, FileWarning, Calendar, Factory, Boxes } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { addRecentlyViewed, removeRecentlyViewed } from '../utils/recentlyViewed';

const MedicineDetails = () => {
  const { id } = useParams();
  const [medicine, setMedicine] = useState(null);
  const [apiInfo, setApiInfo] = useState(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  // 'notFound' = the medicine genuinely doesn't exist anymore (e.g. it was
  // removed from the catalog, or a stale "recently viewed" entry points at
  // an id from before the catalog was reseeded). 'error' = something else
  // went wrong (network hiccup, server hiccup) and is worth retrying,
  // rather than telling the person the medicine is gone when it might not be.
  const [loadError, setLoadError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const { user } = useAuth();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Guards against a slower, earlier request (e.g. from React StrictMode's
    // double-invoke in dev, or quickly clicking between two medicines)
    // resolving after a newer one and overwriting this page with the wrong
    // — or a failed — result.
    let cancelled = false;

    setLoading(true);
    setApiLoading(true);
    setLoadError(null);
    setMedicine(null);

    api
      .get(`/medicines/${id}`)
      .then((res) => {
        if (cancelled) return;
        setMedicine(res.data.medicine);
        setApiInfo(res.data.apiInfo);
        addRecentlyViewed(res.data.medicine);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) {
          setLoadError('notFound');
          // Stop this dead link from resurfacing in "Recently Viewed".
          removeRecentlyViewed(id);
        } else {
          setLoadError('error');
          showToast(err.response?.data?.message || 'Could not load this medicine', 'error');
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setApiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, retryCount]);

  const handleAddToCart = async () => {
    if (!user) {
      showToast('Please log in to add items to your cart', 'info');
      navigate('/login');
      return;
    }
    if (user.role === 'admin') {
      showToast('Admins manage stock, not carts', 'info');
      return;
    }
    const result = await addToCart(medicine._id, quantity);
    showToast(result.success ? `${medicine.name} added to cart` : result.message, result.success ? 'success' : 'error');
  };

  if (loading) return <p className="info-text center-text">Loading medicine details…</p>;

  if (loadError === 'notFound') {
    return (
      <div className="info-text center-text">
        <p>This medicine is no longer available — it may have been removed from the catalog.</p>
        <Link to="/" className="link-muted back-link">← Back to browsing</Link>
      </div>
    );
  }

  if (loadError === 'error' || !medicine) {
    return (
      <div className="info-text center-text">
        <p>Something went wrong loading this medicine.</p>
        <button type="button" className="btn-secondary" onClick={() => setRetryCount((c) => c + 1)} style={{ marginTop: 10 }}>
          Retry
        </button>
      </div>
    );
  }

  const composition = [medicine.composition1, medicine.composition2].filter(Boolean).join(' + ');
  const hasDiscount = medicine.discountPercent > 0;
  const effectivePrice = hasDiscount ? medicine.price * (1 - medicine.discountPercent / 100) : medicine.price;
  const outOfStock = medicine.stock <= 0;
  const expiryLabel = medicine.expiryDate
    ? new Date(medicine.expiryDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' })
    : 'N/A';

  return (
    <div className="details-page">
      <div className="details-grid">
        <div className="details-image">
          <Pill size={64} strokeWidth={1.5} />
        </div>

        <div className="details-main">
          <h1 className="details-title">{medicine.name}</h1>
          {medicine.manufacturer && (
            <p className="details-manufacturer">
              <Factory size={14} strokeWidth={2} /> {medicine.manufacturer}
            </p>
          )}

          <div className="details-tags">
            {medicine.category && <span className="badge badge-category">{medicine.category}</span>}
            {medicine.requiresPrescription && (
              <span className="badge badge-rx"><FileWarning size={11} strokeWidth={2} /> Rx required</span>
            )}
            {outOfStock && <span className="badge badge-outofstock">Out of stock</span>}
          </div>

          <div className="details-price-row">
            <span className="details-price num">₹{effectivePrice?.toFixed(2) ?? 'N/A'}</span>
            {hasDiscount && (
              <>
                <span className="price-strike">₹{medicine.price.toFixed(2)}</span>
                <span className="badge badge-discount">{medicine.discountPercent}% OFF</span>
              </>
            )}
          </div>

          <div className="details-meta-grid">
            <div className="details-meta-item">
              <Boxes size={14} strokeWidth={2} />
              <span>{outOfStock ? 'Out of stock' : `${medicine.stock} in stock`}</span>
            </div>
            <div className="details-meta-item">
              <Calendar size={14} strokeWidth={2} />
              <span>Expires {expiryLabel}</span>
            </div>
          </div>

          {!outOfStock && (
            <div className="qty-row">
              <div className="qty-stepper">
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
                  <Minus size={14} />
                </button>
                <span>{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(medicine.stock, q + 1))}
                  aria-label="Increase quantity"
                >
                  <Plus size={14} />
                </button>
              </div>
              <button className="btn-primary details-add-btn" onClick={handleAddToCart}>
                <ShoppingCart size={16} strokeWidth={2} /> Add to Cart
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="details-sections">
        <DetailSection title="Composition & Pack">
          <p>{composition || 'Not specified'}</p>
          {medicine.packSizeLabel && <p className="muted-text">{medicine.packSizeLabel}</p>}
        </DetailSection>

        <DetailSection title="Uses">
          <p>{medicine.uses || 'Usage information is not available for this medicine.'}</p>
        </DetailSection>

        <DetailSection title="Side Effects">
          <p>{medicine.sideEffects || 'Side-effect information is not available for this medicine.'}</p>
        </DetailSection>

        <DetailSection title="Dosage">
          <p>{medicine.dosage || 'Please consult your pharmacist or doctor for dosage guidance.'}</p>
        </DetailSection>

        <DetailSection title="Additional Information (live lookup)">
          {apiLoading ? (
            <p className="muted-text">Fetching additional details…</p>
          ) : apiInfo ? (
            <div className="api-info-block">
              {apiInfo.uses && <p><strong>Uses:</strong> {apiInfo.uses}</p>}
              {apiInfo.sideEffects && <p><strong>Side Effects:</strong> {apiInfo.sideEffects}</p>}
              {apiInfo.warnings && <p><strong>Warnings:</strong> {apiInfo.warnings}</p>}
              {apiInfo.storage && <p><strong>Storage:</strong> {apiInfo.storage}</p>}
              {apiInfo.dosage && <p><strong>Dosage:</strong> {apiInfo.dosage}</p>}
              <p className="muted-text api-source">Source: {apiInfo.source}</p>
            </div>
          ) : (
            <p className="muted-text">No additional details available from external sources for this medicine.</p>
          )}
        </DetailSection>
      </div>

      <p className="disclaimer-text">
        This information is for general reference only and is not a substitute for professional
        medical advice. Always consult a doctor or pharmacist before use.
      </p>

      <Link to="/" className="link-muted back-link">← Back to browsing</Link>
    </div>
  );
};

const DetailSection = ({ title, children }) => (
  <div className="detail-section">
    <h3>{title}</h3>
    {children}
  </div>
);

export default MedicineDetails;

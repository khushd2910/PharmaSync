import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Minus, Plus, Trash2, ShoppingBag, Tag, Sparkles, ChevronRight, Smartphone, X,
  Heart, AlertTriangle,
} from 'lucide-react';
import MedicineRow from '../components/MedicineRow';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/format';
import { getMedicineImage } from '../utils/medicineFormImage';
import { resolveImageUrl } from '../utils/imageUrl';
import { COUPONS, computeCouponDiscount } from '../utils/coupons';
import api from '../api/axios';

const UPI_OFFERS = [
  { app: 'Google Pay', detail: '5% cashback up to ₹40 on UPI payments' },
  { app: 'PhonePe', detail: 'Flat ₹20 cashback on orders above ₹300' },
  { app: 'Paytm UPI', detail: '10% off up to ₹75 on your first UPI transaction' },
];

const DELIVERY_FEE = 40;
const FREE_DELIVERY_THRESHOLD = 500;
const PLATFORM_FEE = 12;

const Cart = () => {
  const {
    cart,
    updateQuantity,
    removeFromCart,
    addToCart,
    saveForLater,
    loading,
    cartLoaded,
    appliedCoupon,
    setAppliedCoupon,
  } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [isFirstOrder, setIsFirstOrder] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState(COUPONS);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');
  const [relatedItems, setRelatedItems] = useState([]);
  const [relatedRatings, setRelatedRatings] = useState({});
  const [genericAlternatives, setGenericAlternatives] = useState({});

  // Used only to unlock the first-order coupon — falls back to "not first
  // order" (safe default) if the request fails for any reason.
  useEffect(() => {
    api
      .get('/orders')
      .then((res) => setIsFirstOrder((res.data.orders || []).length === 0))
      .catch(() => {});

    api
      .get('/coupons')
      .then((res) => setAvailableCoupons(res.data.coupons || COUPONS))
      .catch(() => setAvailableCoupons(COUPONS));
  }, []);

  const loadRelatedItems = async () => {
    if (cart.items.length === 0) return;
    try {
      const topItem = cart.items[0]?.medicine;
      if (!topItem) return;
      const res = await api.get(`/medicines/${topItem._id}/related`);
      setRelatedItems(res.data.alsoBought || []);
    } catch (err) {
      setRelatedItems([]);
    }
  };

  const loadGenericAlternatives = async () => {
    if (cart.items.length === 0) {
      setGenericAlternatives({});
      return;
    }

    const ids = cart.items.map(({ medicine }) => medicine._id).join(',');
    try {
      const res = await api.get('/medicines/generics', { params: { ids } });
      setGenericAlternatives(res.data.alternatives || {});
    } catch (err) {
      setGenericAlternatives({});
    }
  };

  useEffect(() => {
    loadRelatedItems();
    loadGenericAlternatives();
  }, [cart.items]);

  // Star ratings for the "Frequently bought together" row — medicines with
  // no reviews just aren't in the response, so their cards render without
  // a rating rather than showing empty/zero stars.
  useEffect(() => {
    if (relatedItems.length === 0) {
      setRelatedRatings({});
      return;
    }
    let cancelled = false;
    const ids = relatedItems.map((m) => m._id).join(',');
    api
      .get('/medicines/reviews/summary', { params: { ids } })
      .then((res) => {
        if (!cancelled) setRelatedRatings(res.data.summaries || {});
      })
      .catch(() => {
        if (!cancelled) setRelatedRatings({});
      });
    return () => {
      cancelled = true;
    };
  }, [relatedItems]);

  const handleQuantityChange = async (medicineId, newQty, stock) => {
    if (newQty < 1) return;
    if (newQty > stock) {
      showToast('Not enough stock available', 'error');
      return;
    }
    const result = await updateQuantity(medicineId, newQty);
    if (!result.success) showToast(result.message, 'error');
  };

  const handleRemove = async (medicineId, name, quantity) => {
    const result = await removeFromCart(medicineId);
    if (result.success) {
      showToast(`${name} removed from cart`, 'info', 5000, {
        label: 'Undo',
        callback: async () => {
          const restored = await addToCart(medicineId, quantity || 1);
          if (restored.success) {
            showToast(`${name} restored to cart`, 'success');
          }
        },
      });
    } else showToast(result.message, 'error');
  };

  const handleSwitchToGeneric = async (sourceMedicine, alternative, quantity) => {
    const result = await addToCart(alternative._id, quantity);
    if (!result.success) {
      showToast(result.message, 'error');
      return;
    }

    const removed = await removeFromCart(sourceMedicine._id);
    if (removed.success) {
      showToast(`Switched to generic ${alternative.name} and saved ₹${Math.round((sourceMedicine.price - alternative.price) * quantity)}`, 'success');
    } else {
      showToast('Added generic item, but could not remove original product', 'warning');
    }
  };

  const mrpTotal = useMemo(
    () => cart.items.reduce((sum, { medicine, quantity }) => sum + medicine.price * quantity, 0),
    [cart.items]
  );
  const discountedValue = cart.totalAmount;
  const mrpDiscount = Math.max(0, mrpTotal - discountedValue);

  const couponDiscount = useMemo(
    () => computeCouponDiscount(appliedCoupon, discountedValue),
    [appliedCoupon, discountedValue]
  );

  const gstAmount = Math.round(discountedValue * 0.05 * 100) / 100;
  const deliveryFee = discountedValue >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const amountToPay = Math.max(0, discountedValue - couponDiscount + gstAmount + deliveryFee + PLATFORM_FEE);
  const totalSaved = mrpDiscount + couponDiscount;

  const attemptApply = async (rawCode) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    try {
      const res = await api.post('/coupons/validate', {
        code,
        cartAmount: discountedValue,
      });
      setAppliedCoupon(res.data.coupon);
      setCouponError('');
      setCouponInput('');
      showToast(`${res.data.coupon.code} applied to your order`, 'success');
    } catch (err) {
      setCouponError(err.response?.data?.message || 'Invalid coupon code');
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
  };

  if (!cartLoaded) {
    return (
      <div className="cart-page">
        <div className="cart-skeleton">
          <div className="skeleton-line" style={{ width: '40%' }} />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      </div>
    );
  }

  if (cart.items.length === 0 && (!cart.savedItems || cart.savedItems.length === 0)) {
    return (
      <div className="cart-page">
        <div className="empty-state">
          <ShoppingBag size={40} strokeWidth={1.5} />
          <h2>Your cart is empty</h2>
          <p className="muted-text">Browse medicines and add a few to get started.</p>
          <Link to="/" className="btn-primary">Browse medicines</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <h1 className="page-title">Your Cart</h1>
      {cart.savedItems && cart.savedItems.length > 0 && (
        <div className="saved-items-banner">
          <p>
            You have {cart.savedItems.length} saved item{cart.savedItems.length > 1 ? 's' : ''}.
            <Link to="/saved-items" className="link-btn" style={{ marginLeft: 12 }}>
              View saved items
            </Link>
          </p>
        </div>
      )}

      <div className="cart-grid">
        {/* ---------------- Left column: items + coupons ---------------- */}
        <div className="cart-main">
          <p className="cart-item-count">
            {cart.totalItems} Item{cart.totalItems > 1 ? 's' : ''} in your Cart
          </p>

          <div className="cart-list">
            {cart.items.map(({ medicine, quantity, lineTotal, priceChanged, priceDelta, outOfStock, onlyLeft }) => {
              const alternatives = genericAlternatives[medicine._id] || [];
              const currentPrice = lineTotal / quantity;
              const bestAlternative = alternatives.reduce((best, alt) => {
                if (!alt || !alt.price) return best;
                if (alt.price >= currentPrice) return best;
                if (!best || alt.price < best.price) return alt;
                return best;
              }, null);
              const savings = bestAlternative ? Math.round((currentPrice - bestAlternative.price) * quantity) : 0;
              return (
                <div className="cart-item" key={medicine._id}>
                  <img
                    src={resolveImageUrl(medicine.imageUrl) || getMedicineImage(medicine)}
                    alt={medicine.name}
                    className="cart-item-icon cart-item-img"
                    loading="lazy"
                  />
                  <div className="cart-item-info">
                    <Link to={`/medicines/${medicine._id}`} className="cart-item-name">
                      {medicine.name}
                      {medicine.requiresPrescription && (
                        <span className="badge badge-rx" title="Requires prescription">Rx</span>
                      )}
                    </Link>
                    <p className="muted-text">{medicine.manufacturer}</p>
                    {medicine.packSizeLabel && <p className="cart-item-pack">{medicine.packSizeLabel}</p>}
                    <p className="cart-item-unit-price">{formatCurrency(lineTotal / quantity)} each</p>
                    {priceChanged && (
                      <p className="cart-item-alert">
                        <AlertTriangle size={14} /> Price changed {priceDelta > 0 ? 'up' : 'down'} by {formatCurrency(Math.abs(priceDelta))}
                      </p>
                    )}
                    {outOfStock && (
                      <p className="cart-item-status badge badge-outofstock">Out of stock</p>
                    )}
                    {onlyLeft && !outOfStock && (
                      <p className="cart-item-status badge badge-warning">Only {medicine.stock} left</p>
                    )}
                    {bestAlternative && savings > 0 && (
                      <div className="cart-item-substitution">
                        <span className="cart-item-substitution-text">
                          Save {formatCurrency(savings)} with generic {bestAlternative.name} from {bestAlternative.manufacturer}
                        </span>
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => handleSwitchToGeneric(medicine, bestAlternative, quantity)}
                        >
                          Switch
                        </button>
                      </div>
                    )}
                  </div>
                <div className="qty-stepper">
                  <button
                    onClick={() => handleQuantityChange(medicine._id, quantity - 1, medicine.stock)}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus size={14} />
                  </button>
                  <span>{quantity}</span>
                  <button
                    onClick={() => handleQuantityChange(medicine._id, quantity + 1, medicine.stock)}
                    disabled={quantity >= medicine.stock}
                    title={quantity >= medicine.stock ? `Only ${medicine.stock} in stock` : 'Add one more'}
                    aria-label="Increase quantity"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <span className="cart-item-total num">{formatCurrency(lineTotal)}</span>
                <div className="cart-item-actions">
                  <button className="link-btn" onClick={async () => {
                    const result = await saveForLater(medicine._id);
                    if (result.success) {
                      showToast(`${medicine.name} saved for later`, 'success');
                    } else {
                      showToast(result.message, 'error');
                    }
                  }}>
                    <Heart size={14} /> Save for later
                  </button>
                  <button className="icon-btn-danger" onClick={() => handleRemove(medicine._id, medicine.name, quantity)} aria-label="Remove item">
                    <Trash2 size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>
            )})}
          </div>


          <div className="coupon-section">
            <h3 className="coupon-section-title"><Tag size={16} /> Coupons &amp; Offers</h3>

            {appliedCoupon ? (
              <div className="coupon-banner">
                <div className="coupon-banner-icon"><Sparkles size={16} /></div>
                <div className="coupon-banner-text">
                  <p className="coupon-banner-code">{appliedCoupon.code} Applied</p>
                  <p className="coupon-banner-savings">Saved {formatCurrency(couponDiscount)} on this order</p>
                </div>
                <button className="link-btn" onClick={removeCoupon}>Remove</button>
              </div>
            ) : (
              <div className="coupon-input-row">
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  value={couponInput}
                  onChange={(e) => { setCouponInput(e.target.value); setCouponError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') attemptApply(couponInput); }}
                />
                <button className="btn-secondary" onClick={() => attemptApply(couponInput)}>Apply</button>
              </div>
            )}
            {couponError && <p className="coupon-error" role="alert">{couponError}</p>}

            <div className="coupon-list">
              {availableCoupons.map((c) => {
                const eligible = (!c.firstOrderOnly || isFirstOrder) && discountedValue >= c.minOrder;
                const active = appliedCoupon?.code === c.code;
                return (
                  <div className={`coupon-card${active ? ' active' : ''}${!eligible ? ' ineligible' : ''}`} key={c.code}>
                    <div className="coupon-card-icon"><Sparkles size={16} /></div>
                    <div className="coupon-card-info">
                      <p className="coupon-card-code">
                        {c.code}
                        {c.firstOrderOnly && <span className="badge badge-success coupon-first-badge">First order free</span>}
                      </p>
                      <p className="muted-text">{c.description}</p>
                    </div>
                    {active ? (
                      <button className="link-btn" onClick={removeCoupon}><X size={13} /> Remove</button>
                    ) : (
                      <button className="link-btn" disabled={!eligible} onClick={() => attemptApply(c.code)}>Apply</button>
                    )}
                  </div>
                );
              })}
            </div>
            {relatedItems.length > 0 && (
              <div className="related-items-strip">
                <div className="related-strip-header">
                  <h3>Frequently bought together</h3>
                  <p className="muted-text">See what other customers added with items in your cart.</p>
                </div>
                <MedicineRow
                  title=""
                  medicines={relatedItems}
                  ratings={relatedRatings}
                  onAddToCart={(medicine) => addToCart(medicine._id, 1).then((result) => {
                    if (result.success) showToast(`${medicine.name} added to cart`, 'success');
                    else showToast(result.message, 'error');
                  })}
                />
              </div>
            )}

            <div className="upi-offers">
              <p className="upi-offers-title"><Smartphone size={14} /> UPI App Offers</p>
              {UPI_OFFERS.map((o) => (
                <div className="upi-offer-row" key={o.app}>
                  <span className="upi-offer-app">{o.app}</span>
                  <span className="muted-text">{o.detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---------------- Right column: checkout + bill ---------------- */}
        <div className="cart-side">
          <div className="cart-checkout-card">
            <div className="cart-checkout-total">
              <span className="muted-text">Cart total</span>
              <span className="cart-checkout-amount num">{formatCurrency(amountToPay)}</span>
            </div>
            <button
              className="btn-primary checkout-btn"
              disabled={loading || cart.items.length === 0}
              onClick={() => navigate('/checkout')}
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>

          <div className="bill-summary-card">
            <h3>Bill Summary</h3>
            <div className="bill-row">
              <span>MRP</span>
              <span className="num">{formatCurrency(mrpTotal)}</span>
            </div>
            {mrpDiscount > 0 && (
              <div className="bill-row discount">
                <span>Discount</span>
                <span className="num">-{formatCurrency(mrpDiscount)}</span>
              </div>
            )}
            <div className="bill-row">
              <span>Discounted Value</span>
              <span className="num">{formatCurrency(discountedValue)}</span>
            </div>
            {appliedCoupon && (
              <div className="bill-row discount">
                <span>Coupon ({appliedCoupon.code})</span>
                <span className="num">-{formatCurrency(couponDiscount)}</span>
              </div>
            )}
            <div className="bill-row">
              <span>GST &amp; taxes</span>
              <span className="num">{formatCurrency(Math.round(discountedValue * 0.05 * 100) / 100)}</span>
            </div>
            <div className="bill-row">
              <span>Delivery Fee</span>
              <span className="num">
                {deliveryFee === 0 ? (
                  <><span className="price-strike">{formatCurrency(DELIVERY_FEE)}</span> Free</>
                ) : formatCurrency(deliveryFee)}
              </span>
            </div>
            <div className="bill-row">
              <span>Platform Fee</span>
              <span className="num">{formatCurrency(PLATFORM_FEE)}</span>
            </div>
            <div className="bill-row total">
              <span>Amount to be paid</span>
              <span className="num">{formatCurrency(amountToPay)}</span>
            </div>

            {totalSaved > 0 && (
              <div className="bill-savings-banner">{formatCurrency(totalSaved)} saved on this order</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Minus, Plus, Trash2, ShoppingBag, Tag, Sparkles, ChevronRight, Smartphone, X,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/format';
import { getMedicineImage } from '../utils/medicineFormImage';
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
  const { cart, updateQuantity, removeFromCart, loading, appliedCoupon, setAppliedCoupon } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [isFirstOrder, setIsFirstOrder] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState('');

  // Used only to unlock the first-order coupon — falls back to "not first
  // order" (safe default) if the request fails for any reason.
  useEffect(() => {
    api
      .get('/orders')
      .then((res) => setIsFirstOrder((res.data.orders || []).length === 0))
      .catch(() => {});
  }, []);

  const handleQuantityChange = async (medicineId, newQty, stock) => {
    if (newQty < 1) return;
    if (newQty > stock) {
      showToast('Not enough stock available', 'error');
      return;
    }
    const result = await updateQuantity(medicineId, newQty);
    if (!result.success) showToast(result.message, 'error');
  };

  const handleRemove = async (medicineId, name) => {
    const result = await removeFromCart(medicineId);
    if (result.success) showToast(`${name} removed from cart`, 'info');
    else showToast(result.message, 'error');
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

  const deliveryFee = discountedValue >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const amountToPay = Math.max(0, discountedValue - couponDiscount + deliveryFee + PLATFORM_FEE);
  const totalSaved = mrpDiscount + couponDiscount;

  const attemptApply = (rawCode) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    const found = COUPONS.find((c) => c.code === code);
    if (!found) {
      setCouponError('Invalid coupon code');
      return;
    }
    if (found.firstOrderOnly && !isFirstOrder) {
      setCouponError(`${found.code} is valid only on your first order`);
      return;
    }
    if (discountedValue < found.minOrder) {
      setCouponError(`Add items worth ${formatCurrency(found.minOrder - discountedValue)} more to unlock ${found.code}`);
      return;
    }
    setAppliedCoupon(found);
    setCouponError('');
    setCouponInput('');
    showToast(`${found.code} applied to your order`, 'success');
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
  };

  if (cart.items.length === 0) {
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

      <div className="cart-grid">
        {/* ---------------- Left column: items + coupons ---------------- */}
        <div className="cart-main">
          <p className="cart-item-count">
            {cart.totalItems} Item{cart.totalItems > 1 ? 's' : ''} in your Cart
          </p>

          <div className="cart-list">
            {cart.items.map(({ medicine, quantity, lineTotal }) => (
              <div className="cart-item" key={medicine._id}>
                <img
                  src={getMedicineImage(medicine)}
                  alt={medicine.name}
                  className="cart-item-icon cart-item-img"
                  loading="lazy"
                />
                <div className="cart-item-info">
                  <Link to={`/medicines/${medicine._id}`} className="cart-item-name">{medicine.name}</Link>
                  <p className="muted-text">{medicine.manufacturer}</p>
                  {medicine.packSizeLabel && <p className="cart-item-pack">{medicine.packSizeLabel}</p>}
                  <p className="cart-item-unit-price">{formatCurrency(lineTotal / quantity)} each</p>
                </div>
                <div className="qty-stepper">
                  <button onClick={() => handleQuantityChange(medicine._id, quantity - 1, medicine.stock)} disabled={quantity <= 1}>
                    <Minus size={14} />
                  </button>
                  <span>{quantity}</span>
                  <button
                    onClick={() => handleQuantityChange(medicine._id, quantity + 1, medicine.stock)}
                    disabled={quantity >= medicine.stock}
                    title={quantity >= medicine.stock ? `Only ${medicine.stock} in stock` : 'Add one more'}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <span className="cart-item-total num">{formatCurrency(lineTotal)}</span>
                <button className="icon-btn-danger" onClick={() => handleRemove(medicine._id, medicine.name)} aria-label="Remove item">
                  <Trash2 size={16} strokeWidth={2} />
                </button>
              </div>
            ))}
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
            {couponError && <p className="coupon-error">{couponError}</p>}

            <div className="coupon-list">
              {COUPONS.map((c) => {
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
            <button className="btn-primary checkout-btn" disabled={loading} onClick={() => navigate('/checkout')}>
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

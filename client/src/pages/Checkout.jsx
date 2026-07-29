import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MapPin, CreditCard, Truck, ShieldAlert, UploadCloud, FileCheck2,
  Smartphone, Wallet, Banknote, Check, ChevronLeft, ChevronRight, Loader2,
  PartyPopper, Clock, ShieldCheck, CheckCircle2,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/format';
import IconInput from '../components/IconInput';

const DELIVERY_FEE = 40;
const FREE_DELIVERY_THRESHOLD = 500;
const PLATFORM_FEE = 12;
const COD_MIN_MRP = 500;

const UPI_ID_REGEX = /^[a-zA-Z0-9.\-_]{2,49}@[a-zA-Z][a-zA-Z0-9]{1,49}$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/;

const luhnValid = (digits) => {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits[i]);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
};

const formatCardNumber = (raw) => raw.replace(/(.{4})/g, '$1 ').trim();

const Checkout = () => {
  const { cart, refreshCart } = useCart();
  const { showToast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const rxItems = cart.items.filter(({ medicine }) => medicine.requiresPrescription);

  // Snapshot whether a prescription step is needed once, at mount — cart.items
  // gets cleared server-side right after the order is placed, and recomputing
  // this from the live (now-empty) cart would otherwise silently drop the
  // 'prescription' step from `steps` and shift stepIndex onto the wrong page.
  const [rxRequiredAtStart] = useState(() => cart.items.some(({ medicine }) => medicine.requiresPrescription));

  const steps = useMemo(
    () => [...(rxRequiredAtStart ? ['prescription'] : []), 'address', 'payment', 'confirm'],
    [rxRequiredAtStart]
  );
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];

  const goNext = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  // ---------------- Prescription ----------------
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [prescription, setPrescription] = useState(null);

  const handleUploadPrescription = async () => {
    if (!prescriptionFile) {
      showToast('Choose a prescription file first', 'error');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('prescription', prescriptionFile);
      const res = await api.post('/prescriptions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPrescription(res.data.prescription);
      showToast('Prescription uploaded — you can continue', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Upload a valid prescription before continuing.', 'error');
    } finally {
      setUploading(false);
    }
  };

  // ---------------- Address ----------------
  const savedAddress = user?.address;
  const hasSavedAddress = Boolean(savedAddress?.line1 || savedAddress?.city);
  const [address, setAddress] = useState({
    line1: savedAddress?.line1 || '',
    city: savedAddress?.city || '',
    state: savedAddress?.state || '',
    pincode: savedAddress?.pincode || '',
    lat: null,
    lng: null,
  });
  const [locating, setLocating] = useState(false);

  const handleAddressChange = (e) => setAddress({ ...address, [e.target.name]: e.target.value });

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('Location access is not supported in this browser', 'error');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAddress((prev) => ({ ...prev, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        showToast('Location captured', 'success');
        setLocating(false);
      },
      () => {
        showToast('Could not access your location. Please allow location permission.', 'error');
        setLocating(false);
      }
    );
  };

  const mapSrc = address.lat && address.lng
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${address.lng - 0.01}%2C${address.lat - 0.01}%2C${address.lng + 0.01}%2C${address.lat + 0.01}&layer=mapnik&marker=${address.lat}%2C${address.lng}`
    : null;

  const handleAddressContinue = () => {
    if (!address.line1.trim() || !address.city.trim()) {
      showToast('Please enter at least an address line and city', 'error');
      return;
    }
    goNext();
  };

  // ---------------- Bill maths (shared by payment + confirm steps) ----------------
  const mrpTotal = useMemo(
    () => cart.items.reduce((sum, { medicine, quantity }) => sum + medicine.price * quantity, 0),
    [cart.items]
  );
  const discountedValue = cart.totalAmount;
  const mrpDiscount = Math.max(0, mrpTotal - discountedValue);
  const deliveryFee = discountedValue >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const amountToPay = Math.max(0, discountedValue + deliveryFee + PLATFORM_FEE);
  const codEligible = mrpTotal > COD_MIN_MRP;

  // ---------------- Payment ----------------
  const [method, setMethod] = useState(null); // 'UPI' | 'Card' | 'Wallet' | 'COD'
  const [paying, setPaying] = useState(false);

  const [upiId, setUpiId] = useState('');
  const [upiVerified, setUpiVerified] = useState(false);
  const [upiError, setUpiError] = useState('');

  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [cardErrors, setCardErrors] = useState({});

  const [walletProvider, setWalletProvider] = useState('PhonePe');
  const [wallet, setWallet] = useState({ mobile: '', pin: '' });
  const [walletErrors, setWalletErrors] = useState({});

  const [placedOrder, setPlacedOrder] = useState(null);
  const [placing, setPlacing] = useState(false);

  const selectMethod = (m) => {
    setMethod(m);
    setUpiVerified(false);
    setUpiError('');
    setCardErrors({});
    setWalletErrors({});
  };

  const handleVerifyUpi = () => {
    const trimmed = upiId.trim();
    if (!UPI_ID_REGEX.test(trimmed)) {
      setUpiError('Enter a valid UPI ID, e.g. name@bank');
      setUpiVerified(false);
      return;
    }
    setUpiError('');
    setUpiVerified(true);
    showToast('UPI ID verified', 'success');
  };

  const handleCardChange = (field, value) => {
    if (field === 'number') value = value.replace(/\D/g, '').slice(0, 16);
    if (field === 'cvv') value = value.replace(/\D/g, '').slice(0, 4);
    if (field === 'expiry') {
      value = value.replace(/[^\d/]/g, '').slice(0, 5);
      if (value.length === 2 && !value.includes('/') && card.expiry.length === 1) value += '/';
    }
    setCard((prev) => ({ ...prev, [field]: value }));
  };

  const validateCard = () => {
    const errors = {};
    const digits = card.number.replace(/\s/g, '');
    if (digits.length < 13 || digits.length > 16 || !luhnValid(digits)) {
      errors.number = 'Enter a valid card number';
    }
    if (!card.name.trim()) {
      errors.name = 'Enter the name on the card';
    }
    const match = /^(\d{2})\/(\d{2})$/.exec(card.expiry);
    if (!match) {
      errors.expiry = 'Use MM/YY';
    } else {
      const month = Number(match[1]);
      const year = 2000 + Number(match[2]);
      const now = new Date();
      const expiryDate = new Date(year, month, 0);
      if (month < 1 || month > 12 || expiryDate < new Date(now.getFullYear(), now.getMonth(), 1)) {
        errors.expiry = 'Card has expired';
      }
    }
    if (!/^\d{3,4}$/.test(card.cvv)) {
      errors.cvv = 'Enter a valid CVV';
    }
    setCardErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateWallet = () => {
    const errors = {};
    if (!MOBILE_REGEX.test(wallet.mobile.trim())) {
      errors.mobile = 'Enter a valid 10-digit mobile number';
    }
    if (!/^\d{4,6}$/.test(wallet.pin)) {
      errors.pin = 'Enter your 4–6 digit wallet PIN';
    }
    setWalletErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePlaceOrder = async (paymentMethod, paymentDetails) => {
    setPlacing(true);
    try {
      const res = await api.post('/orders', {
        address,
        paymentMethod,
        paymentDetails,
        prescriptionId: prescription?._id,
      });
      setPlacedOrder(res.data.order);
      await refreshCart();
      goNext();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not place order', 'error');
    } finally {
      setPlacing(false);
      setPaying(false);
    }
  };

  const handlePay = async () => {
    if (!method) {
      showToast('Choose a payment method', 'error');
      return;
    }
    if (rxItems.length > 0 && !prescription) {
      showToast('Upload a valid prescription before placing this order.', 'error');
      return;
    }

    let paymentDetails = '';
    if (method === 'UPI') {
      if (!upiVerified) {
        handleVerifyUpi();
        return;
      }
      paymentDetails = `UPI · ${upiId.trim()}`;
    } else if (method === 'Card') {
      if (!validateCard()) return;
      const digits = card.number.replace(/\s/g, '');
      paymentDetails = `Card ending ${digits.slice(-4)}`;
    } else if (method === 'Wallet') {
      if (!validateWallet()) return;
      const providerLabel = walletProvider === 'AmazonPay' ? 'Amazon Pay' : 'PhonePe';
      paymentDetails = `${providerLabel} Wallet · ${wallet.mobile.trim()}`;
    } else if (method === 'COD') {
      if (!codEligible) {
        showToast(`Cash on Delivery is only available for orders above ${formatCurrency(COD_MIN_MRP)}`, 'error');
        return;
      }
      paymentDetails = 'Cash on Delivery';
    }

    setPaying(true);
    // Brief simulated processing delay so the "Pay" action feels real before
    // the order is actually created — this demo has no live payment gateway.
    setTimeout(() => {
      handlePlaceOrder(method, paymentDetails);
    }, 1100);
  };

  // ---------------- Guards ----------------
  if (cart.items.length === 0 && step !== 'confirm') {
    return (
      <div className="checkout-page">
        <div className="empty-state">
          <ShieldAlert size={40} strokeWidth={1.5} />
          <h2>Your cart is empty</h2>
          <p className="muted-text">Add a few items before checking out.</p>
          <Link to="/" className="btn-primary">Browse medicines</Link>
        </div>
      </div>
    );
  }

  const stepLabels = {
    prescription: 'Prescription',
    address: 'Address',
    payment: 'Payment',
    confirm: 'Confirmation',
  };

  return (
    <div className="checkout-page">
      <h1 className="page-title">Checkout</h1>

      <div className="checkout-stepper">
        {steps.map((s, i) => (
          <div key={s} className={`checkout-step ${i === stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}>
            <span className="checkout-step-dot">{i < stepIndex ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
            <span className="checkout-step-label">{stepLabels[s]}</span>
            {i < steps.length - 1 && <span className="checkout-step-line" />}
          </div>
        ))}
      </div>

      {/* ---------------- Prescription ---------------- */}
      {step === 'prescription' && (
        <section className="checkout-section checkout-step-panel">
          <h2 className="checkout-section-title"><ShieldAlert size={16} strokeWidth={2} /> Prescription Required</h2>
          <p className="muted-text">
            Your order includes: {rxItems.map(({ medicine }) => medicine.name).join(', ')}.
            These are sold only against a valid, pharmacist-approved prescription.
          </p>

          {prescription ? (
            <p className="success-text">
              <FileCheck2 size={15} strokeWidth={2} /> "{prescription.originalName}" uploaded — awaiting
              pharmacist review. Placing the order now will hold it pending that approval.
            </p>
          ) : (
            <>
              <p className="error-text">Upload a valid prescription before continuing.</p>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setPrescriptionFile(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleUploadPrescription}
                disabled={uploading || !prescriptionFile}
              >
                <UploadCloud size={14} strokeWidth={2} /> {uploading ? 'Uploading…' : 'Upload Prescription'}
              </button>
            </>
          )}

          <div className="checkout-step-actions">
            <span />
            <button className="btn-primary" onClick={goNext} disabled={!prescription}>
              Continue <ChevronRight size={16} />
            </button>
          </div>
        </section>
      )}

      {/* ---------------- Address ---------------- */}
      {step === 'address' && (
        <section className="checkout-section checkout-step-panel">
          <h2 className="checkout-section-title"><MapPin size={16} strokeWidth={2} /> Delivery Address</h2>
          {hasSavedAddress && (
            <p className="muted-text" style={{ marginTop: -6, marginBottom: 12 }}>
              Filled in from your saved profile address. You can edit it below just for this order,
              or update it permanently on your <Link to="/profile">profile page</Link>.
            </p>
          )}
          <label className="field-label">Address line</label>
          <input name="line1" value={address.line1} onChange={handleAddressChange} placeholder="House no, street, area" />
          <label className="field-label">City</label>
          <input name="city" value={address.city} onChange={handleAddressChange} placeholder="City" />
          <label className="field-label">State</label>
          <input name="state" value={address.state} onChange={handleAddressChange} placeholder="State" />
          <label className="field-label">Pincode</label>
          <input name="pincode" value={address.pincode} onChange={handleAddressChange} placeholder="Pincode" />

          <button type="button" className="btn-secondary location-btn" onClick={handleUseCurrentLocation} disabled={locating}>
            <Truck size={14} strokeWidth={2} /> {locating ? 'Locating…' : 'Use current location for delivery'}
          </button>

          {mapSrc && (
            <div className="map-preview">
              <iframe title="Delivery location preview" src={mapSrc} loading="lazy" />
              <p className="muted-text map-note">
                Location captured ({address.lat.toFixed(4)}, {address.lng.toFixed(4)})
              </p>
            </div>
          )}

          <div className="checkout-step-actions">
            {steps[stepIndex - 1] ? (
              <button className="btn-secondary" onClick={goBack}><ChevronLeft size={16} /> Back</button>
            ) : <span />}
            <button className="btn-primary" onClick={handleAddressContinue}>
              Continue <ChevronRight size={16} />
            </button>
          </div>
        </section>
      )}

      {/* ---------------- Payment ---------------- */}
      {step === 'payment' && (
        <div className="checkout-grid">
          <div className="checkout-form-col">
            <section className="checkout-section checkout-step-panel">
              <h2 className="checkout-section-title"><CreditCard size={16} strokeWidth={2} /> Payment Method</h2>

              <div className="payment-method-grid">
                <button
                  type="button"
                  className={`payment-method-tile ${method === 'UPI' ? 'active' : ''}`}
                  onClick={() => selectMethod('UPI')}
                >
                  <Smartphone size={20} strokeWidth={2} />
                  <span>UPI</span>
                </button>
                <button
                  type="button"
                  className={`payment-method-tile ${method === 'Card' ? 'active' : ''}`}
                  onClick={() => selectMethod('Card')}
                >
                  <CreditCard size={20} strokeWidth={2} />
                  <span>Credit / Debit Card</span>
                </button>
                <button
                  type="button"
                  className={`payment-method-tile ${method === 'Wallet' ? 'active' : ''}`}
                  onClick={() => selectMethod('Wallet')}
                >
                  <Wallet size={20} strokeWidth={2} />
                  <span>Wallet</span>
                </button>
                <button
                  type="button"
                  className={`payment-method-tile ${method === 'COD' ? 'active' : ''} ${!codEligible ? 'disabled' : ''}`}
                  onClick={() => codEligible && selectMethod('COD')}
                  disabled={!codEligible}
                  title={!codEligible ? `Available on orders above ${formatCurrency(COD_MIN_MRP)} MRP` : undefined}
                >
                  <Banknote size={20} strokeWidth={2} />
                  <span>Cash on Delivery</span>
                  {!codEligible && <span className="payment-method-note">Above {formatCurrency(COD_MIN_MRP)} MRP</span>}
                </button>
              </div>

              {method === 'UPI' && (
                <div className="payment-method-form">
                  <label className="field-label">UPI ID</label>
                  <div className="upi-verify-row">
                    <IconInput
                      icon={Smartphone}
                      placeholder="yourname@bank"
                      value={upiId}
                      onChange={(e) => { setUpiId(e.target.value); setUpiVerified(false); setUpiError(''); }}
                    />
                    <button type="button" className="btn-secondary" onClick={handleVerifyUpi} disabled={!upiId.trim()}>
                      Verify
                    </button>
                  </div>
                  {upiError && <p className="error-text small">{upiError}</p>}
                  {upiVerified && <p className="success-text small"><CheckCircle2 size={14} strokeWidth={2} /> UPI ID verified</p>}
                </div>
              )}

              {method === 'Card' && (
                <div className="payment-method-form">
                  <label className="field-label">Card number</label>
                  <input
                    inputMode="numeric"
                    placeholder="1234 5678 9012 3456"
                    value={formatCardNumber(card.number)}
                    onChange={(e) => handleCardChange('number', e.target.value)}
                  />
                  {cardErrors.number && <p className="error-text small">{cardErrors.number}</p>}

                  <label className="field-label">Name on card</label>
                  <input
                    placeholder="As printed on the card"
                    value={card.name}
                    onChange={(e) => setCard((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  {cardErrors.name && <p className="error-text small">{cardErrors.name}</p>}

                  <div className="form-grid">
                    <div>
                      <label className="field-label">Expiry (MM/YY)</label>
                      <input placeholder="MM/YY" value={card.expiry} onChange={(e) => handleCardChange('expiry', e.target.value)} />
                      {cardErrors.expiry && <p className="error-text small">{cardErrors.expiry}</p>}
                    </div>
                    <div>
                      <label className="field-label">CVV</label>
                      <input type="password" inputMode="numeric" placeholder="•••" value={card.cvv} onChange={(e) => handleCardChange('cvv', e.target.value)} />
                      {cardErrors.cvv && <p className="error-text small">{cardErrors.cvv}</p>}
                    </div>
                  </div>
                </div>
              )}

              {method === 'Wallet' && (
                <div className="payment-method-form">
                  <label className="field-label">Wallet</label>
                  <div className="wallet-provider-row">
                    <button
                      type="button"
                      className={`wallet-provider-tile ${walletProvider === 'PhonePe' ? 'active' : ''}`}
                      onClick={() => setWalletProvider('PhonePe')}
                    >
                      PhonePe Wallet
                    </button>
                    <button
                      type="button"
                      className={`wallet-provider-tile ${walletProvider === 'AmazonPay' ? 'active' : ''}`}
                      onClick={() => setWalletProvider('AmazonPay')}
                    >
                      Amazon Pay Wallet
                    </button>
                  </div>

                  <label className="field-label">Registered mobile number</label>
                  <input
                    inputMode="numeric"
                    placeholder="10-digit mobile number"
                    value={wallet.mobile}
                    onChange={(e) => setWallet((prev) => ({ ...prev, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  />
                  {walletErrors.mobile && <p className="error-text small">{walletErrors.mobile}</p>}

                  <label className="field-label">Wallet PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="4–6 digit PIN"
                    value={wallet.pin}
                    onChange={(e) => setWallet((prev) => ({ ...prev, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  />
                  {walletErrors.pin && <p className="error-text small">{walletErrors.pin}</p>}
                </div>
              )}

              {method === 'COD' && (
                <div className="payment-method-form">
                  <p className="muted-text">
                    Pay in cash when your order arrives. Please keep the exact amount handy where possible.
                  </p>
                </div>
              )}

              <div className="checkout-step-actions">
                <button className="btn-secondary" onClick={goBack}><ChevronLeft size={16} /> Back</button>
                <button className="btn-primary" onClick={handlePay} disabled={!method || paying || placing}>
                  {paying || placing ? <><Loader2 size={16} className="spin" /> Processing…</> : (
                    method === 'COD' ? 'Place Order' : `Pay ${formatCurrency(amountToPay)}`
                  )}
                </button>
              </div>
            </section>
          </div>

          <div className="checkout-summary-col">
            <section className="checkout-section">
              <h2 className="checkout-section-title">Bill Summary</h2>
              <div className="bill-row"><span>MRP</span><span className="num">{formatCurrency(mrpTotal)}</span></div>
              {mrpDiscount > 0 && (
                <div className="bill-row discount"><span>Discount</span><span className="num">-{formatCurrency(mrpDiscount)}</span></div>
              )}
              <div className="bill-row"><span>Delivery Fee</span>
                <span className="num">{deliveryFee === 0 ? 'Free' : formatCurrency(deliveryFee)}</span>
              </div>
              <div className="bill-row"><span>Platform Fee</span><span className="num">{formatCurrency(PLATFORM_FEE)}</span></div>
              <div className="bill-row total"><span>Amount to be paid</span><span className="num">{formatCurrency(amountToPay)}</span></div>
            </section>
          </div>
        </div>
      )}

      {/* ---------------- Confirmation ---------------- */}
      {step === 'confirm' && placedOrder && (() => {
        const orderDeliveryFee = placedOrder.totalAmount >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
        const orderAmountPaid = placedOrder.totalAmount + orderDeliveryFee + PLATFORM_FEE;
        return (
        <div className="checkout-grid">
          <div className="checkout-form-col">
            <section className="checkout-section checkout-step-panel confirm-hero">
              <div className="confirm-hero-icon"><PartyPopper size={28} strokeWidth={2} /></div>
              <h2>Order placed!</h2>
              <p className="muted-text">Invoice {placedOrder.invoiceNumber}</p>

              <div className="confirm-eta">
                <Clock size={16} strokeWidth={2} />
                Arriving in an estimated <strong>{placedOrder.estimatedDeliveryMinutes} minutes</strong>
              </div>

              {placedOrder.prescriptionRequired && (
                <p className="muted-text" style={{ marginTop: 10 }}>
                  <ShieldCheck size={14} strokeWidth={2} className="inline-icon" /> Your uploaded prescription is pending pharmacist review — this order will start processing once it's approved.
                </p>
              )}
            </section>

            <section className="checkout-section">
              <h2 className="checkout-section-title"><MapPin size={16} strokeWidth={2} /> Delivering to</h2>
              <p>{placedOrder.address.line1}</p>
              <p className="muted-text">
                {[placedOrder.address.city, placedOrder.address.state, placedOrder.address.pincode].filter(Boolean).join(', ')}
              </p>
            </section>

            <section className="checkout-section">
              <h2 className="checkout-section-title"><CreditCard size={16} strokeWidth={2} /> Payment</h2>
              <p>{placedOrder.paymentDetails || placedOrder.paymentMethod}</p>
              <span className={`badge ${placedOrder.paymentStatus === 'Paid' ? 'badge-success' : 'badge-status'}`}>
                {placedOrder.paymentStatus}
              </span>
            </section>
          </div>

          <div className="checkout-summary-col">
            <section className="checkout-section">
              <h2 className="checkout-section-title">Bill Summary</h2>
              {placedOrder.items.map((item, i) => (
                <div className="summary-line" key={i}>
                  <span>{item.name} × {item.quantity}</span>
                  <span>{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
              <div className="bill-row"><span>Delivery Fee</span>
                <span className="num">{orderDeliveryFee === 0 ? 'Free' : formatCurrency(orderDeliveryFee)}</span>
              </div>
              <div className="bill-row"><span>Platform Fee</span><span className="num">{formatCurrency(PLATFORM_FEE)}</span></div>
              <div className="bill-row total"><span>Amount Paid</span><span className="num">{formatCurrency(orderAmountPaid)}</span></div>

              <button className="btn-primary place-order-btn" onClick={() => navigate(`/orders/${placedOrder._id}`)}>
                View Order
              </button>
              <button className="btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={() => navigate('/')}>
                Continue Shopping
              </button>
            </section>
          </div>
        </div>
        );
      })()}
    </div>
  );
};

export default Checkout;

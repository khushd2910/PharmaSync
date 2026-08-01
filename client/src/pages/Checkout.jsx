import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MapPin, CreditCard, Truck, ShieldAlert, UploadCloud, FileCheck2,
  Smartphone, Wallet, Banknote, Check, ChevronLeft, ChevronRight, Loader2,
  PartyPopper, ShieldCheck, CheckCircle2, MessageCircle,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/format';
import { computeCouponDiscount } from '../utils/coupons';
import { buildInvoiceMailto, buildOrderShareLinks, getOrderTimelinePreview } from '../utils/checkoutConfirmation';
import IconInput from '../components/IconInput';

const DELIVERY_FEE = 40;
const FREE_DELIVERY_THRESHOLD = 500;
const PLATFORM_FEE = 12;
const COD_MIN_MRP = 500;

// A UPI ID (VPA) is username@handle. The handle is NOT a free-form domain —
// it's one of a closed set of PSP/bank handles that NPCI issues to banks and
// payment apps. So "letters@letters" being syntactically shaped like an
// address (which the old regex accepted — it happily passed things like
// name@gmail.com) isn't the same as it being a real UPI ID. This checks both
// halves the way UPI apps actually do: the username's allowed characters and
// length, and the handle against the common PSP/bank handles seen in
// practice. NPCI onboards new handles over time so this list isn't
// exhaustive, but it now catches the obvious non-UPI mistakes (typing an
// email, a random word, a phone number with no handle at all) instead of
// waving them through.
const UPI_USERNAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9.\-_]{0,254}[a-zA-Z0-9]$/;
const UPI_HANDLE_SHAPE_REGEX = /^[a-zA-Z][a-zA-Z0-9.]{1,63}$/;
const KNOWN_UPI_HANDLES = new Set([
  // Google Pay
  'okhdfcbank', 'okicici', 'oksbi', 'okaxis', 'okbizaxis', 'okkotak', 'okyesbank', 'okhdfc',
  // PhonePe
  'ybl', 'ibl', 'axl', 'phonepe',
  // Paytm
  'paytm', 'ptaxis', 'ptsbi', 'ptyes',
  // Amazon Pay
  'apl', 'rapl', 'yapl',
  // BHIM / NPCI
  'upi',
  // Other apps
  'jio', 'jiopay', 'freecharge', 'airtel', 'airtelpaymentsbank', 'slice', 'fam',
  'waaxis', 'waicici', 'wahdfcbank', 'wasbi', 'pockets', 'jupiteraxis', 'timecosmos',
  'yesg', 'csbpay', 'fifederal',
  // Bank handles
  'sbi', 'hdfcbank', 'icici', 'axisbank', 'kotak', 'idfcbank', 'indus', 'indusind',
  'federal', 'yesbank', 'pnb', 'unionbank', 'unionbankofindia', 'cnrb', 'canara',
  'centralbank', 'cbin', 'boi', 'bandhan', 'bandhanbank', 'rbl', 'sib', 'southindianbank',
  'karb', 'karnatakabank', 'dcb', 'dcbbank', 'idbi', 'idbibank', 'uco', 'ucobank',
  'allbank', 'uboi', 'barodampay', 'equitas', 'dbs', 'hsbc', 'citi', 'citibank', 'scb',
  'jkb', 'nsdl', 'kvb', 'kvbank', 'tjsb',
]);

const isValidUpiId = (value) => {
  const trimmed = (value || '').trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0 || trimmed.indexOf('@', atIndex + 1) !== -1) return false; // exactly one '@'
  const username = trimmed.slice(0, atIndex);
  const handle = trimmed.slice(atIndex + 1);
  if (!UPI_USERNAME_REGEX.test(username)) return false;
  if (!UPI_HANDLE_SHAPE_REGEX.test(handle)) return false;
  return KNOWN_UPI_HANDLES.has(handle.toLowerCase());
};
const MOBILE_REGEX = /^[6-9]\d{9}$/;
// Indian PIN codes are always 6 digits and never start with 0.
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
const CHECKOUT_STORAGE_KEY = 'pharmasync.checkout.state';
const PAYMENT_PREFERENCE_KEY = 'pharmasync.savedPaymentMethod';

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

// IIN (Issuer Identification Number) prefix ranges actually in use by cards
// issued in India, so the CVV length rule and "we don't accept this network"
// check are both grounded in the real numbers rather than guessed.
const getCardNetwork = (digits) => {
  if (/^4/.test(digits)) return 'Visa';
  if (/^(5[1-5]|2(2[2-9][1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720))/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^(60|65|81|82|508|353|356)/.test(digits)) return 'RuPay';
  if (/^3(0[0-5]|[68])/.test(digits)) return 'Diners Club';
  return 'Unknown';
};

const getCvvLength = (network) => (network === 'Amex' ? 4 : 3);

const formatCardNumber = (raw) => raw.replace(/(.{4})/g, '$1 ').trim();

const getStoredPaymentPreference = () => {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(PAYMENT_PREFERENCE_KEY));
  } catch {
    return null;
  }
};

const maskUpiId = (upiId) => {
  const trimmed = upiId.trim();
  if (!trimmed) return 'not saved';
  const [name, domain] = trimmed.split('@');
  if (!domain) return `${trimmed.slice(0, 2)}****`;
  return `${name.slice(0, 2)}****@${domain}`;
};

const maskCard = (cardNumber) => {
  const digits = cardNumber.replace(/\D/g, '');
  if (!digits) return 'not saved';
  return `•••• ${digits.slice(-4)}`;
};

const maskMobile = (mobile) => {
  if (!mobile) return 'not saved';
  return `••••${mobile.slice(-2)}`;
};

const Checkout = () => {
  const { cart, refreshCart, appliedCoupon, cartLoaded } = useCart();
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
  // Pre-fill from whichever saved address is marked default — falling back
  // to the first saved address if none is explicitly flagged yet.
  const savedAddress = (user?.addresses || []).find((a) => a.isDefault) || user?.addresses?.[0];
  const hasSavedAddress = Boolean(savedAddress?.line1 || savedAddress?.city);
  const [address, setAddress] = useState({
    line1: savedAddress?.line1 || '',
    city: savedAddress?.city || '',
    state: savedAddress?.state || '',
    pincode: savedAddress?.pincode || '',
    lat: savedAddress?.lat ?? null,
    lng: savedAddress?.lng ?? null,
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
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Capture the coordinates immediately so the map preview shows up
        // even if the reverse-geocoding lookup below is slow or fails.
        setAddress((prev) => ({ ...prev, lat: latitude, lng: longitude }));

        try {
          // Turn the coordinates into an actual street address. This was the
          // missing piece — capturing lat/lng alone never touched the
          // address line/city/state/pincode fields, so "use current
          // location" looked like it did nothing useful. Nominatim (OSM's
          // free reverse-geocoding API, same provider as the map preview
          // below) needs no API key for this volume of lookups.
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=18`,
            { headers: { Accept: 'application/json' } }
          );
          if (!res.ok) throw new Error('reverse geocode request failed');
          const data = await res.json();
          const a = data.address || {};

          const houseNumber = a.house_number ? `${a.house_number}, ` : '';
          const street = a.road || a.pedestrian || a.footway || a.neighbourhood || a.suburb || '';
          const line1 = `${houseNumber}${street}`.trim() || (data.display_name || '').split(',')[0] || '';
          const city = a.city || a.town || a.village || a.municipality || a.county || '';
          const state = a.state || '';
          const pincode = (a.postcode || '').replace(/\D/g, '').slice(0, 6);

          setAddress((prev) => ({
            ...prev,
            lat: latitude,
            lng: longitude,
            line1: line1 || prev.line1,
            city: city || prev.city,
            state: state || prev.state,
            pincode: pincode.length === 6 ? pincode : prev.pincode,
          }));
          showToast('Location captured — address filled in, please double-check it', 'success');
        } catch {
          showToast('Location captured, but the address could not be auto-filled — please enter it manually', 'error');
        } finally {
          setLocating(false);
        }
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
    if (!PINCODE_REGEX.test(address.pincode.trim())) {
      showToast('Enter a valid 6-digit pincode', 'error');
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
  const couponDiscount = useMemo(
    () => computeCouponDiscount(appliedCoupon, discountedValue),
    [appliedCoupon, discountedValue]
  );
  const deliveryFee = discountedValue >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const amountToPay = Math.max(0, discountedValue - couponDiscount + deliveryFee + PLATFORM_FEE);
  const codEligible = mrpTotal > COD_MIN_MRP;

  // ---------------- Payment ----------------
  const [method, setMethod] = useState(null); // 'UPI' | 'Card' | 'Wallet' | 'COD'
  const [paying, setPaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [saveMethod, setSaveMethod] = useState(() => Boolean(getStoredPaymentPreference()?.enabled));
  const [savedMethodPreference, setSavedMethodPreference] = useState(getStoredPaymentPreference);

  const [upiId, setUpiId] = useState('');
  const [upiChecked, setUpiChecked] = useState(false);
  const [upiError, setUpiError] = useState('');

  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [cardErrors, setCardErrors] = useState({});

  const [walletProvider, setWalletProvider] = useState('PhonePe');
  const [walletMobile, setWalletMobile] = useState('');
  const [walletError, setWalletError] = useState('');
  const [walletRequestSent, setWalletRequestSent] = useState(false);

  const [placedOrder, setPlacedOrder] = useState(null);
  const [billSnapshot, setBillSnapshot] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [shareLinks, setShareLinks] = useState(null);

  const selectMethod = (m) => {
    setMethod(m);
    setUpiChecked(false);
    setUpiError('');
    setCardErrors({});
    setWalletError('');
    setWalletRequestSent(false);
  };

  const handleCheckUpiFormat = () => {
    const trimmed = upiId.trim();
    const atIndex = trimmed.indexOf('@');
    if (atIndex <= 0 || trimmed.indexOf('@', atIndex + 1) !== -1) {
      setUpiError('Enter a valid UPI ID, e.g. name@oksbi');
      setUpiChecked(false);
      return;
    }
    if (!UPI_USERNAME_REGEX.test(trimmed.slice(0, atIndex))) {
      setUpiError('UPI ID before the @ can only have letters, numbers, dots, hyphens or underscores');
      setUpiChecked(false);
      return;
    }
    if (!isValidUpiId(trimmed)) {
      setUpiError(`"@${trimmed.slice(atIndex + 1)}" isn't a bank/UPI app handle we recognise — check for typos`);
      setUpiChecked(false);
      return;
    }
    setUpiError('');
    setUpiChecked(true);
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
    const network = getCardNetwork(digits);

    if (digits.length < 13 || digits.length > 16 || !luhnValid(digits)) {
      errors.number = 'Enter a valid card number';
    } else if (network === 'Unknown') {
      errors.number = 'This card network is not supported';
    }

    if (!card.name.trim()) {
      errors.name = 'Enter the name on the card';
    } else if (!/^[a-zA-Z\s.'-]{2,50}$/.test(card.name.trim())) {
      errors.name = 'Name should only contain letters';
    }

    const match = /^(\d{2})\/(\d{2})$/.exec(card.expiry);
    if (!match) {
      errors.expiry = 'Use MM/YY';
    } else {
      const month = Number(match[1]);
      const year = 2000 + Number(match[2]);
      const now = new Date();
      const expiryDate = new Date(year, month, 0);
      if (month < 1 || month > 12) {
        errors.expiry = 'Enter a valid month';
      } else if (expiryDate < new Date(now.getFullYear(), now.getMonth(), 1)) {
        errors.expiry = 'Card has expired';
      } else if (year > now.getFullYear() + 10) {
        errors.expiry = 'Enter a valid expiry date';
      }
    }

    const requiredCvvLength = getCvvLength(network);
    if (!new RegExp(`^\\d{${requiredCvvLength}}$`).test(card.cvv)) {
      errors.cvv = `Enter a valid ${requiredCvvLength}-digit CVV`;
    }

    setCardErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateWalletMobile = () => {
    if (!MOBILE_REGEX.test(walletMobile.trim())) {
      setWalletError('Enter a valid 10-digit mobile number');
      return false;
    }
    setWalletError('');
    return true;
  };

  // Real wallet/UPI apps never ask the merchant's checkout page for your
  // PIN — the PIN is entered only inside the wallet app when you approve
  // the payment request. This simulates that request-and-approve step
  // instead of collecting a PIN here.
  const handleSendWalletRequest = () => {
    if (!validateWalletMobile()) return;
    setWalletRequestSent(true);
    const providerLabel = walletProvider === 'AmazonPay' ? 'Amazon Pay' : 'PhonePe';
    showToast(`Payment request sent to your ${providerLabel} app — approve it there to continue.`, 'info');
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!saveMethod || !method) {
      localStorage.removeItem(PAYMENT_PREFERENCE_KEY);
      setSavedMethodPreference(null);
      return;
    }

    const maskedPreference = (() => {
      if (method === 'UPI') return { method, detail: maskUpiId(upiId) };
      if (method === 'Card') return { method, detail: maskCard(card.number) };
      if (method === 'Wallet') return { method, detail: maskMobile(walletMobile) };
      if (method === 'COD') return { method, detail: 'Cash on Delivery' };
      return { method, detail: 'saved' };
    })();

    const payload = { enabled: true, method, detail: maskedPreference.detail };
    localStorage.setItem(PAYMENT_PREFERENCE_KEY, JSON.stringify(payload));
    setSavedMethodPreference(payload);
  }, [saveMethod, method, upiId, card.number, walletMobile]);

  useEffect(() => {
    if (!method && savedMethodPreference) {
      setMethod(savedMethodPreference.method);
    }
  }, [method, savedMethodPreference]);

  const handlePlaceOrder = async (paymentMethod, paymentDetails) => {
    setPlacing(true);
    try {
      const res = await api.post('/orders', {
        address,
        paymentMethod,
        paymentDetails,
        couponCode: appliedCoupon?.code || null,
        prescriptionId: prescription?._id,
      });
      setPlacedOrder(res.data.order);
      const orderUrl = `${window.location.origin}/orders/${res.data.order._id}`;
      setShareLinks(buildOrderShareLinks(res.data.order, orderUrl));
      // Snapshot the bill as computed right now — cart.items (and therefore
      // mrpTotal/couponDiscount/amountToPay above) get zeroed out the moment
      // refreshCart() below picks up the now-empty server cart, and the
      // Confirmation step still needs the coupon-inclusive numbers.
      setBillSnapshot({ mrpTotal, mrpDiscount, appliedCoupon, couponDiscount, deliveryFee, amountToPay });
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(CHECKOUT_STORAGE_KEY);
      }
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
    if (submittingRef.current) return;
    if (!agreeTerms) {
      showToast('Please accept the terms and refund policy before paying', 'error');
      return;
    }
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
      if (!upiChecked) {
        handleCheckUpiFormat();
        return;
      }
      paymentDetails = `UPI · ${upiId.trim()}`;
    } else if (method === 'Card') {
      if (!validateCard()) return;
      const digits = card.number.replace(/\s/g, '');
      paymentDetails = `Card ending ${digits.slice(-4)}`;
    } else if (method === 'Wallet') {
      if (!walletRequestSent) {
        handleSendWalletRequest();
        return;
      }
      const providerLabel = walletProvider === 'AmazonPay' ? 'Amazon Pay' : 'PhonePe';
      paymentDetails = `${providerLabel} Wallet · ${walletMobile.trim()}`;
    } else if (method === 'COD') {
      if (!codEligible) {
        showToast(`Cash on Delivery is only available for orders above ${formatCurrency(COD_MIN_MRP)}`, 'error');
        return;
      }
      paymentDetails = 'Cash on Delivery';
    }

    submittingRef.current = true;
    setSubmitting(true);
    setPaying(true);
    // Brief simulated processing delay so the "Pay" action feels real before
    // the order is actually created — this demo has no live payment gateway.
    setTimeout(() => {
      const paymentSucceeded = Math.random() > 0.2;
      if (!paymentSucceeded) {
        showToast('Payment was declined by the simulated gateway. Please try again.', 'error');
        submittingRef.current = false;
        setSubmitting(false);
        setPaying(false);
        return;
      }
      handlePlaceOrder(method, paymentDetails);
    }, 1100);
  };

  // ---------------- Guards ----------------
  if (!cartLoaded) {
    return (
      <div className="checkout-page">
        <div className="cart-skeleton">
          <div className="skeleton-line" style={{ width: '42%' }} />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      </div>
    );
  }

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

      <div className="checkout-stepper" role="list">
        {steps.map((s, i) => (
          <div
            key={s}
            role="listitem"
            aria-current={i === stepIndex ? 'step' : undefined}
            className={`checkout-step ${i === stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}
          >
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
          <input
            name="pincode"
            inputMode="numeric"
            value={address.pincode}
            onChange={(e) => setAddress((prev) => ({ ...prev, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
            placeholder="6-digit pincode"
          />

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
              <p className="muted-text small" style={{ marginBottom: 12 }}>
                Payment processing is demo-only. No real payment gateway is connected in this storefront.
              </p>

              <div className={`payment-form-lock ${submitting ? 'locked' : ''}`}>
                <div role="radiogroup" aria-label="Payment method selection" className="payment-method-grid">
                  <button
                  type="button"
                  role="radio"
                  aria-checked={method === 'UPI'}
                  aria-label="Use UPI payment"
                  className={`payment-method-tile ${method === 'UPI' ? 'active' : ''}`}
                  onClick={() => selectMethod('UPI')}
                  disabled={submitting}
                >
                  <Smartphone size={20} strokeWidth={2} />
                  <span>UPI</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={method === 'Card'}
                  aria-label="Use card payment"
                  className={`payment-method-tile ${method === 'Card' ? 'active' : ''}`}
                  onClick={() => selectMethod('Card')}
                  disabled={submitting}
                >
                  <CreditCard size={20} strokeWidth={2} />
                  <span>Credit / Debit Card</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={method === 'Wallet'}
                  aria-label="Use wallet payment"
                  className={`payment-method-tile ${method === 'Wallet' ? 'active' : ''}`}
                  onClick={() => selectMethod('Wallet')}
                  disabled={submitting}
                >
                  <Wallet size={20} strokeWidth={2} />
                  <span>Wallet</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={method === 'COD'}
                  aria-label="Use cash on delivery"
                  className={`payment-method-tile ${method === 'COD' ? 'active' : ''} ${!codEligible ? 'disabled' : ''}`}
                  onClick={() => codEligible && selectMethod('COD')}
                  disabled={!codEligible || submitting}
                  title={!codEligible ? `Available on orders above ${formatCurrency(COD_MIN_MRP)} MRP` : undefined}
                  aria-disabled={!codEligible || submitting}
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
                      onChange={(e) => { setUpiId(e.target.value); setUpiChecked(false); setUpiError(''); }}
                    />
                    <button type="button" className="btn-secondary" onClick={handleCheckUpiFormat} disabled={!upiId.trim() || submitting}>
                      Check ID
                    </button>
                  </div>
                  {upiError && <p className="error-text small">{upiError}</p>}
                  {upiChecked && <p className="success-text small"><CheckCircle2 size={14} strokeWidth={2} /> Looks good — you'll get a payment request on your UPI app</p>}
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
                    disabled={submitting}
                  />
                  {(() => {
                    const digits = card.number.replace(/\s/g, '');
                    const network = digits.length >= 4 ? getCardNetwork(digits) : null;
                    return network && network !== 'Unknown' && !cardErrors.number ? (
                      <p className="muted-text small">{network} card detected</p>
                    ) : null;
                  })()}
                  {cardErrors.number && <p className="error-text small">{cardErrors.number}</p>}

                  <label className="field-label">Name on card</label>
                  <input
                    placeholder="As printed on the card"
                    value={card.name}
                    onChange={(e) => setCard((prev) => ({ ...prev, name: e.target.value }))}
                    disabled={submitting}
                  />
                  {cardErrors.name && <p className="error-text small">{cardErrors.name}</p>}

                  <div className="form-grid">
                    <div>
                      <label className="field-label">Expiry (MM/YY)</label>
                      <input placeholder="MM/YY" value={card.expiry} onChange={(e) => handleCardChange('expiry', e.target.value)} disabled={submitting} />
                      {cardErrors.expiry && <p className="error-text small">{cardErrors.expiry}</p>}
                    </div>
                    <div>
                      <label className="field-label">CVV</label>
                      <input type="password" inputMode="numeric" placeholder="•••" value={card.cvv} onChange={(e) => handleCardChange('cvv', e.target.value)} disabled={submitting} />
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
                      onClick={() => { setWalletProvider('PhonePe'); setWalletRequestSent(false); }}
                      disabled={submitting}
                    >
                      PhonePe Wallet
                    </button>
                    <button
                      type="button"
                      className={`wallet-provider-tile ${walletProvider === 'AmazonPay' ? 'active' : ''}`}
                      onClick={() => { setWalletProvider('AmazonPay'); setWalletRequestSent(false); }}
                      disabled={submitting}
                    >
                      Amazon Pay Wallet
                    </button>
                  </div>

                  <label className="field-label">Registered mobile number</label>
                  <div className="upi-verify-row">
                    <input
                      inputMode="numeric"
                      placeholder="10-digit mobile number"
                      value={walletMobile}
                      onChange={(e) => { setWalletMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); setWalletRequestSent(false); }}
                      disabled={submitting}
                    />
                    <button type="button" className="btn-secondary" onClick={handleSendWalletRequest} disabled={!walletMobile.trim() || submitting}>
                      Send request
                    </button>
                  </div>
                  {walletError && <p className="error-text small">{walletError}</p>}
                  {walletRequestSent && !walletError && (
                    <p className="success-text small">
                      <CheckCircle2 size={14} strokeWidth={2} /> Request sent — approve it in your {walletProvider === 'AmazonPay' ? 'Amazon Pay' : 'PhonePe'} app, then click Pay below.
                    </p>
                  )}
                  <p className="muted-text small" style={{ marginTop: 6 }}>
                    We'll never ask for your wallet PIN here — you only enter it inside your own wallet app.
                  </p>
                </div>
              )}

              {method === 'COD' && (
                <div className="payment-method-form">
                  <p className="muted-text">
                    Pay in cash when your order arrives. Please keep the exact amount handy where possible.
                    A delivery OTP (sent closer to the delivery date) will be shared with the delivery agent
                    to confirm receipt — no code is needed to place this order.
                  </p>
                </div>
              )}

              <label className="payment-terms-row">
                <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} disabled={submitting} />
                <span>I agree to the terms and refund policy before placing this order.</span>
              </label>

              {savedMethodPreference && (
                <p className="muted-text small" style={{ marginTop: 10 }}>
                  Saved preference: {savedMethodPreference.method} · {savedMethodPreference.detail}
                </p>
              )}

              <div className="checkout-step-actions">
                <button className="btn-secondary" onClick={goBack} disabled={submitting}><ChevronLeft size={16} /> Back</button>
                <label className="payment-save-row">
                  <input type="checkbox" checked={saveMethod} onChange={(e) => setSaveMethod(e.target.checked)} disabled={submitting} />
                  <span>Save this method for next time</span>
                </label>
                <button className="btn-primary" onClick={handlePay} disabled={!method || paying || placing || submitting || !agreeTerms}>
                  {paying || placing ? <><Loader2 size={16} className="spin" /> Processing…</> : (
                    method === 'COD' ? 'Place Order' :
                    method === 'Wallet' && !walletRequestSent ? 'Send Payment Request' :
                    `Pay ${formatCurrency(amountToPay)}`
                  )}
                </button>
              </div>
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
              {appliedCoupon && (
                <div className="bill-row discount"><span>Coupon ({appliedCoupon.code})</span><span className="num">-{formatCurrency(couponDiscount)}</span></div>
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
      {step === 'confirm' && placedOrder && billSnapshot && (
        <div className="checkout-grid">
          <div className="checkout-form-col">
            <section className="checkout-section checkout-step-panel confirm-hero">
              <div className="confirm-hero-icon"><PartyPopper size={28} strokeWidth={2} /></div>
              <h2>Order placed!</h2>
              <p className="muted-text">Invoice {placedOrder.invoiceNumber}</p>

              <div className="confirm-savings-banner">
                You saved <strong>{formatCurrency(billSnapshot.mrpDiscount + billSnapshot.couponDiscount)}</strong> across MRP and coupon savings.
              </div>

              <div className="confirm-actions-row">
                <a
                  className="btn-secondary"
                  href={buildInvoiceMailto(placedOrder, import.meta.env.VITE_API_URL || 'http://localhost:5000/api')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileCheck2 size={14} strokeWidth={2} /> Email invoice
                </a>
                <a
                  className="btn-secondary"
                  href={`${(import.meta.env.VITE_API_URL || 'http://localhost:5000/api')}/orders/${placedOrder._id}/invoice`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileCheck2 size={14} strokeWidth={2} /> Download PDF
                </a>
              </div>

              <div className="confirm-share-row">
                <a className="btn-secondary" href={shareLinks?.sms}>
                  <Smartphone size={14} strokeWidth={2} /> Share via SMS
                </a>
                <a className="btn-secondary" href={shareLinks?.whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={14} strokeWidth={2} /> Share via WhatsApp
                </a>
              </div>

              <div className="confirm-timeline-card">
                <div className="confirm-timeline-title">Tracking preview</div>
                <div className="confirm-timeline-list">
                  {getOrderTimelinePreview(placedOrder).map((step) => (
                    <div key={step.label} className={`confirm-timeline-step ${step.current ? 'current' : ''} ${step.completed ? 'completed' : ''}`}>
                      <span className="confirm-timeline-dot" />
                      <div>
                        <div className="confirm-timeline-label">{step.label}</div>
                        <div className="confirm-timeline-description">{step.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
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
              {billSnapshot.mrpDiscount > 0 && (
                <div className="bill-row discount"><span>Discount</span><span className="num">-{formatCurrency(billSnapshot.mrpDiscount)}</span></div>
              )}
              {billSnapshot.appliedCoupon && (
                <div className="bill-row discount">
                  <span>Coupon ({billSnapshot.appliedCoupon.code})</span>
                  <span className="num">-{formatCurrency(billSnapshot.couponDiscount)}</span>
                </div>
              )}
              <div className="bill-row"><span>Delivery Fee</span>
                <span className="num">{billSnapshot.deliveryFee === 0 ? 'Free' : formatCurrency(billSnapshot.deliveryFee)}</span>
              </div>
              <div className="bill-row"><span>Platform Fee</span><span className="num">{formatCurrency(PLATFORM_FEE)}</span></div>
              <div className="bill-row total"><span>Amount Paid</span><span className="num">{formatCurrency(billSnapshot.amountToPay)}</span></div>

              <button className="btn-primary place-order-btn" onClick={() => navigate(`/orders/${placedOrder._id}`)}>
                View Order
              </button>
              <button className="btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={() => navigate('/')}>
                Continue Shopping
              </button>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default Checkout;

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, CreditCard, Truck, ShieldAlert, UploadCloud, FileCheck2, CalendarCheck } from 'lucide-react';
import api from '../api/axios';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../utils/format';

const Checkout = () => {
  const { cart, refreshCart } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [address, setAddress] = useState({ line1: '', city: '', state: '', pincode: '', lat: null, lng: null });
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [locating, setLocating] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [upiConfirmed, setUpiConfirmed] = useState(false);

  // Module 10 — Prescription Medicine Alert. Replaces the old
  // self-declared checkbox: the user must actually upload a prescription
  // file, which an admin later approves or rejects. `prescription` holds
  // the uploaded doc's id/status once the upload succeeds.
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [prescription, setPrescription] = useState(null);

  const rxItems = cart.items.filter(({ medicine }) => medicine.requiresPrescription);

  const handleChange = (e) => setAddress({ ...address, [e.target.name]: e.target.value });

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
      showToast('Prescription uploaded — you can now place your order', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Upload a valid prescription before placing this order.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!address.line1 || !address.city) {
      showToast('Please enter at least an address line and city', 'error');
      return;
    }
    if (paymentMethod === 'UPI' && !upiConfirmed) {
      showToast('Please complete the demo UPI payment step first', 'error');
      return;
    }
    if (rxItems.length > 0 && !prescription) {
      showToast('Upload a valid prescription before placing this order.', 'error');
      return;
    }

    setPlacing(true);
    try {
      const res = await api.post('/orders', {
        address,
        paymentMethod,
        prescriptionId: prescription?._id,
      });
      showToast('Order placed successfully!', 'success');
      await refreshCart();
      navigate(`/orders/${res.data.order._id}`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not place order', 'error');
    } finally {
      setPlacing(false);
    }
  };

  const mapSrc = address.lat && address.lng
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${address.lng - 0.01}%2C${address.lat - 0.01}%2C${address.lng + 0.01}%2C${address.lat + 0.01}&layer=mapnik&marker=${address.lat}%2C${address.lng}`
    : null;

  return (
    <div className="checkout-page">
      <h1 className="page-title">Checkout</h1>

      <div className="checkout-grid">
        <div className="checkout-form-col">
          <section className="checkout-section">
            <h2 className="checkout-section-title"><MapPin size={16} strokeWidth={2} /> Delivery Address</h2>
            <label className="field-label">Address line</label>
            <input name="line1" value={address.line1} onChange={handleChange} placeholder="House no, street, area" />
            <label className="field-label">City</label>
            <input name="city" value={address.city} onChange={handleChange} placeholder="City" />
            <label className="field-label">State</label>
            <input name="state" value={address.state} onChange={handleChange} placeholder="State" />
            <label className="field-label">Pincode</label>
            <input name="pincode" value={address.pincode} onChange={handleChange} placeholder="Pincode" />

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
          </section>

          <section className="checkout-section">
            <h2 className="checkout-section-title"><CreditCard size={16} strokeWidth={2} /> Payment Method</h2>
            <label className="payment-option">
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === 'COD'}
                onChange={() => { setPaymentMethod('COD'); setUpiConfirmed(false); }}
              />
              Cash on Delivery (COD)
            </label>
            <label className="payment-option">
              <input
                type="radio"
                name="paymentMethod"
                checked={paymentMethod === 'UPI'}
                onChange={() => setPaymentMethod('UPI')}
              />
              UPI (Demo)
            </label>

            {paymentMethod === 'UPI' && (
              <div className="upi-demo-box">
                {upiConfirmed ? (
                  <p className="success-text">✓ Demo payment confirmed</p>
                ) : (
                  <>
                    <p className="muted-text">This is a demo — no real payment is processed.</p>
                    <button type="button" className="btn-secondary" onClick={() => setUpiConfirmed(true)}>
                      Simulate UPI Payment
                    </button>
                  </>
                )}
              </div>
            )}
          </section>

          {rxItems.length > 0 && (
            <section className="checkout-section">
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
                  <p className="error-text">Upload a valid prescription before placing this order.</p>
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
            </section>
          )}
        </div>

        <div className="checkout-summary-col">
          <section className="checkout-section">
            <h2 className="checkout-section-title">Order Summary</h2>
            {cart.items.map(({ medicine, quantity, lineTotal }) => (
              <div className="summary-line" key={medicine._id}>
                <span>{medicine.name} × {quantity}</span>
                <span>{formatCurrency(lineTotal)}</span>
              </div>
            ))}
            <div className="summary-line total">
              <span>Total</span>
              <span>{formatCurrency(cart.totalAmount)}</span>
            </div>

            <p className="delivery-estimate">
              <CalendarCheck size={14} strokeWidth={2} />
              {rxItems.length > 0
                ? 'Estimated delivery: 4–6 days after prescription approval'
                : 'Estimated delivery: 3–5 business days'}
            </p>

            <button
              className="btn-primary place-order-btn"
              onClick={handlePlaceOrder}
              disabled={placing || (rxItems.length > 0 && !prescription)}
            >
              {placing ? 'Placing order…' : 'Place Order'}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Checkout;

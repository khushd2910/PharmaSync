import { useEffect, useRef, useState } from 'react';
import { ScanBarcode, Minus, Plus, Trash2, Receipt, RotateCcw, Wallet, ShieldAlert } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const getEffectivePrice = (medicine) => {
  const price = medicine.price || 0;
  if (medicine.discountPercent > 0) {
    return Math.round(price * (1 - medicine.discountPercent / 100) * 100) / 100;
  }
  return price;
};

const DEMO_GST_RATE = 0.12;

const AdminPOS = () => {
  const { showToast } = useToast();
  const searchInputRef = useRef(null);

  // --- Search / barcode -------------------------------------------------
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // --- Cart (client-side only until "Complete Sale" is pressed) --------
  const [cart, setCart] = useState([]); // [{ medicine, quantity }]

  // --- Customer / payment -------------------------------------------
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [prescriptionConfirmed, setPrescriptionConfirmed] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [lastSale, setLastSale] = useState(null);

  // --- Till summary / recent sales --------------------------------------
  const [today, setToday] = useState({ revenue: 0, count: 0 });
  const [recentSales, setRecentSales] = useState([]);
  const [salesLoading, setSalesLoading] = useState(true);

  const loadTill = () => {
    setSalesLoading(true);
    api
      .get('/admin/pos/sales', { params: { limit: 8 } })
      .then((res) => {
        setToday(res.data.today);
        setRecentSales(res.data.sales);
      })
      .catch((err) => showToast(err.response?.data?.message || 'Could not load sales history', 'error'))
      .finally(() => setSalesLoading(false));
  };

  useEffect(() => {
    loadTill();
    searchInputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced free-text search as the admin types (skipped for anything
  // that looks like it just came from a barcode scan — that's handled by
  // handleSearchSubmit on Enter instead, so a fast scan doesn't also fire
  // a noisy substring search on every digit).
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      api
        .get('/admin/pos/search', { params: { query } })
        .then((res) => setResults(res.data.medicines))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const addToCart = (medicine) => {
    if (medicine.stock <= 0) {
      showToast(`${medicine.name} is out of stock`, 'error');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((line) => line.medicine._id === medicine._id);
      if (existing) {
        if (existing.quantity >= medicine.stock) {
          showToast(`Only ${medicine.stock} of ${medicine.name} in stock`, 'error');
          return prev;
        }
        return prev.map((line) =>
          line.medicine._id === medicine._id ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...prev, { medicine, quantity: 1 }];
    });
  };

  // Enter in the search box = "this was a barcode scan (or a manual
  // barcode typed in)". A hardware scanner types the barcode digits and
  // then emits an Enter keystroke, so this is what actually drives the
  // scan-to-add flow from the diagram.
  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    const value = query.trim();
    if (!value) return;

    try {
      const res = await api.get('/admin/pos/search', { params: { barcode: value } });
      addToCart(res.data.medicines[0]);
      setQuery('');
      setResults([]);
    } catch (err) {
      // Not a recognized barcode — leave the query in place so the debounced
      // free-text search above can still find it by name.
      if (err.response?.status !== 404) {
        showToast(err.response?.data?.message || 'Search failed', 'error');
      }
    }
  };

  const handleResultClick = (medicine) => {
    addToCart(medicine);
    setQuery('');
    setResults([]);
    searchInputRef.current?.focus();
  };

  const changeQuantity = (medicineId, delta) => {
    setCart((prev) =>
      prev.flatMap((line) => {
        if (line.medicine._id !== medicineId) return [line];
        const newQty = line.quantity + delta;
        if (newQty <= 0) return [];
        if (newQty > line.medicine.stock) {
          showToast(`Only ${line.medicine.stock} in stock`, 'error');
          return [line];
        }
        return [{ ...line, quantity: newQty }];
      })
    );
  };

  const removeLine = (medicineId) => {
    setCart((prev) => prev.filter((line) => line.medicine._id !== medicineId));
  };

  const totalAmount = Math.round(
    cart.reduce((sum, line) => sum + getEffectivePrice(line.medicine) * line.quantity, 0) * 100
  ) / 100;
  const taxableValue = Math.round((totalAmount / (1 + DEMO_GST_RATE)) * 100) / 100;
  const gstAmount = Math.round((totalAmount - taxableValue) * 100) / 100;
  const rxItems = cart.filter((line) => line.medicine.requiresPrescription);

  const resetSaleForm = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setPaymentMethod('Cash');
    setPrescriptionConfirmed(false);
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      showToast('Add at least one item to bill', 'error');
      return;
    }
    if (rxItems.length > 0 && !prescriptionConfirmed) {
      showToast('Confirm the prescription has been seen before completing this sale', 'error');
      return;
    }
    setPlacing(true);
    try {
      const res = await api.post('/admin/pos/sales', {
        items: cart.map((line) => ({ medicineId: line.medicine._id, quantity: line.quantity })),
        paymentMethod,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        prescriptionConfirmed,
      });
      setLastSale(res.data.sale);
      showToast('Sale completed', 'success');
      resetSaleForm();
      loadTill();
      searchInputRef.current?.focus();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not complete sale', 'error');
    } finally {
      setPlacing(false);
    }
  };

  const handleRefund = async (sale) => {
    if (!window.confirm(`Refund ${sale.invoiceNumber} for ₹${sale.totalAmount.toFixed(2)}? Stock will be restored.`)) return;
    try {
      await api.patch(`/admin/pos/sales/${sale._id}/refund`);
      showToast('Sale refunded and stock restored', 'success');
      loadTill();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not refund sale', 'error');
    }
  };

  return (
    <div className="admin-orders-page admin-theme">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>POS Billing</h2>
        </div>
        <div className="stat-card pos-till-card">
          <Wallet size={18} strokeWidth={2} className="stat-icon" />
          <div>
            <p className="stat-value">₹{today.revenue.toFixed(2)}</p>
            <p className="stat-label">Today · {today.count} sale{today.count === 1 ? '' : 's'}</p>
          </div>
        </div>
      </header>

      <div className="checkout-grid pos-grid">
        {/* --- Left: scan/search + recent sales -------------------- */}
        <div className="checkout-form-col">
          <section className="checkout-section">
            <h2 className="checkout-section-title"><ScanBarcode size={16} strokeWidth={2} /> Add Items</h2>

            <form onSubmit={handleSearchSubmit} className="pos-search-form">
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Scan barcode, or type a name / manufacturer / composition"
                autoComplete="off"
              />
            </form>
            <p className="muted-text pos-search-hint">
              A scanner types the barcode and presses Enter automatically — or search by name and click a result to add it.
            </p>

            {searching && <p className="info-text center-text">Searching…</p>}

            {results.length > 0 && (
              <div className="pos-result-list">
                {results.map((medicine) => (
                  <button
                    type="button"
                    key={medicine._id}
                    className="pos-result-row"
                    onClick={() => handleResultClick(medicine)}
                    disabled={medicine.stock <= 0}
                  >
                    <div>
                      <p className="order-invoice">{medicine.name}</p>
                      <p className="muted-text">{medicine.manufacturer || medicine.brand || 'No brand'}</p>
                    </div>
                    <div className="pos-result-meta">
                      <span className="num">₹{getEffectivePrice(medicine).toFixed(2)}</span>
                      <span className={`badge ${medicine.stock <= 0 ? 'badge-outofstock' : medicine.stock <= 10 ? 'badge-rx' : 'badge-success'}`}>
                        {medicine.stock <= 0 ? 'Out of stock' : `${medicine.stock} in stock`}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="checkout-section">
            <h2 className="checkout-section-title"><Receipt size={16} strokeWidth={2} /> Recent Sales</h2>
            {salesLoading ? (
              <p className="info-text center-text">Loading…</p>
            ) : recentSales.length === 0 ? (
              <p className="info-text center-text">No sales yet today.</p>
            ) : (
              <div className="admin-orders-table pos-recent-sales">
                {recentSales.map((sale) => (
                  <div className="admin-order-row" key={sale._id}>
                    <div className="admin-order-main">
                      <p className="order-invoice">{sale.invoiceNumber}</p>
                      <p className="muted-text">
                        {new Date(sale.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}{sale.items.length} item{sale.items.length > 1 ? 's' : ''}
                        {' · '}₹{sale.totalAmount.toFixed(2)}
                        {' · '}{sale.paymentMethod}
                      </p>
                    </div>

                    <span className={`badge ${sale.status === 'Refunded' ? 'badge-outofstock' : 'badge-success'}`}>
                      {sale.status}
                    </span>

                    <div className="admin-medicine-actions">
                      <a
                        className="icon-btn-danger"
                        href={`${API_BASE_URL}/admin/pos/sales/${sale._id}/receipt`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Print / download receipt"
                      >
                        <Receipt size={16} strokeWidth={2} />
                      </a>
                      {sale.status !== 'Refunded' && (
                        <button className="icon-btn-danger" onClick={() => handleRefund(sale)} title="Refund sale">
                          <RotateCcw size={16} strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* --- Right: current bill ----------------------------------- */}
        <div className="checkout-summary-col">
          <section className="checkout-section">
            <h2 className="checkout-section-title">Current Bill</h2>

            {cart.length === 0 ? (
              <p className="info-text center-text">Scan or search a medicine to start a sale.</p>
            ) : (
              <div className="cart-list pos-cart-list">
                {cart.map((line) => (
                  <div className="cart-item pos-cart-item" key={line.medicine._id}>
                    <div className="cart-item-info">
                      <p className="cart-item-name">{line.medicine.name}</p>
                      <p className="cart-item-unit-price">₹{getEffectivePrice(line.medicine).toFixed(2)} each</p>
                    </div>
                    <div className="qty-stepper">
                      <button type="button" onClick={() => changeQuantity(line.medicine._id, -1)}>
                        <Minus size={14} />
                      </button>
                      <span>{line.quantity}</span>
                      <button type="button" onClick={() => changeQuantity(line.medicine._id, 1)}>
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="cart-item-total num">
                      ₹{(getEffectivePrice(line.medicine) * line.quantity).toFixed(2)}
                    </span>
                    <button className="icon-btn-danger" onClick={() => removeLine(line.medicine._id)} aria-label="Remove item">
                      <Trash2 size={16} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pos-customer-fields">
              <div>
                <label className="field-label">Customer name (optional)</label>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in customer" />
              </div>
              <div>
                <label className="field-label">Phone (optional)</label>
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="For the receipt / returns" />
              </div>
            </div>

            <label className="field-label">Payment Method</label>
            <div className="pos-payment-options">
              {['Cash', 'UPI', 'Card'].map((method) => (
                <label className="payment-option" key={method}>
                  <input
                    type="radio"
                    name="posPaymentMethod"
                    checked={paymentMethod === method}
                    onChange={() => setPaymentMethod(method)}
                  />
                  {method}
                </label>
              ))}
            </div>

            {rxItems.length > 0 && (
              <div className="notice-banner pos-rx-notice">
                <ShieldAlert size={15} strokeWidth={2} />
                <div>
                  <p>
                    Prescription-only: {rxItems.map((line) => line.medicine.name).join(', ')}
                  </p>
                  <label className="payment-option">
                    <input
                      type="checkbox"
                      checked={prescriptionConfirmed}
                      onChange={(e) => setPrescriptionConfirmed(e.target.checked)}
                    />
                    I've seen a valid prescription for the item(s) above
                  </label>
                </div>
              </div>
            )}

            <div className="summary-line">
              <span>Taxable value</span>
              <span>₹{taxableValue.toFixed(2)}</span>
            </div>
            <div className="summary-line">
              <span>GST (12%, CGST+SGST)</span>
              <span>₹{gstAmount.toFixed(2)}</span>
            </div>
            <div className="summary-line total">
              <span>Total</span>
              <span>₹{totalAmount.toFixed(2)}</span>
            </div>

            <button
              className="btn-primary place-order-btn"
              onClick={handleCompleteSale}
              disabled={placing || cart.length === 0 || (rxItems.length > 0 && !prescriptionConfirmed)}
            >
              {placing ? 'Billing…' : 'Complete Sale'}
            </button>

            {lastSale && (
              <div className="notice-banner pos-last-sale">
                Sale {lastSale.invoiceNumber} completed — ₹{lastSale.totalAmount.toFixed(2)}.{' '}
                <a
                  href={`${API_BASE_URL}/admin/pos/sales/${lastSale._id}/receipt`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Print receipt
                </a>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminPOS;

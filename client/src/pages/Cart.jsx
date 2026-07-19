import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, Pill, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

const Cart = () => {
  const { cart, updateQuantity, removeFromCart, loading } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

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

      <div className="cart-list">
        {cart.items.map(({ medicine, quantity, lineTotal }) => (
          <div className="cart-item" key={medicine._id}>
            <div className="cart-item-icon">
              <Pill size={20} strokeWidth={2} />
            </div>
            <div className="cart-item-info">
              <Link to={`/medicines/${medicine._id}`} className="cart-item-name">{medicine.name}</Link>
              <p className="muted-text">{medicine.manufacturer}</p>
              <p className="cart-item-unit-price">₹{(lineTotal / quantity).toFixed(2)} each</p>
            </div>
            <div className="qty-stepper">
              <button onClick={() => handleQuantityChange(medicine._id, quantity - 1, medicine.stock)}>
                <Minus size={14} />
              </button>
              <span>{quantity}</span>
              <button onClick={() => handleQuantityChange(medicine._id, quantity + 1, medicine.stock)}>
                <Plus size={14} />
              </button>
            </div>
            <span className="cart-item-total num">₹{lineTotal.toFixed(2)}</span>
            <button className="icon-btn-danger" onClick={() => handleRemove(medicine._id, medicine.name)} aria-label="Remove item">
              <Trash2 size={16} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>

      <div className="cart-summary">
        <div className="cart-summary-row">
          <span>Items ({cart.totalItems})</span>
          <span>₹{cart.totalAmount.toFixed(2)}</span>
        </div>
        <div className="cart-summary-row total">
          <span>Total</span>
          <span>₹{cart.totalAmount.toFixed(2)}</span>
        </div>
        <button className="btn-primary checkout-btn" disabled={loading} onClick={() => navigate('/checkout')}>
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
};

export default Cart;

import { Link } from 'react-router-dom';
import { FileWarning, Plus, Minus } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { getStripSize } from '../utils/stripSize';
import { getMedicineImage } from '../utils/medicineFormImage';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

// Below this many units left, show an urgency hint ("Only 3 left")
// instead of a flat "in stock" — a trust/transparency signal that sets
// expectations before checkout rather than at it.
const LOW_STOCK_THRESHOLD = 5;

const MedicineCard = ({ medicine, onAddToCart }) => {
  const { cart, updateQuantity, removeFromCart } = useCart();
  const { showToast } = useToast();

  const hasDiscount = medicine.discountPercent > 0;
  const effectivePrice = hasDiscount
    ? medicine.price * (1 - medicine.discountPercent / 100)
    : medicine.price;
  const savings = hasDiscount ? medicine.price - effectivePrice : 0;
  const outOfStock = medicine.stock <= 0;
  const lowStock = !outOfStock && medicine.stock <= LOW_STOCK_THRESHOLD;
  const stripSize = getStripSize(medicine._id);

  // Once this medicine is already in the cart, the ADD button becomes a
  // quantity stepper (- N +) instead — mirrors quick-commerce cards, and
  // means the same tap target always reflects the cart's actual state.
  const cartLine = cart.items.find((item) => item.medicine._id === medicine._id);
  const quantityInCart = cartLine?.quantity || 0;

  // The whole card navigates to the detail page. All the buttons below sit
  // inside that same clickable area, so every click must be stopped from
  // bubbling up to (and its default <a> navigation prevented by) the card
  // link — otherwise pressing one would both act on the cart and navigate away.
  const handleAddClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAddToCart(medicine);
  };

  const handleIncrement = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (quantityInCart + 1 > medicine.stock) {
      showToast(`Only ${medicine.stock} in stock`, 'error');
      return;
    }
    const result = await updateQuantity(medicine._id, quantityInCart + 1);
    if (!result.success) showToast(result.message, 'error');
  };

  const handleDecrement = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const result = quantityInCart <= 1
      ? await removeFromCart(medicine._id)
      : await updateQuantity(medicine._id, quantityInCart - 1);
    if (!result.success) showToast(result.message, 'error');
  };

  return (
    <Link to={`/medicines/${medicine._id}`} className="medicine-card">
      <div className="medicine-card-media">
        {hasDiscount && <span className="medicine-card-offtag">{medicine.discountPercent}% OFF</span>}
        <img
          src={getMedicineImage(medicine)}
          alt={medicine.name}
          className="medicine-card-img"
          loading="lazy"
        />
        {quantityInCart > 0 ? (
          <div className="medicine-card-stepper" onClick={(e) => e.preventDefault()}>
            <button onClick={handleDecrement} aria-label="Decrease quantity">
              <Minus size={13} strokeWidth={2.5} />
            </button>
            <span>{quantityInCart}</span>
            <button
              onClick={handleIncrement}
              disabled={quantityInCart >= medicine.stock}
              title={quantityInCart >= medicine.stock ? `Only ${medicine.stock} in stock` : 'Add one more'}
              aria-label="Increase quantity"
            >
              <Plus size={13} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <button
            className="medicine-card-add"
            onClick={handleAddClick}
            disabled={outOfStock}
            title={outOfStock ? 'Out of stock' : 'Add to cart'}
          >
            {outOfStock ? 'SOLD OUT' : <><Plus size={13} strokeWidth={2.5} /> ADD</>}
          </button>
        )}
      </div>

      <div className="medicine-card-body">
        <div className="medicine-card-price-row">
          {typeof medicine.price === 'number' ? (
            <>
              <span className="medicine-card-price num">{formatCurrency(effectivePrice)}</span>
              {hasDiscount && <span className="price-strike">{formatCurrency(medicine.price)}</span>}
            </>
          ) : (
            <span className="medicine-card-price">Price unavailable</span>
          )}
        </div>
        <span className="medicine-card-savings">{hasDiscount ? `${formatCurrency(savings)} OFF` : '\u00A0'}</span>

        <span className="medicine-card-name">{medicine.name}</span>
        <p className="medicine-card-sub">
          {stripSize} tablets/strip{medicine.manufacturer ? ` · ${medicine.manufacturer}` : ''}
        </p>

        <div className="medicine-card-tags">
          {medicine.category && <span className="badge badge-category">{medicine.category}</span>}
          {medicine.requiresPrescription && (
            <span className="badge badge-rx" title="A pharmacist must approve an uploaded prescription before this can be delivered">
              <FileWarning size={11} strokeWidth={2} /> Rx required
            </span>
          )}
          {lowStock && <span className="badge badge-discount">Only {medicine.stock} left</span>}
        </div>
      </div>
    </Link>
  );
};

export default MedicineCard;

import { Link } from 'react-router-dom';
import { Pill, ShoppingCart, FileWarning, Layers } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { getStripSize } from '../utils/stripSize';

// Below this many units left, show an urgency hint ("Only 3 left")
// instead of a flat "in stock" — a trust/transparency signal that sets
// expectations before checkout rather than at it.
const LOW_STOCK_THRESHOLD = 5;

const MedicineCard = ({ medicine, onAddToCart }) => {
  const composition = [medicine.composition1, medicine.composition2].filter(Boolean).join(' + ');
  const hasDiscount = medicine.discountPercent > 0;
  const effectivePrice = hasDiscount
    ? medicine.price * (1 - medicine.discountPercent / 100)
    : medicine.price;
  const outOfStock = medicine.stock <= 0;
  const lowStock = !outOfStock && medicine.stock <= LOW_STOCK_THRESHOLD;
  const stripSize = getStripSize(medicine._id);

  // The whole card navigates to the detail page. The Add to Cart button
  // sits inside that same clickable area, so its own click must be
  // stopped from bubbling up to (and its default <a> navigation prevented
  // by) the card link — otherwise pressing it would both add to cart and
  // navigate away.
  const handleAddToCartClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onAddToCart(medicine);
  };

  return (
    <Link to={`/medicines/${medicine._id}`} className="medicine-card">
      <div className="medicine-card-top">
        <div className="medicine-card-icon">
          <Pill size={18} strokeWidth={2} />
        </div>
        {hasDiscount && <span className="badge badge-ribbon">{medicine.discountPercent}% OFF</span>}
      </div>

      <span className="medicine-card-name">{medicine.name}</span>
      {medicine.manufacturer && <p className="medicine-card-manufacturer">{medicine.manufacturer}</p>}
      {composition && <p className="medicine-card-composition">{composition}</p>}

      <div className="medicine-card-tags">
        {medicine.requiresPrescription && (
          <span className="badge badge-rx" title="A pharmacist must approve an uploaded prescription before this can be delivered">
            <FileWarning size={11} strokeWidth={2} /> Rx required
          </span>
        )}
        <span className="badge badge-strip" title="Tablets per strip">
          <Layers size={11} strokeWidth={2} /> {stripSize}/strip
        </span>
        {outOfStock && <span className="badge badge-outofstock">Out of stock</span>}
        {lowStock && <span className="badge badge-discount">Only {medicine.stock} left</span>}
      </div>

      <div className="medicine-card-footer">
        <span className="medicine-card-price num">
          {typeof medicine.price === 'number' ? (
            <>
              {formatCurrency(effectivePrice)}
              {hasDiscount && <span className="price-strike">{formatCurrency(medicine.price)}</span>}
            </>
          ) : (
            'Price unavailable'
          )}
        </span>
        <button
          className="medicine-card-btn"
          onClick={handleAddToCartClick}
          disabled={outOfStock}
          title={outOfStock ? 'Out of stock' : 'Add to cart'}
        >
          <ShoppingCart size={14} strokeWidth={2} />
        </button>
      </div>
    </Link>
  );
};

export default MedicineCard;

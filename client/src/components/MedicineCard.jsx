import { Link } from 'react-router-dom';
import { ShoppingCart, FileWarning } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { getMedicineVisual } from '../utils/medicineVisual';

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
  const { icon: DosageIcon, tint, color } = getMedicineVisual(medicine);

  return (
    <div className="medicine-card">
      <div className="medicine-card-top">
        <div className="medicine-card-icon" style={{ background: `var(${tint})`, color: `var(${color})` }}>
          <DosageIcon size={18} strokeWidth={2} />
        </div>
        {hasDiscount && <span className="badge badge-discount">{medicine.discountPercent}% OFF</span>}
      </div>

      <Link to={`/medicines/${medicine._id}`} className="medicine-card-name">
        {medicine.name}
      </Link>
      {medicine.manufacturer && <p className="medicine-card-manufacturer">{medicine.manufacturer}</p>}
      {composition && <p className="medicine-card-composition">{composition}</p>}

      <div className="medicine-card-tags">
        {medicine.requiresPrescription && (
          <span className="badge badge-rx" title="A pharmacist must approve an uploaded prescription before this can be delivered">
            <FileWarning size={11} strokeWidth={2} /> Rx required
          </span>
        )}
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
          onClick={() => onAddToCart(medicine)}
          disabled={outOfStock}
          title={outOfStock ? 'Out of stock' : 'Add to cart'}
        >
          <ShoppingCart size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};

export default MedicineCard;

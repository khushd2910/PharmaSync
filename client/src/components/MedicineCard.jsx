import { Link } from 'react-router-dom';
import { Pill, ShoppingCart, FileWarning } from 'lucide-react';

const MedicineCard = ({ medicine, onAddToCart }) => {
  const composition = [medicine.composition1, medicine.composition2].filter(Boolean).join(' + ');
  const hasDiscount = medicine.discountPercent > 0;
  const effectivePrice = hasDiscount
    ? medicine.price * (1 - medicine.discountPercent / 100)
    : medicine.price;
  const outOfStock = medicine.stock <= 0;

  return (
    <div className="medicine-card">
      <div className="medicine-card-top">
        <div className="medicine-card-icon">
          <Pill size={18} strokeWidth={2} />
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
          <span className="badge badge-rx">
            <FileWarning size={11} strokeWidth={2} /> Rx required
          </span>
        )}
        {outOfStock && <span className="badge badge-outofstock">Out of stock</span>}
      </div>

      <div className="medicine-card-footer">
        <span className="medicine-card-price num">
          {typeof medicine.price === 'number' ? (
            <>
              ₹{effectivePrice.toFixed(2)}
              {hasDiscount && <span className="price-strike">₹{medicine.price.toFixed(2)}</span>}
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

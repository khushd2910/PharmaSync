import { Pill, ShoppingCart } from 'lucide-react';

const MedicineCard = ({ medicine, onAddToCart }) => {
  const composition = [medicine.composition1, medicine.composition2].filter(Boolean).join(' + ');

  return (
    <div className="medicine-card">
      <div className="medicine-card-icon">
        <Pill size={18} strokeWidth={2} />
      </div>
      <h4 className="medicine-card-name">{medicine.name}</h4>
      {medicine.manufacturer && <p className="medicine-card-manufacturer">{medicine.manufacturer}</p>}
      {composition && <p className="medicine-card-composition">{composition}</p>}
      {medicine.packSizeLabel && <p className="medicine-card-pack">{medicine.packSizeLabel}</p>}
      <div className="medicine-card-footer">
        <span className="medicine-card-price">
          {typeof medicine.price === 'number' ? `₹${medicine.price.toFixed(2)}` : 'Price unavailable'}
        </span>
        <button className="medicine-card-btn" onClick={() => onAddToCart(medicine)}>
          <ShoppingCart size={14} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};

export default MedicineCard;

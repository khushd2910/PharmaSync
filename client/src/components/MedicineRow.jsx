import MedicineCard from './MedicineCard';

// Horizontal scrolling row of medicine cards — used for Home's discovery
// sections (Offers / Popular / Recently Added / Recently Viewed) and for
// the detail page's "Similar Products" / "Top in category" / "People also
// bought" rows at the bottom.
const MedicineRow = ({ title, icon: Icon, medicines, onAddToCart }) => {
  if (!medicines || medicines.length === 0) return null;

  return (
    <section className="browse-row-section">
      <div className="browse-header">
        <h2 className="browse-title">
          {Icon && <Icon size={18} strokeWidth={2} className="browse-title-icon" />}
          {title}
        </h2>
      </div>
      <div className="browse-row-scroll">
        {medicines.map((m) => (
          <div className="browse-row-item" key={m._id}>
            <MedicineCard medicine={m} onAddToCart={onAddToCart} />
          </div>
        ))}
      </div>
    </section>
  );
};

export default MedicineRow;

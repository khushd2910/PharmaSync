import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';

const SavedForLater = () => {
  const { cart, moveSavedToCart, removeSavedItem, loading } = useCart();
  const { showToast } = useToast();

  const savedItems = cart.savedItems || [];

  if (loading && savedItems.length === 0) {
    return (
      <div className="saved-page">
        <p className="info-text center-text">Loading saved items…</p>
      </div>
    );
  }

  if (savedItems.length === 0) {
    return (
      <div className="saved-page">
        <div className="empty-state">
          <Heart size={40} strokeWidth={1.5} />
          <h2>No saved items yet</h2>
          <p className="muted-text">Save items from your cart to review them later.</p>
          <Link to="/cart" className="btn-primary">Back to cart</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-page">
      <h1 className="page-title">Saved for later</h1>
      <p className="muted-text" style={{ marginBottom: 20 }}>
        These items are waiting for you. Move them back to cart when you are ready.
      </p>

      <div className="saved-items-list">
        {savedItems.map(({ medicine, quantity }) => (
          <div className="saved-item" key={medicine._id}>
            <div className="saved-item-info">
              <Link to={`/medicines/${medicine._id}`} className="saved-item-name">
                {medicine.name}
              </Link>
              <p className="muted-text">{medicine.manufacturer}</p>
              <p className="saved-item-meta">{quantity} unit{quantity > 1 ? 's' : ''}</p>
            </div>
            <div className="saved-item-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={async () => {
                  const result = await moveSavedToCart(medicine._id);
                  if (result.success) {
                    showToast(`${medicine.name} moved back to cart`, 'success');
                  } else {
                    showToast(result.message, 'error');
                  }
                }}
              >
                <ShoppingCart size={16} /> Move to cart
              </button>
              <button
                type="button"
                className="link-btn"
                onClick={async () => {
                  const result = await removeSavedItem(medicine._id);
                  if (result.success) {
                    showToast(`${medicine.name} removed from saved items`, 'info');
                  } else {
                    showToast(result.message, 'error');
                  }
                }}
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SavedForLater;

import { Link, useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import MedicineCard from '../components/MedicineCard';
import { SkeletonMedicineCard } from '../components/Skeleton';

// Dedicated destination for wishlisted medicines. Home's "My Wishlist" row
// only surfaces while browsing with no search/filter active and shows
// everything in one unpaginated horizontal scroller — this page is the
// actual place to review and manage the full list, mirroring how
// SavedForLater.jsx is the dedicated home for cart's saved items.
const Wishlist = () => {
  const { medicines, loading, loaded } = useWishlist() || {};
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const wishlistItems = medicines || [];

  const handleAddToCart = async (medicine) => {
    if (!user) {
      showToast('Please log in to add items to your cart', 'info');
      navigate('/login');
      return;
    }
    if (user.role === 'admin') {
      showToast('Admins manage stock, not carts', 'info');
      return;
    }
    const result = await addToCart(medicine._id, 1);
    showToast(result.success ? `${medicine.name} added to cart` : result.message, result.success ? 'success' : 'error');
  };

  if (loading && !loaded) {
    return (
      <div className="saved-page">
        <h1 className="page-title">My Wishlist</h1>
        <div className="medicine-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonMedicineCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (wishlistItems.length === 0) {
    return (
      <div className="saved-page">
        <div className="empty-state">
          <Heart size={40} strokeWidth={1.5} />
          <h2>Your wishlist is empty</h2>
          <p className="muted-text">Tap the heart icon on any medicine to save it here for later.</p>
          <Link to="/" className="btn-primary">Browse medicines</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-page">
      <h1 className="page-title">My Wishlist</h1>
      <p className="muted-text" style={{ marginBottom: 20 }}>
        Medicines you've saved. Tap the heart again to remove one, or add it straight to your cart.
      </p>

      <div className="medicine-grid">
        {wishlistItems.map((medicine) => (
          <MedicineCard key={medicine._id} medicine={medicine} onAddToCart={handleAddToCart} />
        ))}
      </div>
    </div>
  );
};

export default Wishlist;

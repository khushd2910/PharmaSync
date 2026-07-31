import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);

export const WishlistProvider = ({ children }) => {
  const { user } = useAuth();
  // Full medicine docs (for rendering the Home page's Wishlist row) plus a
  // plain id Set (for O(1) "is this one wishlisted?" checks from every
  // MedicineCard on screen, without each card doing its own array scan).
  const [medicines, setMedicines] = useState([]);
  const [ids, setIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refreshWishlist = useCallback(async () => {
    if (!user || user.role !== 'user') {
      setMedicines([]);
      setIds(new Set());
      setLoaded(true);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/user/wishlist');
      setMedicines(res.data.medicines);
      setIds(new Set(res.data.medicines.map((m) => m._id)));
    } catch (err) {
      // not logged in / request hiccup — leave wishlist empty rather than block the page
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    refreshWishlist();
  }, [refreshWishlist]);

  const isWishlisted = (medicineId) => ids.has(medicineId);

  const toggleWishlist = async (medicine) => {
    try {
      const res = await api.post(`/user/wishlist/${medicine._id}/toggle`);
      const wishlisted = res.data.wishlisted;
      setIds((prev) => {
        const next = new Set(prev);
        if (wishlisted) next.add(medicine._id);
        else next.delete(medicine._id);
        return next;
      });
      setMedicines((prev) =>
        wishlisted ? [medicine, ...prev.filter((m) => m._id !== medicine._id)] : prev.filter((m) => m._id !== medicine._id)
      );
      return { success: true, wishlisted };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Could not update wishlist' };
    }
  };

  return (
    <WishlistContext.Provider
      value={{ medicines, loading, loaded, isWishlisted, toggleWishlist, refreshWishlist }}
    >
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => useContext(WishlistContext);

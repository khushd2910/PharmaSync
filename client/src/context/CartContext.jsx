import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

const EMPTY_CART = { items: [], totalItems: 0, totalAmount: 0 };

export const CartProvider = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState(EMPTY_CART);
  const [loading, setLoading] = useState(false);

  const refreshCart = useCallback(async () => {
    if (!user || user.role !== 'user') {
      setCart(EMPTY_CART);
      return;
    }
    try {
      const res = await api.get('/cart');
      setCart(res.data.cart);
    } catch (err) {
      // not logged in / no cart yet — leave as empty
    }
  }, [user]);

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  const addToCart = async (medicineId, quantity = 1) => {
    setLoading(true);
    try {
      const res = await api.post('/cart/items', { medicineId, quantity });
      setCart(res.data.cart);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Could not add to cart' };
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (medicineId, quantity) => {
    setLoading(true);
    try {
      const res = await api.patch(`/cart/items/${medicineId}`, { quantity });
      setCart(res.data.cart);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Could not update quantity' };
    } finally {
      setLoading(false);
    }
  };

  const removeFromCart = async (medicineId) => {
    setLoading(true);
    try {
      const res = await api.delete(`/cart/items/${medicineId}`);
      setCart(res.data.cart);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Could not remove item' };
    } finally {
      setLoading(false);
    }
  };

  const clearCart = () => setCart(EMPTY_CART);

  return (
    <CartContext.Provider
      value={{ cart, loading, addToCart, updateQuantity, removeFromCart, clearCart, refreshCart }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);

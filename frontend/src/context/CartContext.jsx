import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { cartApi } from '../services/cart';
import { useAuth } from './AuthContext';

const EMPTY_CART = {
  items: [],
  count: 0,
  total_quantity: 0,
  subtotal: 0,
  coupon: null,
  coupon_applied: false,
  shipping_address: null,
};

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState(EMPTY_CART);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(EMPTY_CART);
      return EMPTY_CART;
    }
    setLoading(true);
    try {
      const data = await cartApi.get();
      setCart({ ...EMPTY_CART, ...data });
      return data;
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh().catch(() => setCart(EMPTY_CART));
  }, [refresh]);

  const addItem = useCallback(async (productId, quantity = 1) => {
    const data = await cartApi.addItem(productId, quantity);
    setCart({ ...EMPTY_CART, ...data });
    return data;
  }, []);

  const updateItem = useCallback(async (itemId, quantity) => {
    const data = await cartApi.updateItem(itemId, quantity);
    setCart({ ...EMPTY_CART, ...data });
    return data;
  }, []);

  const removeItem = useCallback(async (itemId) => {
    const data = await cartApi.removeItem(itemId);
    setCart({ ...EMPTY_CART, ...data });
    return data;
  }, []);

  const applyCoupon = useCallback(async (code) => {
    const data = await cartApi.applyCoupon(code);
    setCart({ ...EMPTY_CART, ...data });
    return data;
  }, []);

  const removeCoupon = useCallback(async () => {
    const data = await cartApi.removeCoupon();
    setCart({ ...EMPTY_CART, ...data });
    return data;
  }, []);

  const setAddress = useCallback(async (addressId) => {
    const data = await cartApi.setAddress(addressId);
    setCart((current) => ({ ...current, shipping_address: data.shipping_address }));
    return data;
  }, []);

  const value = useMemo(
    () => ({
      cart,
      loading,
      itemCount: cart.total_quantity || 0,
      refresh,
      addItem,
      updateItem,
      removeItem,
      applyCoupon,
      removeCoupon,
      setAddress,
    }),
    [cart, loading, refresh, addItem, updateItem, removeItem, applyCoupon, removeCoupon, setAddress]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}

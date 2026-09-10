'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  Cart,
  getCart,
  getCartBySession,
  createCart,
  addCartItem as apiAddCartItem,
  updateCartItem as apiUpdateCartItem,
  removeCartItem as apiRemoveCartItem,
  clearCart as apiClearCart,
  CartSummary,
} from '../lib/api';

interface CartContextType {
  cart: Cart | null;
  summary: CartSummary | null;
  isLoading: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  initCart: (tenantId: string, storefrontId: string, customerId?: string) => Promise<void>;
  addItem: (productId: string, quantity: number, variantId?: string) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clear: () => Promise<void>;
  itemCount: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const MOCK_CUSTOMER_ID = 'demo-customer-001';
const SESSION_KEY = 'zyra-session-id';
const CART_ID_KEY = 'zyra-cart-id';

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server-session';
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

function computeSummary(cart: Cart | null): CartSummary | null {
  if (!cart) return null;
  const items = cart.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    variantId: item.variantId,
    variantName: item.variant?.name,
    productName: item.product.name,
    image: item.product.images?.[0],
    price: item.price,
    quantity: item.quantity,
    lineTotal: item.price * item.quantity,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  return {
    id: cart.id,
    tenantId: cart.tenantId,
    storefrontId: cart.storefrontId,
    customerId: cart.customerId,
    sessionId: cart.sessionId,
    items,
    subtotal,
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const summary = computeSummary(cart);
  const itemCount = summary?.itemCount || 0;
  const subtotal = summary?.subtotal || 0;

  const initCart = useCallback(async (tenantId: string, storefrontId: string, customerId?: string) => {
    try {
      let existingCart = await getCart(tenantId, customerId || MOCK_CUSTOMER_ID);
      if (!existingCart) {
        existingCart = await getCartBySession(getSessionId());
      }
      if (existingCart) {
        setCart(existingCart);
      } else {
        const newCart = await createCart(tenantId, storefrontId, customerId || MOCK_CUSTOMER_ID, getSessionId());
        setCart(newCart);
      }
    } catch {
      // Ignore init errors — cart can be created later
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addItem = useCallback(async (productId: string, quantity: number, variantId?: string) => {
    if (!cart) return;
    try {
      const updated = await apiAddCartItem(cart.id, productId, quantity, variantId);
      setCart(updated);
      setIsOpen(true);
    } catch (e) {
      console.error('Failed to add item:', e);
      throw e;
    }
  }, [cart]);

  const updateItem = useCallback(async (itemId: string, quantity: number) => {
    if (!cart) return;
    try {
      const updated = await apiUpdateCartItem(cart.id, itemId, quantity);
      setCart(updated);
    } catch (e) {
      console.error('Failed to update item:', e);
      throw e;
    }
  }, [cart]);

  const removeItem = useCallback(async (itemId: string) => {
    if (!cart) return;
    try {
      const updated = await apiRemoveCartItem(cart.id, itemId);
      setCart(updated);
    } catch (e) {
      console.error('Failed to remove item:', e);
      throw e;
    }
  }, [cart]);

  const clear = useCallback(async () => {
    if (!cart) return;
    try {
      const updated = await apiClearCart(cart.id);
      setCart(updated);
    } catch (e) {
      console.error('Failed to clear cart:', e);
      throw e;
    }
  }, [cart]);

  // Restore cart ID from sessionStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedCartId = sessionStorage.getItem(CART_ID_KEY);
    if (savedCartId && !cart) {
      getCartBySession(getSessionId()).then((restored) => {
        if (restored) setCart(restored);
        setIsLoading(false);
      }).catch(() => setIsLoading(false));
    } else if (!cart) {
      setIsLoading(false);
    }
  }, []);

  // Persist cart ID
  useEffect(() => {
    if (cart && typeof window !== 'undefined') {
      sessionStorage.setItem(CART_ID_KEY, cart.id);
    }
  }, [cart?.id]);

  return (
    <CartContext.Provider
      value={{ cart, summary, isLoading, isOpen, setIsOpen, initCart, addItem, updateItem, removeItem, clear, itemCount, subtotal }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

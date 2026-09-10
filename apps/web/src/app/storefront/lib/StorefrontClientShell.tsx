'use client';

import { ReactNode } from 'react';
import StorefrontTheme from '@/components/storefront/StorefrontTheme';
import StorefrontHeader from '@/components/storefront/StorefrontHeader';
import { StoreFooter } from '../components/StoreFooter';
import { CartProvider, useCart } from '../contexts/CartContext';
import CartDrawer from '../components/CartDrawer';
import { Store } from './store-data';

function StorefrontShellInner({ store, children }: { store: Store; children: ReactNode }) {
  const { isOpen, setIsOpen } = useCart();

  return (
    <>
      <StorefrontTheme theme={store.theme as Record<string, unknown> ?? {}} />
      <div
        className="sf-shell min-h-screen flex flex-col"
        style={{
          fontFamily: 'var(--sf-font, inherit)',
          color: 'var(--sf-text, inherit)',
          backgroundColor: 'var(--sf-bg, #fff)',
        }}
        data-store={store.slug}
      >
        <StorefrontHeader store={store} onCartClick={() => setIsOpen(true)} />
        <main className="flex-1">{children}</main>
        <StoreFooter store={store} />
        <CartDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </div>
    </>
  );
}

export default function StorefrontClientShell({ store, children }: { store: Store; children: ReactNode }) {
  return (
    <CartProvider>
      <StorefrontShellInner store={store} children={children} />
    </CartProvider>
  );
}

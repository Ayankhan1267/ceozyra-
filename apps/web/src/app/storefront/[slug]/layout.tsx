/**
 * ZYRA — Storefront Shell layout wrapper for [slug] routes
 */

import StorefrontShell from '@/components/storefront/StorefrontShell';
import StorefrontHeader from '@/components/storefront/StorefrontHeader';
import { StoreFooter } from '../components/StoreFooter';
import { CartProvider } from '../contexts/CartContext';

export default function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  return (
    <StorefrontShell store={{ id: '', slug: params.slug, name: '' } as any}>
      <CartProvider>
        <StorefrontHeader store={{ id: '', slug: params.slug, name: '' } as any} />
        <main className="flex-1">{children}</main>
        <StoreFooter store={{ name: 'Store' } as any} />
      </CartProvider>
    </StorefrontShell>
  );
}
